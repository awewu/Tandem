/**
 * ThatOpen Spike · W-BIM-4 选型验证（蓝图 §6.7 / W-BIM-4）
 * 验证目标：
 *  1. @thatopen/components 世界初始化（three.js 渲染/相机/网格）
 *  2. web-ifc(WASM) 加载 IFC → fragments 模型
 *  3. 剖切（Clipper）、构件选中/显隐（Highlighter/Hider）
 * 注意：这是隔离实验代码，API 以 @thatopen/components ~3.4 为准，
 * 若有 API 漂移以官方 examples 为参照修正。
 */
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBCF from "@thatopen/components-front";

const container = document.getElementById("container");
const statusEl = document.getElementById("status");
const setStatus = (t) => (statusEl.textContent = t);

// ── 1. 世界初始化 ────────────────────────────────────────────
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);
const world = worlds.create();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBCF.PostproductionRenderer(components, container);
world.camera = new OBC.OrthoPerspectiveCamera(components);

components.init();

world.scene.setup();
world.scene.three.background = new THREE.Color(0xeeeeee);
world.camera.controls.setLookAt(12, 8, 12, 0, 0, 0);

const grids = components.get(OBC.Grids);
grids.create(world);

// ── 2. Fragments 初始化（必须先于 IFC 加载）──────────────────
const fragments = components.get(OBC.FragmentsManager);
const workerUrl = await OBC.FragmentsManager.getWorker();
fragments.init(workerUrl);

world.camera.controls.addEventListener("update", () => fragments.core.update());
fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  fragments.core.update(true);
});
fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  if (!("isLodMaterial" in material && material.isLodMaterial)) {
    material.polygonOffset = true;
    material.polygonOffsetUnits = 1;
    material.polygonOffsetFactor = Math.random();
  }
});

// ── 3. IFC 加载（web-ifc WASM → fragments）───────────────────
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: { path: "https://unpkg.com/web-ifc@0.0.77/", absolute: true },
});

document.getElementById("ifc-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus(`解析中：${file.name} …`);
  const t0 = performance.now();
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    await ifcLoader.load(buffer, true, file.name);
    const dt = ((performance.now() - t0) / 1000).toFixed(2);
    setStatus(`已加载 ${file.name}（${dt}s）。双击构件选中。`);
  } catch (err) {
    console.error(err);
    setStatus(`加载失败：${err.message}（查看控制台）`);
  }
});

// ── 4. 剖切 Clipper ──────────────────────────────────────────
const clipper = components.get(OBC.Clipper);
let clipOn = false;
const clipBtn = document.getElementById("toggle-clip");
const createClipBtn = document.getElementById("create-clip");
const deleteClipBtn = document.getElementById("delete-clip");

const updateClipBtn = () => {
  clipBtn.textContent = `剖切: ${clipOn ? "开" : "关"}`;
};

clipBtn.addEventListener("click", () => {
  clipOn = !clipOn;
  clipper.enabled = clipOn;
  updateClipBtn();
  setStatus(clipOn ? "剖切模式已开启，可点'放剖切面'或双击模型。" : "剖切模式已关闭。");
});

createClipBtn.addEventListener("click", () => {
  if (!clipOn) {
    setStatus("请先点'剖切: 关'开启剖切模式。");
    return;
  }
  clipper.create(world);
  setStatus("已放置剖切面。");
});

deleteClipBtn.addEventListener("click", () => {
  if (!clipOn) {
    setStatus("剖切模式已关闭，无剖切面可删除。");
    return;
  }
  clipper.delete(world);
  setStatus("已删除当前剖切面。");
});

container.ondblclick = () => {
  if (clipOn) clipper.create(world);
};
window.addEventListener("keydown", (e) => {
  if ((e.key === "Delete" || e.key === "Backspace") && clipOn) {
    clipper.delete(world);
  }
});

// ── 5. 选中/显隐 Highlighter + Hider ────────────────────────
const highlighter = components.get(OBCF.Highlighter);
highlighter.setup({ world });

const hider = components.get(OBC.Hider);

document.getElementById("toggle-hide").addEventListener("click", async () => {
  const selection = highlighter.selection.select;
  if (!selection || Object.keys(selection).length === 0) {
    setStatus("请先双击选中一个构件再隐藏。");
    return;
  }
  await hider.set(false, selection);
  highlighter.clear();
  setStatus("已隐藏选中构件。");
});

document.getElementById("reset-hide").addEventListener("click", async () => {
  await hider.set(true);
  setStatus("已恢复全部构件显示。");
});
