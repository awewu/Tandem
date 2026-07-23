const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

process.env.PORT = '4020';

const appDir = path.resolve(__dirname, '..', '.next', 'standalone', 'apps', 'dealer-workbench');
const publicSrc = path.resolve(__dirname, '..', 'public');
const publicDest = path.join(appDir, 'public');

if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
}

const child = spawn('D:\\Soft\\nodejs20\\node.exe', ['server.js'], {
  cwd: appDir,
  env: process.env,
  stdio: 'ignore',
  detached: false,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
