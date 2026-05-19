/**
 * Yjs Realtime Doc · 实时协作文档
 *
 * 架构:
 *   - 客户端: y-websocket provider 连 ws://server/yjs/<docId>
 *   - 服务端: 独立 ws server 进程 (V1 用 y-websocket 自带的 server)
 *   - 持久化: 每 30s flush 到 PG (Document.body 字段, 序列化的 Y.Doc state)
 *   - awareness: 每客户端实时广播光标/选区/在线状态
 *
 * V1: 仅提供 helper 函数 + API 入口, 真实 ws server 由独立进程跑:
 *   $ node scripts/yjs-server.mjs    (用 y-websocket/bin/server.js)
 *
 * 客户端用法:
 *   import * as Y from 'yjs';
 *   import { WebsocketProvider } from 'y-websocket';
 *   const ydoc = new Y.Doc();
 *   const provider = new WebsocketProvider('ws://localhost:1234', `doc-${docId}`, ydoc);
 *   const ytext = ydoc.getText('content');
 */

import * as Y from 'yjs';

/** 序列化 Y.Doc → base64 (用于持久化到 PG). */
export function encodeDocState(doc: Y.Doc): string {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

/** 反序列化 base64 → 应用到 Y.Doc. */
export function applyDocState(doc: Y.Doc, base64: string): void {
  if (!base64) return;
  const update = Buffer.from(base64, 'base64');
  Y.applyUpdate(doc, update);
}

/** 创建一个空 Y.Doc, 可选用初始状态恢复. */
export function createDoc(initialState?: string): Y.Doc {
  const doc = new Y.Doc();
  if (initialState) applyDocState(doc, initialState);
  return doc;
}

/** 提取纯文本 (用于服务端搜索索引 + 摘要). */
export function extractPlainText(doc: Y.Doc, fieldName = 'content'): string {
  const ytext = doc.getText(fieldName);
  return ytext.toString();
}

export const YJS_WS_URL = process.env.YJS_WS_URL ?? 'ws://localhost:1234';
export function isYjsConfigured(): boolean {
  return !!process.env.YJS_WS_URL;
}
