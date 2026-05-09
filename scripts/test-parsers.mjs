// Headless smoke test for the document parser.
// Runs in Node, mocks File via Blob+name shim. Validates that mammoth/xlsx/jszip
// can actually parse real-world bytes.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const fixtures = resolve(root, 'scripts', 'fixtures');
if (!existsSync(fixtures)) mkdirSync(fixtures, { recursive: true });

// Build a minimal real .xlsx fixture using xlsx itself
const XLSX = await import('xlsx');
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([
  ['SKU', '品名', '单价', '5月预测'],
  ['HH-A12-Pro', '即热式电热水器 12kW', 1899, 17800],
  ['HH-A10-Lite', '即热式电热水器 8kW', 1199, 8000],
]);
XLSX.utils.book_append_sheet(wb, ws, '5月需求');
const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const xlsxPath = resolve(fixtures, 'demand-may.xlsx');
writeFileSync(xlsxPath, xlsxBuf);

// Build a minimal real .docx fixture from scratch using JSZip
const JSZip = (await import('jszip')).default;
const zip = new JSZip();
zip.file('[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
zip.file('_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
zip.file('word/document.xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>恒热品牌 GEO 优化方案 V1</w:t></w:r></w:p>
<w:p><w:r><w:t>目标：30 天内让恒热出现在 AI 引擎相关问答的前 3 推荐。</w:t></w:r></w:p>
</w:body>
</w:document>`);
const docxBuf = await zip.generateAsync({ type: 'nodebuffer' });
const docxPath = resolve(fixtures, 'geo-plan.docx');
writeFileSync(docxPath, docxBuf);

// Test parsing
const mammoth = await import('mammoth');

console.log('=== Parser smoke test ===\n');

// Test xlsx
const xlsxData = readFileSync(xlsxPath);
const xlsxWb = XLSX.read(xlsxData, { type: 'buffer' });
const csv = XLSX.utils.sheet_to_csv(xlsxWb.Sheets['5月需求']);
console.log('[xlsx]', xlsxPath);
console.log('  sheets:', xlsxWb.SheetNames);
console.log('  csv:');
console.log(csv.split('\n').map(l => '    ' + l).join('\n'));

// Test docx
const docxData = readFileSync(docxPath);
const docxResult = await mammoth.extractRawText({ buffer: docxData });
console.log('\n[docx]', docxPath);
console.log('  extracted text:');
console.log(docxResult.value.split('\n').map(l => '    ' + l).join('\n'));

console.log('\n✅ All parsers OK');
console.log('Fixtures saved to', fixtures);
console.log('You can drag-upload these to /memories or /knowledge to verify the UI flow.');
