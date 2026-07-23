const BaseRepository = require('../../repositories/BaseRepository');
const Project = require('../../models/Project');

class ProjectsService {
  constructor(options = {}) {
    this.repo = options.repo || new BaseRepository(Project);
  }

  list(scope, query = {}) {
    const filters = {};
    if (query.status && query.status !== 'all') filters.status = query.status;
    if (query.search) filters.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { 'customer.name': { $regex: query.search, $options: 'i' } }
    ];
    return this.repo.list(scope, filters, { page: query.page, limit: query.limit });
  }

  create(scope, data) {
    return this.repo.create(scope, { ...data, status: data.status || 'draft', ownerUserId: scope.userId });
  }

  get(scope, id) {
    return this.repo.findById(scope, id);
  }

  update(scope, id, data) {
    return this.repo.updateById(scope, id, data);
  }

  async delete(scope, id) {
    await Project.findOneAndDelete({ _id: id, tenantId: scope.tenantId });
    return { id, deleted: true };
  }

  async stats(scope) {
    const [active, quoted, delivered] = await Promise.all([
      Project.countDocuments({ tenantId: scope.tenantId, status: 'designing' }),
      Project.countDocuments({ tenantId: scope.tenantId, status: 'review' }),
      Project.countDocuments({ tenantId: scope.tenantId, status: 'completed' })
    ]);
    return { active, quoted, delivered };
  }
}

module.exports = ProjectsService;
