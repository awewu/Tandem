#!/usr/bin/env node
/**
 * Tandem · 硬盘目录一键导入与投喂学习脚本 (import-local-folder.mjs)
 *
 * 用途: 递归扫描指定本地硬盘文件夹，自动解析纯文本，并在系统数据库建立 documents + memories(个人记忆)，让 AI 瞬间吸收！
 * 支持: TXT / MD / CSV / JSON / DOCX / XLSX / PPTX / PDF
 *
 * 用法:
 *   node scripts/import-local-folder.mjs "D:\你的本地文件夹" [Owner邮箱, 默认 admin@tandem.local]
 */

import pg from 'pg';
import { randomBytes, Buffer } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// ---------- 简易 .env loader ----------
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local')); // override

if (!process.env.DATABASE_URL) {
  console.error('[import] FATAL: DATABASE_URL not set');
  process.exit(1);
}

// 接收终端参数
const targetFolder = process.argv[2];
const ownerEmailInput = process.argv[3] || process.env.TANDEM_BOOTSTRAP_OWNER_EMAIL || 'admin@tandem.local';

if (!targetFolder) {
  console.log('\n❌ [错误] 缺少目标本地文件夹路径！');
  console.log('用法: node scripts/import-local-folder.mjs "D:\\你的文件夹" [Owner邮箱]');
  console.log('例如: node scripts/import-local-folder.mjs "C:\\Users\\Desktop\\Tandem-SOPs"\n');
  process.exit(1);
}

if (!existsSync(targetFolder)) {
  console.error(`❌ [错误] 目标本地文件夹不存在: ${targetFolder}`);
  process.exit(1);
}

function genId(prefix) {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}

// ---------- 各种文件的高性能 Node 端解析实现 ----------

async function parseDocx(filePath) {
  const buf = readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value.trim();
}

async function parseXlsx(filePath) {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sections = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) sections.push(`### Sheet: ${name}\n\n${csv}`);
  }
  return sections.join('\n\n---\n\n').trim();
}

async function parsePptx(filePath) {
  const buf = readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const ai = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
      const bi = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
      return ai - bi;
    });
  const sections = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const xml = await zip.files[slidePaths[i]].async('string');
    const texts = [];
    const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const piece = m[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (piece.trim()) texts.push(piece);
    }
    if (texts.length) sections.push(`### Slide ${i + 1}\n\n${texts.join('\n')}`);
  }
  return sections.join('\n\n---\n\n').trim();
}

// Node.js 端 PDF 解析免 worker 极简兼容
async function parsePdf(filePath) {
  // 采用 pdfjs-dist 在 Node 环境下的极简引入，
  // 如果 pdfjs 抛错，我们提供优雅捕获
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const buf = readFileSync(filePath);
    const data = new Uint8Array(buf);
    const doc = await pdfjs.getDocument({ data }).promise;
    const sections = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) sections.push(`### Page ${i}\n\n${text}`);
    }
    return sections.join('\n\n---\n\n').trim();
  } catch (err) {
    throw new Error(`PDF 解析加载失败 (在 Node 端通常需要 pdfjs-dist/legacy)。详情: ${err.message}`);
  }
}

async function parsePlain(filePath) {
  return readFileSync(filePath, 'utf8').trim();
}

// ---------- 遍历本地目录 ----------

const SUPPORTED_EXTS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.json', '.log',
  '.docx', '.xlsx', '.xls', '.ods', '.pptx', '.pdf'
]);

function scanFiles(dir, filesList = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      scanFiles(fullPath, filesList);
    } else {
      const ext = extname(item).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) {
        filesList.push({
          fullPath,
          fileName: item,
          ext,
          size: stat.size,
          relativePath: fullPath.replace(targetFolder, '').replace(/^[\\/]/, '')
        });
      }
    }
  }
  return filesList;
}

// ---------- Main Execution ----------

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  console.log(`[import] Connected to database.`);

  // 1. 获取 Owner / Admin 用户
  const ownerEmail = ownerEmailInput.toLowerCase();
  const ownerRes = await client.query('SELECT id FROM "User" WHERE email = $1', [ownerEmail]);
  if (ownerRes.rowCount === 0) {
    console.error(`❌ [错误] 邮箱为 ${ownerEmail} 的用户不存在！请确保你在 .env.local 中配置了正确的 TANDEM_BOOTSTRAP_OWNER_EMAIL。`);
    process.exit(1);
  }
  const ownerId = ownerRes.rows[0].id;
  const now = new Date();

  // 2. 扫描硬盘资料
  console.log(`[import] 正在扫描硬盘目录: "${targetFolder}"...`);
  const files = scanFiles(targetFolder);
  if (files.length === 0) {
    console.log(`⚠️ [提示] 目标目录下没有找到支持的格式 (${Array.from(SUPPORTED_EXTS).join(', ')})。`);
    process.exit(0);
  }
  console.log(`[import] 扫描完毕！共找到 ${files.length} 个支持导入的文件。\n`);

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const f of files) {
    console.log(`⏳ 正在处理 [${okCount + failCount + 1}/${files.length}]: ${f.relativePath} (${(f.size / 1024).toFixed(1)} KB)...`);
    
    // 幂等：如果已导入同名同绝对路径的文件，则跳过
    const exists = await client.query('SELECT id FROM "Document" WHERE title = $1 AND "ownerId" = $2', [f.fileName, ownerId]);
    if (exists.rowCount > 0) {
      console.log(`  ⏩ 跳过: 数据库中已有同名文档 (id=${exists.rows[0].id})`);
      skipCount++;
      continue;
    }

    try {
      let text = '';
      switch (f.ext) {
        case '.docx':
          text = await parseDocx(f.fullPath);
          break;
        case '.xlsx':
        case '.xls':
        case '.ods':
          text = await parseXlsx(f.fullPath);
          break;
        case '.pptx':
          text = await parsePptx(f.fullPath);
          break;
        case '.pdf':
          text = await parsePdf(f.fullPath);
          break;
        default:
          text = await parsePlain(f.fullPath);
          break;
      }

      if (!text.trim()) {
        console.log(`  ⚠️ 警告: 文件解析后内容为空，跳过落库。`);
        failCount++;
        continue;
      }

      const docId = genId('doc');
      const header = `<!-- 来源本地导入: ${f.relativePath} · ${(f.size / 1024).toFixed(1)}KB -->\n\n`;
      const docContent = header + text;

      // 3. 写入 Document 表 (协作文档中可见)
      await client.query(
        `INSERT INTO "Document" (id, title, content, type, "ownerId", "tenantId", permissions, version, "isLocked", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'doc', $4, 'default', '{}'::jsonb, 1, false, $5, $5)`,
        [docId, f.fileName, docContent, ownerId, now]
      );

      // 4. 双写到 KvStore 的 memories 集合，让 AI 分身瞬间可以直接引用学习！
      const memoryId = genId('mem');
      // 推断分类
      const uiCategory = 
        /SOP|规范|标准|规则|制度/i.test(f.fileName) ? 'standard'
        : /需求|Requirement|PRD/i.test(f.fileName) ? 'requirement'
        : /共识|Consensus|决议/i.test(f.fileName) ? 'consensus'
        : 'context';

      const typeMap = {
        standard: 'sop',
        requirement: 'lesson',
        consensus: 'value',
        context: 'case'
      };

      const memoryData = {
        id: memoryId,
        type: typeMap[uiCategory],
        title: f.fileName.replace(/\.[^.]+$/, ''), // 去掉后缀
        body: docContent,
        status: 'active',
        ownershipLevel: 'personal',
        ownerUserId: ownerId,
        signers: [],
        referenceCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        uiCategory,
        priority: 'medium',
        tags: [f.ext.slice(1), 'local-imported'],
        parentId: null,
        isActive: true,
        version: 1
      };

      await client.query(
        `INSERT INTO "KvStore" (collection, id, data, "tenantId", "createdAt", "updatedAt")
         VALUES ('memories', $1, $2::jsonb, 'default', $3, $3)`,
        [memoryId, JSON.stringify(memoryData), now]
      );

      console.log(`  ✅ 成功: 写入 Documents 并且 自动学习为个人 Memory! (docId=${docId}, memId=${memoryId})`);
      okCount++;
    } catch (err) {
      console.log(`  ❌ 失败: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n==================================================');
  console.log(`🎉 批量导入本地目录结束！`);
  console.log(`  - 成功导入: ${okCount} 个文件 (双写 Document + Memory)`);
  console.log(`  - 重复跳过: ${skipCount} 个文件`);
  console.log(`  - 失败/空子: ${failCount} 个文件`);
  console.log(`==================================================`);
  console.log(`💡 AI 已经在后台瞬间吸收了这 ${okCount} 份资料！快去本地工作台 `/memories` 或 `/documents` 查看吧。`);

} catch (err) {
  console.error('[import] FATAL ERROR:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
