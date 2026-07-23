/**
 * FeedbackCollector - 用户反馈收集系统
 * 实现用户试用反馈收集、分析、跟踪
 * 
 * 112Agent-D并行任务 - L3质量版
 */

class FeedbackCollector {
  constructor(options = {}) {
    this.storage = options.storage || 'memory'; // memory, file, database
    this.feedbackDir = options.feedbackDir || './feedback';
    this.autoAnalyze = options.autoAnalyze !== false;
    
    this.feedback = [];
    this.categories = {
      bug: { priority: 'high', label: '缺陷' },
      feature: { priority: 'medium', label: '功能建议' },
      usability: { priority: 'medium', label: '易用性' },
      performance: { priority: 'high', label: '性能' },
      documentation: { priority: 'low', label: '文档' },
      other: { priority: 'low', label: '其他' }
    };
    
    this.satisfactionScores = [];
    this.npsScores = [];
  }

  // 收集反馈
  async collectFeedback(data) {
    const feedback = {
      id: `FB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: data.type || 'general',
      category: this.categorizeFeedback(data.content),
      priority: 'medium',
      status: 'new',
      
      // 用户信息
      user: {
        id: data.userId,
        role: data.userRole,
        company: data.company,
        contact: data.contact
      },
      
      // 反馈内容
      content: {
        title: data.title,
        description: data.content,
        context: data.context, // 使用场景
        expectation: data.expectation, // 期望结果
        actual: data.actual // 实际结果
      },
      
      // 环境信息
      environment: {
        browser: data.browser,
        os: data.os,
        screenResolution: data.screenResolution,
        timestamp: data.sessionTimestamp
      },
      
      // 满意度评分
      ratings: {
        overall: data.satisfaction, // 1-5
        usability: data.usability, // 1-5
        performance: data.performance, // 1-5
        nps: data.nps // 0-10
      },
      
      // 截图/附件
      attachments: data.attachments || [],
      
      // 自动分析结果
      analysis: null,
      
      // 处理记录
      processing: []
    };
    
    // 设置优先级
    feedback.priority = this.calculatePriority(feedback);
    
    // 自动分析
    if (this.autoAnalyze) {
      feedback.analysis = await this.analyzeFeedback(feedback);
    }
    
    // 保存
    this.feedback.push(feedback);
    await this.saveFeedback(feedback);
    
    // 更新统计数据
    this.updateStats(feedback);
    
    console.log(`[FeedbackCollector] 新反馈收集: ${feedback.id}`);
    console.log(`  - 类型: ${feedback.category}`);
    console.log(`  - 优先级: ${feedback.priority}`);
    
    return feedback;
  }

  // 分类反馈
  categorizeFeedback(content) {
    const text = (content || '').toLowerCase();
    
    if (text.includes('bug') || text.includes('错误') || text.includes('崩溃') || text.includes('exception')) {
      return 'bug';
    }
    if (text.includes('建议') || text.includes('希望') || text.includes('功能') || text.includes('feature')) {
      return 'feature';
    }
    if (text.includes('慢') || text.includes('卡') || text.includes('卡顿') || text.includes('性能')) {
      return 'performance';
    }
    if (text.includes('难用') || text.includes('不清楚') || text.includes(' confusing') || text.includes('不懂')) {
      return 'usability';
    }
    if (text.includes('文档') || text.includes('说明') || text.includes('help')) {
      return 'documentation';
    }
    
    return 'other';
  }

  // 计算优先级
  calculatePriority(feedback) {
    let score = 0;
    
    // 基础优先级
    const categoryPriority = {
      bug: 3,
      performance: 3,
      usability: 2,
      feature: 1,
      documentation: 1,
      other: 1
    };
    
    score += categoryPriority[feedback.category] || 1;
    
    // 用户角色权重
    const roleWeight = {
      rheem_official: 3,
      store_admin: 2,
      designer: 2,
      sales: 1,
      end_user: 1
    };
    
    score += roleWeight[feedback.user.role] || 1;
    
    // 满意度影响
    if (feedback.ratings.overall <= 2) score += 2;
    if (feedback.ratings.overall === 1) score += 1;
    
    // 转换为优先级
    if (score >= 6) return 'critical';
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  // 分析反馈
  async analyzeFeedback(feedback) {
    const analysis = {
      sentiment: this.analyzeSentiment(feedback.content.description),
      keywords: this.extractKeywords(feedback.content.description),
      relatedAreas: this.identifyRelatedAreas(feedback),
      suggestedAction: this.suggestAction(feedback),
      estimatedEffort: this.estimateEffort(feedback)
    };
    
    return analysis;
  }

  // 情感分析
  analyzeSentiment(text) {
    const positiveWords = ['好', '棒', '优秀', '满意', '喜欢', 'good', 'great', 'excellent', 'love', 'perfect'];
    const negativeWords = ['差', '糟糕', '失望', '不满意', '讨厌', 'bad', 'terrible', 'poor', 'hate', 'awful'];
    
    const words = (text || '').toLowerCase().split(/\s+/);
    
    let positive = 0;
    let negative = 0;
    
    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) positive++;
      if (negativeWords.some(nw => word.includes(nw))) negative++;
    }
    
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }

  // 提取关键词
  extractKeywords(text) {
    const commonWords = ['的', '了', '是', '在', '有', '和', '我', 'the', 'is', 'and', 'to', 'of'];
    const words = (text || '').split(/[\s,\.，。]+/).filter(w => w.length > 1);
    
    const frequency = {};
    for (const word of words) {
      if (!commonWords.includes(word.toLowerCase())) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    }
    
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  // 识别相关领域
  identifyRelatedAreas(feedback) {
    const areas = [];
    const text = (feedback.content.description || '').toLowerCase();
    
    if (text.includes('登录') || text.includes('auth') || text.includes('token')) {
      areas.push('authentication');
    }
    if (text.includes('cad') || text.includes('图纸') || text.includes('import')) {
      areas.push('cad-import');
    }
    if (text.includes('3d') || text.includes('渲染') || text.includes('render')) {
      areas.push('3d-rendering');
    }
    if (text.includes('报价') || text.includes('价格') || text.includes('quotation')) {
      areas.push('quotation');
    }
    if (text.includes('mqtt') || text.includes('设备') || text.includes('econet')) {
      areas.push('iot-integration');
    }
    
    return areas;
  }

  // 建议处理动作
  suggestAction(feedback) {
    const actions = {
      bug: '创建Bug ticket，分配给开发团队',
      performance: '进行性能分析，优化相关代码',
      usability: 'UX团队评估，改进交互设计',
      feature: '产品经理评估，加入需求池',
      documentation: '文档团队更新相关文档',
      other: '人工审核分类'
    };
    
    return actions[feedback.category] || '人工审核';
  }

  // 估算工作量
  estimateEffort(feedback) {
    const estimates = {
      bug: { min: 2, max: 8, unit: 'hours' },
      performance: { min: 4, max: 16, unit: 'hours' },
      usability: { min: 4, max: 12, unit: 'hours' },
      feature: { min: 8, max: 40, unit: 'hours' },
      documentation: { min: 1, max: 4, unit: 'hours' },
      other: { min: 1, max: 2, unit: 'hours' }
    };
    
    return estimates[feedback.category] || estimates.other;
  }

  // 保存反馈
  async saveFeedback(feedback) {
    // 根据存储类型保存
    switch (this.storage) {
      case 'file':
        await this.saveToFile(feedback);
        break;
      case 'database':
        await this.saveToDatabase(feedback);
        break;
      default:
        // 内存存储，已保存在this.feedback中
        break;
    }
  }

  async saveToFile(feedback) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const filepath = path.join(this.feedbackDir, `${feedback.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(feedback, null, 2));
  }

  async saveToDatabase(feedback) {
    // 数据库保存逻辑
    console.log(`[FeedbackCollector] 保存到数据库: ${feedback.id}`);
  }

  // 更新统计
  updateStats(feedback) {
    if (feedback.ratings.overall) {
      this.satisfactionScores.push(feedback.ratings.overall);
    }
    if (feedback.ratings.nps !== undefined) {
      this.npsScores.push(feedback.ratings.nps);
    }
  }

  // 处理反馈状态更新
  async updateStatus(feedbackId, status, processor, notes) {
    const feedback = this.feedback.find(f => f.id === feedbackId);
    if (!feedback) return null;
    
    feedback.status = status;
    feedback.processing.push({
      timestamp: new Date().toISOString(),
      status,
      processor,
      notes
    });
    
    await this.saveFeedback(feedback);
    
    return feedback;
  }

  // 获取反馈列表
  getFeedbackList(filters = {}) {
    let list = [...this.feedback];
    
    if (filters.category) {
      list = list.filter(f => f.category === filters.category);
    }
    
    if (filters.priority) {
      list = list.filter(f => f.priority === filters.priority);
    }
    
    if (filters.status) {
      list = list.filter(f => f.status === filters.status);
    }
    
    if (filters.userRole) {
      list = list.filter(f => f.user.role === filters.userRole);
    }
    
    // 排序
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return list;
  }

  // 获取统计报告
  getStatistics() {
    const now = new Date();
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    const recentFeedback = this.feedback.filter(f => new Date(f.timestamp) > oneWeekAgo);
    
    // 计算NPS
    const nps = this.calculateNPS();
    
    // 计算满意度
    const satisfaction = this.calculateSatisfaction();
    
    // 分类统计
    const byCategory = {};
    for (const f of recentFeedback) {
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    }
    
    // 优先级统计
    const byPriority = {};
    for (const f of recentFeedback) {
      byPriority[f.priority] = (byPriority[f.priority] || 0) + 1;
    }
    
    return {
      summary: {
        total: this.feedback.length,
        recent: recentFeedback.length,
        unresolved: this.feedback.filter(f => f.status === 'new' || f.status === 'in-progress').length
      },
      nps,
      satisfaction,
      byCategory,
      byPriority,
      trends: this.calculateTrends()
    };
  }

  calculateNPS() {
    if (this.npsScores.length === 0) return null;
    
    const promoters = this.npsScores.filter(s => s >= 9).length;
    const detractors = this.npsScores.filter(s => s <= 6).length;
    const total = this.npsScores.length;
    
    return Math.round(((promoters - detractors) / total) * 100);
  }

  calculateSatisfaction() {
    if (this.satisfactionScores.length === 0) return null;
    
    const avg = this.satisfactionScores.reduce((a, b) => a + b, 0) / this.satisfactionScores.length;
    return Math.round(avg * 10) / 10;
  }

  calculateTrends() {
    // 计算反馈趋势
    const daily = {};
    
    for (const f of this.feedback) {
      const date = f.timestamp.split('T')[0];
      daily[date] = (daily[date] || 0) + 1;
    }
    
    return Object.entries(daily)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7);
  }

  // 获取反馈详情
  getFeedback(id) {
    return this.feedback.find(f => f.id === id);
  }

  // 导出反馈数据
  exportData(format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.feedback, null, 2);
      case 'csv':
        return this.convertToCSV();
      default:
        return this.feedback;
    }
  }

  convertToCSV() {
    const headers = ['ID', 'Timestamp', 'Category', 'Priority', 'Status', 'User Role', 'Satisfaction', 'Title'];
    
    const rows = this.feedback.map(f => [
      f.id,
      f.timestamp,
      f.category,
      f.priority,
      f.status,
      f.user.role,
      f.ratings.overall,
      f.content.title
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = FeedbackCollector;
