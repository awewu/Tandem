const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const reportPath = path.join(ROOT, 'audit', 'operational-readiness-report.json');

describe('operational readiness harness', () => {
  test('recognizes modular production health and heartbeat routes', () => {
    execSync('node audit/operational-readiness-harness.js', {
      cwd: ROOT,
      stdio: 'pipe'
    });

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const heartbeatCheck = report.checks.find(check => check.name === 'production heartbeat endpoints exist');
    expect(heartbeatCheck).toBeTruthy();
    expect(heartbeatCheck.passed).toBe(true);
    expect(report.score).toBe(100);
  });
});
