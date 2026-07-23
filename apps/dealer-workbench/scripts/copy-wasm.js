// 将 web-ifc 的 WASM 拷到 public/wasm/，供浏览器本地加载（离线安全）。
// 由 predev / prebuild 自动执行；幂等。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'node_modules', 'web-ifc');
const dest = path.join(root, 'public', 'wasm');
const files = ['web-ifc.wasm', 'web-ifc-mt.wasm'];

fs.mkdirSync(dest, { recursive: true });
let copied = 0;
for (const f of files) {
  const from = path.join(src, f);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(dest, f));
    copied++;
  } else {
    console.warn(`[copy-wasm] 缺少 ${from}（web-ifc 是否已安装？）`);
  }
}
console.log(`[copy-wasm] 已拷贝 ${copied}/${files.length} 个 WASM 到 public/wasm/`);
