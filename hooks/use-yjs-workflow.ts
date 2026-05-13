/**
 * useYjsWorkflow · React Hook for Yjs 实时协作
 *
 * 用法:
 *   const { nodes, edges, setNodes, setEdges, addNode, updateNode, deleteNode, addEdge, collaboratorCount, ready }
 *     = useYjsWorkflow('room-123');
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WorkflowRoom, type FlowNodeData, type FlowEdgeData } from '@/lib/yjs/workflow-room';

export function useYjsWorkflow(roomId: string | null) {
  const roomRef = useRef<WorkflowRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [nodes, setNodesState] = useState<FlowNodeData[]>([]);
  const [edges, setEdgesState] = useState<FlowEdgeData[]>([]);
  const [collaboratorCount, setCollaboratorCount] = useState(1);

  useEffect(() => {
    if (!roomId) return;
    const room = new WorkflowRoom(roomId);
    roomRef.current = room;

    // 初始同步
    room.whenSynced().then(() => {
      setNodesState(room.getNodes());
      setEdgesState(room.getEdges());
      setReady(true);
    });

    // 监听远程变更
    const unsubNodes = room.observeNodes((newNodes) => setNodesState(newNodes));
    const unsubEdges = room.observeEdges((newEdges) => setEdgesState(newEdges));
    const unsubAwareness = room.observeAwareness((count) => setCollaboratorCount(count));

    return () => {
      unsubNodes();
      unsubEdges();
      unsubAwareness();
      room.destroy();
      roomRef.current = null;
    };
  }, [roomId]);

  const setNodes = useCallback(
    (updater: FlowNodeData[] | ((prev: FlowNodeData[]) => FlowNodeData[])) => {
      const room = roomRef.current;
      if (!room || !roomId) {
        setNodesState(updater);
        return;
      }
      const next = typeof updater === 'function' ? updater(room.getNodes()) : updater;
      room.setNodes(next);
      setNodesState(next);
    },
    [roomId]
  );

  const setEdges = useCallback(
    (updater: FlowEdgeData[] | ((prev: FlowEdgeData[]) => FlowEdgeData[])) => {
      const room = roomRef.current;
      if (!room || !roomId) {
        setEdgesState(updater);
        return;
      }
      const next = typeof updater === 'function' ? updater(room.getEdges()) : updater;
      room.setEdges(next);
      setEdgesState(next);
    },
    [roomId]
  );

  const addNode = useCallback(
    (node: FlowNodeData) => {
      const room = roomRef.current;
      if (room && roomId) {
        room.addNode(node);
      } else {
        setNodesState((prev) => [...prev, node]);
      }
    },
    [roomId]
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<FlowNodeData>) => {
      const room = roomRef.current;
      if (room && roomId) {
        room.updateNode(id, patch);
      } else {
        setNodesState((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      }
    },
    [roomId]
  );

  const deleteNode = useCallback(
    (id: string) => {
      const room = roomRef.current;
      if (room && roomId) {
        room.deleteNode(id);
      } else {
        setNodesState((prev) => prev.filter((n) => n.id !== id));
        setEdgesState((prev) => prev.filter((e) => e.from !== id && e.to !== id));
      }
    },
    [roomId]
  );

  const addEdge = useCallback(
    (edge: FlowEdgeData) => {
      const room = roomRef.current;
      if (room && roomId) {
        room.addEdge(edge);
      } else {
        setEdgesState((prev) => [...prev, edge]);
      }
    },
    [roomId]
  );

  const deleteEdge = useCallback(
    (from: string, to: string) => {
      const room = roomRef.current;
      if (room && roomId) {
        room.deleteEdge(from, to);
      } else {
        setEdgesState((prev) => prev.filter((e) => !(e.from === from && e.to === to)));
      }
    },
    [roomId]
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    collaboratorCount,
    ready,
    room: roomRef.current,
  };
}
