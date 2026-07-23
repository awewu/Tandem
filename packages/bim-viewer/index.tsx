'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - three examples controls are consumed through the shared viewer package boundary.
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - three examples loader types are not published for this package boundary.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - web-ifc has no bundled TypeScript declarations in this workspace version.
import { IfcAPI } from 'web-ifc';

export type BimModelSourceType = 'local-upload' | 'artifact';
export type BimModelType = 'ifc' | 'glb' | 'unknown';
export type BimModelLoadPhase = 'loading' | 'ready' | 'error';

export interface BimModelObjectSummary {
  id: string;
  name: string;
  type: string;
}

export interface BimModelLoadEvent {
  phase: BimModelLoadPhase;
  sourceType: BimModelSourceType;
  modelType: BimModelType;
  name: string;
  artifactId?: string;
  uploadReference?: Record<string, unknown>;
  meshCount?: number;
  objectCount?: number;
  objects?: BimModelObjectSummary[];
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface BimViewerProps {
  status?: string;
  artifactId?: string;
  wasmPath?: string;
  authToken?: string;
  artifactEndpoint?: string;
  onModelEvent?: (event: BimModelLoadEvent) => void | Promise<void>;
}

type Stat = { kind: 'idle' | 'loading' | 'ready' | 'error'; text: string };

function readToken(explicit?: string): string | null {
  if (explicit) return explicit;
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|; )nx_token=([^;]*)/);
    if (m) return decodeURIComponent(m[1]);
  }
  if (typeof window !== 'undefined') return localStorage.getItem('token');
  return null;
}

function detectModelType(name?: string, mimeType?: string | null): BimModelType {
  const lowerName = String(name || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();
  if (lowerName === 'ifc' || lowerName === 'glb' || lowerName === 'unknown') return lowerName;
  if (lowerName === 'gltf') return 'glb';
  if (lowerName.endsWith('.ifc') || lowerMime.includes('ifc')) return 'ifc';
  if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf') || lowerMime.includes('gltf'))
    return 'glb';
  return 'unknown';
}

function byteSlice(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

function collectGlbObjects(root: THREE.Object3D): BimModelObjectSummary[] {
  const objects: BimModelObjectSummary[] = [];
  root.traverse((child) => {
    if (objects.length >= 200 || child.type === 'Scene') return;
    objects.push({
      id: child.uuid,
      name: child.name || child.type,
      type: child.type,
    });
  });
  return objects;
}

export default function BimViewer({
  status: initialStatus = '打开本地 IFC/GLB 模型，或选择成果库文件',
  artifactId,
  wasmPath = '/wasm/',
  authToken,
  artifactEndpoint = '/api/v2/file-artifact/{id}/base64',
  onModelEvent,
}: BimViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
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
    scene.background = new THREE.Color(0xf8fafc);
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
    scene.add(new THREE.GridHelper(50, 50, 0x94a3b8, 0xe2e8f0));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const group = new THREE.Group();
    scene.add(group);

    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    groupRef.current = group;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  const clearModel = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    for (const child of [...group.children]) {
      group.remove(child);
      disposeObject(child);
    }
  }, []);

  const fitCamera = useCallback(() => {
    const group = groupRef.current;
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

  const loadIfcBuffer = useCallback(
    async (buffer: Uint8Array) => {
      const group = groupRef.current;
      if (!group) return { meshCount: 0, objects: [] as BimModelObjectSummary[] };
      const ifcApi = new IfcAPI();
      ifcApi.SetWasmPath(wasmPath);
      await ifcApi.Init();
      const modelID = ifcApi.OpenModel(buffer);
      let count = 0;
      const objects: BimModelObjectSummary[] = [];
      ifcApi.StreamAllMeshes(modelID, (mesh: any) => {
        if (objects.length < 200) {
          objects.push({
            id: String(mesh.expressID ?? `ifc-mesh-${count}`),
            name: `IFC element ${mesh.expressID ?? count + 1}`,
            type: 'IFC',
          });
        }
        const placed = mesh.geometries;
        for (let i = 0; i < placed.size(); i++) {
          const pg = placed.get(i);
          const geom = ifcApi.GetGeometry(modelID, pg.geometryExpressID);
          const verts = ifcApi.GetVertexArray(
            geom.GetVertexData(),
            geom.GetVertexDataSize()
          ) as Float32Array;
          const indices = ifcApi.GetIndexArray(
            geom.GetIndexData(),
            geom.GetIndexDataSize()
          ) as Uint32Array;
          const positions = new Float32Array(verts.length / 2);
          const normals = new Float32Array(verts.length / 2);
          for (let v = 0; v < verts.length; v += 6) {
            const j = (v / 6) * 3;
            positions[j] = verts[v];
            positions[j + 1] = verts[v + 1];
            positions[j + 2] = verts[v + 2];
            normals[j] = verts[v + 3];
            normals[j + 1] = verts[v + 4];
            normals[j + 2] = verts[v + 5];
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
          const m4 = new THREE.Matrix4().fromArray(pg.flatTransformation);
          const threeMesh = new THREE.Mesh(bg, material);
          threeMesh.applyMatrix4(m4);
          group.add(threeMesh);
          count++;
          geom.delete();
        }
      });
      ifcApi.CloseModel(modelID);
      group.rotation.set(-Math.PI / 2, 0, 0);
      return { meshCount: count, objects };
    },
    [wasmPath]
  );

  const loadGlbBuffer = useCallback(async (buffer: Uint8Array) => {
    const group = groupRef.current;
    if (!group) return { meshCount: 0, objects: [] as BimModelObjectSummary[] };
    const gltf = await new Promise<any>((resolve, reject) => {
      new GLTFLoader().parse(byteSlice(buffer), '', resolve, reject);
    });
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error('GLB scene is empty');
    group.rotation.set(0, 0, 0);
    group.add(root);
    let meshCount = 0;
    root.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    return { meshCount, objects: collectGlbObjects(root) };
  }, []);

  const loadModelBuffer = useCallback(
    async (
      buffer: Uint8Array,
      name: string,
      modelType: BimModelType,
      sourceType: BimModelSourceType,
      extra: Partial<BimModelLoadEvent> = {}
    ) => {
      if (modelType === 'unknown') {
        const message = `不支持的模型类型：${name}`;
        setStatus({ kind: 'error', text: message });
        await onModelEvent?.({
          phase: 'error',
          sourceType,
          modelType,
          name,
          error: message,
          ...extra,
        });
        return;
      }

      setStatus({ kind: 'loading', text: `正在加载 ${name}` });
      await onModelEvent?.({ phase: 'loading', sourceType, modelType, name, ...extra });
      clearModel();
      setMeshCount(0);

      try {
        const loaded =
          modelType === 'ifc' ? await loadIfcBuffer(buffer) : await loadGlbBuffer(buffer);
        setMeshCount(loaded.meshCount);
        fitCamera();
        setStatus({ kind: 'ready', text: `已载入 ${name}：${loaded.meshCount} 个网格` });
        await onModelEvent?.({
          phase: 'ready',
          sourceType,
          modelType,
          name,
          meshCount: loaded.meshCount,
          objectCount: loaded.objects.length,
          objects: loaded.objects,
          metadata: { meshCount: loaded.meshCount, objectCount: loaded.objects.length },
          ...extra,
        });
      } catch (err) {
        const message = (err as Error).message;
        console.error(err);
        setStatus({ kind: 'error', text: `载入失败：${message}` });
        await onModelEvent?.({
          phase: 'error',
          sourceType,
          modelType,
          name,
          error: message,
          ...extra,
        });
      }
    },
    [clearModel, fitCamera, loadGlbBuffer, loadIfcBuffer, onModelEvent]
  );

  useEffect(() => {
    if (!artifactId) return;
    const token = readToken(authToken);
    const url = artifactEndpoint.replace('{id}', artifactId);
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const payload = data?.data ?? data;
        const base64 = payload?.dataBase64 ?? payload?.base64;
        const originalName = payload?.originalName ?? payload?.filename ?? `artifact-${artifactId}`;
        const modelType = detectModelType(
          payload?.modelType ?? payload?.sourceMetadata?.modelType ?? originalName,
          payload?.mimeType
        );
        if (!base64) throw new Error('成果响应缺少 base64 数据');
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
        return loadModelBuffer(buffer, originalName, modelType, 'artifact', {
          artifactId,
          metadata: { originalName, mimeType: payload?.mimeType, sizeBytes: payload?.sizeBytes },
        });
      })
      .catch((err) => {
        const message = err?.message ?? String(err);
        setStatus({ kind: 'error', text: `成果载入失败：${message}` });
        onModelEvent?.({
          phase: 'error',
          sourceType: 'artifact',
          modelType: 'unknown',
          name: `artifact-${artifactId}`,
          artifactId,
          error: message,
        });
      });
  }, [artifactId, authToken, artifactEndpoint, loadModelBuffer, onModelEvent]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const modelType = detectModelType(f.name, f.type);
    const uploadReference = {
      fileName: f.name,
      mimeType: f.type || null,
      sizeBytes: f.size,
      lastModified: f.lastModified,
    };
    f.arrayBuffer().then((b) =>
      loadModelBuffer(new Uint8Array(b), f.name, modelType, 'local-upload', {
        uploadReference,
        metadata: { originalName: f.name, mimeType: f.type || null, sizeBytes: f.size },
      })
    );
  };

  const statusColor =
    status.kind === 'error' ? '#dc2626' : status.kind === 'ready' ? '#16a34a' : '#64748b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: '#ffffff',
          flexWrap: 'wrap',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <label
          style={{
            background: '#0b8079',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          打开 IFC/GLB
          <input
            type="file"
            accept=".ifc,.glb,.gltf"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </label>
        <button
          onClick={fitCamera}
          disabled={meshCount === 0}
          style={{
            background: '#fff',
            color: meshCount ? '#334155' : '#94a3b8',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: meshCount ? 'pointer' : 'not-allowed',
          }}
        >
          适配视图
        </button>
        <span style={{ fontSize: 12, color: statusColor }}>
          {status.kind === 'loading' ? '加载中 - ' : ''}
          {status.text}
        </span>
      </div>
      <div ref={mountRef} style={{ flex: 1, minHeight: 400, background: '#f8fafc' }} />
      <div style={{ padding: '6px 10px', fontSize: 11, color: '#64748b', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        @rhautt/bim-viewer / web-ifc + GLTFLoader / 本地 WASM / 旋转、缩放、平移
      </div>
    </div>
  );
}
