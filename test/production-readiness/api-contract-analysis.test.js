const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  extractApiCalls,
  normalizeApiPath
} = require('../../scripts/lib/apiContractAnalysis');

describe('API contract analysis path normalization', () => {
  test('keeps Rysnova retired download URLs in route matching scope', () => {
    expect(normalizeApiPath('/rysnova-bim-deliverables/CNT-001/design-proposal.pdf'))
      .toBe('/rysnova-bim-deliverables/CNT-001/design-proposal.pdf');
    expect(normalizeApiPath('/images/ruud-logo.svg')).toBe(null);
  });

  test('extracts Rysnova retired download fetches instead of treating them as static assets', () => {
    const file = path.join(os.tmpdir(), `rysnova-bim-api-contract-${Date.now()}.js`);
    fs.writeFileSync(file, "fetch('/rysnova-bim-deliverables/CNT-001/material-bom.xlsx');\n", 'utf8');

    try {
      expect(extractApiCalls(file).map(call => call.path)).toEqual([
        '/rysnova-bim-deliverables/CNT-001/material-bom.xlsx'
      ]);
    } finally {
      fs.unlinkSync(file);
    }
  });
});
