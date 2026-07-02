#!/usr/bin/env node
/**
 * gen-updater-config.mjs — 生成 Tauri updater 的构建期配置补丁 (§desktop 自动更新).
 *
 * 背景: tauri.conf.json 是静态 JSON, 不支持 env 变量替换. 但更新端点与公钥需按公司部署而变:
 *   - 端点 = 公司 Tandem 服务器地址 (与 TANDEM_DEFAULT_SERVER_URL 同源).
 *   - pubkey = tauri signer 生成的更新签名公钥.
 * 因此本脚本从环境变量生成 `src-tauri/gen/updater.conf.json`, 由
 *   `tauri build --config src-tauri/gen/updater.conf.json` 合并进最终构建配置.
 *
 * 环境变量:
 *   TANDEM_DEFAULT_SERVER_URL  公司服务器地址 (默认 http://127.0.0.1:3005)
 *   TANDEM_UPDATER_PUBKEY      更新签名公钥 (tauri signer generate 产出的公钥内容)
 *   TANDEM_UPDATER_PUBKEY_FILE 公钥文件路径 (二选一, 优先 env 直传)
 *
 * 若未提供公钥 → 写出空补丁 ({}), updater 在运行期保持未配置 (自动更新优雅禁用, 构建仍成功).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const genDir = join(root, 'src-tauri', 'gen');
const outFile = join(genDir, 'updater.conf.json');

const serverUrl = (process.env.TANDEM_DEFAULT_SERVER_URL || 'http://127.0.0.1:3005')
  .trim()
  .replace(/\/+$/, '');

let pubkey = (process.env.TANDEM_UPDATER_PUBKEY || '').trim();
if (!pubkey && process.env.TANDEM_UPDATER_PUBKEY_FILE) {
  const f = process.env.TANDEM_UPDATER_PUBKEY_FILE.trim();
  if (existsSync(f)) pubkey = readFileSync(f, 'utf8').trim();
}
// 约定默认公钥文件位置 (gitignored), 方便本地构建.
if (!pubkey) {
  const defaultKey = join(root, 'src-tauri', 'updater-pubkey.txt');
  if (existsSync(defaultKey)) pubkey = readFileSync(defaultKey, 'utf8').trim();
}

mkdirSync(genDir, { recursive: true });

if (!pubkey) {
  writeFileSync(outFile, '{}\n', 'utf8');
  console.warn(
    '[gen-updater-config] 未提供 TANDEM_UPDATER_PUBKEY → 自动更新未配置 (构建仍可继续).\n' +
      '  启用步骤: npx tauri signer generate -w src-tauri/updater.key\n' +
      '  然后把公钥存到 src-tauri/updater-pubkey.txt 或设 TANDEM_UPDATER_PUBKEY 后重新构建.',
  );
  process.exit(0);
}

const endpoint = `${serverUrl}/api/desktop/update/{{target}}/{{arch}}/{{current_version}}`;

const patch = {
  plugins: {
    updater: {
      endpoints: [endpoint],
      pubkey,
    },
  },
};

writeFileSync(outFile, JSON.stringify(patch, null, 2) + '\n', 'utf8');
console.log(`[gen-updater-config] wrote ${outFile}`);
console.log(`  endpoint: ${endpoint}`);
