function withStableOrder(order) {
  if (!Array.isArray(order) || order.length === 0) return order;
  if (order.some((entry) => Array.isArray(entry) && entry.length === 2 && entry[0] === 'id')) return order;
  const last = order[order.length - 1];
  const direction = Array.isArray(last) && /^(ASC|DESC)$/i.test(String(last[last.length - 1])) ? String(last[last.length - 1]).toUpperCase() : 'ASC';
  return [...order, ['id', direction]];
}

function createTenantScopedRepository(model) {
  function requireTenantId(tenantId) {
    if (!tenantId) {
      throw new Error(`tenantScopedRepository(${model.name}): tenantId is required`);
    }
  }

  function scopedWhere(tenantId, where) {
    requireTenantId(tenantId);
    return { ...where, tenantId };
  }

  return {
    findAll: (tenantId, options = {}) =>
      model.findAll({ ...options, where: scopedWhere(tenantId, options.where) }),

    findAndCountAll: (tenantId, options = {}) =>
      model.findAndCountAll({ ...options, where: scopedWhere(tenantId, options.where), ...(options.order ? { order: withStableOrder(options.order) } : {}) }),

    findOne: (tenantId, options = {}) =>
      model.findOne({ ...options, where: scopedWhere(tenantId, options.where) }),

    findByPk: (tenantId, id, options = {}) =>
      model.findOne({ ...options, where: scopedWhere(tenantId, { ...options.where, id }) }),

    create: (tenantId, data, options = {}) => {
      requireTenantId(tenantId);
      return model.create({ ...data, tenantId }, options);
    },

    update: async (tenantId, id, data, options = {}) => {
      const [affected] = await model.update(data, {
        ...options,
        where: scopedWhere(tenantId, { id }),
      });
      return affected;
    },
  };
}

module.exports = { createTenantScopedRepository };
