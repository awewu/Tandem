class BaseRepository {
  constructor(model, options = {}) {
    if (!model) throw new Error('BaseRepository requires a mongoose model');
    this.model = model;
    this.tenantScoped = options.tenantScoped !== false;
    this.defaultLimit = options.defaultLimit || 20;
    this.maxLimit = options.maxLimit || 100;
  }

  requireTenant(scope) {
    if (!scope || !scope.tenantId) {
      throw new Error('tenantId is required for tenant-scoped repository operations');
    }
    return scope.tenantId;
  }

  withTenant(scope, query = {}) {
    if (!this.tenantScoped) return { ...query };
    const tenantId = this.requireTenant(scope);
    return { ...query, tenantId };
  }

  sanitizeTenantUpdate(scope, update = {}) {
    const base = { ...update };
    const setPayload = { ...(base.$set || {}) };
    const setOnInsert = { ...(base.$setOnInsert || {}) };

    delete base.$set;
    delete base.$setOnInsert;
    delete base.tenantId;
    delete setPayload.tenantId;
    delete setOnInsert.tenantId;

    for (const [key, value] of Object.entries(base)) {
      if (key.startsWith('$')) continue;
      setPayload[key] = value;
      delete base[key];
    }

    if (!this.tenantScoped) {
      return {
        ...base,
        ...(Object.keys(setOnInsert).length ? { $setOnInsert: setOnInsert } : {}),
        $set: {
          ...setPayload,
          updatedAt: new Date()
        }
      };
    }
    return {
      ...base,
      ...(Object.keys(setOnInsert).length ? { $setOnInsert: setOnInsert } : {}),
      $set: {
        ...setPayload,
        tenantId: this.requireTenant(scope),
        updatedAt: new Date()
      }
    };
  }

  async create(scope, data, options = {}) {
    const payload = this.tenantScoped
      ? { ...data, tenantId: this.requireTenant(scope) }
      : { ...data };
    return this.model.create([payload], options).then(items => items[0]);
  }

  async findById(scope, id, options = {}) {
    return this.model
      .findOne(this.withTenant(scope, { _id: id }), options.projection)
      .lean(options.lean !== false);
  }

  async findOne(scope, query = {}, options = {}) {
    return this.model
      .findOne(this.withTenant(scope, query), options.projection)
      .lean(options.lean !== false);
  }

  async list(scope, query = {}, options = {}) {
    const page = Math.max(parseInt(options.page || 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(options.limit || this.defaultLimit, 10), 1), this.maxLimit);
    const skip = (page - 1) * limit;
    const sort = options.sort || { updatedAt: -1 };
    const q = this.withTenant(scope, query);

    const [items, total] = await Promise.all([
      this.model.find(q, options.projection).sort(sort).skip(skip).limit(limit).lean(options.lean !== false),
      this.model.countDocuments(q)
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async updateById(scope, id, update = {}, options = {}) {
    const payload = this.sanitizeTenantUpdate(scope, update);
    return this.model
      .findOneAndUpdate(
        this.withTenant(scope, { _id: id }),
        payload,
        { new: true, ...options }
      )
      .lean(options.lean !== false);
  }
}

module.exports = BaseRepository;
