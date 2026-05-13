/**
 * Yjs Workflow Room · 多人实时协作
 *
 * 基于 Yjs + WebRTC (y-webrtc) 的 P2P 协作，无需自建服务端。
 * 本地持久化通过 y-indexeddb 保证断线重连后不丢数据。
 *
 * V1: 使用公共 signaling 服务器 (signaling.yjs.dev)
 * V2: 可切换为自研 WebSocket 信令服务器 (y-websocket)
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface FlowNodeData {
  id: string;
  type: string;
  x: number;
  y: number;
  label: string;
  config: Record<string, string>;
}

export interface FlowEdgeData {
  from: string;
  to: string;
}

export class WorkflowRoom {
  doc: Y.Doc;
  provider: WebrtcProvider;
  persistence: IndexeddbPersistence;
  yNodes: Y.Array<Y.Map<any>>;
  yEdges: Y.Array<Y.Map<any>>;

  constructor(roomId: string, signalingUrls = ['wss://signaling.yjs.dev']) {
    this.doc = new Y.Doc();
    this.yNodes = this.doc.getArray<Y.Map<any>>('nodes');
    this.yEdges = this.doc.getArray<Y.Map<any>>('edges');

    // IndexedDB 本地持久化
    this.persistence = new IndexeddbPersistence(`tandem-workflow-${roomId}`, this.doc);

    // WebRTC P2P 协作
    this.provider = new WebrtcProvider(`tandem-workflow-${roomId}`, this.doc, {
      signaling: signalingUrls,
      maxConns: 20 + Math.floor(Math.random() * 15),
      filterBcConns: true,
      peerOpts: {},
    } as any);
  }

  /** 等待 IndexedDB 同步完成 */
  async whenSynced(): Promise<void> {
    await this.persistence.whenSynced;
    return;
  }

  /** 当前在线协作者数 (含自己) */
  get collaboratorCount(): number {
    return this.provider.awareness.getStates().size;
  }

  /** 观察节点变更 */
  observeNodes(handler: (nodes: FlowNodeData[]) => void): () => void {
    const cb = () => handler(this.getNodes());
    this.yNodes.observeDeep(cb);
    return () => this.yNodes.unobserveDeep(cb);
  }

  /** 观察边变更 */
  observeEdges(handler: (edges: FlowEdgeData[]) => void): () => void {
    const cb = () => handler(this.getEdges());
    this.yEdges.observeDeep(cb);
    return () => this.yEdges.unobserveDeep(cb);
  }

  /** 观察协作者 awareness */
  observeAwareness(handler: (count: number) => void): () => void {
    const aw = this.provider.awareness;
    const cb = () => handler(aw.getStates().size);
    aw.on('change', cb);
    return () => aw.off('change', cb);
  }

  getNodes(): FlowNodeData[] {
    return this.yNodes.toArray().map((m) => ({
      id: m.get('id') ?? '',
      type: m.get('type') ?? 'agent',
      x: m.get('x') ?? 0,
      y: m.get('y') ?? 0,
      label: m.get('label') ?? '',
      config: m.get('config') ?? {},
    }));
  }

  getEdges(): FlowEdgeData[] {
    return this.yEdges.toArray().map((m) => ({
      from: m.get('from') ?? '',
      to: m.get('to') ?? '',
    }));
  }

  setNodes(nodes: FlowNodeData[]) {
    this.doc.transact(() => {
      this.yNodes.delete(0, this.yNodes.length);
      for (const n of nodes) {
        const m = new Y.Map<any>();
        m.set('id', n.id);
        m.set('type', n.type);
        m.set('x', n.x);
        m.set('y', n.y);
        m.set('label', n.label);
        m.set('config', n.config);
        this.yNodes.push([m]);
      }
    });
  }

  setEdges(edges: FlowEdgeData[]) {
    this.doc.transact(() => {
      this.yEdges.delete(0, this.yEdges.length);
      for (const e of edges) {
        const m = new Y.Map<any>();
        m.set('from', e.from);
        m.set('to', e.to);
        this.yEdges.push([m]);
      }
    });
  }

  addNode(node: FlowNodeData) {
    const m = new Y.Map<any>();
    m.set('id', node.id);
    m.set('type', node.type);
    m.set('x', node.x);
    m.set('y', node.y);
    m.set('label', node.label);
    m.set('config', node.config);
    this.yNodes.push([m]);
  }

  updateNode(id: string, patch: Partial<FlowNodeData>) {
    for (const m of this.yNodes.toArray()) {
      if (m.get('id') === id) {
        this.doc.transact(() => {
          if (patch.type !== undefined) m.set('type', patch.type);
          if (patch.x !== undefined) m.set('x', patch.x);
          if (patch.y !== undefined) m.set('y', patch.y);
          if (patch.label !== undefined) m.set('label', patch.label);
          if (patch.config !== undefined) m.set('config', patch.config);
        });
        break;
      }
    }
  }

  deleteNode(id: string) {
    const idx = this.yNodes.toArray().findIndex((m) => m.get('id') === id);
    if (idx !== -1) this.yNodes.delete(idx, 1);
    // 级联删除边
    const edges = this.yEdges.toArray();
    for (let i = edges.length - 1; i >= 0; i--) {
      if (edges[i].get('from') === id || edges[i].get('to') === id) {
        this.yEdges.delete(i, 1);
      }
    }
  }

  addEdge(edge: FlowEdgeData) {
    const m = new Y.Map<any>();
    m.set('from', edge.from);
    m.set('to', edge.to);
    this.yEdges.push([m]);
  }

  deleteEdge(from: string, to: string) {
    const edges = this.yEdges.toArray();
    const idx = edges.findIndex((m) => m.get('from') === from && m.get('to') === to);
    if (idx !== -1) this.yEdges.delete(idx, 1);
  }

  destroy() {
    try { this.provider.destroy(); } catch { /* noop */ }
    try { this.persistence.destroy(); } catch { /* noop */ }
    try { this.doc.destroy(); } catch { /* noop */ }
  }
}
