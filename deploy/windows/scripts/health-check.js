const checks = [
  ['Nexus backend', 'http://127.0.0.1:4500/api/v2/health'],
  ['Nexus frontend', 'http://127.0.0.1:5000/'],
];

async function main() {
  let failed = false;
  for (const [name, url] of checks) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      console.log(`${name}: HTTP ${response.status} ${response.ok ? 'OK' : 'FAILED'}`);
      if (!response.ok) failed = true;
    } catch (error) {
      failed = true;
      console.error(`${name}: FAILED (${error.message})`);
    }
  }
  if (failed) process.exitCode = 1;
}

main();
