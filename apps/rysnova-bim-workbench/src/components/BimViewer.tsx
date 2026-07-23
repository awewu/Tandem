'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - three examples 无类型声明
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - web-ifc 无打包类型
import { IfcAPI } from 'web-ifc';
import { getToken } from '@rhautt/shared-auth';

/**
 * 整合版 BIM 查看器（相互学习推演整合 · 可靠基座）：
 *  - 引擎：裸 three + web-ifc IfcAPI（取 dealer BimIfcViewer 的成熟离线做法；ThatOpen 2.4.11
 *    的 FragmentsManager worker API 版本脆弱、getWorker 不存在，故基座选可靠的裸 three）。
 *  - WASM：本地 /wasm/（离线/内网安全）。版本锁 web-ifc 0.0.68（与本 app 依赖一致）。
 *  - 数据：支持本地 IFC 文件 与 artifactId（从 file-artifact API 拉签约 BIM 产物）。
 *  - 后续 P3 抽到 packages/bim-viewer 供 designer / dealer / 本端共用。
 */
export interface BimViewerProps {
  status?: string;
  artifactId?: string;
  height?: number;
}

type Stat = { kind: 'idle' | 'loading' | 'ready' | 'error'; text: string };

export default function BimViewer({ status: initialStatus = '请选择 IFC 文件或加载签约产物', artifactId }: BimViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<number>(0);
  const [status, setStatus] = useState<Stat>({ kind: 'idle', text: initialStatus });
  const [meshCount, setMeshCount] = useState(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 480;
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
    dir.position.set(10, 20, 10); scene.add(dir);
    scene.add(new THREE.GridHelper(50, 50, 0x444a5f, 0x2a2f3f));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const group = new THREE.Group(); scene.add(group);

    sceneRef.current = scene; rendererRef.current = renderer; cameraRef.current = camera;
    controlsRef.current = controls; groupRef.current = group;

    const animate = () => { frameRef.current = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();
    const onResize = () => { const w = mount.clientWidth, h = mount.clientHeight || height; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  const clearModel = useCallback(() => {
    const group = groupRef.current; if (!group) return;
    for (const child of [...group.children]) {
      group.remove(child);
      const m = child as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    }
  }, []);

  const fitCamera = useCallback(() => {
    const group = groupRef.current, camera = cameraRef.current, controls = controlsRef.current;
    if (!group || !camera || !controls) return;
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 10;
    const dist = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.position.set(center.x + dist, center.y + dist, center.z + dist);
    camera.near = maxDim / 100; camera.far = maxDim * 100; camera.updateProjectionMatrix();
    controls.target.copy(center); controls.update();
  }, []);

  const loadBuffer = useCallback(async (buffer: Uint8Array, name: string) => {
    const group = groupRef.current; if (!group) return;
    setStatus({ kind: 'loading', text: `解析 ${name} …` });
    clearModel(); setMeshCount(0);
    try {
      const ifcApi = new IfcAPI();
      ifcApi.SetWasmPath('/wasm/'); // 本地离线 WASM
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
          const material = new THREE.MeshLambertMaterial({ color: new THREE.Color(c.x, c.y, c.z), transparent: c.w < 1, opacity: c.w, side: THREE.DoubleSide });
          const m4 = new THREE.Matrix4().fromArray(pg.flatTransformation);
          const threeMesh = new THREE.Mesh(bg, material);
          threeMesh.applyMatrix4(m4);
          group.add(threeMesh); count++;
          geom.delete();
        }
      });
      ifcApi.CloseModel(modelID);
      group.rotation.x = -Math.PI / 2; // IFC Z-up → three Y-up
      setMeshCount(count); fitCamera();
      setStatus({ kind: 'ready', text: `已加载 ${name}（${count} 个构件几何体）` });
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', text: `加载失败：${(err as Error).message}` });
    }
  }, [clearModel, fitCamera]);

  // artifactId → 从 file-artifact API 拉取 BIM 产物
  useEffect(() => {
    if (!artifactId) return;
    const token = getToken() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    fetch(`/api/v2/file-artifact/${artifactId}/base64`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => {
        const base64 = data?.data?.base64 ?? data?.base64;
        if (!base64) throw new Error('产物响应缺少 base64');
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
        return loadBuffer(buffer, data?.data?.originalName ?? `artifact-${artifactId}.ifc`);
      })
      .catch((err) => setStatus({ kind: 'error', text: `产物加载失败：${err?.message ?? err}` }));
  }, [artifactId, loadBuffer]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) f.arrayBuffer().then((b) => loadBuffer(new Uint8Array(b), f.name));
  };

  const statusColor = status.kind === 'error' ? '#dc2626' : status.kind === 'ready' ? '#16a34a' : '#475569';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f1f3f7', flexWrap: 'wrap' }}>
        <label style={{ background: '#0f766e', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
          选择 IFC 文件
          <input type="file" accept=".ifc" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <button onClick={fitCamera} disabled={meshCount === 0} style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: meshCount ? 'pointer' : 'not-allowed' }}>适配视图</button>
        <span style={{ fontSize: 12, color: statusColor }}>{status.kind === 'loading' ? '⏳ ' : ''}{status.text}</span>
      </div>
      <div ref={mountRef} style={{ flex: 1, minHeight: 400, background: '#1a1d29' }} />
      <div style={{ padding: '6px 10px', fontSize: 11, color: '#94a3b8', background: '#f8fafc' }}>web-ifc (MPL-2.0) + three (MIT) · 本地离线 WASM · 拖动旋转 / 滚轮缩放 / 右键平移</div>
    </div>
  );
}
