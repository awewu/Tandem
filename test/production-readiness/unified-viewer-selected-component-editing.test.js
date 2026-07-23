const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('unified viewer selected component editing contract', () => {
  test('selected components expose a Chinese property editor for every supported type', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(shell).toContain('data-selected-component-editor="true"');
    for (const label of [
      '选中构件属性',
      '名称',
      '类型',
      '系统',
      '楼层',
      '状态',
      '标高',
      '位置X',
      '位置Y',
      '位置Z',
      '旋转X',
      '旋转Y',
      '旋转Z',
      '墙体',
      '门窗',
      '设备',
      '管线',
      '保存属性',
    ]) {
      expect(shell).toContain(label);
    }
    expect(shell).toContain('installHeight');
  });

  test('type-specific fields cover wall, opening, equipment and route edits', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    for (const label of [
      '长度',
      '厚度',
      '高度',
      '起点X',
      '终点X',
      '墙体类型',
      '宽度',
      '离地高度',
      '开启方向',
      '容量',
      '型号',
      '安装方式',
      '所属系统',
      '接口方向',
      '管线名称',
      '管线系统',
      '管径',
      '风管宽度',
      '风管高度',
      '起点标高',
      '终点标高',
      '计算长度',
      '弯曲半径',
      '端点连接',
      '节点连接',
      '材质',
      '保温信息',
      '保温厚度',
    ]) {
      expect(shell).toContain(label);
    }
    expect(shell).toContain('data-selected-component-id={component.id}');
    expect(shell).toContain('data-selected-component-type={component.type}');
    expect(shell).toContain('{route ? (');
    expect(shell).not.toContain('BOM / 报价元数据');
    expect(shell).not.toContain('Field label="BOM分类"');
    expect(shell).not.toContain('Field label="SKU提示"');
    expect(shell).not.toContain('Field label="所属墙体"');
  });

  test('editing previews locally and persists through the viewer draft component API', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const service = read('services/api/src/modules/rysnova-bim/viewer-draft.service.ts');

    expect(shell).toContain('componentEditor');
    expect(shell).toContain('componentEditorFromComponent');
    expect(shell).toContain('componentFromEditor');
    expect(shell).toContain('previewSelectedComponent');
    expect(shell).toContain('userFacingComponentTitle');
    expect(shell).toContain('looksLikeUuid');
    expect(shell).toContain('validateComponentEditor');
    expect(shell).toContain('componentEditorErrorMessage');
    expect(shell).toContain('displayName: component.displayName');
    expect(shell).toContain("visibility: editor.visible ? 'visible' : 'hidden'");
    expect(shell).toContain('locked: editor.locked');
    expect(shell).toContain('floor: editor.floor');
    expect(shell).toContain('installHeight: editor.installHeight');
    expect(shell).toContain('position: { ...(component.position ?? {}), x: editor.x, y: editor.elevation, z: editor.z }');
    expect(shell).toContain('构件已锁定，属性、尺寸、位置、旋转和删除操作已禁用。');
    expect(shell).toContain('构件已锁定，不能保存属性修改。');
    expect(shell).toContain('名称不能使用系统 UUID，请输入中文构件名称。');
    expect(shell).toContain('旋转角度必须在 -360 到 360 度之间。');
    expect(shell).toContain('updateModelComponent');
    expect(shell).toContain('saveSelectedComponentProperties');
    expect(shell).toContain('viewerDrafts.updateComponent');
    expect(shell).toContain('applyDraft(saved)');
    expect(shell).toContain('保存后刷新/重新打开会恢复尺寸、位置、旋转和删除状态');
    expect(api).toContain('/viewer-drafts/${encodeURIComponent(id)}/components/${encodeURIComponent(componentId)}');
    expect(service).toContain('updateComponent');
    expect(service).toContain('dimensions: input.dimensions ?? current.dimensions');
    expect(service).toContain('rotation: input.rotation ?? current.rotation');
    expect(service).toContain('displayName: input.displayName ?? current.displayName ?? current.name');
    expect(service).toContain('visibility: input.visibility ?? current.visibility');
    expect(service).toContain('locked: input.lockState !== undefined ? input.locked : input.locked ?? current.locked');
    expect(service).toContain('floor: input.floor ?? current.floor');
    expect(service).toContain('installHeight: input.installHeight ?? current.installHeight');
    expect(service).toContain('geometry: input.geometry ?? current.geometry');
  });

  test('viewport dragging and deletion persist selected component changes', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');

    expect(shell).toContain('data-viewer-viewport-toolbar="true"');
    expect(shell).toContain('order="08-move-component"');
    expect(shell).toContain('order="11-delete"');
    expect(shell).toContain("active={props.pipeEditMode === 'move-component'}");
    expect(shell).toContain('disabled={props.busy || !props.canDeleteSelected}');
    expect(shell).toContain('onComponentMove={updateMovedComponentFromViewport}');
    expect(shell).toContain('updateMovedComponentFromViewport');
    expect(shell).toContain('dragUpdatedAt');
    expect(shell).toContain('deleteSelectedComponent');
    expect(shell).toContain('viewerDrafts.deleteComponent');
    expect(viewport).toContain("editModeRef.current === 'move-component'");
    expect(viewport).toContain("component.visibility === 'hidden'");
    expect(viewport).toContain('if (selected.locked) return');
    expect(viewport).toContain('onComponentMoveRef.current?.(moved.component, point)');
    expect(viewport).toContain('onPipeUpdateRef.current?.(dragged.component, points');
    expect(viewport).toContain('onDeleteRef.current?.(selected)');
  });

  test('property editing clears interaction state and restores viewport camera controls', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');

    expect(shell).toContain("useState<ViewerInteractionState>('idle')");
    expect(shell).toContain("setViewerInteractionState('editing-property')");
    expect(shell).toContain("current === 'editing-property' ? 'idle' : current");
    expect(shell).toContain("event.key !== 'Enter' && event.key !== 'Escape'");
    expect(shell).toContain('event.target.blur()');
    expect(shell).toContain('data-viewer-interaction-state={props.interactionState}');
    expect(shell).toContain('onFocus={props.onPropertyFocus}');
    expect(shell).toContain('onBlur={props.onPropertyBlur}');
    expect(shell).toContain('onKeyDown={props.onPropertyKeyDown}');
    expect(shell).toContain('onInteractionStateChange={setViewerInteractionState}');
    expect(viewport).toContain("export type ViewerInteractionState = 'idle' | 'editing-property' | 'dragging-component' | 'orbiting-camera'");
    expect(viewport).toContain('document.activeElement.blur()');
    expect(viewport).toContain('releasePointerCapture(pointerId)');
    expect(viewport).toContain("renderer.domElement.addEventListener('pointercancel', onPointerCancel)");
    expect(viewport).toContain("clearPointerInteraction('cleanup-selection-or-remount')");
    expect(viewport).toContain("restoreCameraControls('pointerup-orbit')");
    expect(viewport).toContain("restoreCameraControls('pointerup')");
  });

  test('viewport selection ignores helper frames and only promotes real visible unlocked components', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');
    const policy = read('apps/designer-workbench/src/app/viewer/selectable-object-policy.ts');
    const nodeTest = read('apps/designer-workbench/test/selectable-object-policy.nodetest.cts');

    expect(shell).toContain('onClearSelection={clearViewportSelection}');
    expect(shell).toContain('const clearViewportSelection = () => {');
    expect(viewport).toContain('nearestSelectableComponent(raycaster.intersectObjects(selectable, true))');
    expect(viewport).toContain('markSelectionHelper(grid, \'reference-grid\')');
    expect(viewport).toContain('markSelectionHelper(helperRoot, \'helper-container\')');
    expect(viewport).toContain('markSelectionHelper(outline, \'room-zone-outline\')');
    expect(viewport).toContain('markSelectionHelper(cap, \'wall-cap-helper\')');
    expect(viewport).toContain('if (policy.hidden) continue');
    expect(viewport).toContain('if (policy.selectable) selectable.push(object)');
    expect(policy).toContain("'helper-or-boundary'");
    expect(policy).toContain("component.type === 'building-outline'");
    expect(policy).toContain('metadata.locked === true');
    expect(policy).toContain('metadata.hidden === true');
    expect(nodeTest).toContain('helper hits are skipped');
    expect(nodeTest).toContain('outer boundary hidden and locked components cannot enter selection or dragging');
  });
});
