const path = require('path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');

function configureRuntimeEnvironment(env = process.env) {
  const envPath = env.DOTENV_CONFIG_PATH || path.join(repoRoot, '.env.nestjs');
  const tsProjectPath = env.TS_NODE_PROJECT || path.join(repoRoot, 'services', 'api', 'tsconfig.json');
  const compiledEntry = env.API_COMPILED_ENTRY || path.join(repoRoot, 'dist', 'services', 'api', 'main.js');

  env.DOTENV_CONFIG_PATH = envPath;
  env.TS_NODE_PROJECT = tsProjectPath;
  env.API_COMPILED_ENTRY = compiledEntry;

  const result = dotenv.config({ path: envPath, processEnv: env, quiet: true });
  if (result.error && result.error.code !== 'ENOENT') throw result.error;

  return { repoRoot, envPath, tsProjectPath, compiledEntry };
}

async function startApi() {
  const config = configureRuntimeEnvironment();
  const useTypeScript = process.env.API_START_MODE === 'typescript';
  const entry = useTypeScript
    ? path.join(repoRoot, 'services', 'api', 'src', 'main.ts')
    : config.compiledEntry;

  if (useTypeScript) require('ts-node/register/transpile-only');
  const { bootstrap } = require(entry);
  return bootstrap();
}

if (require.main === module) {
  startApi().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  configureRuntimeEnvironment,
  startApi,
};
