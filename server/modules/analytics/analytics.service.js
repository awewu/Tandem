class AnalyticsService {
  constructor(options = {}) {
    this.memoryDb = options.db || options.memoryDb || null;
    this.dealerModel = options.dealerModel || require('../../models/Dealer');
    this.storeModel = options.storeModel || require('../../models/Store');
    this.userModel = options.userModel || require('../../models/UserV2');
    this.customerModel = options.customerModel || require('../../models/CustomerV2');
    this.opportunityModel = options.opportunityModel || require('../../models/Opportunity');
  }

  buildScopeMatch(scope = {}, filters = {}) {
    if (!scope.tenantId) throw new Error('tenantId is required for analytics queries');

    const match = { tenantId: scope.tenantId };
    const isHqScope = scope.role === 'platform_admin' || scope.role === 'hq_admin';

    if (filters.dealerId) match.dealerId = filters.dealerId;
    if (filters.storeId) match.storeId = filters.storeId;

    if (!isHqScope) {
      if (scope.dealerId) match.dealerId = scope.dealerId;
      if (scope.storeId) match.storeId = scope.storeId;
    }

    return match;
  }

  async getOverview(scope, filters = {}) {
    if (this.shouldUseMemoryMode()) return this.getMemoryOverview(scope, filters);

    const match = this.buildScopeMatch(scope, filters);
    const tenantMatch = { tenantId: scope.tenantId };

    const [dealerCount, storeCount, staffCount, customerCount, opportunitySummary, dealerPerformance] = await Promise.all([
      this.dealerModel.countDocuments(match.dealerId ? { ...tenantMatch, _id: match.dealerId } : tenantMatch),
      this.storeModel.countDocuments(match),
      this.userModel.countDocuments(match),
      this.customerModel.countDocuments(match),
      this.opportunityModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            amount: { $sum: '$estimatedValue' }
          }
        }
      ]),
      this.opportunityModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$dealerId',
            opportunityCount: { $sum: 1 },
            estimatedPipeline: { $sum: '$estimatedValue' },
            wonCount: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
            quotedCount: { $sum: { $cond: [{ $eq: ['$stage', 'quoted'] }, 1, 0] } }
          }
        },
        { $sort: { estimatedPipeline: -1 } },
        { $limit: 20 }
      ])
    ]);

    const pipeline = opportunitySummary.reduce((sum, item) => sum + (item.amount || 0), 0);
    const won = opportunitySummary.find(item => item._id === 'won');
    const quoted = opportunitySummary.find(item => item._id === 'quoted');

    return {
      scope: {
        tenantId: scope.tenantId,
        dealerId: match.dealerId || null,
        storeId: match.storeId || null,
        role: scope.role || null,
        visibility: scope.role === 'platform_admin' || scope.role === 'hq_admin' ? 'tenant-wide' : 'dealer-scoped'
      },
      totals: {
        dealers: dealerCount,
        stores: storeCount,
        staff: staffCount,
        customers: customerCount,
        pipeline,
        wonAmount: won ? won.amount : 0,
        quotedAmount: quoted ? quoted.amount : 0
      },
      stages: opportunitySummary.reduce((acc, item) => {
        acc[item._id] = {
          count: item.count,
          amount: item.amount
        };
        return acc;
      }, {}),
      dealerPerformance,
      generatedAt: new Date().toISOString()
    };
  }

  shouldUseMemoryMode() {
    return Boolean(this.memoryDb && !process.env.MONGODB_URI);
  }

  getMemoryOverview(scope, filters = {}) {
    const match = this.buildScopeMatch(scope, filters);
    const customers = this.memoryDb.customers || [];
    const users = this.memoryDb.users || [];
    const quotes = this.memoryDb.quotes || [];
    const contracts = this.memoryDb.contracts || [];
    const stores = [...new Set(users.map(user => user.storeId).filter(Boolean))];

    const pipeline = quotes.reduce((sum, quote) => sum + Number(quote.totalPrice || 0), 0);
    const wonContracts = contracts.filter(contract => contract.status === 'completed');
    const quoted = quotes.filter(quote => quote.status !== 'approved');
    const wonAmount = wonContracts.reduce((sum, contract) => sum + Number(contract.totalPrice || 0), 0);
    const quotedAmount = quoted.reduce((sum, quote) => sum + Number(quote.totalPrice || 0), 0);

    return {
      scope: {
        tenantId: scope.tenantId,
        dealerId: match.dealerId || null,
        storeId: match.storeId || null,
        role: scope.role || null,
        visibility: scope.role === 'platform_admin' || scope.role === 'hq_admin' ? 'tenant-wide' : 'dealer-scoped'
      },
      totals: {
        dealers: 1,
        stores: stores.length || 1,
        staff: users.filter(user => user.role !== 'end_user').length,
        customers: customers.length,
        pipeline,
        wonAmount,
        quotedAmount
      },
      stages: {
        quoted: { count: quoted.length, amount: quotedAmount },
        won: { count: wonContracts.length, amount: wonAmount }
      },
      dealerPerformance: [{
        dealerId: match.dealerId || 'demo-dealer',
        opportunityCount: quotes.length,
        estimatedPipeline: pipeline,
        wonCount: wonContracts.length,
        quotedCount: quoted.length
      }],
      generatedAt: new Date().toISOString(),
      storageMode: 'memory'
    };
  }
}

module.exports = AnalyticsService;
