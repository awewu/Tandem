/**
 * 户型库扩展脚本：50 → 100
 * 策略：补齐多样化类型，每种户型保持现有 schema，避免影响 HouseTypeLibrary 索引
 *   - 新增 5 种 type: penthouse / mansion / compact / single_family / courtyard
 *   - 覆盖面积区间：35㎡ 起始公寓 → 600㎡ 大别墅
 *   - 多元痛点 + 客群标签，便于推荐打分
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'house-types.json');
const existing = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const startIndex = existing.length; // 50

// ---- 新户型蓝图（50 个）----
const blueprints = [
  // ---- 紧凑型公寓 (compact) 35-55㎡ × 8 个 ----
  { type: 'compact',  name: '单身公寓-Loft 35㎡',          area: 35,  floors: 2, beds: 1, baths: 1, livings: 1, demos: ['single', 'student'], pains: ['hot_water_insufficient'] },
  { type: 'compact',  name: '青年公寓 40㎡',                 area: 40,  floors: 1, beds: 1, baths: 1, livings: 1, demos: ['single', 'young_couple'], pains: ['cooling_uneven'] },
  { type: 'compact',  name: '一居室 42㎡',                    area: 42,  floors: 1, beds: 1, baths: 1, livings: 1, demos: ['single'], pains: ['humidity'] },
  { type: 'compact',  name: '小一居 45㎡',                    area: 45,  floors: 1, beds: 1, baths: 1, livings: 1, demos: ['single', 'young_couple'], pains: ['noise', 'cooling_uneven'] },
  { type: 'compact',  name: '紧凑两居 48㎡',                  area: 48,  floors: 1, beds: 2, baths: 1, livings: 1, demos: ['young_couple'], pains: ['hot_water_insufficient', 'cooling_uneven'] },
  { type: 'compact',  name: '小复式 50㎡',                    area: 50,  floors: 2, beds: 1, baths: 1, livings: 1, demos: ['single'], pains: ['humidity'] },
  { type: 'compact',  name: '精致两居 52㎡',                  area: 52,  floors: 1, beds: 2, baths: 1, livings: 1, demos: ['young_couple'], pains: ['cooling_uneven'] },
  { type: 'compact',  name: '小户两居 55㎡',                  area: 55,  floors: 1, beds: 2, baths: 1, livings: 1, demos: ['young_couple', 'small_family'], pains: ['hot_water_insufficient'] },

  // ---- 公寓补齐 (apartment) 60-130㎡ × 10 个 ----
  { type: 'apartment', name: '舒适两居 75㎡',                 area: 75,  floors: 1, beds: 2, baths: 1, livings: 1, demos: ['young_couple', 'small_family'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'apartment', name: '现代三居 95㎡',                 area: 95,  floors: 1, beds: 3, baths: 1, livings: 1, demos: ['small_family'], pains: ['hot_water_insufficient', 'cooling_uneven'] },
  { type: 'apartment', name: '精装三居 100㎡',                area: 100, floors: 1, beds: 3, baths: 2, livings: 1, demos: ['small_family'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'apartment', name: '改善三居 110㎡',                area: 110, floors: 1, beds: 3, baths: 2, livings: 1, demos: ['family_with_kids'], pains: ['noise', 'humidity'] },
  { type: 'apartment', name: '舒适三居 118㎡',                area: 118, floors: 1, beds: 3, baths: 2, livings: 1, demos: ['family_with_kids'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'apartment', name: '南北通透三居 125㎡',            area: 125, floors: 1, beds: 3, baths: 2, livings: 1, demos: ['family_with_kids'], pains: ['cooling_uneven'] },
  { type: 'apartment', name: '改善四居 135㎡',                area: 135, floors: 1, beds: 4, baths: 2, livings: 1, demos: ['family_with_kids', 'three_generations'], pains: ['hot_water_insufficient', 'cooling_uneven'] },
  { type: 'apartment', name: '大平层四居 145㎡',              area: 145, floors: 1, beds: 4, baths: 2, livings: 2, demos: ['three_generations'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'apartment', name: '高端大平层 158㎡',              area: 158, floors: 1, beds: 4, baths: 3, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['air_quality', 'noise'] },
  { type: 'apartment', name: '改善型四居 168㎡',              area: 168, floors: 1, beds: 4, baths: 3, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['cooling_uneven', 'air_quality'] },

  // ---- 大平层 (mansion) 180-380㎡ × 8 个 ----
  { type: 'mansion',   name: '豪华大平层 180㎡',              area: 180, floors: 1, beds: 4, baths: 3, livings: 2, demos: ['high_net_worth'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'mansion',   name: '尊享大平层 200㎡',              area: 200, floors: 1, beds: 4, baths: 3, livings: 2, demos: ['high_net_worth'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'mansion',   name: '私享大平层 220㎡',              area: 220, floors: 1, beds: 4, baths: 4, livings: 2, demos: ['high_net_worth', 'three_generations'], pains: ['hot_water_insufficient', 'air_quality'] },
  { type: 'mansion',   name: '至尊大平层 250㎡',              area: 250, floors: 1, beds: 5, baths: 4, livings: 2, demos: ['high_net_worth'], pains: ['air_quality', 'noise'] },
  { type: 'mansion',   name: '璀璨大平层 280㎡',              area: 280, floors: 1, beds: 5, baths: 4, livings: 2, demos: ['high_net_worth'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'mansion',   name: '总裁大平层 320㎡',              area: 320, floors: 1, beds: 5, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'noise', 'humidity'] },
  { type: 'mansion',   name: '巅峰大平层 360㎡',              area: 360, floors: 1, beds: 6, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'humidity'] },
  { type: 'mansion',   name: '艺术大平层 380㎡',              area: 380, floors: 1, beds: 6, baths: 5, livings: 3, demos: ['high_net_worth'], pains: ['air_quality', 'cooling_uneven'] },

  // ---- 顶层公寓 (penthouse) 200-500㎡ × 6 个 ----
  { type: 'penthouse', name: '空中别墅顶层 200㎡',            area: 200, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['high_net_worth'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'penthouse', name: '复式顶层 240㎡',                area: 240, floors: 2, beds: 4, baths: 4, livings: 2, demos: ['high_net_worth'], pains: ['hot_water_insufficient', 'humidity'] },
  { type: 'penthouse', name: '空中花园顶层 280㎡',            area: 280, floors: 2, beds: 5, baths: 4, livings: 2, demos: ['high_net_worth', 'three_generations'], pains: ['air_quality', 'cooling_uneven'] },
  { type: 'penthouse', name: '璀璨顶层 320㎡',                area: 320, floors: 2, beds: 5, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'noise', 'humidity'] },
  { type: 'penthouse', name: '至尊顶层 380㎡',                area: 380, floors: 2, beds: 6, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'cooling_uneven'] },
  { type: 'penthouse', name: '空中宫殿 500㎡',                area: 500, floors: 3, beds: 6, baths: 6, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'humidity', 'cooling_uneven'] },

  // ---- 复式/跃层 (duplex) 100-280㎡ × 8 个 ----
  { type: 'duplex',    name: '小复式三居 100㎡',              area: 100, floors: 2, beds: 3, baths: 2, livings: 1, demos: ['young_couple', 'small_family'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'duplex',    name: '小跃层 120㎡',                  area: 120, floors: 2, beds: 3, baths: 2, livings: 1, demos: ['small_family'], pains: ['hot_water_insufficient'] },
  { type: 'duplex',    name: '舒适跃层 140㎡',                area: 140, floors: 2, beds: 3, baths: 2, livings: 2, demos: ['family_with_kids'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'duplex',    name: '改善跃层 160㎡',                area: 160, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['family_with_kids', 'three_generations'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'duplex',    name: '尊享跃层 180㎡',                area: 180, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['three_generations'], pains: ['hot_water_insufficient', 'cooling_uneven'] },
  { type: 'duplex',    name: '空中跃层 220㎡',                area: 220, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'duplex',    name: '璀璨跃层 250㎡',                area: 250, floors: 2, beds: 5, baths: 4, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['air_quality', 'humidity'] },
  { type: 'duplex',    name: '至尊跃层 280㎡',                area: 280, floors: 2, beds: 5, baths: 4, livings: 3, demos: ['high_net_worth'], pains: ['air_quality', 'cooling_uneven'] },

  // ---- 联排别墅 (townhouse) 180-380㎡ × 5 个 ----
  { type: 'townhouse', name: '入门联排 180㎡',                area: 180, floors: 3, beds: 4, baths: 3, livings: 2, demos: ['family_with_kids'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'townhouse', name: '舒适联排 220㎡',                area: 220, floors: 3, beds: 4, baths: 3, livings: 2, demos: ['family_with_kids', 'three_generations'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'townhouse', name: '尊享联排 280㎡',                area: 280, floors: 3, beds: 5, baths: 4, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['air_quality', 'humidity', 'noise'] },
  { type: 'townhouse', name: '璀璨联排 320㎡',                area: 320, floors: 3, beds: 5, baths: 4, livings: 3, demos: ['three_generations', 'high_net_worth'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'townhouse', name: '至尊联排 380㎡',                area: 380, floors: 4, beds: 6, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'humidity'] },

  // ---- 独栋别墅 (single_family) 280-600㎡ × 5 个 ----
  { type: 'single_family', name: '入门独栋别墅 280㎡',         area: 280, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['high_net_worth'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'single_family', name: '舒适独栋 350㎡',             area: 350, floors: 2, beds: 5, baths: 4, livings: 2, demos: ['high_net_worth', 'three_generations'], pains: ['air_quality', 'humidity'] },
  { type: 'single_family', name: '尊享独栋 420㎡',             area: 420, floors: 3, beds: 5, baths: 4, livings: 3, demos: ['high_net_worth'], pains: ['air_quality', 'humidity', 'noise'] },
  { type: 'single_family', name: '璀璨独栋 500㎡',             area: 500, floors: 3, beds: 6, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'humidity', 'cooling_uneven'] },
  { type: 'single_family', name: '至尊独栋 600㎡',             area: 600, floors: 3, beds: 7, baths: 6, livings: 4, demos: ['high_net_worth', 'executive'], pains: ['air_quality', 'humidity', 'cooling_uneven'] },

  // ---- 院墅 (courtyard) 220-450㎡ × 5 个 ----
  { type: 'courtyard', name: '中式院墅 220㎡',                area: 220, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['humidity', 'air_quality'] },
  { type: 'courtyard', name: '新中式合院 280㎡',              area: 280, floors: 2, beds: 4, baths: 3, livings: 2, demos: ['three_generations', 'high_net_worth'], pains: ['humidity', 'cooling_uneven'] },
  { type: 'courtyard', name: '私享合院 350㎡',                area: 350, floors: 2, beds: 5, baths: 4, livings: 3, demos: ['high_net_worth'], pains: ['humidity', 'air_quality'] },
  { type: 'courtyard', name: '尊享合院 400㎡',                area: 400, floors: 2, beds: 5, baths: 4, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['humidity', 'air_quality', 'cooling_uneven'] },
  { type: 'courtyard', name: '至尊合院 450㎡',                area: 450, floors: 3, beds: 6, baths: 5, livings: 3, demos: ['high_net_worth', 'executive'], pains: ['humidity', 'air_quality', 'noise'] },

  // ---- LOFT × 5 个 ----
  { type: 'loft',      name: '工业风 LOFT 50㎡',              area: 50,  floors: 2, beds: 1, baths: 1, livings: 1, demos: ['single', 'creative'], pains: ['hot_water_insufficient', 'cooling_uneven'] },
  { type: 'loft',      name: '复式 LOFT 65㎡',                area: 65,  floors: 2, beds: 1, baths: 1, livings: 1, demos: ['young_couple', 'creative'], pains: ['cooling_uneven', 'humidity'] },
  { type: 'loft',      name: '艺术 LOFT 80㎡',                area: 80,  floors: 2, beds: 2, baths: 2, livings: 1, demos: ['young_couple', 'creative'], pains: ['cooling_uneven', 'air_quality'] },
  { type: 'loft',      name: '复式 LOFT 100㎡',               area: 100, floors: 2, beds: 2, baths: 2, livings: 1, demos: ['young_couple'], pains: ['hot_water_insufficient', 'cooling_uneven'] },
  { type: 'loft',      name: '高端 LOFT 120㎡',               area: 120, floors: 2, beds: 3, baths: 2, livings: 1, demos: ['family_with_kids', 'creative'], pains: ['cooling_uneven', 'air_quality'] }
];

console.log(`[Expand] 现有 ${existing.length} 个，待新增 ${blueprints.length} 个`);

const newItems = blueprints.map((bp, i) => {
  const id = `HT-${String(startIndex + i + 1).padStart(3, '0')}`;
  const layoutText = `${bp.beds}室${bp.livings}厅${bp.baths}卫`;
  return {
    id,
    name: bp.name,
    type: bp.type,
    area: bp.area,
    floors: bp.floors,
    rooms: {
      bedrooms: bp.beds,
      bathrooms: bp.baths,
      livingRooms: bp.livings,
      kitchens: 1,
      balconies: bp.area >= 100 ? 2 : 1
    },
    layout: layoutText,
    features: {
      hasWestExposure: bp.area >= 80,
      hasBasement: bp.type === 'single_family' || bp.type === 'courtyard',
      hasLoft: bp.type === 'loft',
      hasDuplex: bp.type === 'duplex' || bp.type === 'penthouse'
    },
    targetDemographics: bp.demos,
    commonPainPoints: bp.pains,
    model3D: `/models/${id.toLowerCase()}.glb`,
    createdAt: '2026-04-26'
  };
});

const merged = existing.concat(newItems);
fs.writeFileSync(DB_PATH, JSON.stringify(merged, null, 2), 'utf-8');

const types = {};
merged.forEach(h => { types[h.type] = (types[h.type] || 0) + 1; });
console.log(`[Expand] 完成 ✅ 总数 ${merged.length}`);
console.log('[Expand] 类型分布:', types);
