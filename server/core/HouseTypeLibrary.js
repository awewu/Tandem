/**
 * HouseTypeLibrary - 户型库管理引擎
 * Q2-W1-2 任务: 户型库快速扩张（20→50种）
 *
 * 功能：
 * - 户型数据加载与缓存
 * - 多维度搜索筛选
 * - 智能推荐匹配
 * - 户型对比分析
 */

const fs = require('fs');
const path = require('path');

class HouseTypeLibrary {
  constructor(dataPath) {
    this.dataPath = dataPath || path.join(__dirname, '../../database/house-types.json');
    this.houseTypes = [];
    this.indexByType = new Map();
    this.indexByArea = new Map();
    this.loadData();
  }

  loadData() {
    try {
      const raw = fs.readFileSync(this.dataPath, 'utf-8');
      this.houseTypes = JSON.parse(raw);
      this.buildIndexes();
      console.log(`[HouseTypeLibrary] 加载完成: ${this.houseTypes.length}种户型`);
    } catch (err) {
      console.error('[HouseTypeLibrary] 数据加载失败:', err.message);
      this.houseTypes = [];
    }
  }

  buildIndexes() {
    this.indexByType.clear();
    this.indexByArea.clear();
    for (const ht of this.houseTypes) {
      if (!this.indexByType.has(ht.type)) this.indexByType.set(ht.type, []);
      this.indexByType.get(ht.type).push(ht);

      const areaBucket = this.getAreaBucket(ht.area);
      if (!this.indexByArea.has(areaBucket)) this.indexByArea.set(areaBucket, []);
      this.indexByArea.get(areaBucket).push(ht);
    }
  }

  getAreaBucket(area) {
    if (area < 60) return 'mini';
    if (area < 90) return 'small';
    if (area < 130) return 'medium';
    if (area < 180) return 'large';
    if (area < 250) return 'xlarge';
    return 'villa';
  }

  getAll() {
    return this.houseTypes;
  }

  getById(id) {
    return this.houseTypes.find(h => h.id === id);
  }

  getByType(type) {
    return this.indexByType.get(type) || [];
  }

  getByAreaRange(minArea, maxArea) {
    return this.houseTypes.filter(h => h.area >= minArea && h.area <= maxArea);
  }

  /**
   * 多维度搜索
   * @param {Object} query - {type, areaMin, areaMax, bedrooms, bathrooms, keywords}
   */
  search(query = {}) {
    let results = [...this.houseTypes];

    if (query.type) {
      results = results.filter(h => h.type === query.type);
    }
    if (query.areaMin != null) {
      results = results.filter(h => h.area >= query.areaMin);
    }
    if (query.areaMax != null) {
      results = results.filter(h => h.area <= query.areaMax);
    }
    if (query.bedrooms != null) {
      results = results.filter(h => h.rooms.bedrooms === query.bedrooms);
    }
    if (query.bathrooms != null) {
      results = results.filter(h => h.rooms.bathrooms >= query.bathrooms);
    }
    if (query.floors != null) {
      results = results.filter(h => h.floors === query.floors);
    }
    if (query.keywords) {
      const kw = query.keywords.toLowerCase();
      results = results.filter(h =>
        h.name.toLowerCase().includes(kw) ||
        h.layout.toLowerCase().includes(kw)
      );
    }
    return results;
  }

  /**
   * 智能推荐：根据客户画像推荐最匹配的户型
   */
  recommend(profile = {}) {
    const { area, bedrooms, demographic, painPoints = [] } = profile;
    const scored = this.houseTypes.map(ht => {
      let score = 0;
      if (area && Math.abs(ht.area - area) < 20) score += 30;
      if (bedrooms && ht.rooms.bedrooms === bedrooms) score += 25;
      if (demographic && ht.targetDemographics.includes(demographic)) score += 20;
      const overlap = painPoints.filter(p => ht.commonPainPoints.includes(p)).length;
      score += overlap * 10;
      return { houseType: ht, score };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * 统计信息
   */
  getStatistics() {
    const stats = {
      total: this.houseTypes.length,
      byType: {},
      byAreaBucket: {},
      avgArea: 0,
      areaRange: { min: Infinity, max: 0 }
    };
    let sumArea = 0;
    for (const ht of this.houseTypes) {
      stats.byType[ht.type] = (stats.byType[ht.type] || 0) + 1;
      const bucket = this.getAreaBucket(ht.area);
      stats.byAreaBucket[bucket] = (stats.byAreaBucket[bucket] || 0) + 1;
      sumArea += ht.area;
      if (ht.area < stats.areaRange.min) stats.areaRange.min = ht.area;
      if (ht.area > stats.areaRange.max) stats.areaRange.max = ht.area;
    }
    stats.avgArea = Math.round(sumArea / this.houseTypes.length);
    return stats;
  }

  /**
   * 户型对比
   */
  compare(ids = []) {
    const items = ids.map(id => this.getById(id)).filter(Boolean);
    if (items.length < 2) return null;
    return {
      items,
      comparison: {
        areas: items.map(h => h.area),
        bedrooms: items.map(h => h.rooms.bedrooms),
        bathrooms: items.map(h => h.rooms.bathrooms),
        types: items.map(h => h.type)
      }
    };
  }

  /**
   * 户型库统计 (前端 house-type-library.html 调用)
   * @returns {Object} { total, avgArea, areaRange:{min,max}, byType, byBedrooms, byFloors }
   */
  getStats() {
    const list = this.houseTypes || [];
    const total = list.length;
    if (total === 0) {
      return { total: 0, avgArea: 0, areaRange: { min: 0, max: 0 }, byType: {}, byBedrooms: {}, byFloors: {} };
    }
    const areas = list.map(h => Number(h.area) || 0);
    const sumArea = areas.reduce((s, v) => s + v, 0);
    const avgArea = Math.round(sumArea / total);
    const areaRange = { min: Math.min(...areas), max: Math.max(...areas) };

    const tally = (arr, fn) => arr.reduce((acc, h) => {
      const k = fn(h); if (k == null) return acc;
      acc[k] = (acc[k] || 0) + 1; return acc;
    }, {});

    return {
      total,
      avgArea,
      areaRange,
      byType:     tally(list, h => h.type),
      byBedrooms: tally(list, h => h.rooms && h.rooms.bedrooms),
      byFloors:   tally(list, h => h.floors)
    };
  }
}

module.exports = HouseTypeLibrary;
