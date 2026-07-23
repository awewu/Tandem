/**
 * 地址规范化（Project 业务唯一键组成之一）。
 *
 * 用途：项目主线以 (tenant_id, phone_hash, address_normalized) 作为业务唯一键
 *（见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md）。规范化把同一物理地址的不同
 * 书写形式归并为同一 key，避免"XX路1号" vs "XX路1號" 判不出重复。
 *
 * 决策（2026-07-13 评审）：先纯文本归一，不接入行政区划/地理编码。
 * 规则须集中此处，前后端/回填脚本共用，避免漂移。
 *
 * 纯函数、无副作用，可被单测与迁移回填脚本复用。
 */

/** 全角字符（含全角空格）转半角。 */
function toHalfWidth(input: string): string {
  return input
    // 全角空格 U+3000 → 半角空格
    .replace(/\u3000/g, ' ')
    // 全角 ASCII（U+FF01–U+FF5E）→ 半角（偏移 0xFEE0）
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

/**
 * 门牌/序号等价归一：把"號"折成"号"，去除 -、#、连续空白等无语义分隔差异。
 * 注意：仅做文本层归一，不改变中文数字（如"一号楼"保持原样）。
 */
export function normalizeAddress(raw: string | null | undefined): string {
  if (raw == null) return '';
  let s = String(raw);
  s = toHalfWidth(s);
  s = s.toLowerCase();
  // 繁简/异体归一（仅高频地址用字，保守集合）
  s = s
    .replace(/號/g, '号')
    .replace(/樓/g, '楼')
    .replace(/棟|楝/g, '栋')
    .replace(/單元/g, '单元')
    .replace(/室/g, '室');
  // 去除无语义分隔符：#、-、·、逗号、句点、连续空白
  s = s.replace(/[#\-·,，.。\s]+/g, '');
  return s.trim();
}

/** 两个地址在规范化后是否指向同一项目地址。 */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeAddress(a);
  const nb = normalizeAddress(b);
  return na.length > 0 && na === nb;
}
