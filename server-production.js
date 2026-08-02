/**
 * 瑞诺瓦AI舒适家 production runtime entry.
 *
 * App composition lives in server/modules/productionAppFactory.js so importing
 * Importing this file for tests does not start runtime engines or schedulers.
 */

require('dotenv').config();

const fs = require('fs');
const https = require('https');
const dbLayer = require('./server/db/index');
const {
  initializePostListenEngines,
  printStartupBanner,
  startPostListenServices,
  startPreListenServices
} = require('./server/modules/runtimeServices');
const { createProductionApp } = require('./server/modules/productionAppFactory');

const USE_HTTPS = process.env.USE_HTTPS === 'true' || false;
const DEFAULT_RUNTIME_PROFILE = 'full';
let runtime;

function resolveRuntimeProfile(options = {}) {
  return options.runtimeProfile || process.env.RHAUTT_RUNTIME_PROFILE || DEFAULT_RUNTIME_PROFILE;
}

function resolveListenPort(options = {}) {
  return options.port || process.env.PORT || 3000;
}

function resolveHttpsPort(options = {}) {
  return options.httpsPort || process.env.HTTPS_PORT || 5443;
}

function resolveListenHost(options = {}) {
  return options.host || process.env.HOST || process.env.BIND_HOST || undefined;
}

function getRuntime(options = {}) {
  const runtimeProfile = resolveRuntimeProfile(options);
  if (!runtime || options.reset === true || runtime.runtimeProfile !== runtimeProfile) {
    runtime = createProductionApp({
      runtimeProfile
    });
  }
  return runtime;
}

// ==================== 启动服务器 ====================

let httpServer;
let httpsServer;

async function startProductionServer(options = {}) {
  const runtimeProfile = resolveRuntimeProfile(options);
  const port = resolveListenPort(options);
  const httpsPort = resolveHttpsPort(options);
  const host = resolveListenHost(options);
  const { app, db, engines } = getRuntime({ runtimeProfile });
  await dbLayer.connect();
  startPreListenServices({ engines });

  const onListening = async () => {
    await initializePostListenEngines({ engines });
    printStartupBanner({ port, host, httpsPort, useHttps: USE_HTTPS, runtimeProfile });
    startPostListenServices();
  };

  httpServer = await new Promise((resolve, reject) => {
    let settled = false;
    const onError = (err) => {
      handleHttpServerError(err, { port });
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    const server = host
      ? app.listen(port, host, async () => {
        try {
          await onListening();
          if (!settled) {
            settled = true;
            resolve(server);
          }
        } catch (error) {
          if (!settled) {
            settled = true;
            reject(error);
          }
        }
      })
      : app.listen(port, async () => {
        try {
          await onListening();
          if (!settled) {
            settled = true;
            resolve(server);
          }
        } catch (error) {
          if (!settled) {
            settled = true;
            reject(error);
          }
        }
      });
    server.once('error', onError);
  });

  if (USE_HTTPS) {
    try {
      const key = fs.readFileSync('./ssl/server.key');
      const cert = fs.readFileSync('./ssl/server.crt');
      httpsServer = https.createServer({ key, cert }, app);
      httpsServer.listen(httpsPort, () => {
        console.log(`🔒 HTTPS服务器已启动: https://localhost:${httpsPort}`);
      });
    } catch (error) {
      console.log('⚠️ HTTPS证书未配置，仅HTTP可用');
      console.log('   生成证书命令: mkdir ssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl/server.key -out ssl/server.crt');
    }
  }

  return httpServer;
}

// 错误监听
function handleHttpServerError(err, options = {}) {
  const port = options.port || resolveListenPort();
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${port} 已被占用，请关闭占用该端口的程序后重试`);
    console.log('   您可以使用命令查找占用进程: netstat -ano | findstr :' + port);
    process.exit(1);
  } else {
    console.error('❌ HTTP服务器错误:', err.message);
  }
}

if (require.main === module) {
  startProductionServer().catch((error) => {
    console.error('❌ 瑞诺瓦AI舒适家 生产服务启动失败:', error.message);
    process.exit(1);
  });
}

// 导出供测试使用
module.exports = {
  get app() { return getRuntime({ runtimeProfile: 'safe' }).app; },
  get runtime() { return getRuntime({ runtimeProfile: 'safe' }); },
  getRuntime,
  get httpServer() { return httpServer; },
  get httpsServer() { return httpsServer; },
  resolveRuntimeProfile,
  resolveListenHost,
  startProductionServer
};
