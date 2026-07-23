'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * W-BIM-4 · 3.1：ThatOpen IFC 查看器组件（React 封装）。
 *
 * 功能：
 *  - IFC 本地文件加载
 *  - 剖切面创建/删除
 *  - 双击选中构件
 *  - 隐藏/恢复选中构件
 *
 * 依赖：three, @thatopen/components, @thatopen/components-front
 * 注意：web-ifc WASM 通过 CDN 加载，若项目要求本地化，可在 next.config.ts 中配置 copy 静态资源。
 */
export interface ThatOpenViewerProps {
  /** 初始状态提示文本 */
  status?: string;
  /** 可选：已审批产物 file-artifact ID；提供时自动加载 */
  artifactId?: string;
  /** 加载完成后回调（返回模型信息） */
  onLoaded?: (info: { fileName: string; duration: number }) => void;
}

export default function ThatOpenViewer({ status: initialStatus = '请选择 IFC 文件', artifactId, onLoaded }: ThatOpenViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<any>(null);
  const ifcLoaderRef = useRef<any>(null);
  const clipperRef = useRef<any>(null);
  const highlighterRef = useRef<any>(null);
  const hiderRef = useRef<any>(null);
  const clipOnRef = useRef(false);
  const [status, setStatus] = useState(initialStatus);
  const [clipOn, setClipOn] = useState(false);
  const [libs, setLibs] = useState<{ THREE: any; OBC: any; OBCF: any } | null>(null);

  const loadIfcBuffer = async (buffer: Uint8Array, fileName: string) => {
    const loader = ifcLoaderRef.current;
    if (!loader) {
      setStatus('IFC 加载器未初始化');
      return;
    }
    setStatus(`解析中：${fileName} …`);
    const t0 = performance.now();
    try {
      await loader.load(buffer, true, fileName);
      const dt = (performance.now() - t0) / 1000;
      setStatus(`已加载 ${fileName}（${dt.toFixed(2)}s）。双击构件选中。`);
      onLoaded?.({ fileName, duration: dt });
    } catch (err: any) {
      console.error(err);
      setStatus(`加载失败：${err?.message ?? err}（查看控制台）`);
    }
  };

  useEffect(() => {
    let disposed = false;
    const init = async () => {
      const THREE = await import('three');
      const OBC = await import('@thatopen/components');
      const OBCF = await import('@thatopen/components-front');
      if (disposed) return;
      setLibs({ THREE, OBC, OBCF });
      if (!containerRef.current) return;

      const components = new OBC.Components();
      const worlds = components.get(OBC.Worlds);
      const world = worlds.create();
      worldRef.current = world;

      world.scene = new OBC.SimpleScene(components);
      world.renderer = new OBCF.PostproductionRenderer(components, containerRef.current);
      world.camera = new OBC.OrthoPerspectiveCamera(components);

      components.init();
      (world.scene as any).setup();
      (world.scene.three as any).background = new THREE.Color(0xeeeeee);
      world.camera.controls?.setLookAt(12, 8, 12, 0, 0, 0);

      const grids = components.get(OBC.Grids);
      grids.create(world);

      const fragments = components.get(OBC.FragmentsManager) as any;
      const workerUrl = await (OBC.FragmentsManager as any).getWorker();
      fragments.init(workerUrl);

      world.camera.controls?.addEventListener('update', () => fragments.core?.update());
      fragments.list.onItemSet.add(({ value: model }: any) => {
        model.useCamera(world.camera.three);
        world.scene.three.add(model.object);
        fragments.core?.update(true);
      });
      fragments.core?.models.materials.list.onItemSet.add(({ value: material }: any) => {
        if (!('isLodMaterial' in material && material.isLodMaterial)) {
          material.polygonOffset = true;
          material.polygonOffsetUnits = 1;
          material.polygonOffsetFactor = Math.random();
        }
      });

      const ifcLoader = components.get(OBC.IfcLoader);
      ifcLoaderRef.current = ifcLoader;
      await ifcLoader.setup({
        autoSetWasm: false,
        wasm: { path: 'https://unpkg.com/web-ifc@0.0.68/', absolute: true },
      });

      const clipper = components.get(OBC.Clipper);
      clipperRef.current = clipper;
      const highlighter = components.get(OBCF.Highlighter);
      highlighter.setup({ world });
      highlighterRef.current = highlighter;
      const hider = components.get(OBC.Hider);
      hiderRef.current = hider;

      const fileInput = document.getElementById('ifc-input') as HTMLInputElement | null;
      const handleFileChange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const buffer = new Uint8Array(await file.arrayBuffer());
        await loadIfcBuffer(buffer, file.name);
      };
      fileInput?.addEventListener('change', handleFileChange);

      // 若传入 artifactId，自动从 API 拉取并加载
      if (artifactId) {
        fetch(`/api/v2/file-artifact/${artifactId}/base64`, { credentials: 'include' })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((data) => {
            const base64 = data?.data?.base64;
            if (!base64) throw new Error('响应缺少 base64');
            const binary = atob(base64);
            const buffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
            return loadIfcBuffer(buffer, data?.data?.originalName ?? `artifact-${artifactId}.ifc`);
          })
          .catch((err) => {
            console.error(err);
            setStatus(`产物加载失败：${err?.message ?? err}`);
          });
      }

      const handleDblClick = () => {
        if (clipOnRef.current) clipper.create(world);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && clipOnRef.current) {
          clipper.delete(world);
        }
      };
      containerRef.current.addEventListener('dblclick', handleDblClick);
      window.addEventListener('keydown', handleKeyDown);

      // 保存引用以便清理
      (worldRef.current as any).__cleanup = () => {
        fileInput?.removeEventListener('change', handleFileChange);
        containerRef.current?.removeEventListener('dblclick', handleDblClick);
        window.removeEventListener('keydown', handleKeyDown);
        try {
          components.dispose();
        } catch {
          /* ignore */
        }
      };
    };

    init();
    return () => {
      disposed = true;
      (worldRef.current as any)?.__cleanup?.();
    };
  }, [onLoaded]);

  const toggleClip = () => {
    const clipper = clipperRef.current;
    if (!clipper) return;
    const next = !clipOnRef.current;
    clipOnRef.current = next;
    clipper.enabled = next;
    setClipOn(next);
    setStatus(next ? '剖切模式已开启。' : '剖切模式已关闭。');
  };

  const createClip = () => {
    if (!clipOnRef.current) {
      setStatus('请先开启剖切模式。');
      return;
    }
    const world = worldRef.current;
    const clipper = clipperRef.current;
    if (!world || !clipper) return;
    clipper.create(world);
    setStatus('已放置剖切面。');
  };

  const deleteClip = () => {
    if (!clipOnRef.current) {
      setStatus('剖切模式已关闭，无剖切面可删除。');
      return;
    }
    const world = worldRef.current;
    const clipper = clipperRef.current;
    if (!world || !clipper) return;
    clipper.delete(world);
    setStatus('已删除当前剖切面。');
  };

  const hideSelected = async () => {
    const highlighter = highlighterRef.current;
    const hider = hiderRef.current;
    if (!highlighter || !hider) return;
    const selection = highlighter.selection?.select;
    if (!selection || Object.keys(selection).length === 0) {
      setStatus('请先双击选中一个构件再隐藏。');
      return;
    }
    await hider.set(false, selection);
    highlighter.clear();
    setStatus('已隐藏选中构件。');
  };

  const resetVisibility = async () => {
    const hider = hiderRef.current;
    if (!hider) return;
    await hider.set(true);
    setStatus('已恢复全部构件显示。');
  };

  return (
    <div className="flex flex-col h-full w-full gap-2">
      <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
        <input id="ifc-input" type="file" accept=".ifc" className="text-sm" />
        <button onClick={toggleClip} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          剖切: {clipOn ? '开' : '关'}
        </button>
        <button onClick={createClip} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          放剖切面
        </button>
        <button onClick={deleteClip} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          删剖切面
        </button>
        <button onClick={hideSelected} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          隐藏选中
        </button>
        <button onClick={resetVisibility} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          恢复显示
        </button>
        <button
          onClick={async () => {
            setStatus('正在加载示例 small.ifc …');
            try {
              const res = await fetch('/small.ifc');
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buffer = new Uint8Array(await res.arrayBuffer());
              await loadIfcBuffer(buffer, 'small.ifc');
            } catch (err: any) {
              console.error(err);
              setStatus(`示例加载失败：${err?.message ?? err}（请确认 public/small.ifc 已放置）`);
            }
          }}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-200"
        >
          加载示例
        </button>
        <span className="text-sm text-gray-700 ml-2">{status}</span>
      </div>
      <div ref={containerRef} className="flex-1 border rounded bg-gray-50 min-h-[400px]" />
    </div>
  );
}
