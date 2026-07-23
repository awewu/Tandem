'use client';
// Rysnova BIM · IFC 查看器（web-ifc MPL-2.0 + three MIT，离线安全）
// 替代 AGPL 的 xeokit；web-ifc 是 That Open Engine 的解析核心。
// WASM 由本地 /wasm/ 提供，终端无需外网。
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '@rhautt/shared-auth';
import * as THREE from 'three';
// three 0.155 自带 examples/jsm
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - three examples 无类型导出声明
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// web-ifc 无打包类型 → 以 any 引入
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { IfcAPI } from 'web-ifc';

type Status = { kind: 'idle' | 'loading' | 'ready' | 'error'; text: string };

export interface BimIfcViewerProps {
  height?: number;
  artifactId?: string;
  status?: string;
}

export default function BimIfcViewer({ height = 520, artifactId, status: initialStatus }: BimIfcViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number>(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: initialStatus || '选择 .ifc 文件以加载 BIM 模型' });
  const [meshCount, setMeshCount] = useState(0);

  // ── three 场景初始化 ──────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1d29);
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 5000);
    camera.position.set(15, 15, 15);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(dir);
    scene.add(new THREE.GridHelper(50, 50, 0x444a5f, 0x2a2f3f));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const group = new THREE.Group();
    scene.add(group);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    modelGroupRef.current = group;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [height]);

  // ── 清空当前模型 ──────────────────────────────────────────────────────────
  const clearModel = useCallback(() => {
    const group = modelGroupRef.current;
    if (!group) return;
    for (const child of [...group.children]) {
      group.remove(child);
      const m = child as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    }
  }, []);

  // ── 相机适配包围盒 ────────────────────────────────────────────────────────
  const fitCamera = useCallback(() => {
    const group = modelGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!group || !camera || !controls) return;
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 10;
    const dist = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.position.set(center.x + dist, center.y + dist, center.z + dist);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }, []);

  // ── 解析 IFC buffer（文件或 artifact 共用） ────────────────────────────────
  const loadBuffer = useCallback(async (buffer: Uint8Array, name: string) => {
    const group = modelGroupRef.current;
    if (!group) return;
    setStatus({ kind: 'loading', text: `解析 ${name} …` });
    clearModel();
    setMeshCount(0);
    try {
      const ifcApi = new IfcAPI();
      ifcApi.SetWasmPath('/wasm/');
      await ifcApi.Init();
      const modelID = ifcApi.OpenModel(buffer);

      let count = 0;
      ifcApi.StreamAllMeshes(modelID, (mesh: any) => {
        const placed = mesh.geometries;
        for (let i = 0; i < placed.size(); i++) {
          const pg = placed.get(i);
          const geom = ifcApi.GetGeometry(modelID, pg.geometryExpressID);
          const verts = ifcApi.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize()) as Float32Array;
          const indices = ifcApi.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize()) as Uint32Array;
          // verts 交错排列：position(3) + normal(3)
          const positions = new Float32Array(verts.length / 2);
          const normals = new Float32Array(verts.length / 2);
          for (let v = 0; v < verts.length; v += 6) {
            const j = (v / 6) * 3;
            positions[j] = verts[v]; positions[j + 1] = verts[v + 1]; positions[j + 2] = verts[v + 2];
            normals[j] = verts[v + 3]; normals[j + 1] = verts[v + 4]; normals[j + 2] = verts[v + 5];
          }
          const bg = new THREE.BufferGeometry();
          bg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          bg.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
          bg.setIndex(new THREE.BufferAttribute(indices, 1));
          const c = pg.color;
          const material = new THREE.MeshLambertMaterial({
            color: new THREE.Color(c.x, c.y, c.z),
            transparent: c.w < 1,
            opacity: c.w,
            side: THREE.DoubleSide,
          });
          const m = new THREE.Matrix4().fromArray(pg.flatTransformation);
          const threeMesh = new THREE.Mesh(bg, material);
          threeMesh.applyMatrix4(m);
          group.add(threeMesh);
          count++;
          geom.delete();
        }
      });
      ifcApi.CloseModel(modelID);

      // IFC 多为 Z-up，转 three 的 Y-up
      group.rotation.x = -Math.PI / 2;
      setMeshCount(count);
      fitCamera();
      setStatus({ kind: 'ready', text: `已加载 ${name}（${count} 个几何体）` });
    } catch (err) {
      setStatus({ kind: 'error', text: `加载失败：${(err as Error).message}` });
    }
  }, [clearModel, fitCamera]);

  // ── 加载本地 IFC 文件 ─────────────────────────────────────────────────────
  const loadIfc = useCallback(async (file: File) => {
    loadBuffer(new Uint8Array(await file.arrayBuffer()), file.name);
  }, [loadBuffer]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadIfc(f);
  };

  // ── 加载签约 BIM 产物 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!artifactId) return;
    const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    fetch(`/api/v2/file-artifact/${encodeURIComponent(artifactId)}/base64`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => {
        const base64 = data?.data?.base64 ?? data?.base64;
        if (!base64) throw new Error('产物响应缺少 base64');
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
        loadBuffer(buffer, data?.data?.originalName ?? `artifact-${artifactId}.ifc`);
      })
      .catch((err) => setStatus({ kind: 'error', text: `产物加载失败：${err?.message ?? err}` }));
  }, [artifactId, loadBuffer]);

  const statusColor = status.kind === 'error' ? 'var(--danger)' : status.kind === 'ready' ? 'var(--success)' : 'var(--t-secondary)';

  return (
    <div className="card-elevated" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>BIM 模型查看器</div>
        <label style={{ background: 'var(--brand)', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
          选择 IFC 文件
          <input type="file" accept=".ifc" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <button onClick={fitCamera} disabled={meshCount === 0}
          style={{ background: 'var(--surface-2)', color: 'var(--t-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: meshCount ? 'pointer' : 'not-allowed' }}>
          适配视图
        </button>
        <span style={{ fontSize: 12, color: statusColor }}>{status.kind === 'loading' ? '⏳ ' : ''}{status.text}</span>
      </div>
      <div ref={mountRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', background: '#1a1d29' }} />
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t-tertiary)' }}>
        web-ifc (MPL-2.0) + three (MIT)，离线本地 WASM；拖动旋转 / 滚轮缩放 / 右键平移。
      </div>
    </div>
  );
}
