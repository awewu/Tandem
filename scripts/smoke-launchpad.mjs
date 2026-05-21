/**
 * Launchpad full-chain smoke:
 *   list → click → admin stats → CRUD → reorder → toggle → delete
 *
 * Run after `npx next dev -p 3001` is up.
 */
const BASE = process.env.BASE ?? 'http://localhost:3001';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name} :: ${detail ?? ''}`); fail++; }
}

async function j(path, init) {
  const r = await fetch(BASE + path, init);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { _raw: text }; }
  return { status: r.status, body };
}

(async () => {
  console.log('\n[1] GET /api/launchpad (viewer)');
  const list = await j('/api/launchpad');
  check('200', list.status === 200, list.status);
  check('apps array', Array.isArray(list.body.apps), JSON.stringify(list.body).slice(0, 100));
  check('seed produced ≥ 7 apps', (list.body.apps?.length ?? 0) >= 7, `got ${list.body.apps?.length}`);

  if (!list.body.apps?.length) { console.log('No apps; abort'); process.exit(1); }
  const target = list.body.apps[0];
  console.log(`  target: ${target.name} (${target.id})`);

  console.log('\n[2] POST /api/launchpad/:id/click');
  const click = await j(`/api/launchpad/${target.id}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'home' }),
  });
  check('200', click.status === 200, click.status);
  check('returns url', !!click.body.url, JSON.stringify(click.body));

  console.log('\n[3] GET /api/admin/launchpad — stats updated');
  const admin = await j('/api/admin/launchpad');
  check('200', admin.status === 200);
  const targetStats = admin.body.apps?.find((a) => a.id === target.id);
  check('target totalClicks ≥ 1', (targetStats?.stats?.totalClicks ?? 0) >= 1, `got ${targetStats?.stats?.totalClicks}`);
  check('target uniqueUsers ≥ 1', (targetStats?.stats?.uniqueUsers ?? 0) >= 1, `got ${targetStats?.stats?.uniqueUsers}`);

  console.log('\n[4] POST /api/launchpad — create (admin)');
  const created = await j('/api/launchpad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Test App',
      url: 'https://smoke.test',
      category: 'custom',
      description: 'created by smoke',
      recommendKeywords: ['smoke'],
    }),
  });
  check('201', created.status === 201, created.status);
  const newId = created.body.app?.id;
  check('id returned', !!newId);

  console.log('\n[5] PATCH /api/launchpad/:id — update');
  const patch = await j(`/api/launchpad/${newId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'updated by smoke' }),
  });
  check('200', patch.status === 200);
  check('description updated', patch.body.app?.description === 'updated by smoke');

  console.log('\n[6] PATCH disable + re-enable');
  const off = await j(`/api/launchpad/${newId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'disabled' }),
  });
  check('disable 200', off.status === 200 && off.body.app?.status === 'disabled');
  // viewer should NOT see disabled app
  const list2 = await j('/api/launchpad');
  check('viewer hides disabled', !list2.body.apps?.some((a) => a.id === newId));
  await j(`/api/launchpad/${newId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  });

  console.log('\n[7] POST /api/admin/launchpad — reorder');
  const reorder = await j('/api/admin/launchpad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderMap: [{ id: newId, order: 999 }] }),
  });
  check('reorder 200', reorder.status === 200);
  const after = await j('/api/admin/launchpad');
  const reordered = after.body.apps?.find((a) => a.id === newId);
  check('order=999', reordered?.order === 999, `got ${reordered?.order}`);

  console.log('\n[8] DELETE /api/launchpad/:id');
  const del = await j(`/api/launchpad/${newId}`, { method: 'DELETE' });
  check('200', del.status === 200);
  const final = await j('/api/admin/launchpad');
  check('app removed', !final.body.apps?.some((a) => a.id === newId));

  console.log(`\n=== Launchpad smoke: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
