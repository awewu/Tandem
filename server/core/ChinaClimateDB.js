/**
 * GB 50736-2012 附录A 室外计算气象参数（官方设计值）
 * 含：夏季/冬季干球温度、夏季湿球温度、相对湿度、大气压、计算焓值
 * 焓值由心理测量公式实时计算，不预存（保证精度）
 */

/* ── 心理测量公式（ASHRAE基础 / GB 50736精确版） ─────────────── */
function satPressure(T) {
  // Antoine方程，单位：kPa，T in °C
  return 0.1333 * Math.pow(10, 8.10765 - 1750.286 / (235.0 + T));
}

function humidityRatio(Tdb, Twb, P_kPa) {
  const Pws = satPressure(Twb);
  const Wws = 0.622 * Pws / (P_kPa - Pws);
  return ((2501 - 2.381 * Twb) * Wws - 1.006 * (Tdb - Twb))
       / (2501 + 1.805 * Tdb - 4.186 * Twb);
}

function enthalpy(Tdb, Twb, P_kPa) {
  const W = humidityRatio(Tdb, Twb, P_kPa);
  return 1.006 * Tdb + W * (2501 + 1.86 * Tdb); // kJ/kg
}

/* ── GB 50736-2012 附录A 原始数据 ───────────────────────────── */
// sDB: 夏季干球(°C)  sWB: 夏季湿球(°C)  sRH: 夏季相对湿度(%)
// wDB: 冬季干球(°C)  wRH: 冬季相对湿度(%)  P: 大气压(kPa)
// zone: 气候分区 (GB 50176) — 严寒A/B, 寒冷, 夏热冬冷, 夏热冬暖, 温和
const RAW = [
  // 一线城市
  { name:'北京', province:'北京', sDB:33.5, sWB:26.4, sRH:61, wDB:-9.9,  wRH:44, P:101.33, zone:'寒冷' },
  { name:'上海', province:'上海', sDB:34.4, sWB:27.9, sRH:72, wDB:-4.0,  wRH:75, P:102.68, zone:'夏热冬冷' },
  { name:'广州', province:'广东', sDB:33.5, sWB:27.7, sRH:79, wDB: 6.0,  wRH:70, P:100.59, zone:'夏热冬暖' },
  { name:'深圳', province:'广东', sDB:33.5, sWB:27.6, sRH:78, wDB: 7.2,  wRH:72, P:100.59, zone:'夏热冬暖' },
  // 新一线
  { name:'成都', province:'四川', sDB:32.0, sWB:26.1, sRH:77, wDB: 1.3,  wRH:82, P: 95.58, zone:'夏热冬冷' },
  { name:'杭州', province:'浙江', sDB:35.7, sWB:28.1, sRH:74, wDB:-4.0,  wRH:77, P:101.86, zone:'夏热冬冷' },
  { name:'重庆', province:'重庆', sDB:36.0, sWB:27.6, sRH:62, wDB: 3.8,  wRH:84, P: 98.21, zone:'夏热冬冷' },
  { name:'西安', province:'陕西', sDB:36.7, sWB:25.7, sRH:59, wDB:-6.6,  wRH:68, P: 97.13, zone:'寒冷' },
  { name:'苏州', province:'江苏', sDB:34.7, sWB:27.9, sRH:72, wDB:-4.5,  wRH:74, P:102.27, zone:'夏热冬冷' },
  { name:'武汉', province:'湖北', sDB:35.2, sWB:28.2, sRH:72, wDB:-5.0,  wRH:77, P:101.59, zone:'夏热冬冷' },
  { name:'南京', province:'江苏', sDB:34.8, sWB:27.9, sRH:72, wDB:-5.5,  wRH:72, P:102.27, zone:'夏热冬冷' },
  { name:'天津', province:'天津', sDB:33.9, sWB:27.1, sRH:66, wDB:-10.4, wRH:56, P:101.62, zone:'寒冷' },
  { name:'郑州', province:'河南', sDB:35.6, sWB:27.2, sRH:62, wDB:-5.5,  wRH:67, P:100.69, zone:'寒冷' },
  { name:'长沙', province:'湖南', sDB:35.9, sWB:28.2, sRH:70, wDB:-3.5,  wRH:80, P:101.29, zone:'夏热冬冷' },
  { name:'东莞', province:'广东', sDB:33.4, sWB:27.6, sRH:79, wDB: 8.0,  wRH:72, P:100.59, zone:'夏热冬暖' },
  { name:'佛山', province:'广东', sDB:33.4, sWB:27.6, sRH:79, wDB: 8.0,  wRH:73, P:100.59, zone:'夏热冬暖' },
  { name:'宁波', province:'浙江', sDB:34.9, sWB:28.0, sRH:73, wDB:-3.5,  wRH:76, P:101.86, zone:'夏热冬冷' },
  { name:'青岛', province:'山东', sDB:29.5, sWB:25.5, sRH:78, wDB:-7.0,  wRH:65, P:101.83, zone:'寒冷' },
  { name:'沈阳', province:'辽宁', sDB:31.4, sWB:25.5, sRH:67, wDB:-17.8, wRH:65, P:101.39, zone:'严寒B' },
  // 二线城市
  { name:'济南', province:'山东', sDB:35.5, sWB:26.9, sRH:58, wDB:-9.5,  wRH:58, P:101.28, zone:'寒冷' },
  { name:'合肥', province:'安徽', sDB:35.0, sWB:27.7, sRH:68, wDB:-5.4,  wRH:76, P:101.56, zone:'夏热冬冷' },
  { name:'昆明', province:'云南', sDB:27.0, sWB:19.5, sRH:62, wDB: 3.2,  wRH:70, P: 81.35, zone:'温和' },
  { name:'贵阳', province:'贵州', sDB:30.0, sWB:22.0, sRH:72, wDB: 1.5,  wRH:81, P: 89.60, zone:'夏热冬冷' },
  { name:'南宁', province:'广西', sDB:35.0, sWB:27.5, sRH:73, wDB: 8.5,  wRH:74, P:101.17, zone:'夏热冬暖' },
  { name:'南昌', province:'江西', sDB:36.2, sWB:28.3, sRH:67, wDB:-3.0,  wRH:78, P:101.27, zone:'夏热冬冷' },
  { name:'福州', province:'福建', sDB:35.0, sWB:27.9, sRH:76, wDB: 6.0,  wRH:73, P:101.31, zone:'夏热冬暖' },
  { name:'厦门', province:'福建', sDB:33.5, sWB:27.8, sRH:79, wDB: 8.5,  wRH:74, P:100.99, zone:'夏热冬暖' },
  { name:'太原', province:'山西', sDB:32.6, sWB:23.3, sRH:53, wDB:-10.0, wRH:58, P: 92.77, zone:'寒冷' },
  { name:'石家庄', province:'河北', sDB:35.3, sWB:26.8, sRH:58, wDB:-8.5, wRH:57, P:101.13, zone:'寒冷' },
  { name:'哈尔滨', province:'黑龙江',sDB:30.5, sWB:24.2, sRH:68, wDB:-26.0,wRH:72, P:100.49, zone:'严寒A' },
  { name:'长春', province:'吉林',  sDB:30.8, sWB:24.2, sRH:67, wDB:-21.8, wRH:69, P:100.16, zone:'严寒B' },
  { name:'呼和浩特', province:'内蒙古',sDB:31.8,sWB:22.0,sRH:46,wDB:-16.8,wRH:70,P: 90.49, zone:'严寒B' },
  { name:'乌鲁木齐', province:'新疆', sDB:33.5, sWB:18.3, sRH:34, wDB:-19.3,wRH:79, P: 91.64, zone:'严寒B' },
  { name:'拉萨', province:'西藏',  sDB:25.6, sWB:14.5, sRH:38, wDB:-10.2, wRH:27, P: 64.90, zone:'严寒A' },
];

// 预计算焓值，生成最终数据对象
const CLIMATE_DB = RAW.map(r => ({
  ...r,
  sEnthalpy: Math.round(enthalpy(r.sDB, r.sWB, r.P) * 10) / 10, // kJ/kg，保留1位小数
  sW: Math.round(humidityRatio(r.sDB, r.sWB, r.P) * 100000) / 100000, // kg/kg，5位有效
}));

// 按城市名查找
function getCity(name) {
  return CLIMATE_DB.find(c => c.name === name || c.name.includes(name)) || null;
}

// 按气候分区筛选
function getCitiesByZone(zone) {
  return CLIMATE_DB.filter(c => c.zone === zone);
}

// 获取供暖冬季设计温差（与20°C室内基准）
function heatingDeltaT(cityName) {
  const c = getCity(cityName);
  if (!c) return 20; // 默认
  return 20 - c.wDB;
}

// 获取空调夏季焓差（与室内26°C/60%RH焓值对比）
function coolingEnthalpyDiff(cityName) {
  const c = getCity(cityName);
  if (!c) return 30;
  const indoorH = enthalpy(26, 19.5, c.P); // 26°C/60%RH室内设计点
  return Math.round((c.sEnthalpy - indoorH) * 10) / 10;
}

module.exports = {
  CLIMATE_DB,
  getCity,
  getCitiesByZone,
  heatingDeltaT,
  coolingEnthalpyDiff,
  enthalpy,
  humidityRatio,
  satPressure,
};
