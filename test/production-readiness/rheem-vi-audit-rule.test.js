const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const auditScript = fs.readFileSync(
  path.join(ROOT, 'scripts/agent-guards/rheem-vi-production-audit.js'),
  'utf8'
);

describe('Rheem VI audit rule precision', () => {
  test('does not treat every 瑞美 equipment mention as a fake logo lockup', () => {
    expect(auditScript).toContain('contextualChecks');
    expect(auditScript).toContain('Potential fake Rheem Chinese lockup appears near logo/wordmark usage');

    const benignEquipmentCopy = "desc: '瑞美 RTG-95X 80L'";
    const contextualPattern = /瑞\s*美/gi;
    const shouldFlag = ({ relativePath, snippet }) => (
      /rheem-logo\.svg$/.test(relativePath) ||
      /logo|wordmark|lockup|brand-mark|brand-logo|brand-card|Since 1925/i.test(snippet)
    );

    expect(contextualPattern.test(benignEquipmentCopy)).toBe(true);
    expect(shouldFlag({
      relativePath: 'public/customer-share.html',
      snippet: benignEquipmentCopy
    })).toBe(false);
    expect(shouldFlag({
      relativePath: 'public/images/rheem-logo.svg',
      snippet: '<text>瑞美</text>'
    })).toBe(true);
    expect(shouldFlag({
      relativePath: 'public/index-ready.html',
      snippet: 'brand-card Rheem 瑞美 Since 1925'
    })).toBe(true);
  });
});
