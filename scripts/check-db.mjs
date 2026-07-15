import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://postgres:Rheem2025@113.249.110.37:5432/tandem',
  connectionTimeoutMillis: 8000,
});
try {
  await c.connect();
  // admin@tandem.local 的 user id
  const u = await c.query(`SELECT id, email, roles, disabled FROM "User" WHERE email = 'admin@tandem.local'`);
  console.log('admin@tandem.local:', u.rows[0]);

  // 它的密码记录
  const uid = u.rows[0]?.id;
  if (uid) {
    const pw = await c.query(`SELECT id, data FROM "KvStore" WHERE collection = 'auth_password' AND id = $1`, [uid]);
    console.log('\nPassword record:', pw.rows.length ? 'FOUND' : 'NOT FOUND');
    if (pw.rows[0]) {
      const hash = pw.rows[0].data.hash;
      console.log('hash prefix:', hash?.substring(0, 30));
      console.log('hash algo:', hash?.split('$')[0]);
    }

    // user_extras
    const ux = await c.query(`SELECT id, data FROM "KvStore" WHERE collection = 'auth_user_extras' AND id = $1`, [uid]);
    console.log('\nUser extras:', ux.rows.length ? 'FOUND' : 'NOT FOUND');
    if (ux.rows[0]) console.log('data:', JSON.stringify(ux.rows[0].data));
  }

  // 另一个 admin admin@rhenext.com
  const u2 = await c.query(`SELECT id, email FROM "User" WHERE email = 'admin@rhenext.com'`);
  console.log('\nadmin@rhenext.com:', u2.rows[0]);
  if (u2.rows[0]) {
    const pw2 = await c.query(`SELECT data FROM "KvStore" WHERE collection = 'auth_password' AND id = $1`, [u2.rows[0].id]);
    console.log('Password record:', pw2.rows.length ? 'FOUND' : 'NOT FOUND');
    if (pw2.rows[0]) console.log('hash prefix:', pw2.rows[0].data.hash?.substring(0, 30));
  }

  await c.end();
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
