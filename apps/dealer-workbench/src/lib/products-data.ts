// 产品目录数据层：品类 / 型号 / 区域价 / 系统方案包
export const CATEGORIES = [
  { key: 'heat_pump',  label: '热泵主机' },
  { key: 'fresh_air',  label: '新风系统' },
  { key: 'floor_heat', label: '地暖系统' },
  { key: 'water',      label: '净水系统' },
  { key: 'water_heater', label: '热水系统' },
  { key: 'control',    label: '智能控制' },
] as const;

export type CatKey = typeof CATEGORIES[number]['key'];

export interface Product {
  id: string;
  category: CatKey;
  brand: string;
  model: string;
  name: string;
  spec: string;            // 关键参数
  marketPrice: number;     // 市场指导价
  dealerPrice: number;     // 经销商进货价
  stock: 'in' | 'low' | 'order'; // 库存状态
  isNew?: boolean;
}

export const PRODUCTS: Product[] = [
  { id:'hp1', category:'heat_pump', brand:'Rheem', model:'RP-16kW-INV', name:'瑞美变频风冷热泵 16kW', spec:'制冷16kW/制热18kW · 变频 · COP4.2', marketPrice:48000, dealerPrice:33600, stock:'in', isNew:true },
  { id:'hp2', category:'heat_pump', brand:'Rheem', model:'RP-12kW-INV', name:'瑞美变频风冷热泵 12kW', spec:'制冷12kW/制热13kW · 变频 · COP4.0', marketPrice:38000, dealerPrice:26600, stock:'in' },
  { id:'hp3', category:'heat_pump', brand:'Ruud', model:'RU-20kW', name:'璐德地源热泵 20kW', spec:'地源 · 20kW · COP5.1 · 双压缩机', marketPrice:78000, dealerPrice:54600, stock:'order' },
  { id:'fa1', category:'fresh_air', brand:'瑞合', model:'FA-350-HR', name:'全热交换新风机 350m³/h', spec:'350m³/h · 全热交换75% · 三级过滤', marketPrice:18000, dealerPrice:12600, stock:'in' },
  { id:'fa2', category:'fresh_air', brand:'瑞合', model:'FA-500-HR', name:'全热交换新风机 500m³/h', spec:'500m³/h · 全热交换78% · PM2.5净化', marketPrice:25000, dealerPrice:17500, stock:'low', isNew:true },
  { id:'fh1', category:'floor_heat', brand:'瑞合', model:'FH-MANIFOLD-8', name:'8路分集水器', spec:'8回路 · 黄铜 · 流量计', marketPrice:4800, dealerPrice:3360, stock:'in' },
  { id:'wt1', category:'water', brand:'瑞合', model:'WT-RO-600G', name:'中央净水RO 600G', spec:'反渗透 · 600加仑/天 · 双出水', marketPrice:12000, dealerPrice:8400, stock:'in' },
  { id:'wh1', category:'water_heater', brand:'Rheem', model:'WH-HP-300L', name:'瑞美空气能热水器 300L', spec:'300L · 空气能 · COP3.8', marketPrice:16000, dealerPrice:11200, stock:'in' },
  { id:'ct1', category:'control', brand:'瑞合', model:'ECONET-HUB', name:'Econet 智控中枢', spec:'全屋联动 · APP远程 · 能耗监测', marketPrice:8000, dealerPrice:5600, stock:'in', isNew:true },
  { id:'ct2', category:'control', brand:'瑞合', model:'ECONET-THERMO', name:'Econet 智能温控器', spec:'分区控温 · 触屏 · 离线语音', marketPrice:1200, dealerPrice:840, stock:'in' },
];

export interface SystemPack {
  id: string;
  name: string;
  desc: string;
  items: { model: string; qty: number }[];
  bundlePrice: number;
  scenario: string;
}

export const SYSTEM_PACKS: SystemPack[] = [
  { id:'pk1', name:'五恒系统·旗舰', desc:'恒温恒湿恒氧恒洁恒静全覆盖', scenario:'200-350㎡大平层/别墅',
    items:[{model:'RP-16kW-INV',qty:1},{model:'FA-500-HR',qty:1},{model:'FH-MANIFOLD-8',qty:2},{model:'WT-RO-600G',qty:1},{model:'ECONET-HUB',qty:1},{model:'ECONET-THERMO',qty:6}],
    bundlePrice:185000 },
  { id:'pk2', name:'地暖+新风组合', desc:'采暖与空气品质双解决', scenario:'120-200㎡舒适住宅',
    items:[{model:'RP-12kW-INV',qty:1},{model:'FA-350-HR',qty:1},{model:'FH-MANIFOLD-8',qty:1},{model:'ECONET-THERMO',qty:4}],
    bundlePrice:78000 },
  { id:'pk3', name:'热水+净水一体', desc:'生活热水与饮用水净化', scenario:'紧凑户型基础舒适',
    items:[{model:'WH-HP-300L',qty:1},{model:'WT-RO-600G',qty:1},{model:'ECONET-THERMO',qty:2}],
    bundlePrice:32000 },
];
