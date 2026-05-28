# Yjs 协同文档 — 部署说明 (P3-12)

## 总览

Tandem 文档系统支持多人实时协作 (CRDT, 基于 Yjs + y-websocket).

```
┌────────────┐   WebSocket  ┌──────────────────┐
│ 浏览器 (n)  │ ◄──────────► │ yjs-server.mjs   │  独立进程, 端口 1234
└────────────┘              │ (y-websocket)    │
                            └──────────────────┘
                                   │
                                   │ 30s auto-save
                                   ▼
┌────────────┐   PUT       ┌──────────────────┐
│ Next.js    │ ◄────────── │ /api/documents   │  Document.body 落 PG
│ /documents │             └──────────────────┘
└────────────┘
```

## 启动

### 开发

```bash
# 终端 1: Next.js
npm run dev

# 终端 2: Yjs ws server
npm run yjs:server         # 监听 ws://0.0.0.0:1234

# 设置环境变量, 让前端知道 ws server 地址
$env:YJS_WS_URL="ws://localhost:1234"        # PowerShell
# 或写入 .env.local
```

未设 `YJS_WS_URL` 时, `<CollabTextarea>` 自动降级为本地 textarea (无协作, 但保存正常).

### 生产

1. 独立容器跑 `node scripts/yjs-server.mjs`
2. nginx/cloudflare 反代 `wss://collab.your-domain.com/` → `ws://yjs-server:1234`
3. 在 Next.js app env 配置 `YJS_WS_URL=wss://collab.your-domain.com`
4. 客户端 SSL: 浏览器只允许 https + wss 同源

## 数据持久化

- **实时同步**: y-websocket 进程内存 (CRDT 增量自动 merge)
- **落库**: 客户端编辑 → CollabTextarea `onLocalChange` → 父组件 state →
  每 30s auto-save PUT `/api/documents/[id]` (写 PG `documents.body`)
- **重启容错**: y-websocket server 重启会丢失尚未 auto-save 的最近 30s 改动.
  生产建议给 y-websocket server 接 LevelDB persistence (见
  [y-websocket README](https://github.com/yjs/y-websocket#using-the-built-in-server))
  或 PG persistence (要扩 `scripts/yjs-server.mjs`).

## Awareness (在线状态/光标)

每个客户端通过 `provider.awareness.setLocalStateField('user', { name, color })` 上报.
其他客户端订阅 `awareness.on('change')` 即可实时显示在线列表 (右上角徽标).

## 兼容性

- y-websocket@3 协议与 y-websocket@1.x 不兼容; 浏览器和 server 必须同步升级.
- Yjs 文档 v1 binary 格式稳定, 跨版本兼容.

## 测试

启动 ws server 后, 打开两个浏览器窗口同登 `/documents/<id>`,
在一个窗口输入文字 → 另一窗口立即看到. 关闭其中一个 → 在线人数 -1.
