const BaseRepository = require('../../repositories/BaseRepository');
const Device = require('../../models/Device');

class DevicesService {
  constructor(options = {}) {
    this.repo = new BaseRepository(Device, { tenantScoped: false }); // 设备库全局共享
  }

  list(scope, query = {}) {
    const filters = { status: 'active' };
    if (query.system && query.system !== 'all') filters.system = query.system;
    if (query.brand === 'rheem') filters.isRheem = true;
    else if (query.brand === 'third') filters.isRheem = false;
    if (query.search) filters.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { model: { $regex: query.search, $options: 'i' } }
    ];
    return this.repo.list(scope, filters, { page: query.page, limit: query.limit, sort: { isRheem: -1, name: 1 } });
  }

  get(scope, id) {
    return this.repo.findById(scope, id);
  }

  search(scope, query) {
    return this.list(scope, { search: query });
  }

  async categoriesStats() {
    const agg = await Device.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$system', count: { $sum: 1 } } }
    ]);
    return Object.fromEntries(agg.map(r => [r._id, r.count]));
  }
}

module.exports = DevicesService;
