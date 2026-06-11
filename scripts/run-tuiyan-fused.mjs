/**
 * 融合推演 · 先热重载 skill registry (注册新加的 KPI/9宫格/奖金 工具),
 * 再让中央 AI 跨 OKR+KPI+人才+奖金 四维真值做推演, 找出系统进化机会。
 *   node scripts/run-tuiyan-fused.mjs ["自定义问题"]
 */
const BASE = process.env.BASE || 'http://localhost:3000';
const QUESTION = process.argv[2] ||
  '基于公司真实数据做一次融合推演, 找出瑞合瑞德这套"经营管理系统"当前最值得抓的进化机会。' +
  '请综合四个维度交叉看: ① OKR 目标健康度; ② KPI 底线达成与权重/cascade 配置; ' +
  '③ 人才 9 宫格分布 (谁是 star、谁在烧穿 risk_burnout、谁要 must_intervene); ' +
  '④ 年终奖金池与下发就绪度。重点找"跨维度的错配与杠杆点"——例如高 KPI 低 TTI 的烧穿风险、' +
  '奖金与实际产出错配、目标与底线不一致。给出 3-5 个进化机会, 每个含: 现状证据(引用真实数字)、' +
  '为什么是机会、下一步动作、优先级。';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'e00001@ruihe.local', password: 'Ruihe@2026' }),
});
if (login.status !== 200) { console.error('login failed', login.status, await login.text()); process.exit(1); }
const cookie = (login.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/).map((s) => s.split(';')[0].trim()).join('; ');
console.log('✓ 登录 owner\n');

// 1) 热重载 skill registry (让新加的工具立即生效, 无需重启 dev server)
const reload = await fetch(`${BASE}/api/admin/skills/reload`, { method: 'POST', headers: { cookie } });
const reloadJson = await reload.json().catch(() => ({}));
console.log('skill reload:', reload.status, JSON.stringify(reloadJson).slice(0, 400), '\n');

// 2) 跑融合推演
console.log('问题:', QUESTION, '\n');
console.log('─────────────── 中央 AI 融合推演 ───────────────');
const res = await fetch(`${BASE}/api/boss-ai/stream`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ messages: [{ role: 'user', content: QUESTION }], currentPath: '/okr', sessionId: 'tuiyan-fused-' + Date.now() }),
});
if (!res.ok || !res.body) { console.error('stream failed', res.status, await res.text()); process.exit(1); }
let buf = '', answer = '';
const decoder = new TextDecoder();
for await (const chunk of res.body) {
  buf += decoder.decode(chunk, { stream: true });
  const parts = buf.split('\n\n');
  buf = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data: '));
    if (!line) continue;
    let obj; try { obj = JSON.parse(line.slice(6)); } catch { continue; }
    if (obj.status) process.stdout.write(`\x1b[2m[${obj.status}]\x1b[0m\n`);
    if (obj.content) { answer += obj.content; process.stdout.write(obj.content); }
    if (obj.error) console.error('\n[ERROR]', obj.error);
    if (obj.done) process.stdout.write('\n─────────────── 推演结束 ───────────────\n');
  }
}
console.log(`\n(共 ${answer.length} 字)`);
