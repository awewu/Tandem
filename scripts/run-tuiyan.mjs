/**
 * 跑推演 · 调用 Tandem 中央 AI (CompanyBrain) 对导入的瑞合瑞德 OKR 数据做多步深推理。
 *
 *   node scripts/run-tuiyan.mjs ["自定义问题"]
 *
 * 走 /api/boss-ai/stream (S2 深推理: okr.health_digest / okr.read / memory.search),
 * 以 owner 身份登录, 流式打印中央 AI 的推演简报与结论。
 */
const BASE = process.env.BASE || 'http://localhost:3000';
const QUESTION = process.argv[2] ||
  '请基于公司真实 OKR 数据分析瑞合瑞德集团 2026 年度目标的整体健康度：' +
  '空气和水事业部 与 制造事业部 相比，哪个的 KR 风险更高？' +
  '应该优先保障哪些目标、收缩或砍掉哪些？请给出依据和优先级建议。';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'e00001@ruihe.local', password: 'Ruihe@2026' }),
});
if (login.status !== 200) { console.error('login failed', login.status, await login.text()); process.exit(1); }
const cookie = (login.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/).map((s) => s.split(';')[0].trim()).join('; ');
console.log('✓ 登录 owner e00001@ruihe.local\n');
console.log('问题:', QUESTION, '\n');
console.log('─────────────── 中央 AI 推演 ───────────────');

const res = await fetch(`${BASE}/api/boss-ai/stream`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ messages: [{ role: 'user', content: QUESTION }], currentPath: '/okr', sessionId: 'tuiyan-' + Date.now() }),
});
if (!res.ok || !res.body) { console.error('stream failed', res.status, await res.text()); process.exit(1); }

let buf = '';
let answer = '';
const decoder = new TextDecoder();
for await (const chunk of res.body) {
  buf += decoder.decode(chunk, { stream: true });
  const parts = buf.split('\n\n');
  buf = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data: '));
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line.slice(6)); } catch { continue; }
    if (obj.status) process.stdout.write(`\x1b[2m[${obj.status}]\x1b[0m\n`);
    if (obj.content) { answer += obj.content; process.stdout.write(obj.content); }
    if (obj.error) console.error('\n[ERROR]', obj.error);
    if (obj.done) process.stdout.write('\n─────────────── 推演结束 ───────────────\n');
  }
}
console.log(`\n(共 ${answer.length} 字)`);
