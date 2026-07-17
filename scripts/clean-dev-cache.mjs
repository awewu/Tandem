import { existsSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const targets = ['.next-dev'];

if (process.argv.includes('--all')) {
  targets.push('.next');
}

function assertInsideRoot(path) {
  const resolved = resolve(root, path);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Refusing to remove path outside project root: ${resolved}`);
  }
  return resolved;
}

for (const target of targets) {
  const resolved = assertInsideRoot(target);
  if (!existsSync(resolved)) {
    console.log(`[dev:clean] skip missing ${target}`);
    continue;
  }
  rmSync(resolved, { recursive: true, force: true });
  console.log(`[dev:clean] removed ${target}`);
}
