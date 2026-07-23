# Three.js 性能优化最佳实践

## 学习来源
- 文档: https://discoverthreejs.com/tips-and-tricks/
- 搜索: "Three.js performance optimization LOD culling"
- 时间: 2026-04-10 进化迭代

## 核心优化技巧

### 1. 静态对象优化
```javascript
// 对静态或很少移动的对象禁用自动矩阵更新
object.matrixAutoUpdate = false;
// 手动调用更新当 position/rotation/scale 改变时
object.updateMatrix();
```

### 2. 透明度优化
- 透明对象很慢，尽量减少使用
- 使用 alphatest 替代标准透明度（更快）

### 3. 性能测试方法
```javascript
// 替换所有材质为基础材质测试性能瓶颈
scene.overrideMaterial = new THREE.MeshBasicMaterial();
// 如果性能提升 = GPU瓶颈
// 如果性能不变 = CPU瓶颈
```

### 4. LOD (Level of Detail) 系统
- 远处物体不需要高细节
- 使用 LOD 对象自动切换细节级别
- 远处物体可每2-3帧更新一次

### 5. 移动端优化
- 限制 pixel ratio 最大为 2 或 3
- 高像素比设备(如5x)会降低性能
- 轻微模糊换取显著性能提升

### 6. 光照和阴影优化
- 烘焙光照和阴影贴图
- 减少场景中的光源数量

### 7. Draw Call 优化
- 规则: 越少 draw calls = 越好性能
- 使用几何体实例化（成百上千相似几何体）
- 避免 TriangleFanDrawMode

### 8. GPU 动画
- 在GPU而非CPU上执行动画
- 特别适用于顶点或粒子动画

## 应用到本项目

### 当前BIM 3D引擎可优化点:
- [ ] 为静态墙体设置 matrixAutoUpdate = false
- [ ] 添加LOD系统（远景简化模型）
- [ ] 限制移动端 pixel ratio
- [ ] 优化 draw calls（墙体合并）

### 下次实现3D功能时:
1. 先设置性能基准测试
2. 应用上述优化技巧
3. 测试性能提升效果
