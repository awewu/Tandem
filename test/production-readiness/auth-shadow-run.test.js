/**
 * Auth M2 · 影子运行对比脚本契约测试
 *
 * 验证 scripts/auth-shadow-run.js 存在、结构正确，且能在无真实服务器时
 * 被解析/检查通过。真实双端对比需要 staging 手动运行该脚本。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'auth-shadow-run.js');
const REPORT_DIR = path.join(ROOT, 'reports', 'auth-shadow-run');

describe('Auth M2 · 影子运行对比脚本', () => {
  test('脚本存在且可被 Node 解析', () => {
    expect(fs.existsSync(SCRIPT)).toBe(true);
    const out = execSync(`node --check ${SCRIPT}`, { encoding: 'utf8' });
    expect(out).toBe('');
  });

  test('脚本读取环境变量配置并支持 LEGACY_URL / NESTJS_URL / TEST_PHONE / TEST_PASSWORD', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    expect(src).toMatch(/process\.env\.LEGACY_URL/);
    expect(src).toMatch(/process\.env\.NESTJS_URL/);
    expect(src).toMatch(/process\.env\.TEST_PHONE/);
    expect(src).toMatch(/process\.env\.TEST_PASSWORD/);
  });

  test('脚本覆盖所有 legacy auth 端点的镜像对比', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const required = ['/login', '/login-sms', '/send-sms', '/register', '/me', '/user', '/password', '/refresh-token', '/logout'];
    for (const p of required) {
      expect(src).toContain(p);
    }
  });

  test('脚本对比 status 与 body shape 并输出 JSON/Markdown 报告', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    expect(src).toMatch(/statusMatch/);
    expect(src).toMatch(/shapeMatch/);
    expect(src).toMatch(/\.json/);
    expect(src).toMatch(/\.md/);
    expect(src).toMatch(/REPORT_DIR/);
  });

  test('报告目录已预创建能力', () => {
    // 脚本运行时会自动创建 reports/auth-shadow-run；这里只验证目录路径声明一致。
    expect(fs.readFileSync(SCRIPT, 'utf8')).toContain("reports', 'auth-shadow-run'");
  });
});
