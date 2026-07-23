const { existsSync } = require('fs');
const { join, resolve } = require('path');

const root = resolve(__dirname, '..');
const envFile = process.env.DOTENV_CONFIG_PATH || join(root, 'config', '.env.production');

if (!existsSync(envFile)) {
  console.error(`ERROR: production environment file not found: ${envFile}`);
  process.exit(1);
}

const dotenv = require(join(root, 'backend', 'node_modules', 'dotenv'));
const result = dotenv.config({ path: envFile, quiet: true });
if (result.error) {
  console.error(`ERROR: failed to load production environment: ${result.error.message}`);
  process.exit(1);
}

const { bootstrap } = require(join(root, 'backend', 'dist', 'services', 'api', 'main.js'));
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
