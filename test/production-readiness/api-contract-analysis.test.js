const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  extractApiCalls,
  normalizeApiPath
} = require('../../scripts/lib/apiContractAnalysis');

describe('API contract analysis path normalization', () => {
  test('normalizes non-API download URLs into route matching scope', () => {
    expect(normalizeApiPath('/downloads/CNT-001/quotation.pdf'))
      .toBe('/api/downloads/CNT-001/quotation.pdf');
    expect(normalizeApiPath('/images/ruud-logo.svg')).toBe(null);
  });

  test('extracts download fetches instead of treating them as static assets', () => {
    const file = path.join(os.tmpdir(), `download-api-contract-${Date.now()}.js`);
    fs.writeFileSync(file, "fetch('/downloads/CNT-001/quotation.pdf');\n", 'utf8');

    try {
      expect(extractApiCalls(file).map(call => call.path)).toEqual([
        '/api/downloads/CNT-001/quotation.pdf'
      ]);
    } finally {
      fs.unlinkSync(file);
    }
  });
});
