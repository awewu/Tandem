#!/usr/bin/env node
/**
 * Yjs WebSocket Server · 文档实时协作后端
 *
 * 用法: node scripts/yjs-server.mjs [PORT]
 * 默认端口: 1234
 *
 * 生产部署: 跑在独立容器, 与 Next.js app 同租户网络, 通过 nginx 反代为 wss://
 */

import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils.js';

const PORT = Number(process.env.YJS_PORT ?? process.argv[2] ?? 1234);

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (conn, req) => {
  // y-websocket 的 setupWSConnection 处理协议
  setupWSConnection(conn, req, { gc: true });
});

// eslint-disable-next-line no-console
console.log(`[yjs] listening on ws://0.0.0.0:${PORT}`);
