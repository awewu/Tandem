/**
 * Phase 1 · 薪酬表导入 + 对账 (只读 xlsx, 不写数据库)
 *
 * 输入: docs/各职能岗位技能工资对应表.xlsx · docs/薪酬结构总表.xlsx
 * 输出: lib/comp/seed/skills.json · grade-bands.json  +  控制台对账报告
 *
 * 对账 (§4.1): 技能工资对应表"合计行" vs Σ技能定价; 暴露源表不规则数据。
 *
 * 运行: node scripts/comp/import-comp-tables.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import pkg from 'xlsx';
const XLSX = pkg.default ?? pkg;

const BOARD = { '一': 'HR', '二': 'FIN', '三': 'MFG', '四': 'RND', '五': 'MKT' };
const romanToClass = (s) => (s.includes('Ⅰ') ? 'I' : s.includes('Ⅱ') ? 'II' : s.includes('Ⅲ') ? 'III' : null);
const LEVELS = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];
const num = (v) => { const n = Number(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
const isSkillRow = (c) => /^\s*\d+\s*[、.]/.test(String(c || '').trim());

function rowsOf(file, sheet) {
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const ws = sheet ? wb.Sheets[sheet] : wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
    .map((r) => r.map((c) => String(c).replace(/\s+/g, ' ').trim()));
}

// ---------------------------------------------------------------------------
// 1) 技能工资对应表 → skills[] + 合计对账
// ---------------------------------------------------------------------------
function parseSkills() {
  const rows = rowsOf('docs/各职能岗位技能工资对应表.xlsx');
  const skills = [];
  const reconcile = [];
  let board = null;
  let block = null; // { family, levelCols, wageCol, srcCol, skills:[] }

  const flush = () => {
    if (!block || !block.skills.length) return;
    const family = block.family || '(未命名)';
    for (const s of block.skills) {
      skills.push({ board, family, name: s.name, skillWage: s.wage, requiredAt: s.req, source: s.src });
    }
    // 对账: 每个等级 Σ定价 vs 合计
    if (block.totals) {
      for (const lvl of Object.keys(block.levelCols)) {
        const expected = block.skills.filter((s) => s.req.includes(lvl)).reduce((a, s) => a + s.wage, 0);
        const actual = block.totals[lvl];
        if (actual !== undefined && actual !== expected) {
          reconcile.push({ board, family, level: lvl, expected, actual, diff: actual - expected });
        }
      }
    }
  };

  for (const r of rows) {
    const secKey = (r[0] || '').match(/^([一二三四五])、/);
    if (secKey) { flush(); block = null; board = BOARD[secKey[1]]; continue; }
    const isHeader = r.some((c) => c === '技能库');
    if (isHeader) {
      flush();
      const levelCols = {};
      r.forEach((c, i) => { if (LEVELS.includes(c)) levelCols[c] = i; });
      block = { family: null, levelCols, wageCol: r.indexOf('技能工资标准（元）'), srcCol: r.lastIndexOf('标准来源'), skills: [], totals: null };
      continue;
    }
    if (!block) continue;
    if (isSkillRow(r[1])) {
      if (!block.family && r[0]) block.family = r[0];
      const wage = num(r[block.wageCol] || r[2]);
      const req = Object.entries(block.levelCols).filter(([, i]) => /v/i.test(r[i])).map(([lvl]) => lvl);
      const src = block.srcCol > 0 ? (r[block.srcCol] || '案例佐证') : '案例佐证';
      block.skills.push({ name: r[1], wage, req, src });
    } else {
      // 合计/汇总行: 读各等级列的数字
      const totals = {};
      for (const [lvl, i] of Object.entries(block.levelCols)) {
        if (r[i] !== '' && /\d/.test(r[i])) totals[lvl] = num(r[i]);
      }
      if (Object.keys(totals).length) block.totals = totals;
      if (!block.family && r[1] && r[1] !== '合计') block.family = r[1];
    }
  }
  flush();
  return { skills, reconcile };
}

// ---------------------------------------------------------------------------
// 2) 薪酬结构总表 → gradeBands[]
// ---------------------------------------------------------------------------
function parseBands() {
  const rows = rowsOf('docs/薪酬结构总表.xlsx', '薪酬设计总览-2026');
  const bands = [];
  let cols = null;
  let jobClass = null, familyGroup = null;
  const idx = (r, name) => r.indexOf(name);

  for (const r of rows) {
    if (r.includes('层级') && r.includes('基本工资')) {
      cols = {
        cls: 0, family: 1, level: idx(r, '层级'), edu: idx(r, '岗位学历'), exp: idx(r, '岗位经验'),
        base: idx(r, '基本工资'), skill: idx(r, '技能工资'), taskRatio: idx(r, '任务比例'),
        task: idx(r, '任务工资'), skillStep: idx(r, '技能级差'), taskStep: idx(r, '任务级差'),
        adjStep: idx(r, '调整级差'), title: idx(r, '对应岗位'), annual: idx(r, '标准年薪 （不含绩效）'),
        monthly: idx(r, '月薪标准'),
      };
      // A-G 紧跟 调整级差 之后 7 列
      cols.gearStart = cols.adjStep + 1;
      continue;
    }
    if (!cols) continue;
    const cls = romanToClass(r[cols.cls] || '');
    if (cls) jobClass = cls;
    if (r[cols.family]) familyGroup = r[cols.family];
    const level = r[cols.level];
    if (!/^L\d/i.test(level)) continue;
    const gears = {};
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((g, i) => { gears[g] = num(r[cols.gearStart + i]); });
    bands.push({
      jobClass, familyGroup, level, education: r[cols.edu], experience: r[cols.exp],
      baseWage: num(r[cols.base]), skillWageSnapshot: num(r[cols.skill]), taskRatio: Number(r[cols.taskRatio]) || 0,
      taskWageStd: num(r[cols.task]), skillStep: num(r[cols.skillStep]), taskStep: num(r[cols.taskStep]),
      adjustStep: num(r[cols.adjStep]), taskGears: gears, title: r[cols.title],
      annual: num(r[cols.annual]), monthly: num(r[cols.monthly]),
    });
  }
  return bands;
}

// ---------------------------------------------------------------------------
const { skills, reconcile } = parseSkills();
const bands = parseBands();

mkdirSync('lib/comp/seed', { recursive: true });
writeFileSync('lib/comp/seed/skills.json', JSON.stringify(skills, null, 2), 'utf8');
writeFileSync('lib/comp/seed/grade-bands.json', JSON.stringify(bands, null, 2), 'utf8');
writeFileSync('lib/comp/seed/reconcile.json', JSON.stringify(reconcile, null, 2), 'utf8');

// 导入参考差异 (docs/comp-reconcile-review.md) —— 非阻断, 仅提示 HR
const reviewLines = [
  '# 导入参考差异：薪酬总表"合计行" vs 实时 Σ技能定价', '',
  '> 自动生成 (scripts/comp/import-comp-tables.mjs)。**技能工资唯一真源 = 能力定价表 (comp_skill_def)，由 HR 动态维护。**',
  '> 薪酬总表的"合计行"仅为历史快照；以下差异是**正常现象**（HR 事后调价/快照过期），**非阻断错误**。',
  '> 系统技能工资恒以实时 Σ定价 计算；HR 在定价治理台调价即消解差异。此表供 HR 参考核对。', '',
  '| 板块 | 岗族 | 等级 | 旧快照(合计) | 实时Σ定价 | 差额 |',
  '|---|---|---|---:|---:|---:|',
  ...reconcile.map((a) => `| ${a.board} | ${a.family} | ${a.level} | ${a.actual} | ${a.expected} | ${a.diff} |`),
  '', `**差异条目**: ${reconcile.length} 项（参考，非阻断）。`,
];
writeFileSync('docs/comp-reconcile-review.md', reviewLines.join('\n'), 'utf8');

const families = [...new Set(skills.map((s) => s.board + ' / ' + s.family))];
console.log('=== 导入汇总 ===');
console.log('技能条目:', skills.length, '| 岗族:', families.length, '| 带宽行:', bands.length);
console.log('\n=== 对账异常 (合计 ≠ Σ技能定价) ===');
if (!reconcile.length) console.log('无异常, 全部咬合 ✓');
else {
  for (const a of reconcile) console.log(`[${a.board}] ${a.family} ${a.level}: 合计=${a.actual} Σ定价=${a.expected} 差=${a.diff}`);
  console.log('\n异常合计:', reconcile.length, '项 (源表数据质量问题, 需人工核对)');
}
console.log('\n种子已写: lib/comp/seed/skills.json, grade-bands.json');
