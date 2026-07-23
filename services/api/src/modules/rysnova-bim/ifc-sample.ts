/**
 * 最小 IFC4 样例（两个相交盒体 + 一块楼板 + 一根抬高风管），用于 IFC 几何解析/碰撞/净高自测。
 * 单位：米。盒体经 IfcExtrudedAreaSolid(矩形轮廓沿 Z 拉伸) 表达，web-ifc 可镶嵌。
 *
 * 布局（米）：
 *   BoxA (管A): X[-0.5,0.5] Y[-0.05,0.05] Z[0,0.1]
 *   BoxB (风管B): X[0.25,0.35] Y[-0.5,0.5] Z[0,0.1]   → 与 A 在 X[0.25,0.35] 相交（硬碰撞）
 *   Slab (楼板): X[-2,2] Y[-2,2] Z[-0.2,0]            → 顶面 Z=0
 *   Duct (风管): X[-1,1] Y[1,1.3] Z[2.2,2.5]          → 底 Z=2.2，距楼板顶净高 2.2m
 */

// 每个盒体：矩形轮廓(xDim,yDim) 在 (px,py,pz) 处沿 Z 拉伸 depth。
function box(startId: number, name: string, ifcType: string, xDim: number, yDim: number, px: number, py: number, pz: number, depth: number): { text: string; nextId: number; proxyId: number } {
  const id = (n: number) => `#${startId + n}`;
  const lines = [
    `${id(0)}=IFCCARTESIANPOINT((${px},${py},${pz}));`,
    `${id(1)}=IFCDIRECTION((0.,0.,1.));`,
    `${id(2)}=IFCDIRECTION((1.,0.,0.));`,
    `${id(3)}=IFCAXIS2PLACEMENT3D(${id(0)},${id(1)},${id(2)});`,
    `${id(4)}=IFCCARTESIANPOINT((0.,0.));`,
    `${id(5)}=IFCAXIS2PLACEMENT2D(${id(4)},$);`,
    `${id(6)}=IFCRECTANGLEPROFILEDEF(.AREA.,$,${id(5)},${xDim},${yDim});`,
    `${id(7)}=IFCEXTRUDEDAREASOLID(${id(6)},${id(3)},${id(1)},${depth});`,
    `${id(8)}=IFCSHAPEREPRESENTATION(#100,'Body','SweptSolid',(${id(7)}));`,
    `${id(9)}=IFCPRODUCTDEFINITIONSHAPE($,$,(${id(8)}));`,
    `${id(10)}=IFCLOCALPLACEMENT($,#104);`,
    `${id(11)}=IFCBUILDINGELEMENTPROXY('${name}GUID000000000000${startId}',#5,'${name}','${ifcType}',$,${id(10)},${id(9)},$,$);`,
  ];
  return { text: lines.join('\n'), nextId: startId + 12, proxyId: startId + 11 };
}

export function buildSampleIfc(): string {
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    "FILE_NAME('rhautt-sample.ifc','2026-01-01T00:00:00',(''),(''),'RysNova','RysNova','');",
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
    "#1=IFCPERSON($,'RysNova',$,$,$,$,$,$);",
    "#2=IFCORGANIZATION($,'RysNova',$,$,$);",
    '#3=IFCPERSONANDORGANIZATION(#1,#2,$);',
    "#4=IFCAPPLICATION(#2,'1.0','RysNova','rhautt');",
    "#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);",
    "#10=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);",
    '#11=IFCUNITASSIGNMENT((#10));',
    "#101=IFCCARTESIANPOINT((0.,0.,0.));",
    '#102=IFCDIRECTION((0.,0.,1.));',
    '#103=IFCDIRECTION((1.,0.,0.));',
    '#104=IFCAXIS2PLACEMENT3D(#101,#102,#103);',
    '#100=IFCGEOMETRICREPRESENTATIONCONTEXT($,\'Model\',3,1.0E-5,#104,$);',
    "#12=IFCPROJECT('0PROJECTGUID0000000000',#5,'RysNova Sample',$,$,$,$,(#100),#11);",
  ];
  const parts: string[] = [header.join('\n')];
  const proxies: number[] = [];
  let next = 200;
  const specs: Array<[string, string, number, number, number, number, number, number]> = [
    // name, ifcType, xDim, yDim, px, py, pz, depth
    ['PipeA', 'PIPE', 1.0, 0.1, 0, 0, 0, 0.1],       // X[-0.5,0.5] Y[-0.05,0.05] Z[0,0.1]
    ['DuctB', 'DUCT', 0.1, 1.0, 0.3, 0, 0, 0.1],     // X[0.25,0.35] Y[-0.5,0.5] Z[0,0.1] ∩ A
    ['Slab', 'SLAB', 4.0, 4.0, 0, 0, -0.2, 0.2],     // 楼板 顶面 Z=0
    ['DuctHigh', 'DUCT', 2.0, 0.3, 0, 1.15, 2.2, 0.3], // 抬高风管 底 Z=2.2
  ];
  for (const [name, t, xd, yd, px, py, pz, d] of specs) {
    const b = box(next, name, t, xd, yd, px, py, pz, d);
    parts.push(b.text);
    proxies.push(b.proxyId);
    next = b.nextId;
  }
  // 空间聚合（可选，简化省略 IfcRelContainedInSpatialStructure）
  parts.push('ENDSEC;');
  parts.push('END-ISO-10303-21;');
  return parts.join('\n');
}
