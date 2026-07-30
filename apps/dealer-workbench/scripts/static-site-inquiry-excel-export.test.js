const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..', '..');
const shell = fs.readFileSync(
  path.join(root, 'apps', 'dealer-workbench', 'src', 'app', 'comfort', '[[...section]]', 'BrandSiteConsoleShell.tsx'),
  'utf8'
);

test('site inquiry export downloads a real Excel workbook', () => {
  const exportStart = shell.indexOf('async function exportCurrent()');
  const exportEnd = shell.indexOf('  return (', exportStart);
  const exportBlock = shell.slice(exportStart, exportEnd);

  assert.match(exportBlock, /await import\('xlsx'\)/);
  assert.match(exportBlock, /XLSX\.utils\.aoa_to_sheet\(\[headers, \.\.\.rows\]\)/);
  assert.match(exportBlock, /XLSX\.utils\.book_new\(\)/);
  assert.match(exportBlock, /XLSX\.write\(workbook, \{ bookType: 'xlsx', type: 'array' \}\)/);
  assert.match(exportBlock, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(exportBlock, /const exportTitle = kind === 'customer' \? '客户咨询' : '加盟咨询'/);
  assert.match(exportBlock, /link\.download = `\$\{exportTitle\}_\$\{formatExportFilenameTime\(\)\}\.xlsx`/);
  assert.match(exportBlock, /siteInquiries\.list\(siteCode, inquiryQuery\('1', '200'\)\)/);
  assert.match(exportBlock, /siteInquiries\.list\(siteCode, inquiryQuery\(String\(nextPage\), '200'\)\)/);
  assert.doesNotMatch(exportBlock, /text\/csv|inquiries\.csv|csvCell/);
});

test('site inquiry filters include submitted date range', () => {
  const filterStart = shell.indexOf('className="site-inquiry-date-filter"');
  const filterEnd = shell.indexOf('</WorkbenchFilterToolbar>', filterStart);
  const filterBlock = shell.slice(filterStart, filterEnd);

  assert.match(shell, /const \[submittedFrom, setSubmittedFrom\] = useState\(''\);/);
  assert.match(shell, /const \[submittedTo, setSubmittedTo\] = useState\(''\);/);
  assert.match(shell, /\.\.\.\(submittedFrom \? \{ submittedFrom \} : \{\}\)/);
  assert.match(shell, /\.\.\.\(submittedTo \? \{ submittedTo \} : \{\}\)/);
  assert.match(filterBlock, /<Calendar size=\{14\} \/>/);
  assert.match(filterBlock, /type="date"/);
  assert.match(filterBlock, /setSubmittedFrom\(event\.target\.value\)/);
  assert.match(filterBlock, /setSubmittedTo\(event\.target\.value\)/);
  assert.match(filterBlock, /min=\{submittedFrom \|\| undefined\}/);
  assert.match(filterBlock, /className="site-inquiry-date-filter"/);
  assert.match(filterBlock, /className="input site-inquiry-date-input"/);
  assert.match(shell, /\.site-inquiry-date-filter-label/);
  assert.match(shell, /\.site-inquiry-date-input::-webkit-calendar-picker-indicator/);
  assert.doesNotMatch(filterBlock, /inputMode="numeric"|normalizeDateFilterInput/);
});
