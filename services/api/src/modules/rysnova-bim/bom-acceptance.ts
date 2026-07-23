/**
 * P1-1 · BOM 逐设备提取 + 验收清单生成（纯函数，无 IO，可单测）。
 *
 * 修复两处「演示级」根因：
 *  1) `buildIotHandoffPackage` 旧逻辑 `bom.filter(d => d.systemFamily || d.category)`——
 *     而标准报价 BOM 行仅含 { sku, name, unitPrice, quantity, params }，两字段皆无 →
 *     devices 恒为 0。此处改为「每条真实 BOM 行都是一台设备」，仅剔除空行，永不误删。
 *  2) 验收清单旧逻辑按固定模板 DEFAULT_CHECKLIST 过滤——与实际卖出的设备无关。
 *     此处改为「按实际 BOM 逐设备生成」安装/调试确认项 + 通用验收项；BOM 为空才回退模板。
 *
 * 系统归类：优先取显式字段（systemFamily/category/system/systemKey），
 * 否则按 name/sku 关键词匹配，未命中归「设备」（仍计入，绝不丢弃）。
 */

export interface BomItemLike {
  sku?: unknown;
  model?: unknown;
  name?: unknown;
  systemFamily?: unknown;
  category?: unknown;
  system?: unknown;
  systemKey?: unknown;
  quantity?: unknown;
  params?: unknown;
}

export interface NormalizedDevice {
  name: string;
  system: string; // 中文系统名，或「设备」
  quantity: number;
  sku: string | null;
  model: string | null;
}

export interface AcceptanceItem {
  system: string;
  item: string;
  done: boolean;
  photos: string[];
  deviceRef?: string; // 关联设备（sku 或名称），便于逐设备核对
  fromBom?: boolean; // true=按真实 BOM 生成；false=模板/通用项
}

// 英文 key → 中文系统名（与 bim.service SYSTEM_KEY_TO_CN 同口径）。
const SYSTEM_KEY_TO_CN: Record<string, string> = {
  hot_water: '热水', hotWater: '热水', water_heater: '热水',
  heating: '采暖', floor_heating: '采暖',
  fresh_air: '新风', freshAir: '新风', air: '新风', ventilation: '新风',
  water: '净水', purification: '净水', purifier: '净水',
  cooling: '制冷', air_conditioning: '制冷', airConditioning: '制冷',
  humidity: '恒湿',
  control: '智控', smart_control: '智控', smartControl: '智控',
};

// 中文系统名 → 归类关键词（用于 name/sku 无显式系统时的兜底分类）。
const SYSTEM_KEYWORDS: Array<{ system: string; keywords: string[] }> = [
  { system: '热水', keywords: ['热水', '热泵热水', '壁挂炉', 'water heater', 'boiler', 'heater'] },
  { system: '净水', keywords: ['净水', '软水', '前置', '反渗透', 'ro', 'purifier', 'softener'] },
  { system: '采暖', keywords: ['采暖', '地暖', '暖气片', '散热器', '盘管', 'radiator', 'floor heating'] },
  { system: '制冷', keywords: ['空调', '多联机', '风管机', 'vrf', 'air condition'] },
  { system: '新风', keywords: ['新风', '全热', '换气', 'erv', 'fresh air', 'ventilation'] },
  { system: '恒湿', keywords: ['除湿', '恒湿', 'doas', 'dehumid'] },
  { system: '智控', keywords: ['智控', '智能', '网关', '温控', '控制', 'econet', 'control', 'gateway', 'thermostat'] },
];

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();

/** 归类单条 BOM 行到中文系统名；显式字段优先，其次关键词，兜底「设备」。 */
export function classifyBomItemSystem(item: BomItemLike): string {
  const explicit = str(item.systemFamily) || str(item.category) || str(item.system) || str(item.systemKey);
  if (explicit) {
    const cn = SYSTEM_KEY_TO_CN[explicit] || SYSTEM_KEY_TO_CN[explicit.toLowerCase()];
    if (cn) return cn;
    // 显式值本身可能已是中文系统名
    for (const { system } of SYSTEM_KEYWORDS) if (explicit.includes(system)) return system;
    // 显式但无法识别：按关键词继续尝试 name/sku，最后回退显式原值
  }
  const hay = `${str(item.name)} ${str(item.sku)} ${str(item.model)}`.toLowerCase();
  if (hay.trim()) {
    for (const { system, keywords } of SYSTEM_KEYWORDS) {
      if (keywords.some((k) => hay.includes(k.toLowerCase()))) return system;
    }
  }
  return explicit || '设备';
}

/**
 * 逐设备提取：每条有效 BOM 行=一台设备，绝不因缺 systemFamily/category 而丢弃。
 * 仅剔除完全空白行（无 name/sku/model）。
 */
export function extractDevices(bom: BomItemLike[] | null | undefined): NormalizedDevice[] {
  const items = Array.isArray(bom) ? bom : [];
  const devices: NormalizedDevice[] = [];
  for (const it of items) {
    const name = str(it.name) || str(it.model) || str(it.sku);
    if (!name) continue; // 空行剔除
    const q = Number(it.quantity);
    devices.push({
      name,
      system: classifyBomItemSystem(it),
      quantity: Number.isFinite(q) && q > 0 ? q : 1,
      sku: str(it.sku) || null,
      model: str(it.model) || null,
    });
  }
  return devices;
}

// BOM 为空时回退用的通用模板（保留旧行为，避免只剩验收项）。
const TEMPLATE_CHECKLIST: Array<{ system: string; item: string }> = [
  { system: '热水', item: '主机安装完成' },
  { system: '热水', item: '管路通水测压' },
  { system: '采暖', item: '分集水器安装完成' },
  { system: '采暖', item: '地暖盘管铺设完成' },
  { system: '新风', item: '新风机安装完成' },
  { system: '新风', item: '风管连接测试' },
  { system: '净水', item: '净水设备安装完成' },
  { system: '智控', item: 'Econet 网关上线' },
  { system: '智控', item: '设备绑定 APP 确认' },
];

// 通用验收项（无论 BOM 如何都必须有）。
const GENERAL_ACCEPTANCE: Array<{ system: string; item: string }> = [
  { system: '验收', item: '客户现场确认' },
  { system: '验收', item: '《交付验收单》签字' },
];

const normCn = (families: string[]): string[] =>
  (families || []).map((s) => SYSTEM_KEY_TO_CN[s] || SYSTEM_KEY_TO_CN[String(s).toLowerCase()] || s);

/**
 * 按实际 BOM 逐设备生成验收清单：每台设备 →「『{名称}』安装并调试确认」项（带 deviceRef）；
 * 末尾追加通用验收项。BOM 为空时回退按 systemFamilies 过滤的模板（保留旧行为）。
 */
export function buildAcceptanceChecklist(
  bom: BomItemLike[] | null | undefined,
  systemFamilies: string[] = [],
): AcceptanceItem[] {
  const devices = extractDevices(bom);
  const items: AcceptanceItem[] = [];

  if (devices.length) {
    for (const d of devices) {
      const qtyTag = d.quantity > 1 ? `（${d.quantity} 台）` : '';
      items.push({
        system: d.system,
        item: `「${d.name}」${qtyTag}安装并调试确认`,
        done: false,
        photos: [],
        deviceRef: d.sku || d.name,
        fromBom: true,
      });
    }
  } else {
    // 回退模板：按 systemFamilies 过滤，无匹配则全量（避免只剩验收项）。
    const cn = normCn(systemFamilies);
    const filtered = cn.length
      ? TEMPLATE_CHECKLIST.filter((c) => cn.some((s) => c.system.includes(s) || s.includes(c.system)))
      : TEMPLATE_CHECKLIST;
    const source = filtered.length ? filtered : TEMPLATE_CHECKLIST;
    for (const c of source) items.push({ ...c, done: false, photos: [], fromBom: false });
  }

  for (const g of GENERAL_ACCEPTANCE) items.push({ ...g, done: false, photos: [], fromBom: false });
  return items;
}
