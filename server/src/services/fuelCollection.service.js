const { Op, Transaction } = require('sequelize');

const { sequelize, FuelCollection, FuelCollectionContainer, FuelStation, Vehicle, Site } = require('../models');
const AppError = require('../utils/AppError');
const { requireText, optionalText, requireNumber, optionalNumber } = require('../utils/validation');
const { parseListQuery, parseEnumFilter } = require('../utils/queryOptions');
const { buildListResponse } = require('../utils/listResponse');
const { createTenantScopedRepository } = require('./tenantScopedRepository');
const { recordAudit, recordCreate, recordUpdate } = require('./audit.service');
const { assertSiteAllowed, supervisorSiteId } = require('./siteAccess');
const { assertSiteAssignable } = require('./site.service');
const { nextSequentialCode, isCodeCollision } = require('./codeGenerator');
const { assertStationUsable } = require('./fuelStation.service');
const { postFuelMovement, siteScope } = require('./fuelStock.service');
const {
  roundQuantity,
  roundMoney,
  todayDateOnly,
  requireBusinessDate,
  optionalDateFilter,
  requirePositive,
  requireStorableFuelType,
} = require('./fuelCommon');

const repo = createTenantScopedRepository(FuelCollection);

const SORTABLE_FIELDS = ['createdAt', 'collectionDate', 'collectionNumber', 'amount'];
const DEFAULT_SORT = 'createdAt:desc';

const COLLECTION_NUMBER_PREFIX = 'FC-';
const COLLECTION_NUMBER_GENERATION_ATTEMPTS = 5;
const MAX_CONTAINER_ROWS = 20;

const INCLUDE_DETAILS = [
  { model: Site, as: 'site', attributes: ['id', 'name'] },
  { model: FuelStation, as: 'fuelStation', attributes: ['id', 'stationName'] },
  { model: Vehicle, as: 'carrierVehicle', attributes: ['id', 'assetId', 'registrationNumber'] },
  { model: FuelCollectionContainer, as: 'containers' },
];

function toPublic(collection) {
  return {
    ...collection.toPublicJSON(),
    siteName: collection.site?.name ?? null,
    fuelStationName: collection.fuelStation?.stationName ?? null,
    carrierAssetId: collection.carrierVehicle?.assetId ?? null,
    carrierLabel: collection.carrierVehicle?.registrationNumber ?? null,
    containers: (collection.containers ?? [])
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((container) => container.toPublicJSON()),
  };
}

function readContainers(rawContainers) {
  if (!Array.isArray(rawContainers) || rawContainers.length === 0) {
    throw AppError.badRequest('Add at least one row of cans (number of cans × litres in each)');
  }
  if (rawContainers.length > MAX_CONTAINER_ROWS) {
    throw AppError.badRequest(`A collection can have at most ${MAX_CONTAINER_ROWS} rows of cans`);
  }
  return rawContainers.map((raw, index) => {
    const label = `Cans row ${index + 1}`;
    const containerCount = requireNumber(raw?.containerCount, `${label}: number of cans`, { min: 1 });
    if (!Number.isInteger(containerCount)) {
      throw AppError.badRequest(`${label}: number of cans must be a whole number`);
    }
    const litresPerContainer = roundQuantity(requirePositive(raw?.litresPerContainer, `${label}: litres in each can`));
    return { containerCount, litresPerContainer };
  });
}

function readCollectionInput(payload) {
  const containers = readContainers(payload.containers);
  const quantity = roundQuantity(containers.reduce((sum, c) => sum + c.containerCount * c.litresPerContainer, 0));
  const pricePerLitre = roundMoney(requirePositive(payload.pricePerLitre, 'Price per litre'));

  return {
    fields: {
      fuelStationId: requireNumber(payload.fuelStationId, 'Fuel station', { min: 1 }),
      fuelType: requireStorableFuelType(payload.fuelType),
      collectionDate: requireBusinessDate(payload.collectionDate, 'Collection date'),
      quantity,
      pricePerLitre,
      amount: roundMoney(quantity * pricePerLitre),
      billNumber: optionalText(payload.billNumber, 'Bill number', { max: 64 }),
      driverName: optionalText(payload.driverName, 'Driver name', { max: 150 }),
      notes: optionalText(payload.notes, 'Notes', { max: 2000 }),
    },
    carrierAssetId: requireText(payload.carrierAssetId, 'Carrier vehicle', { max: 64 }),
    containers,
  };
}

async function resolveCarrier(tenantId, carrierAssetId, siteId) {
  const vehicle = await Vehicle.findOne({ where: { tenantId, assetId: carrierAssetId } });
  if (!vehicle) throw AppError.badRequest('Carrier vehicle not found');
  if (vehicle.status !== 'active') throw AppError.badRequest('The carrier vehicle is archived and cannot be used');
  if (Number(vehicle.currentSiteId) !== Number(siteId)) {
    throw AppError.badRequest('The carrier vehicle must be a vehicle at this site');
  }
  return vehicle;
}

async function findVisible(tenantId, auth, id, options = {}) {
  const collection = await repo.findByPk(tenantId, id, options);
  if (!collection) throw AppError.notFound('Fuel collection not found');
  assertSiteAllowed(auth, collection.siteId, 'Fuel collection not found');
  return collection;
}

async function listFuelCollections({ tenantId, auth, query }) {
  const { page, limit, offset, order } = parseListQuery(query, {
    sortableFields: SORTABLE_FIELDS,
    defaultSort: DEFAULT_SORT,
  });

  const where = { ...siteScope(auth, query) };
  const status = parseEnumFilter(query.status, FuelCollection.STATUSES, 'Status');
  if (status) where.status = status;
  const fuelType = parseEnumFilter(query.fuelType, FuelCollection.FUEL_TYPES, 'Fuel type');
  if (fuelType) where.fuelType = fuelType;
  if (query.fuelStationId) where.fuelStationId = Number(query.fuelStationId);

  if (query.carrierAssetId) {
    const carrier = await Vehicle.findOne({ where: { tenantId, assetId: String(query.carrierAssetId) }, attributes: ['id'] });
    where.carrierVehicleId = carrier ? carrier.id : 0;
  }

  const dateFrom = optionalDateFilter(query.dateFrom, 'From date');
  const dateTo = optionalDateFilter(query.dateTo, 'To date');
  if (dateFrom || dateTo) {
    where.collectionDate = {};
    if (dateFrom) where.collectionDate[Op.gte] = dateFrom;
    if (dateTo) where.collectionDate[Op.lte] = dateTo;
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    where[Op.or] = [{ collectionNumber: { [Op.like]: `%${search}%` } }, { billNumber: { [Op.like]: `%${search}%` } }];
  }

  const { rows, count } = await repo.findAndCountAll(tenantId, {
    where,
    include: INCLUDE_DETAILS,
    order: [...order, ['id', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return buildListResponse(rows.map(toPublic), { page, limit, total: count });
}

async function getFuelCollection({ tenantId, auth, id }) {
  const collection = await findVisible(tenantId, auth, id, { include: INCLUDE_DETAILS });
  return toPublic(collection);
}

async function createFuelCollection({ tenantId, auth, actingUserId, payload }) {
  const ownSiteId = supervisorSiteId(auth);
  const siteId = ownSiteId !== null ? ownSiteId : optionalNumber(payload.siteId, 'Site', { min: 1 });
  if (siteId == null) throw AppError.badRequest('Site is required');
  await assertSiteAssignable(tenantId, siteId);

  const { fields, carrierAssetId, containers } = readCollectionInput(payload);
  await assertStationUsable(tenantId, fields.fuelStationId);
  const carrier = await resolveCarrier(tenantId, carrierAssetId, siteId);

  const created = await sequelize.transaction(async (transaction) => {
    let collection;
    for (let attempt = 1; attempt <= COLLECTION_NUMBER_GENERATION_ATTEMPTS; attempt += 1) {
      const collectionNumber = await nextSequentialCode(FuelCollection, 'collectionNumber', COLLECTION_NUMBER_PREFIX, {
        tenantId,
        transaction,
      });
      try {
        collection = await repo.create(
          tenantId,
          {
            ...fields,
            siteId,
            carrierVehicleId: carrier.id,
            collectionNumber,
            status: 'in_transit',
            createdBy: actingUserId,
            updatedBy: actingUserId,
          },
          { transaction }
        );
        break;
      } catch (error) {
        const isLastAttempt = attempt === COLLECTION_NUMBER_GENERATION_ATTEMPTS;
        if (!isCodeCollision(error, 'uq_fuel_collections_tenant_number') || isLastAttempt) throw error;
      }
    }

    await FuelCollectionContainer.bulkCreate(
      containers.map((c) => ({ ...c, tenantId, collectionId: collection.id })),
      { transaction }
    );

    await recordCreate(
      { tenantId, entityType: 'FuelCollection', entityId: collection.id, performedBy: actingUserId, after: collection },
      { transaction }
    );

    return collection;
  });

  return getFuelCollection({ tenantId, auth, id: created.id });
}

async function updateFuelCollection({ tenantId, auth, actingUserId, id, payload }) {
  const collection = await findVisible(tenantId, auth, id);
  if (collection.status !== 'in_transit') {
    throw AppError.conflict('Only a collection that is still in transit can be edited');
  }

  const { fields, carrierAssetId, containers } = readCollectionInput(payload);
  await assertStationUsable(tenantId, fields.fuelStationId);
  const carrier = await resolveCarrier(tenantId, carrierAssetId, collection.siteId);

  await sequelize.transaction(async (transaction) => {
    const locked = await FuelCollection.findOne({
      where: { tenantId, id: collection.id },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (locked.status !== 'in_transit') {
      throw AppError.conflict('Only a collection that is still in transit can be edited');
    }

    const before = locked.toJSON();
    await locked.update({ ...fields, carrierVehicleId: carrier.id, updatedBy: actingUserId }, { transaction });
    await FuelCollectionContainer.destroy({ where: { tenantId, collectionId: locked.id }, transaction });
    await FuelCollectionContainer.bulkCreate(
      containers.map((c) => ({ ...c, tenantId, collectionId: locked.id })),
      { transaction }
    );

    await recordUpdate(
      { tenantId, entityType: 'FuelCollection', entityId: locked.id, performedBy: actingUserId, before, after: locked },
      { transaction }
    );
  });

  return getFuelCollection({ tenantId, auth, id: collection.id });
}

async function receiveFuelCollection({ tenantId, auth, actingUserId, id, payload }) {
  const collection = await findVisible(tenantId, auth, id);

  const receivedQuantity = roundQuantity(requireNumber(payload?.receivedQuantity, 'Litres received', { min: 0 }));
  const receivedDate =
    payload?.receivedDate === undefined || payload?.receivedDate === ''
      ? todayDateOnly()
      : requireBusinessDate(payload.receivedDate, 'Received date');
  const receiptNotes = optionalText(payload?.receiptNotes, 'Notes', { max: 2000 });

  await sequelize.transaction(async (transaction) => {
    const locked = await FuelCollection.findOne({
      where: { tenantId, id: collection.id },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (locked.status === 'received') throw AppError.conflict('This collection has already been received');
    if (locked.status === 'cancelled') throw AppError.conflict('This collection was cancelled and cannot be received');

    const collected = Number(locked.quantity);
    if (receivedQuantity > collected) {
      throw AppError.badRequest(
        `Litres received can't be more than the ${collected.toLocaleString('en-IN')} L collected`
      );
    }
    if (receivedDate < locked.collectionDate) {
      throw AppError.badRequest('The received date cannot be before the collection date');
    }

    const price = Number(locked.pricePerLitre);
    const receiptValue = roundMoney(receivedQuantity * price);
    const shortageQuantity = roundQuantity(collected - receivedQuantity);
    const shortageValue = roundMoney(Number(locked.amount) - receiptValue);

    if (receivedQuantity > 0) {
      await postFuelMovement({
        tenantId,
        siteId: locked.siteId,
        fuelType: locked.fuelType,
        entryType: 'RECEIPT',
        direction: 'IN',
        quantity: receivedQuantity,
        unitCost: price,
        totalCost: receiptValue,
        entryDate: receivedDate,
        referenceType: 'FUEL_COLLECTION',
        referenceId: locked.id,
        createdBy: actingUserId,
        transaction,
      });
    }

    await locked.update(
      {
        status: 'received',
        receivedDate,
        receivedQuantity,
        shortageQuantity,
        shortageValue,
        receiptNotes,
        receivedBy: actingUserId,
        updatedBy: actingUserId,
      },
      { transaction }
    );

    await recordAudit(
      {
        tenantId,
        entityType: 'FuelCollection',
        entityId: locked.id,
        action: 'RECEIVED',
        before: { status: 'in_transit' },
        after: { status: 'received', receivedDate, receivedQuantity, shortageQuantity, shortageValue },
        performedBy: actingUserId,
      },
      { transaction }
    );
  });

  return getFuelCollection({ tenantId, auth, id: collection.id });
}

async function cancelFuelCollection({ tenantId, auth, actingUserId, id, confirmation }) {
  if (confirmation !== 'DELETE') {
    throw AppError.badRequest('Type DELETE to confirm this action.');
  }

  const collection = await findVisible(tenantId, auth, id);

  await sequelize.transaction(async (transaction) => {
    const locked = await FuelCollection.findOne({
      where: { tenantId, id: collection.id },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (locked.status === 'received') {
      throw AppError.conflict(
        "A received collection can't be cancelled — its fuel is already in site stock. Record a stock adjustment instead."
      );
    }
    if (locked.status === 'cancelled') throw AppError.conflict('This collection is already cancelled');

    await locked.update(
      { status: 'cancelled', cancelledAt: new Date(), cancelledBy: actingUserId, updatedBy: actingUserId },
      { transaction }
    );

    await recordAudit(
      {
        tenantId,
        entityType: 'FuelCollection',
        entityId: locked.id,
        action: 'CANCELLED',
        before: { status: 'in_transit' },
        after: { status: 'cancelled' },
        performedBy: actingUserId,
      },
      { transaction }
    );
  });

  return getFuelCollection({ tenantId, auth, id: collection.id });
}

module.exports = {
  listFuelCollections,
  getFuelCollection,
  createFuelCollection,
  updateFuelCollection,
  receiveFuelCollection,
  cancelFuelCollection,
};
