#!/usr/bin/env node
/**
 * 全量闭环验证 v2 · 业务写入路径 + 跨角色可见性
 *
 * 覆盖:
 *   - employee 登录 → POST /api/convergence (新建议事, noKrReason 路径)
 *   - employee 看 /api/tandem-okr (objectives)
 *   - manager  登录 → GET /api/convergence (能看到 employee 刚建的议事)
 *   - hr       登录 → GET /api/360/cycles, /api/org/users
 *   - 任一登录身份 → /api/llm-health (DeepSeek 健康度)
 *   - 任一登录身份 → /api/health
 *
 * 输出: 每步 HTTP + 关键字段 + ✅/❌. 末尾给汇总.
 *
 * 用法: node scripts/full-loop-verify.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3005';
const PASSWORD = 'Demo1234!@#';

const ACCOUNTS = {
  employee: 'employee@tandem.local',
  manager:  'manager@tandem.local',
  hr:       'hr@tandem.local',
};

const cookieJars = {};
const stats = { pass: 0, fail: 0, steps: [] };

function pass(label, detail) {
  stats.pass++;
  stats.steps.push({ ok: true, label, detail });
  console.log(`  ✅ ${label}  ${detail ?? ''}`);
}

function fail(label, detail) {
  stats.fail++;
  stats.steps.push({ ok: false, label, detail });
  console.log(`  ❌ ${label}  ${detail ?? ''}`);
}

async function login(role) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ACCOUNTS[role], password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    fail(`login ${role}`, `HTTP ${res.status} ${JSON.stringify(body)}`);
    return false;
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  cookieJars[role] = setCookie.map((c) => String(c).split(';')[0]).filter(Boolean).join('; ');
  pass(`login ${role}`, `userId=${body.userId.slice(0, 18)}... cookies=${cookieJars[role].length} chars`);
  return true;
}

async function call(role, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieJars[role] ?? '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text.slice(0, 160) }; }
  return { status: res.status, body: json, ok: res.ok };
}

async function section(name, fn) {
  console.log(`\n━━ ${name} ━━`);
  try { await fn(); } catch (e) { fail(`${name} threw`, e.message); }
}

async function main() {
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║  Tandem · 全量业务闭环验证 v2                 ║`);
  console.log(`║  ${BASE.padEnd(45)} ║`);
  console.log(`╚═══════════════════════════════════════════════╝`);

  // ───── §1 health checks ─────
  await section('§1 系统健康度', async () => {
    const r1 = await call('employee', 'GET', '/api/health');
    r1.ok ? pass('GET /api/health', `HTTP 200`) : fail('GET /api/health', `HTTP ${r1.status}`);
    const r2 = await call('employee', 'GET', '/api/llm-health');
    if (r2.ok && r2.body.deepseekHealthy) {
      pass('GET /api/llm-health (DeepSeek)', `latency=${r2.body.health?.['deepseek-v3']?.latencyMs}ms`);
    } else {
      fail('GET /api/llm-health (DeepSeek)', JSON.stringify(r2.body).slice(0, 100));
    }
  });

  // ───── §2 三角色登录 ─────
  await section('§2 三角色登录', async () => {
    await login('employee');
    await login('manager');
    await login('hr');
  });

  // ───── §3 身份正确性 ─────
  await section('§3 身份正确性', async () => {
    for (const role of ['employee', 'manager', 'hr']) {
      const r = await call(role, 'GET', '/api/auth/me');
      if (r.ok && r.body.user?.email === ACCOUNTS[role]) {
        pass(`/api/auth/me (${role})`, `roles=[${(r.body.user.roles ?? []).join(',')}]`);
      } else {
        fail(`/api/auth/me (${role})`, `body=${JSON.stringify(r.body).slice(0, 120)}`);
      }
    }
  });

  // ───── §4 读路径 (各 role 读公共数据) ─────
  await section('§4 公共数据读路径', async () => {
    const r1 = await call('employee', 'GET', '/api/tandem-okr');
    if (r1.ok && Array.isArray(r1.body.objectives)) {
      pass('GET /api/tandem-okr', `objectives=${r1.body.objectives.length}`);
    } else {
      fail('GET /api/tandem-okr', JSON.stringify(r1.body).slice(0, 120));
    }

    const r2 = await call('manager', 'GET', '/api/org/users');
    if (r2.ok && Array.isArray(r2.body.users)) {
      pass('GET /api/org/users (manager)', `users=${r2.body.users.length}`);
    } else {
      fail('GET /api/org/users (manager)', JSON.stringify(r2.body).slice(0, 120));
    }

    const r3 = await call('hr', 'GET', '/api/360/cycles');
    if (r3.ok && Array.isArray(r3.body.cycles)) {
      pass('GET /api/360/cycles (hr)', `cycles=${r3.body.cycles.length}`);
    } else {
      fail('GET /api/360/cycles (hr)', JSON.stringify(r3.body).slice(0, 120));
    }

    const r4 = await call('employee', 'GET', '/api/tandem/memory/list?limit=5');
    if (r4.ok && Array.isArray(r4.body.memories)) {
      pass('GET /api/tandem/memory/list', `memories=${r4.body.memories.length}`);
    } else {
      fail('GET /api/tandem/memory/list', JSON.stringify(r4.body).slice(0, 120));
    }

    const r5 = await call('employee', 'GET', '/api/dashboard/stats');
    if (r5.ok && r5.body.decisionCards) {
      pass('GET /api/dashboard/stats', `cards=${r5.body.decisionCards?.total}, memories=${r5.body.memories?.total}`);
    } else {
      fail('GET /api/dashboard/stats', JSON.stringify(r5.body).slice(0, 120));
    }
  });

  // ───── §5 employee 创建议事 ─────
  let convergenceId = null;
  await section('§5 employee → POST /api/convergence (新建议事)', async () => {
    const r = await call('employee', 'POST', '/api/convergence', {
      title: `[E2E test] 张伟提议引入周会工作量 ${new Date().toISOString().slice(0, 16)}`,
      description: 'E2E 跨角色闭环验证脚本自动创建. 议程: 评估周会带来的实际产能影响.',
      noKrReason: '本议题是流程改进, 不直接关联到任何 Q2 KR 指标, 故选择无 KR 路径.',
    });
    if (r.ok && r.body.cardId) {
      convergenceId = r.body.cardId;
      pass('POST /api/convergence (employee)', `cardId=${convergenceId.slice(0, 18)}... step=${r.body.step}`);
    } else {
      fail('POST /api/convergence (employee)', `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 150)}`);
    }
  });

  // ───── §6 跨角色可见性: manager 能看到 employee 刚建的议事 ─────
  await section('§6 跨角色可见性 · manager GET /api/convergence', async () => {
    const r = await call('manager', 'GET', '/api/convergence');
    if (!r.ok) {
      fail('GET /api/convergence (manager)', `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
      return;
    }
    const cards = r.body.cards ?? [];
    const found = convergenceId ? cards.find((c) => c.id === convergenceId) : null;
    if (found) {
      pass('manager 真后端看到 employee 议事', `title="${found.title.slice(0, 40)}..."`);
    } else {
      fail('manager 真后端看到 employee 议事', `total=${cards.length}, 但未找到 id=${convergenceId}`);
    }
  });

  // ───── §7 hr 视角验证 ─────
  await section('§7 hr 视角', async () => {
    const r1 = await call('hr', 'GET', '/api/org/users');
    if (r1.ok && Array.isArray(r1.body.users)) {
      // 注意: /api/org/users 在隐私脱敏后, 同事的 email 字段为空 (EVO-7, by design).
      // 用 name 字段做判定.
      const hasEmployee = r1.body.users.some((u) => /张伟|员工/.test(u.name ?? ''));
      const hasManager = r1.body.users.some((u) => /王主管|部门经理/.test(u.name ?? ''));
      if (hasEmployee && hasManager) {
        pass('hr 能看到 employee + manager', `total=${r1.body.users.length} (email 脱敏 by EVO-7)`);
      } else {
        fail('hr 看到的用户不完整', `hasEmployee=${hasEmployee}, hasManager=${hasManager}, names=${r1.body.users.map(u=>u.name).join('|')}`);
      }
    } else {
      fail('GET /api/org/users (hr)', JSON.stringify(r1.body).slice(0, 120));
    }
  });

  // ───── §8 LLM 流式 (SSE) 触达测试 ─────
  await section('§8 LLM 流式调用 (POST /api/ai/extract-daily-report)', async () => {
    // 只验证能开始接收 SSE 流, 不等完整结果
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 12_000);
      const res = await fetch(`${BASE}/api/ai/extract-daily-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Cookie: cookieJars.employee ?? '',
        },
        body: JSON.stringify({
          rawInput: '今天调试好了登录流程, 修复了 6 个 e2e 测试, 接入了 DeepSeek 真 LLM. 明天准备做云端部署.',
          kr: {
            id: 'kr_e2e_test',
            title: '完成 Tandem 单机版上线 + 云端试用',
            startValue: 0,
            targetValue: 100,
            currentValue: 40,
            unit: '%',
            measureType: 'percentage',
            confidence: 'on-track',
          },
          mood: 'focused',
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        fail('LLM SSE init', `HTTP ${res.status}`);
        return;
      }
      // 读前 2KB 验证 SSE 起拍
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = '';
      let chunks = 0;
      const t = Date.now();
      while (Date.now() - t < 6000 && chunks < 5) {
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise((r) => setTimeout(() => r({ value: undefined, done: true }), 4000)),
        ]);
        if (done || !value) break;
        received += decoder.decode(value, { stream: true });
        chunks++;
      }
      reader.cancel().catch(() => {});
      if (chunks > 0 && received.length > 0) {
        pass('LLM SSE 流式响应', `chunks=${chunks}, head="${received.slice(0, 60).replace(/\n/g, '\\n')}..."`);
      } else {
        fail('LLM SSE 流式响应', `没收到任何 chunk (chunks=${chunks}, len=${received.length})`);
      }
    } catch (e) {
      fail('LLM SSE 流式响应', e.message);
    }
  });

  // ───── §9 logout 测试 ─────
  await section('§9 logout 测试', async () => {
    const r = await call('employee', 'POST', '/api/auth/logout');
    if (r.ok) {
      pass('POST /api/auth/logout (employee)', `cleared`);
    } else {
      fail('POST /api/auth/logout (employee)', `HTTP ${r.status}`);
    }
  });

  // ───── 汇总 ─────
  console.log(`\n╔═══════════════════════════════════════════════╗`);
  console.log(`║  汇总                                          ║`);
  console.log(`╠═══════════════════════════════════════════════╣`);
  console.log(`║  ✅ Pass: ${String(stats.pass).padStart(3)}                                  ║`);
  console.log(`║  ❌ Fail: ${String(stats.fail).padStart(3)}                                  ║`);
  console.log(`║  ${stats.fail === 0 ? '🟢 全部通过!  云端部署 GO' : '🔴 有失败项, 看上面 ❌'.padEnd(43)} ║`);
  console.log(`╚═══════════════════════════════════════════════╝`);

  if (stats.fail > 0) {
    console.log('\nFailed steps:');
    for (const s of stats.steps.filter((s) => !s.ok)) {
      console.log(`  - ${s.label}: ${s.detail}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
