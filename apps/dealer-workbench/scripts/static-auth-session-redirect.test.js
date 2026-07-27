const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const apiPath = path.join(__dirname, '..', 'src', 'lib', 'api.ts');
const apiSource = fs.readFileSync(apiPath, 'utf8');

test('API wrapper redirects expired authenticated sessions to login', () => {
  assert.match(apiSource, /import \{ clearToken, getToken \} from '@rhautt\/shared-auth';/);
  assert.match(apiSource, /function isAuthExpired\(status: number, details: any\): boolean/);
  assert.match(apiSource, /if \(status === 401\) return true;/);
  assert.match(apiSource, /status === 403 && authExpiredMessages\.some/);
  assert.match(apiSource, /function redirectToLogin\(path: string, status: number, details: any\)/);
  assert.match(apiSource, /clearToken\(\);/);
  assert.match(apiSource, /localStorage\.removeItem\('token'\);/);
  assert.match(apiSource, /localStorage\.removeItem\('user'\);/);
  assert.match(apiSource, /window\.location\.href = `\/\?returnUrl=\$\{encodeURIComponent\(returnUrl\)\}`;/);
  assert.match(apiSource, /redirectToLogin\(path, res\.status, json\);/);
});

test('login form authentication errors stay on the login page', () => {
  assert.match(apiSource, /const AUTH_LOGIN_PATH = '\/api\/v2\/auth\/login';/);
  assert.match(apiSource, /if \(path === AUTH_LOGIN_PATH \|\| typeof window === 'undefined' \|\| !isAuthExpired\(status, details\)\) return;/);
});
