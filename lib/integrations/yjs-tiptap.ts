/**
 * Yjs + Tiptap · 文档协作
 *
 * Yjs: CRDT 实时协同编辑库 (MIT)
 * Tiptap: ProseMirror 富文本编辑器 (MIT)
 * y-websocket-server: 协同后端 (MIT)
 *
 * 启用步骤:
 *   1. npm i yjs y-websocket @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/extension-collaboration y-prosemirror
 *   2. 启动 y-websocket-server (Node 一行代码)
 *   3. 客户端使用 lib/integrations/yjs-tiptap createCollabEditor
 *
 * 用途:
 *   - Materials 层文档实时协作
 *   - Memory 签批工作流的"批阅"界面
 *   - 议事室 Action items 的"任务详情"页面
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CollabDoc {
  docId: string;
  /** Y.Doc 实例 (动态 import 后注入) */
  ydoc: unknown;
  /** y-websocket Provider */
  provider: unknown;
  destroy(): void;
}

const WS_URL = process.env.YJS_WS_URL ?? 'ws://localhost:1234';

/**
 * 客户端: 创建协同 Y.Doc + WS provider
 */
export async function createCollabDoc(docId: string, userInfo: { name: string; color?: string }): Promise<CollabDoc> {
  const Y = await import('yjs');
  // @ts-expect-error optional dependency
  const { WebsocketProvider } = await import('y-websocket');

  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(WS_URL, docId, ydoc);

  // Awareness 用户信息
  provider.awareness.setLocalStateField('user', {
    name: userInfo.name,
    color: userInfo.color ?? '#10b981',
  });

  return {
    docId,
    ydoc,
    provider,
    destroy() {
      provider.destroy();
      ydoc.destroy();
    },
  };
}

/**
 * 服务端: 持久化 Y.Doc 到 storage (Material body)
 *
 * 由 y-websocket-server 的 'updates' 钩子调用
 */
export async function persistDoc(docId: string, ydocBytes: Uint8Array): Promise<void> {
  // 调用 lib/storage materials.update
  // 存储 ydocBytes 作为 Material.body 的二进制
  // Y.encodeStateAsUpdate / Y.applyUpdate 处理增量
}

/**
 * 服务端: 加载 Y.Doc 历史
 */
export async function loadDoc(docId: string): Promise<Uint8Array | null> {
  return null;
}
