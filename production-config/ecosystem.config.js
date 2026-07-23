module.exports = {
  apps: [
    {
      name: 'express-api',
      script: 'server-production.js',
      env_file: '.env.production',
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
    {
      name: 'nestjs-api',
      script: 'node_modules/.bin/ts-node',
      args: '--project services/api/tsconfig.json --transpile-only services/api/src/main.ts',
      env_file: '.env.nestjs',
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
    {
      name: 'dealer-workbench',
      script: 'npm',
      args: 'start',
      cwd: 'apps/dealer-workbench',
      env: { PORT: 4000, NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
    {
      name: 'consumer-diagnosis',
      script: 'npm',
      args: 'start',
      cwd: 'apps/consumer-diagnosis',
      env: { PORT: 4001, NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
  ],
};

