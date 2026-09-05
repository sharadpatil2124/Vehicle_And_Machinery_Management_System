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
      model.findAndCountAll({ ...options, where: scopedWhere(tenantId, options.where) }),

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
