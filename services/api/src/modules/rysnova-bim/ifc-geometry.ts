/**
 * 真实 IFC 几何解析（服务端 web-ifc / WASM）。
 *
 * 从 IFC 字节流按构件提取**真实网格顶点**并计算 AABB（含世界变换），
 * 取代"客户端上报包围盒"的近似，供碰撞检测与净高分析使用。
 * 三角网级碰撞可在 AABB 相交基础上进一步细化（后续）。
 */

// web-ifc 为 WASM 模块，延迟加载 + 单例，避免无 IFC 场景的启动开销。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _api: any = null;
let _initPromise: Promise<unknown> | null = null;

async function getApi(): Promise<unknown> {
  if (_api) return _api;
  if (!_initPromise) {
    _initPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const wi = require('web-ifc');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const api = new wi.IfcAPI();
      const dir = path.dirname(require.resolve('web-ifc')) + '/';
      api.SetWasmPath(dir, true); // absolute=true：直接用 node_modules 路径
      await api.Init();
      _api = api;
      return api;
    })();
  }
  await _initPromise;
  return _api;
}

export interface IfcElementGeometry {
  expressID: number;
  ifcType: string;
  name: string | null;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  triangleCount: number;
}

/** 4x4 行主序变换（web-ifc flatTransformation 为列主序 16 元）应用到点。 */
function applyMatrix(m: number[], x: number, y: number, z: number): [number, number, number] {
  // web-ifc flatTransformation：列主序 [m0..m15]，点乘：p' = M * [x y z 1]
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/**
 * 解析 IFC 字节流，返回每个可见几何构件的世界坐标 AABB（单位与 IFC 一致，通常 m；调用方按需换算）。
 */
export async function parseIfcElementGeometry(bytes: Uint8Array): Promise<{ elements: IfcElementGeometry[]; unit: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = await getApi();
  const modelID = api.OpenModel(bytes);
  const elements: IfcElementGeometry[] = [];
  try {
    // 构件名称/类型缓存（按 expressID）
    const nameOf = (id: number): { type: string; name: string | null } => {
      try {
        const line = api.GetLine(modelID, id);
        const type = line?.constructor?.name || (line?.type != null ? String(line.type) : 'IfcElement');
        const name = line?.Name?.value ?? null;
        return { type, name };
      } catch { return { type: 'IfcElement', name: null }; }
    };

    api.StreamAllMeshes(modelID, (mesh: { expressID: number; geometries: { size(): number; get(i: number): { geometryExpressID: number; flatTransformation: number[] } } }) => {
      const geoms = mesh.geometries;
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      let tris = 0;
      for (let gi = 0; gi < geoms.size(); gi++) {
        const pg = geoms.get(gi);
        const geom = api.GetGeometry(modelID, pg.geometryExpressID);
        const verts: Float32Array = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
        const idxCount: number = geom.GetIndexDataSize();
        tris += Math.floor(idxCount / 3);
        const m = pg.flatTransformation;
        // 顶点缓冲步长 6：位置3 + 法线3
        for (let v = 0; v < verts.length; v += 6) {
          const [wx, wy, wz] = applyMatrix(m, verts[v], verts[v + 1], verts[v + 2]);
          if (wx < minX) minX = wx; if (wy < minY) minY = wy; if (wz < minZ) minZ = wz;
          if (wx > maxX) maxX = wx; if (wy > maxY) maxY = wy; if (wz > maxZ) maxZ = wz;
        }
        if (typeof geom.delete === 'function') geom.delete();
      }
      if (minX === Infinity) return; // 无顶点，跳过
      const meta = nameOf(mesh.expressID);
      elements.push({
        expressID: mesh.expressID,
        ifcType: meta.type,
        name: meta.name,
        boundingBox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
        triangleCount: tris,
      });
    });
  } finally {
    api.CloseModel(modelID);
  }
  return { elements, unit: 'ifc-native' };
}
