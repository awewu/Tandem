/* ── 产品数据源（单一源，products 列表页与详情页共用）──
   参数均为示意，正式发布前须以工程部核定数据替换 */

export type Product = {
  id: string;
  name: string;
  desc: string;
  brand: 'Rheem' | 'Ruud' | 'EverHot' | 'Rhautt';
  cat: string;
  code: string;
  bg: string;
  metric: string;
  price: string;
  eco: boolean;
  specs: { label: string; value: string }[];
  features: string[];
  scenarios: string[];
};

export const PRODUCTS: Product[] = [
  {
    id: 'RHP-8C', name: 'RHP-8C', desc: '变频空气源热泵 8kW', brand: 'Rheem', cat: '采暖系统', code: 'HP',
    bg: 'linear-gradient(135deg,rgba(228,0,43,0.12),rgba(118,35,47,0.06))', metric: 'COP 4.2', price: '¥28,800', eco: true,
    specs: [
      { label: '额定制热量', value: '8 kW' },
      { label: 'COP（制热）', value: '4.2' },
      { label: '运行环温', value: '-25°C ~ 43°C' },
      { label: '噪音', value: '≤48 dB(A)' },
      { label: '制冷剂', value: 'R32 低GWP' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['全直流变频压缩机', '-25°C 低温强热', 'Econet 智控接入', '分区水温控制'],
    scenarios: ['120㎡ 以下户型采暖', '地暖 + 生活热水两联供', '长江流域冬季采暖'],
  },
  {
    id: 'RHP-16DC', name: 'RHP-16DC', desc: '变频空气源热泵 16kW', brand: 'Rheem', cat: '中央空调', code: 'HP',
    bg: 'linear-gradient(135deg,rgba(228,0,43,0.12),rgba(118,35,47,0.06))', metric: 'COP 4.8', price: '¥52,000', eco: true,
    specs: [
      { label: '额定制热量', value: '16 kW' },
      { label: 'COP（制热）', value: '4.8' },
      { label: '运行环温', value: '-30°C ~ 46°C' },
      { label: '噪音', value: '≤52 dB(A)' },
      { label: '制冷剂', value: 'R32 低GWP' },
      { label: '电源', value: '380V / 50Hz' },
    ],
    features: ['喷气增焓压缩机', '冷暖两联供', '级联控制支持', 'Econet 云端组网'],
    scenarios: ['200-350㎡ 大户型/别墅', '采暖 + 制冷两联供', '北方严寒地区'],
  },
  {
    id: 'GSHP-20', name: 'GSHP-20', desc: '地源热泵 20kW', brand: 'Rheem', cat: '采暖系统', code: 'GS',
    bg: 'linear-gradient(135deg,rgba(63,88,90,0.20),rgba(16,28,40,0.12))', metric: 'COP 5.5', price: '¥86,000', eco: true,
    specs: [
      { label: '额定制热量', value: '20 kW' },
      { label: 'COP（制热）', value: '5.5' },
      { label: '地埋管型式', value: '垂直双U' },
      { label: '噪音', value: '≤45 dB(A)' },
      { label: '制冷剂', value: 'R410A' },
      { label: '电源', value: '380V / 50Hz' },
    ],
    features: ['土壤源恒温热交换', '全年 COP 稳定', '三合一（冷/暖/热水）', '25年地埋管寿命设计'],
    scenarios: ['独栋别墅整宅系统', '对运行费用敏感的大面积建筑', '严寒地区全年候方案'],
  },
  {
    id: 'WH-150', name: 'WH-150', desc: '中央热水机 150L', brand: 'Rheem', cat: '热水系统', code: 'WH',
    bg: 'linear-gradient(135deg,rgba(228,0,43,0.10),rgba(16,28,40,0.06))', metric: '≤5s出热水', price: '¥18,500', eco: false,
    specs: [
      { label: '水箱容积', value: '150 L' },
      { label: '出热水速度', value: '≤5 秒' },
      { label: '内胆', value: '金圭特护搪瓷' },
      { label: '保温层', value: '50mm 聚氨酯' },
      { label: '能效等级', value: '一级' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['金圭内胆 8 年质保', '即开即热循环', '双胆速热', '中温保温节能模式'],
    scenarios: ['两卫户型中央热水', '即开即热舒适需求', '水质较硬地区'],
  },
  {
    id: 'WH-300', name: 'WH-300', desc: '中央热水机 300L', brand: 'Rheem', cat: '热水系统', code: 'WH',
    bg: 'linear-gradient(135deg,rgba(228,0,43,0.10),rgba(16,28,40,0.06))', metric: '≤5s出热水', price: '¥31,200', eco: false,
    specs: [
      { label: '水箱容积', value: '300 L' },
      { label: '出热水速度', value: '≤5 秒' },
      { label: '内胆', value: '金圭特护搪瓷' },
      { label: '保温层', value: '50mm 聚氨酯' },
      { label: '能效等级', value: '一级' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['大容积多点供水', '即开即热循环', '智能峰谷电加热', 'Econet 远程预约'],
    scenarios: ['三卫以上大户型', '多人口家庭', '浴缸 + 花洒同时用水'],
  },
  {
    id: 'ERV-150', name: 'ERV-150', desc: '全热交换新风 150 风量', brand: 'Ruud', cat: '新风净化', code: 'NV',
    bg: 'linear-gradient(135deg,rgba(63,88,90,0.18),rgba(228,0,43,0.06))', metric: 'CO₂≤800ppm', price: '¥12,800', eco: true,
    specs: [
      { label: '额定风量', value: '150 m³/h' },
      { label: '热交换效率', value: '≥75%' },
      { label: '过滤等级', value: 'H11 + 初效' },
      { label: '噪音', value: '≤32 dB(A)' },
      { label: '安装方式', value: '吊顶式' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['全热交换芯回收能量', 'H11 医用级过滤', 'CO₂ 浓度联动风量', '滤网寿命提醒'],
    scenarios: ['90㎡ 以下户型', '婴幼儿/敏感人群家庭', '临街噪音大不便开窗'],
  },
  {
    id: 'ERV-300', name: 'ERV-300', desc: '全热交换新风 300 风量', brand: 'Ruud', cat: '新风净化', code: 'NV',
    bg: 'linear-gradient(135deg,rgba(63,88,90,0.18),rgba(228,0,43,0.06))', metric: 'PM2.5≤5μg', price: '¥21,600', eco: true,
    specs: [
      { label: '额定风量', value: '300 m³/h' },
      { label: '热交换效率', value: '≥75%' },
      { label: '过滤等级', value: 'H13 + 初效 + 活性炭' },
      { label: '噪音', value: '≤36 dB(A)' },
      { label: '安装方式', value: '吊顶式' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['H13 级 HEPA 过滤', 'PM2.5 数显联动', '内循环净化模式', '旁通免热交换换气'],
    scenarios: ['150㎡ 左右户型', '雾霾高发地区', '新装修除醛需求'],
  },
  {
    id: 'ERV-500', name: 'ERV-500', desc: '全热交换新风 500 风量', brand: 'Ruud', cat: '新风净化', code: 'NV',
    bg: 'linear-gradient(135deg,rgba(63,88,90,0.18),rgba(228,0,43,0.06))', metric: '换气效率≥75%', price: '¥34,800', eco: true,
    specs: [
      { label: '额定风量', value: '500 m³/h' },
      { label: '热交换效率', value: '≥75%' },
      { label: '过滤等级', value: 'H13 + 初效 + 活性炭' },
      { label: '噪音', value: '≤40 dB(A)' },
      { label: '安装方式', value: '吊顶式 / 立柜式' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['大风量全屋换气', '双核 EC 风机', '分区风阀控制', '楼宇协议接入（Modbus）'],
    scenarios: ['大平层/别墅全屋新风', '商用办公空间', '高密闭性被动式建筑'],
  },
  {
    id: 'RF-600', name: 'RF-600', desc: 'RO 反渗透净水直饮机 600G', brand: 'EverHot', cat: '净水系统', code: 'RO',
    bg: 'linear-gradient(135deg,rgba(228,0,43,0.08),rgba(16,28,40,0.06))', metric: 'TDS≤50ppm', price: '¥8,600', eco: false,
    specs: [
      { label: '额定产水量', value: '600G（约1.6L/min）' },
      { label: '出水 TDS', value: '≤50 ppm' },
      { label: '滤芯配置', value: 'PP+CTO+RO 三级' },
      { label: '废水比', value: '2:1' },
      { label: '安装方式', value: '厨下式' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['RO 膜 3 年长效', '双出水（纯水/净水）', '滤芯寿命数显', '无桶大流量'],
    scenarios: ['家庭直饮水', '母婴用水', 'TDS 偏高市政水质'],
  },
  {
    id: 'WS-300', name: 'WS-300', desc: '中央软水机 3T', brand: 'EverHot', cat: '净水系统', code: 'SW',
    bg: 'linear-gradient(135deg,rgba(228,0,43,0.08),rgba(16,28,40,0.06))', metric: '硬度≤50mg/L', price: '¥11,200', eco: false,
    specs: [
      { label: '额定流量', value: '3 T/h' },
      { label: '出水硬度', value: '≤50 mg/L' },
      { label: '树脂', value: '食品级阳离子树脂' },
      { label: '再生方式', value: '流量型自动再生' },
      { label: '安装方式', value: '入户主管道' },
      { label: '电源', value: '220V / 50Hz' },
    ],
    features: ['全屋软水覆盖', '智能流量再生省盐', '断电记忆', '低盐提醒'],
    scenarios: ['北方高硬度水质', '保护热水/采暖设备', '衣物洗护与肌肤敏感'],
  },
  {
    id: 'EC-HUB', name: 'EC-HUB', desc: 'Econet 智控中枢', brand: 'Rhautt', cat: '智控', code: 'EC',
    bg: 'linear-gradient(135deg,rgba(16,28,40,0.92),rgba(63,88,90,0.18))', metric: '响应<100ms', price: '¥6,800', eco: false,
    specs: [
      { label: '协议支持', value: 'Wi-Fi / Zigbee / RS485' },
      { label: '响应延迟', value: '<100 ms（本地）' },
      { label: '接入设备数', value: '≤64 台' },
      { label: '语音生态', value: '小爱/天猫精灵/Siri' },
      { label: '供电', value: 'DC 12V' },
      { label: '安装', value: '导轨式/壁挂' },
    ],
    features: ['全系统统一中枢', '本地化场景引擎（断网可用）', '能耗统计看板', 'OTA 远程升级'],
    scenarios: ['热水+采暖+新风联动', '全屋能耗管理', '别墅多设备集中控制'],
  },
  {
    id: 'EC-TC', name: 'EC-TC', desc: 'Econet 智能温控器', brand: 'Rhautt', cat: '智控', code: 'TC',
    bg: 'linear-gradient(135deg,rgba(16,28,40,0.92),rgba(63,88,90,0.18))', metric: '精度±0.3°C', price: '¥1,980', eco: false,
    specs: [
      { label: '控温精度', value: '±0.3°C' },
      { label: '显示', value: '3.5" IPS 触屏' },
      { label: '通讯', value: 'Zigbee 3.0' },
      { label: '继电器', value: '16A 干接点' },
      { label: '供电', value: 'AC 220V' },
      { label: '安装', value: '86 盒标准' },
    ],
    features: ['分室控温', '地暖/散热器双模式', '周编程 + 假日模式', '自适应预热算法'],
    scenarios: ['分室采暖控制', '地暖系统末端', '酒店/公寓客控'],
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find(p => p.id === id);
}

export const BRAND_COLOR: Record<string, string> = {
  Rheem: 'var(--rh-red)', Ruud: 'var(--rh-red)', EverHot: 'var(--rh-red)', Rhautt: 'var(--rh-red-dk)',
};
