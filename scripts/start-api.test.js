const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { configureRuntimeEnvironment } = require('./start-api');

test('API starter loads the Nest production environment portably', () => {
  const env = {};
  const config = configureRuntimeEnvironment(env);

  assert.equal(config.envPath, path.join(config.repoRoot, '.env.nestjs'));
  assert.equal(config.tsProjectPath, path.join(config.repoRoot, 'services', 'api', 'tsconfig.json'));
  assert.equal(config.compiledEntry, path.join(config.repoRoot, 'dist', 'services', 'api', 'main.js'));
  assert.equal(env.DOTENV_CONFIG_PATH, config.envPath);
  assert.equal(env.TS_NODE_PROJECT, config.tsProjectPath);
  assert.equal(env.API_COMPILED_ENTRY, config.compiledEntry);
});

test('Nest API consumes the environment file selected by the production launcher', () => {
  const appModulePath = path.join(
    __dirname,
    '..',
    'services',
    'api',
    'src',
    'modules',
    'app.module.ts'
  );
  const source = fs.readFileSync(appModulePath, 'utf8');

  assert.match(source, /envFilePath:\s*process\.env\.DOTENV_CONFIG_PATH/);
});
