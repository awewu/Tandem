'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type {
  GeneratedHvacComponent,
  GeneratedHvacModel,
  ViewerComponentCatalogTemplate,
} from '../../lib/api';
import {
  componentSelectablePolicy,
  markBusinessSelectable,
  markSelectionHelper,
  nearestSelectableComponent,
  nearestSelectableRoot,
  selectableComponentFromObject,
  selectableRootFromObject,
} from './selectable-object-policy';
import {
  applyPlacementPointerOffset,
  appendOrthogonalRouteDraftPoint,
  componentPlacementAnchor,
  constrainPlacementPoint,
  deleteIntermediateRoutePoint,
  findRouteEndpointSnapCandidate,
  insertRoutePointOnSegment,
  moveRoutePoint,
  normalizeRouteEndpointRefs,
  parseTemplateDropId,
  parseTemplateDropData,
  placementElevationFrom,
  placementPointerOffset,
  routeEndpointRefsWithCandidate,
} from './viewer-component-placement';
import type {
  CatalogTemplateDefaultOverrides,
  PlacementConstraintResult,
  RouteEndpointRefs,
  RouteEndpointSnapCandidate,
} from './viewer-component-placement';
import {
  renderSavedRouteComponentForView,
  routeHasFloorVisibility,
  routeRenderMetrics,
  routeRiserMarkers,
  routeVisiblePointRefs,
  routeVisibleSegmentRefs,
} from './viewer-route-geometry';
import type { RouteFloorView, RouteFloorViewMode } from './viewer-route-geometry';
import {
  GENERATED_SYSTEM_COLORS,
  VIEWER_SEMANTIC_MATERIAL_TOKENS,
  VIEWER_STATE_ACCENT_TOKENS,
  componentStateTreatment,
  frameMaterialSpec,
  generatedComponentMaterialSpec,
} from './viewer-semantic-materials';
import type { ViewerComponentVisualState, ViewerMaterialSpec } from './viewer-semantic-materials';

export type GeneratedVisibility = {
  cooling: boolean;
  heating: boolean;
  freshAir: boolean;
  pipes: boolean;
  equipment: boolean;
};

type Props = {
  model: GeneratedHvacModel;
  componentTemplates?: ViewerComponentCatalogTemplate[];
  templateDefaultOverrides?: Record<string, CatalogTemplateDefaultOverrides>;
  outsidePlacementMarginM?: unknown;
  visibility: GeneratedVisibility;
  selectedId?: string | null;
  floorViewMode?: RouteFloorViewMode;
  activeFloor?: number;
  editMode?: PipeEditMode;
  floorHeight?: number;
  onSelect: (component: GeneratedHvacComponent) => void;
  onClearSelection?: () => void;
  onTemplateDrop?: (templateId: string, point: PipePoint) => void;
  onComponentMove?: (component: GeneratedHvacComponent, point: PipePoint) => void;
  draftRoutePoints?: PipePoint[];
  routeDraftFloor?: number;
  routeDraftElevation?: number;
  routeDraftSystemKey?: GeneratedHvacComponent['systemKey'];
  routeDraftType?: 'pipe-route' | 'duct-route';
  draftRouteEndpointRefs?: RouteEndpointRefs;
  onPipeDraftChange?: (points: PipePoint[]) => void;
  onPipeDraftEndpointRefsChange?: (endpointRefs: RouteEndpointRefs) => void;
  onPipeCreate?: (points: PipePoint[], endpointRefs?: RouteEndpointRefs) => void;
  onPipeUpdate?: (
    component: GeneratedHvacComponent,
    points: PipePoint[],
    endpointRefs?: RouteEndpointRefs
  ) => void;
  onRiserPoint?: (point: PipePoint) => void;
  onDelete?: (component: GeneratedHvacComponent) => void;
  onInteractionStateChange?: (state: ViewerInteractionState) => void;
};

export type PipeEditMode =
  | 'select'
  | 'place-component'
  | 'move-component'
  | 'draw-pipe'
  | 'edit-pipe'
  | 'add-riser'
  | 'delete';
export type PipePoint = { x: number; y: number; z: number };
// prettier-ignore
export type ViewerInteractionState = 'idle' | 'editing-property' | 'dragging-component' | 'orbiting-camera';

export default function GeneratedHvacViewport({
  model,
  componentTemplates = [],
  templateDefaultOverrides = {},
  outsidePlacementMarginM,
  visibility,
  selectedId,
  floorViewMode = 'all-floors',
  activeFloor = 1,
  editMode = 'select',
  floorHeight = 3,
  onSelect,
  onClearSelection,
  onTemplateDrop,
  onComponentMove,
  draftRoutePoints = [],
  routeDraftFloor = 1,
  routeDraftElevation,
  routeDraftSystemKey = 'cooling',
  routeDraftType = 'pipe-route',
  draftRouteEndpointRefs,
  onPipeDraftChange,
  onPipeDraftEndpointRefsChange,
  onPipeCreate,
  onPipeUpdate,
  onRiserPoint,
  onDelete,
  onInteractionStateChange,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const selectedIdRef = useRef<string | null | undefined>(selectedId);
  const editModeRef = useRef<PipeEditMode>(editMode);
  const onSelectRef = useRef(onSelect);
  const onClearSelectionRef = useRef(onClearSelection);
  const onTemplateDropRef = useRef(onTemplateDrop);
  const onComponentMoveRef = useRef(onComponentMove);
  const draftRoutePointsRef = useRef<PipePoint[]>(draftRoutePoints);
  const routeDraftFloorRef = useRef(routeDraftFloor);
  const routeDraftElevationRef = useRef(routeDraftElevation);
  const routeDraftSystemKeyRef = useRef(routeDraftSystemKey);
  const routeDraftTypeRef = useRef(routeDraftType);
  const draftRouteEndpointRefsRef = useRef<RouteEndpointRefs>(
    normalizeRouteEndpointRefs(draftRouteEndpointRefs)
  );
  const onPipeDraftChangeRef = useRef(onPipeDraftChange);
  const onPipeDraftEndpointRefsChangeRef = useRef(onPipeDraftEndpointRefsChange);
  const onPipeCreateRef = useRef(onPipeCreate);
  const onPipeUpdateRef = useRef(onPipeUpdate);
  const onRiserPointRef = useRef(onRiserPoint);
  const onDeleteRef = useRef(onDelete);
  const onInteractionStateChangeRef = useRef(onInteractionStateChange);

  selectedIdRef.current = selectedId;
  editModeRef.current = editMode;
  onSelectRef.current = onSelect;
  onClearSelectionRef.current = onClearSelection;
  onTemplateDropRef.current = onTemplateDrop;
  onComponentMoveRef.current = onComponentMove;
  draftRoutePointsRef.current = draftRoutePoints;
  routeDraftFloorRef.current = routeDraftFloor;
  routeDraftElevationRef.current = routeDraftElevation;
  routeDraftSystemKeyRef.current = routeDraftSystemKey;
  routeDraftTypeRef.current = routeDraftType;
  draftRouteEndpointRefsRef.current = normalizeRouteEndpointRefs(draftRouteEndpointRefs);
  onPipeDraftChangeRef.current = onPipeDraftChange;
  onPipeDraftEndpointRefsChangeRef.current = onPipeDraftEndpointRefsChange;
  onPipeCreateRef.current = onPipeCreate;
  onPipeUpdateRef.current = onPipeUpdate;
  onRiserPointRef.current = onRiserPoint;
  onDeleteRef.current = onDelete;
  onInteractionStateChangeRef.current = onInteractionStateChange;

  useEffect(() => {
    selectedIdRef.current = selectedId;
    editModeRef.current = editMode;
    onSelectRef.current = onSelect;
    onClearSelectionRef.current = onClearSelection;
    onTemplateDropRef.current = onTemplateDrop;
    onComponentMoveRef.current = onComponentMove;
    draftRoutePointsRef.current = draftRoutePoints;
    routeDraftFloorRef.current = routeDraftFloor;
    routeDraftElevationRef.current = routeDraftElevation;
    routeDraftSystemKeyRef.current = routeDraftSystemKey;
    routeDraftTypeRef.current = routeDraftType;
    draftRouteEndpointRefsRef.current = normalizeRouteEndpointRefs(draftRouteEndpointRefs);
    onPipeDraftChangeRef.current = onPipeDraftChange;
    onPipeDraftEndpointRefsChangeRef.current = onPipeDraftEndpointRefsChange;
    onPipeCreateRef.current = onPipeCreate;
    onPipeUpdateRef.current = onPipeUpdate;
    onRiserPointRef.current = onRiserPoint;
    onDeleteRef.current = onDelete;
    onInteractionStateChangeRef.current = onInteractionStateChange;
  }, [
    editMode,
    onComponentMove,
    draftRoutePoints,
    onDelete,
    onPipeCreate,
    onPipeDraftChange,
    onPipeDraftEndpointRefsChange,
    onPipeUpdate,
    onRiserPoint,
    onSelect,
    onClearSelection,
    onTemplateDrop,
    onInteractionStateChange,
    routeDraftElevation,
    routeDraftFloor,
    routeDraftSystemKey,
    routeDraftType,
    draftRouteEndpointRefs,
    selectedId,
  ]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 620;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(18, 16, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 0.9);
    light.position.set(10, 20, 10);
    scene.add(light);
    const grid = new THREE.GridHelper(48, 24, 0x94a3b8, 0xe2e8f0);
    markSelectionHelper(grid, 'reference-grid');
    scene.add(grid);

    const root = new THREE.Group();
    const helperRoot = new THREE.Group();
    markSelectionHelper(root, 'scene-container');
    markSelectionHelper(helperRoot, 'helper-container');
    scene.add(root);
    scene.add(helperRoot);
    const selectable: THREE.Object3D[] = [];
    const handles: THREE.Object3D[] = [];
    let selectedPipePoints: PipePoint[] = [];
    let selectedPipeComponent: GeneratedHvacComponent | null = null;
    let hoveredObject: THREE.Object3D | null = null;
    let hoveredComponent: GeneratedHvacComponent | null = null;
    const floorView: RouteFloorView = {
      mode: floorViewMode,
      floor: Math.max(1, Math.round(activeFloor)),
      floorHeight,
    };

    for (const component of model.components) {
      const policy = componentSelectablePolicy(component);
      if (policy.hidden) continue;
      if (!isVisible(component, visibility)) continue;
      if (!isFloorVisible(component, floorView)) continue;
      const isSelected = component.id === selectedIdRef.current;
      const object = renderComponent(component, isSelected, floorView);
      if (!object) continue;
      root.add(object);
      if (policy.selectable) selectable.push(object);
      if (isSelected && isRouteComponent(component)) {
        const pointRefs = routeVisiblePointRefs(component, floorView);
        const segmentRefs = routeVisibleSegmentRefs(component, floorView);
        selectedPipePoints = pointRefs.map((ref) => ref.point);
        selectedPipeComponent = component;
        pointRefs.forEach((ref) => {
          handles.push(addRoutePointHandle(helperRoot, component, ref.index, ref.point));
        });
        for (const segment of segmentRefs) {
          handles.push(
            addRouteSegmentHandle(
              helperRoot,
              component,
              segment.insertAfterIndex,
              segment.start,
              segment.end
            )
          );
        }
      }
    }

    const fittedTarget = fitCamera(camera, root);
    const cameraTarget = cameraStateRef.current?.target.clone() ?? fittedTarget;
    if (cameraStateRef.current) {
      camera.position.copy(cameraStateRef.current.position);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
    } else {
      cameraStateRef.current = {
        position: camera.position.clone(),
        target: cameraTarget.clone(),
      };
    }
    renderer.domElement.dataset.cameraPosition = [
      camera.position.x.toFixed(2),
      camera.position.y.toFixed(2),
      camera.position.z.toFixed(2),
    ].join(',');
    writeEndpointDataset(renderer.domElement, selectedPipePoints, camera);
    writeRouteEditDataset(renderer.domElement, selectedPipePoints, camera);
    writeComponentAnchorDataset(
      renderer.domElement,
      model.components.filter(
        (component) => isVisible(component, visibility) && isFloorVisible(component, floorView)
      ),
      camera,
      placementElevationFrom({
        floor: routeDraftFloorRef.current,
        elevation: routeDraftElevationRef.current,
        floorHeight,
        fallbackElevation: 0.95,
      })
    );
    writeRiserMarkerDataset(renderer.domElement, model, floorView, camera);
    writePlacementConstraintDataset(
      renderer.domElement,
      constrainPlacementPoint({
        model,
        point: { x: 0, y: 0, z: 0 },
        outsidePlacementMarginM,
      })
    );

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.45 };
    const pointer = new THREE.Vector2();
    let pendingDraftRoutePoint: {
      point: PipePoint;
      endpointKey: 'from' | 'to';
      endpointRef: RouteEndpointSnapCandidate | null;
      startX: number;
      startY: number;
      moved: boolean;
    } | null = null;
    let draggingRoutePoint: {
      component: GeneratedHvacComponent;
      pointIndex: number;
      points: PipePoint[];
      endpointRefs: RouteEndpointRefs;
    } | null = null;
    let draggingComponent: {
      component: GeneratedHvacComponent;
      object: THREE.Object3D;
      plane: THREE.Plane;
      pointerOffset: PipePoint;
      lastAnchor: PipePoint;
    } | null = null;
    let orbitDrag: {
      button: number;
      mode: 'orbit' | 'pan';
      lastX: number;
      lastY: number;
      startX: number;
      startY: number;
      moved: boolean;
    } | null = null;
    let draftLine: THREE.Line | null = null;
    let capturedPointerId: number | null = null;
    let interactionState: ViewerInteractionState = 'idle';

    const setInteractionState = (state: ViewerInteractionState) => {
      interactionState = state;
      renderer.domElement.dataset.interactionState = state;
      renderer.domElement.dataset.cameraControlsEnabled =
        state === 'editing-property' || state === 'dragging-component' ? 'false' : 'true';
      onInteractionStateChangeRef.current?.(state);
    };

    const restoreCameraControls = (reason: string) => {
      renderer.domElement.dataset.cameraControlsRestored = reason;
      setInteractionState('idle');
    };

    const releasePointerCapture = (pointerId = capturedPointerId) => {
      if (pointerId == null) return;
      try {
        if (renderer.domElement.hasPointerCapture(pointerId)) {
          renderer.domElement.releasePointerCapture(pointerId);
        }
      } catch {
        // Browser can throw if capture was already released during remount.
      } finally {
        if (capturedPointerId === pointerId) capturedPointerId = null;
        renderer.domElement.dataset.pointerCaptureReleased = 'true';
      }
    };

    const capturePointer = (event: PointerEvent) => {
      try {
        renderer.domElement.setPointerCapture(event.pointerId);
        capturedPointerId = event.pointerId;
        renderer.domElement.dataset.pointerCaptureActive = 'true';
      } catch {
        capturedPointerId = null;
      }
    };

    const clearPointerInteraction = (reason: string, pointerId?: number) => {
      if (editModeRef.current !== 'draw-pipe') clearDraftLine();
      if (draggingComponent) {
        applyComponentObjectMaterialState(draggingComponent.object, draggingComponent.component, {
          selected: draggingComponent.component.id === selectedIdRef.current,
          locked: draggingComponent.component.locked,
        });
      }
      pendingDraftRoutePoint = null;
      draggingRoutePoint = null;
      draggingComponent = null;
      orbitDrag = null;
      releasePointerCapture(pointerId);
      renderer.domElement.dataset.pointerCaptureActive = 'false';
      restoreCameraControls(reason);
    };

    const constrainComponentPlacement = (component: GeneratedHvacComponent, point: PipePoint) => {
      const result = constrainPlacementPoint({
        model,
        point,
        component,
        floor: component.floor ?? component.businessMetadata?.floor,
        outsidePlacementMarginM,
      });
      writePlacementCandidateDataset(renderer.domElement, point, result);
      return result;
    };

    const setHoveredComponent = (
      object: THREE.Object3D | null,
      component: GeneratedHvacComponent | null
    ) => {
      if (hoveredObject === object && hoveredComponent === component) return;
      if (hoveredObject && hoveredComponent) {
        applyComponentObjectMaterialState(hoveredObject, hoveredComponent, {
          selected: hoveredComponent.id === selectedIdRef.current,
          locked: hoveredComponent.locked,
        });
      }
      hoveredObject = object;
      hoveredComponent = component;
      if (hoveredObject && hoveredComponent) {
        applyComponentObjectMaterialState(hoveredObject, hoveredComponent, {
          selected: hoveredComponent.id === selectedIdRef.current,
          hovered: hoveredComponent.id !== selectedIdRef.current,
          locked: hoveredComponent.locked,
        });
      }
    };

    const routeDraftPlane = () =>
      placementPlaneForElevation(
        placementElevationFrom({
          floor: routeDraftFloorRef.current,
          elevation: routeDraftElevationRef.current,
          floorHeight,
          fallbackElevation: 0.95,
        })
      );

    const routeSnapCandidate = (
      point: PipePoint,
      endpointKey: 'from' | 'to',
      component?: GeneratedHvacComponent
    ) =>
      findRouteEndpointSnapCandidate({
        model,
        point,
        systemKey: component?.systemKey ?? routeDraftSystemKeyRef.current,
        routeType: (component?.type === 'duct-route' ? 'duct-route' : routeDraftTypeRef.current) as
          'pipe-route' | 'duct-route',
        endpointKey,
      });

    const writeRouteSnapDataset = (
      endpointKey: 'from' | 'to',
      candidate: RouteEndpointSnapCandidate | null
    ) => {
      renderer.domElement.dataset.routeSnapEndpoint = endpointKey;
      renderer.domElement.dataset.routeSnapStatus = candidate ? candidate.status : 'none';
      renderer.domElement.dataset.routeSnapAttachmentKind = candidate?.attachmentKind ?? 'none';
      renderer.domElement.dataset.routeSnapEquipmentId = candidate?.equipmentId ?? '';
      renderer.domElement.dataset.routeSnapAttachmentId = candidate?.attachmentId ?? '';
      renderer.domElement.dataset.routeSnapDistanceM =
        candidate?.distanceM === undefined ? '' : String(candidate.distanceM);
    };

    const routeDraftPointAtPointer = (
      endpointKey: 'from' | 'to'
    ): { point: PipePoint; endpointRef: RouteEndpointSnapCandidate | null } | null => {
      const point = pointOnPipePlane(raycaster, routeDraftPlane());
      if (!point) return null;
      const candidate = routeSnapCandidate(point, endpointKey);
      writeRouteSnapDataset(endpointKey, candidate);
      return { point: candidate?.point ?? point, endpointRef: candidate };
    };

    const updateRouteDraft = (
      point: PipePoint,
      endpointKey: 'from' | 'to',
      endpointRef: RouteEndpointSnapCandidate | null
    ) => {
      const nextPoints = appendOrthogonalRouteDraftPoint(draftRoutePointsRef.current, point);
      const endpointRefs = routeEndpointRefsWithCandidate(
        draftRouteEndpointRefsRef.current,
        endpointKey,
        endpointRef
      );
      draftRoutePointsRef.current = nextPoints;
      draftRouteEndpointRefsRef.current = endpointRefs;
      updateDraftLine(nextPoints);
      onPipeDraftChangeRef.current?.(nextPoints);
      onPipeDraftEndpointRefsChangeRef.current?.(endpointRefs);
      renderer.domElement.dataset.routeDraftPointCount = String(nextPoints.length);
      renderer.domElement.dataset.routeDraftLastPoint = `${point.x},${point.y},${point.z}`;
    };

    const constrainTemplatePlacement = (transfer: string, point: PipePoint) => {
      const dropData = parseTemplateDropData(transfer);
      const templateId = parseTemplateDropId(transfer);
      const template = componentTemplates.find((item) => item.id === templateId);
      const defaultOverrides = template ? (templateDefaultOverrides[template.id] ?? {}) : {};
      const floor = dropData.floor ?? defaultOverrides.floor;
      const result = constrainPlacementPoint({
        model,
        point,
        template,
        defaultOverrides,
        floor,
        outsidePlacementMarginM,
      });
      writePlacementCandidateDataset(renderer.domElement, point, result);
      return result.point;
    };

    const saveCameraState = () => {
      cameraStateRef.current = {
        position: camera.position.clone(),
        target: cameraTarget.clone(),
      };
      renderer.domElement.dataset.cameraPosition = [
        camera.position.x.toFixed(2),
        camera.position.y.toFixed(2),
        camera.position.z.toFixed(2),
      ].join(',');
      writeEndpointDataset(renderer.domElement, selectedPipePoints, camera);
      writeRouteEditDataset(renderer.domElement, selectedPipePoints, camera);
      writeComponentAnchorDataset(
        renderer.domElement,
        model.components.filter(
          (component) => isVisible(component, visibility) && isFloorVisible(component, floorView)
        ),
        camera,
        -routeDraftPlane().constant
      );
      writeRiserMarkerDataset(renderer.domElement, model, floorView, camera);
    };

    const orbitCamera = (deltaX: number, deltaY: number) => {
      const offset = camera.position.clone().sub(cameraTarget);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= deltaX * 0.006;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - deltaY * 0.006, 0.18, Math.PI - 0.18);
      camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
      renderer.domElement.dataset.orbitEvents = String(
        Number(renderer.domElement.dataset.orbitEvents ?? 0) + 1
      );
      saveCameraState();
    };

    const panCamera = (deltaX: number, deltaY: number) => {
      const offset = camera.position.clone().sub(cameraTarget);
      const distance = Math.max(4, offset.length());
      const panScale = distance * 0.0015;
      const forward = cameraTarget.clone().sub(camera.position).normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();
      const move = right
        .multiplyScalar(-deltaX * panScale)
        .add(up.multiplyScalar(deltaY * panScale));
      camera.position.add(move);
      cameraTarget.add(move);
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
      renderer.domElement.dataset.panEvents = String(
        Number(renderer.domElement.dataset.panEvents ?? 0) + 1
      );
      saveCameraState();
    };

    const fitGeneratedView = () => {
      const target = fitCamera(camera, root);
      cameraTarget.copy(target);
      cameraStateRef.current = {
        position: camera.position.clone(),
        target: target.clone(),
      };
      renderer.domElement.dataset.fitViewEvents = String(
        Number(renderer.domElement.dataset.fitViewEvents ?? 0) + 1
      );
      saveCameraState();
    };

    const selectAtPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const selected = nearestSelectableComponent(raycaster.intersectObjects(selectable, true));
      if (!selected) {
        onClearSelectionRef.current?.();
        return;
      }
      if (editModeRef.current === 'delete') {
        if (selected.locked) return;
        onDeleteRef.current?.(selected);
        return;
      }
      onSelectRef.current(selected);
    };

    const updateDraftLine = (points: PipePoint[]) => {
      if (!draftLine) {
        draftLine = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ color: 0xfacc15 })
        );
        helperRoot.add(draftLine);
      }
      draftLine.geometry.dispose();
      draftLine.geometry = new THREE.BufferGeometry().setFromPoints(
        points.map((point) => new THREE.Vector3(point.x, point.y, point.z))
      );
    };

    const clearDraftLine = () => {
      if (!draftLine) return;
      helperRoot.remove(draftLine);
      draftLine.geometry.dispose();
      (draftLine.material as THREE.Material).dispose();
      draftLine = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      capturePointer(event);
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      if (event.button === 0 && editModeRef.current === 'delete') {
        const routeHandle = findRouteEditHandle(
          raycaster.intersectObjects(handles, true)[0]?.object
        );
        if (routeHandle?.kind === 'point') {
          const nextPoints = deleteIntermediateRoutePoint(
            pipePoints(routeHandle.component),
            routeHandle.pointIndex
          );
          clearPointerInteraction('delete-route-point', event.pointerId);
          if (nextPoints && !routeHandle.component.locked) {
            onPipeUpdateRef.current?.(routeHandle.component, nextPoints);
          }
          return;
        }
      }

      if (
        event.button === 1 ||
        event.button === 2 ||
        (event.button === 0 &&
          (event.shiftKey || editModeRef.current === 'select' || editModeRef.current === 'delete'))
      ) {
        setInteractionState('orbiting-camera');
        orbitDrag = {
          button: event.button,
          mode: event.button === 1 || (event.button === 0 && event.shiftKey) ? 'pan' : 'orbit',
          lastX: event.clientX,
          lastY: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        return;
      }

      if (event.button === 0 && editModeRef.current === 'draw-pipe') {
        setInteractionState('dragging-component');
        const endpointKey = draftRoutePointsRef.current.length === 0 ? 'from' : 'to';
        const snapped = routeDraftPointAtPointer(endpointKey);
        if (!snapped) {
          clearPointerInteraction('draw-pipe-no-plane-hit', event.pointerId);
          return;
        }
        pendingDraftRoutePoint = {
          point: snapped.point,
          endpointKey,
          endpointRef: snapped.endpointRef,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        updateDraftLine(
          appendOrthogonalRouteDraftPoint(draftRoutePointsRef.current, snapped.point)
        );
        return;
      }

      if (event.button === 0 && editModeRef.current === 'add-riser') {
        setInteractionState('dragging-component');
        const point = pointOnPipePlane(raycaster, routeDraftPlane());
        clearPointerInteraction(
          point ? 'add-riser-point' : 'add-riser-no-plane-hit',
          event.pointerId
        );
        if (point) {
          renderer.domElement.dataset.lastRiserPoint = `${point.x},${point.y},${point.z}`;
          onRiserPointRef.current?.(point);
        }
        return;
      }

      if (event.button === 0 && editModeRef.current === 'move-component') {
        const hits = raycaster.intersectObjects(selectable, true);
        const selected = nearestSelectableComponent(hits);
        const object = nearestSelectableRoot(hits) as THREE.Object3D | null;
        if (selected && object) {
          onSelectRef.current(selected);
          if (selected.locked) {
            clearPointerInteraction('locked-component', event.pointerId);
            return;
          }
          setInteractionState('dragging-component');
          const anchor = componentPlacementAnchor(selected);
          const plane = placementPlaneForComponent(selected, floorHeight);
          const pointerOnPlane = pointOnPipePlane(raycaster, plane);
          if (!pointerOnPlane) {
            clearPointerInteraction('move-component-no-plane-hit', event.pointerId);
            return;
          }
          draggingComponent = {
            component: selected,
            object,
            plane,
            pointerOffset: placementPointerOffset(anchor, pointerOnPlane),
            lastAnchor: anchor,
          };
          return;
        }
      }

      if (event.button === 0 && editModeRef.current === 'edit-pipe') {
        const handleHit = raycaster.intersectObjects(handles, true)[0];
        const handle = findRouteEditHandle(handleHit?.object);
        if (handle?.kind === 'point') {
          if (handle.component.locked) {
            clearPointerInteraction('locked-route-point', event.pointerId);
            return;
          }
          setInteractionState('dragging-component');
          draggingRoutePoint = {
            component: handle.component,
            pointIndex: handle.pointIndex,
            points: pipePoints(handle.component),
            endpointRefs: normalizeRouteEndpointRefs(handle.component.route?.endpointRefs),
          };
          return;
        }
        if (handle?.kind === 'segment') {
          if (handle.component.locked) {
            clearPointerInteraction('locked-route-segment', event.pointerId);
            return;
          }
          const inserted = insertRoutePointOnSegment(
            pipePoints(handle.component),
            handle.insertAfterIndex,
            handle.point
          );
          const pointIndex = Math.min(handle.insertAfterIndex + 1, inserted.length - 1);
          setInteractionState('dragging-component');
          draggingRoutePoint = {
            component: handle.component,
            pointIndex,
            points: inserted,
            endpointRefs: normalizeRouteEndpointRefs(handle.component.route?.endpointRefs),
          };
          updateDraftLine(inserted);
          onPipeDraftChangeRef.current?.(inserted);
          renderer.domElement.dataset.routeInsertedPointIndex = String(pointIndex);
          return;
        }
        const point = pointOnPipePlane(
          raycaster,
          placementPlaneForElevation(selectedPipePoints[0]?.y ?? 0.95)
        );
        if (point && selectedPipeComponent && selectedPipePoints.length >= 2) {
          if (selectedPipeComponent.locked) {
            clearPointerInteraction('locked-route', event.pointerId);
            return;
          }
          const insertion = nearestRouteSegmentInsertion(selectedPipePoints, point);
          if (!insertion) {
            clearPointerInteraction('route-segment-insert-miss', event.pointerId);
            return;
          }
          const inserted = insertRoutePointOnSegment(
            selectedPipePoints,
            insertion.insertAfterIndex,
            insertion.point
          );
          const pointIndex = Math.min(insertion.insertAfterIndex + 1, inserted.length - 1);
          draggingRoutePoint = {
            component: selectedPipeComponent,
            pointIndex,
            points: inserted,
            endpointRefs: normalizeRouteEndpointRefs(selectedPipeComponent.route?.endpointRefs),
          };
          updateDraftLine(inserted);
          onPipeDraftChangeRef.current?.(inserted);
          renderer.domElement.dataset.routeInsertedPointIndex = String(pointIndex);
          setInteractionState('dragging-component');
          return;
        }
        setInteractionState('orbiting-camera');
        orbitDrag = {
          button: event.button,
          mode: 'orbit',
          lastX: event.clientX,
          lastY: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        return;
      }

      selectAtPointer(event);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (orbitDrag) {
        setHoveredComponent(null, null);
        const deltaX = event.clientX - orbitDrag.lastX;
        const deltaY = event.clientY - orbitDrag.lastY;
        const totalMove = Math.hypot(
          event.clientX - orbitDrag.startX,
          event.clientY - orbitDrag.startY
        );
        orbitDrag.moved = orbitDrag.moved || totalMove > 3;
        orbitDrag.lastX = event.clientX;
        orbitDrag.lastY = event.clientY;
        if (orbitDrag.moved) {
          if (orbitDrag.mode === 'pan') panCamera(deltaX, deltaY);
          else orbitCamera(deltaX, deltaY);
        }
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      if (pendingDraftRoutePoint) {
        setHoveredComponent(null, null);
        const totalMove = Math.hypot(
          event.clientX - pendingDraftRoutePoint.startX,
          event.clientY - pendingDraftRoutePoint.startY
        );
        pendingDraftRoutePoint.moved = pendingDraftRoutePoint.moved || totalMove > 3;
        const point = pointOnPipePlane(raycaster, routeDraftPlane());
        if (!point) return;
        const candidate = routeSnapCandidate(point, pendingDraftRoutePoint.endpointKey);
        writeRouteSnapDataset(pendingDraftRoutePoint.endpointKey, candidate);
        pendingDraftRoutePoint.point = candidate?.point ?? point;
        pendingDraftRoutePoint.endpointRef = candidate;
        updateDraftLine(
          appendOrthogonalRouteDraftPoint(draftRoutePointsRef.current, pendingDraftRoutePoint.point)
        );
        return;
      }

      if (draggingRoutePoint) {
        setHoveredComponent(null, null);
        const point = pointOnPipePlane(
          raycaster,
          placementPlaneForElevation(
            draggingRoutePoint.points[draggingRoutePoint.pointIndex]?.y ?? 0.95
          )
        );
        if (!point) return;
        const endpointKey =
          draggingRoutePoint.pointIndex === 0
            ? 'from'
            : draggingRoutePoint.pointIndex === draggingRoutePoint.points.length - 1
              ? 'to'
              : null;
        const candidate = endpointKey
          ? routeSnapCandidate(point, endpointKey, draggingRoutePoint.component)
          : null;
        if (endpointKey) {
          writeRouteSnapDataset(endpointKey, candidate);
          draggingRoutePoint.endpointRefs = routeEndpointRefsWithCandidate(
            draggingRoutePoint.endpointRefs,
            endpointKey,
            candidate
          );
        }
        const nextPoints = moveRoutePoint(
          draggingRoutePoint.points,
          draggingRoutePoint.pointIndex,
          candidate?.point ?? point
        );
        draggingRoutePoint.points = nextPoints;
        draggingRoutePoint.pointIndex = Math.min(
          draggingRoutePoint.pointIndex,
          nextPoints.length - 1
        );
        updateDraftLine(nextPoints);
        onPipeDraftChangeRef.current?.(nextPoints);
        return;
      }

      if (draggingComponent) {
        setHoveredComponent(null, null);
        const point = pointOnPipePlane(raycaster, draggingComponent.plane);
        if (!point) return;
        const result = constrainComponentPlacement(
          draggingComponent.component,
          applyPlacementPointerOffset(point, draggingComponent.pointerOffset)
        );
        const anchor = result.point;
        draggingComponent.object.position.set(anchor.x, anchor.y, anchor.z);
        draggingComponent.lastAnchor = anchor;
        applyComponentObjectMaterialState(draggingComponent.object, draggingComponent.component, {
          selected: true,
          locked: draggingComponent.component.locked,
          invalidPlacement: !result.valid,
        });
        return;
      }

      const hits = raycaster.intersectObjects(selectable, true);
      setHoveredComponent(
        nearestSelectableRoot(hits) as THREE.Object3D | null,
        nearestSelectableComponent(hits)
      );
    };

    const onPointerUp = (event: PointerEvent) => {
      releasePointerCapture(event.pointerId);
      if (orbitDrag) {
        const wasClick = !orbitDrag.moved && orbitDrag.button === 0;
        orbitDrag = null;
        if (wasClick) selectAtPointer(event);
        restoreCameraControls('pointerup-orbit');
        return;
      }
      if (pendingDraftRoutePoint) {
        const point = pendingDraftRoutePoint.point;
        const endpointKey = pendingDraftRoutePoint.endpointKey;
        const endpointRef = pendingDraftRoutePoint.endpointRef;
        const moved = pendingDraftRoutePoint.moved;
        pendingDraftRoutePoint = null;
        if (!moved) {
          updateRouteDraft(point, endpointKey, endpointRef);
        } else if (draftRoutePointsRef.current.length) {
          updateDraftLine(draftRoutePointsRef.current);
        } else {
          clearDraftLine();
        }
        restoreCameraControls('pointerup-draw-pipe');
        return;
      }
      if (draggingRoutePoint) {
        const linePoints = draftLinePoints(draftLine);
        const dragged = draggingRoutePoint;
        const points = linePoints.length >= 2 ? linePoints : dragged.points;
        clearDraftLine();
        draggingRoutePoint = null;
        if (points.length >= 2 && routeHasRenderableSegment(points)) {
          onPipeUpdateRef.current?.(dragged.component, points, dragged.endpointRefs);
        }
        restoreCameraControls('pointerup-edit-pipe');
        return;
      }
      if (draggingComponent) {
        const moved = draggingComponent;
        draggingComponent = null;
        const point = moved.lastAnchor;
        if (point) onComponentMoveRef.current?.(moved.component, point);
      }
      restoreCameraControls('pointerup');
    };

    const onPointerCancel = (event: PointerEvent) => {
      clearPointerInteraction('pointercancel', event.pointerId);
    };

    const onPointerLeave = () => {
      setHoveredComponent(null, null);
    };
    const onDragEnd = () => clearPointerInteraction('dragend');
    const onViewportBlur = () => clearPointerInteraction('viewport-blur');
    const onDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      fitGeneratedView();
      restoreCameraControls('fit-view');
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (interactionState === 'dragging-component' || interactionState === 'editing-property')
        return;
      const offset = camera.position.clone().sub(cameraTarget);
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * (event.deltaY > 0 ? 1.12 : 0.88),
        4,
        80
      );
      camera.position.copy(cameraTarget).add(offset.normalize().multiplyScalar(nextDistance));
      camera.lookAt(cameraTarget);
      camera.updateProjectionMatrix();
      saveCameraState();
      const zoomEvents = Number(renderer.domElement.dataset.zoomEvents ?? 0) + 1;
      renderer.domElement.dataset.zoomEvents = String(zoomEvents);
      renderer.domElement.dataset.cameraDistance = nextDistance.toFixed(2);
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('application/x-rysnova-component-template')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const transfer =
        event.dataTransfer.getData('application/x-rysnova-component-template') ||
        event.dataTransfer.getData('text/plain');
      const dropData = parseTemplateDropData(transfer);
      const dropElevation = placementElevationFrom({
        floor: dropData.floor,
        elevation: dropData.elevation,
        installHeight: dropData.installHeight,
        floorHeight,
        fallbackElevation: 0,
      });
      const point = pointOnPipePlane(
        raycaster,
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -dropElevation)
      );
      if (point) constrainTemplatePlacement(transfer, point);
    };
    const onDrop = (event: DragEvent) => {
      const transfer = event.dataTransfer?.getData('application/x-rysnova-component-template');
      if (!transfer) return;
      event.preventDefault();
      clearPointerInteraction('drop');
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const dropData = parseTemplateDropData(transfer);
      const dropElevation = placementElevationFrom({
        floor: dropData.floor,
        elevation: dropData.elevation,
        installHeight: dropData.installHeight,
        floorHeight,
        fallbackElevation: 0,
      });
      const point = pointOnPipePlane(
        raycaster,
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -dropElevation)
      );
      if (point) {
        const constrainedPoint = constrainTemplatePlacement(transfer, point);
        renderer.domElement.dataset.lastTemplateDrop = transfer;
        renderer.domElement.dataset.lastDropPoint = `${constrainedPoint.x},${constrainedPoint.y},${constrainedPoint.z}`;
        onTemplateDropRef.current?.(transfer, constrainedPoint);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('dragover', onDragOver);
    renderer.domElement.addEventListener('drop', onDrop);
    renderer.domElement.addEventListener('dragend', onDragEnd);
    renderer.domElement.addEventListener('blur', onViewportBlur);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);
    mount.addEventListener('wheel', onWheel, { passive: false });

    if (editModeRef.current === 'draw-pipe' && draftRoutePointsRef.current.length > 0) {
      updateDraftLine(draftRoutePointsRef.current);
      renderer.domElement.dataset.routeDraftPointCount = String(draftRoutePointsRef.current.length);
    }

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nextWidth = mount.clientWidth || width;
      const nextHeight = mount.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('dragover', onDragOver);
      renderer.domElement.removeEventListener('drop', onDrop);
      renderer.domElement.removeEventListener('dragend', onDragEnd);
      renderer.domElement.removeEventListener('blur', onViewportBlur);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      mount.removeEventListener('wheel', onWheel);
      clearPointerInteraction('cleanup-selection-or-remount');
      disposeObject(root);
      disposeObject(helperRoot);
      renderer.dispose();
      if (renderer.domElement.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, [
    componentTemplates,
    draftRoutePoints,
    editMode,
    floorHeight,
    floorViewMode,
    activeFloor,
    model,
    outsidePlacementMarginM,
    routeDraftElevation,
    routeDraftFloor,
    selectedId,
    templateDefaultOverrides,
    visibility,
  ]);

  return (
    <div className="relative h-full min-h-[480px] w-full">
      <div
        ref={mountRef}
        className="h-full min-h-[480px] w-full"
        data-generated-hvac-viewport={model.id}
        data-generated-hvac-edit-mode={editMode}
        data-generated-hvac-floor-view-mode={floorViewMode}
        data-generated-hvac-active-floor={activeFloor}
        data-generated-hvac-component-count={model.components.length}
        data-generated-hvac-route-count={
          model.components.filter((component) => isRouteComponent(component)).length
        }
        data-generated-hvac-component-ids={model.components
          .map((component) => component.id)
          .join(',')}
        data-generated-hvac-route-geometry-summary={JSON.stringify(
          model.components
            .filter((component) => isRouteComponent(component))
            .map((component) => {
              const points = pipePoints(component);
              const acceptedLengthM = roundCoord(routeLengthFromPoints(points));
              return {
                id: component.id,
                points,
                floors: component.route?.floors ?? [],
                crossFloorTransitions: component.route?.crossFloorTransitions ?? [],
                routeSummary: component.route?.summary ?? null,
                acceptedLengthM,
                bomQuantity: num(component.bomMetadata?.quantity, acceptedLengthM),
                endpointRefs: normalizeRouteEndpointRefs(component.route?.endpointRefs),
                routeConnectionStatus: routeConnectionStatusForSummary(component),
              };
            })
        )}
        data-generated-hvac-route-visual-summary={JSON.stringify(
          model.components
            .filter((component) => isRouteComponent(component))
            .map((component) => ({
              id: component.id,
              selected: component.id === selectedId,
              locked: component.locked,
              type: component.type,
              systemKey: component.systemKey,
              metrics: routeRenderMetrics(component),
            }))
        )}
        data-generated-hvac-floor-route-summary={JSON.stringify(
          model.components
            .filter((component) => isRouteComponent(component))
            .map((component) => {
              const floorView: RouteFloorView = {
                mode: floorViewMode,
                floor: activeFloor,
                floorHeight,
              };
              return {
                id: component.id,
                floorViewMode,
                activeFloor,
                visible: isFloorVisible(component, floorView),
                visiblePointCount: routeVisiblePointRefs(component, floorView).length,
                visibleSegmentCount: routeVisibleSegmentRefs(component, floorView).length,
                riserMarkers: routeRiserMarkers(component, floorView).map((marker) => ({
                  direction: marker.direction,
                  floor: marker.floor,
                  otherFloor: marker.otherFloor,
                  point: marker.point,
                })),
              };
            })
        )}
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-700">
        {editModeHint(editMode)}
      </div>
    </div>
  );
}

function renderComponent(
  component: GeneratedHvacComponent,
  selected: boolean,
  floorView: RouteFloorView
): THREE.Object3D | null {
  const geometry = component.geometry || {};
  const systemColor =
    GENERATED_SYSTEM_COLORS[component.systemKey] || GENERATED_SYSTEM_COLORS.envelope;
  const materialSpec = generatedComponentMaterialSpec(component);
  const visualState = { selected, locked: component.locked };

  if (geometry.kind === 'box') {
    const width = num(geometry.width, 1);
    const height = num(geometry.height, 1);
    const depth = num(geometry.depth, 1);
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      componentMaterial(materialSpec, visualState, component.type === 'building-outline')
    );
    markBusinessSelectable(group, component);
    markBusinessSelectable(mesh, component);
    group.add(mesh);
    addComponentModelDetails(group, component, { width, height, depth, materialSpec, visualState });
    addComponentStateTreatment(group, component, { width, height, depth }, visualState);
    group.position.set(num(geometry.x, 0), num(geometry.y, 0), num(geometry.z, 0));
    const rotation = component.rotation ?? {};
    group.rotation.set(
      THREE.MathUtils.degToRad(num(rotation.x, 0)),
      THREE.MathUtils.degToRad(num(rotation.y, 0)),
      THREE.MathUtils.degToRad(num(rotation.z, 0))
    );
    return group;
  }

  if (geometry.kind === 'polyline' && Array.isArray(geometry.points)) {
    return renderSavedRouteComponentForView(component, selected, systemColor, floorView);
  }

  return null;
}

function componentMaterial(
  spec: ViewerMaterialSpec,
  state: ViewerComponentVisualState,
  wireframe = false
) {
  const treatment = componentStateTreatment(state);
  const material = new THREE.MeshStandardMaterial({
    color: spec.color,
    transparent: spec.transparent,
    opacity: spec.opacity,
    roughness: spec.roughness,
    metalness: spec.metalness,
    wireframe,
    emissive: new THREE.Color(treatment.emissiveColor),
    emissiveIntensity: treatment.emissiveIntensity,
  });
  material.userData.generatedBaseMaterial = true;
  material.userData.baseColor = spec.color;
  material.userData.baseOpacity = spec.opacity;
  material.userData.baseTransparent = spec.transparent;
  material.userData.materialRole = spec.role;
  return material;
}

function applyComponentObjectMaterialState(
  object: THREE.Object3D,
  component: GeneratedHvacComponent,
  state: ViewerComponentVisualState
) {
  const treatment = componentStateTreatment(state);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const materials = mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : [];
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.userData.generatedBaseMaterial || !standard.emissive) continue;
      standard.emissive.setHex(treatment.emissiveColor);
      standard.emissiveIntensity = treatment.emissiveIntensity;
      standard.needsUpdate = true;
    }
  });
  object.userData.invalidPlacement = state.invalidPlacement === true;
  object.userData.hovered = state.hovered === true;
  object.userData.selectedVisual = state.selected === true;
  object.userData.lockedVisual = state.locked ?? component.locked;
}

function addComponentModelDetails(
  group: THREE.Group,
  component: GeneratedHvacComponent,
  size: {
    width: number;
    height: number;
    depth: number;
    materialSpec: ViewerMaterialSpec;
    visualState: ViewerComponentVisualState;
  }
) {
  if (component.type === 'equipment') {
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(size.width * 0.52, size.height * 0.08, size.depth * 1.04),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, opacity: 0.86, transparent: true })
    );
    grille.position.set(0, size.height * 0.18, size.depth * 0.04);
    markSelectionHelper(grille, 'equipment-detail');
    group.add(grille);
    const servicePanel = new THREE.Mesh(
      new THREE.BoxGeometry(size.width * 0.12, size.height * 0.7, size.depth * 1.08),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, opacity: 0.75, transparent: true })
    );
    servicePanel.position.set(size.width * 0.36, 0, 0);
    markSelectionHelper(servicePanel, 'equipment-detail');
    group.add(servicePanel);
    return;
  }

  if (component.type === 'door' || component.type === 'window') {
    const frameMaterial = componentMaterial(frameMaterialSpec(component), size.visualState);
    const horizontal = new THREE.BoxGeometry(
      size.width * 1.08,
      Math.max(size.height * 0.06, 0.04),
      size.depth * 1.12
    );
    const vertical = new THREE.BoxGeometry(
      Math.max(size.width * 0.06, 0.04),
      size.height * 1.08,
      size.depth * 1.12
    );
    const top = new THREE.Mesh(horizontal, frameMaterial);
    top.position.set(0, size.height * 0.42, 0);
    const bottom = new THREE.Mesh(horizontal, frameMaterial.clone());
    bottom.position.set(0, -size.height * 0.42, 0);
    const left = new THREE.Mesh(vertical, frameMaterial.clone());
    left.position.set(-size.width * 0.42, 0, 0);
    const right = new THREE.Mesh(vertical, frameMaterial.clone());
    right.position.set(size.width * 0.42, 0, 0);
    markSelectionHelper(top, 'opening-frame');
    markSelectionHelper(bottom, 'opening-frame');
    markSelectionHelper(left, 'opening-frame');
    markSelectionHelper(right, 'opening-frame');
    group.add(top, bottom, left, right);
    if (component.type === 'door') {
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(size.width * 0.035, 0.025), 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.38, metalness: 0.18 })
      );
      handle.position.set(size.width * 0.28, 0, size.depth * 0.62);
      markSelectionHelper(handle, 'door-panel-handle');
      group.add(handle);
    } else {
      const mullionMaterial = componentMaterial(
        {
          ...frameMaterialSpec(component),
          color: VIEWER_SEMANTIC_MATERIAL_TOKENS.windowFrame,
          opacity: 0.98,
        },
        size.visualState
      );
      const mullion = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(size.width * 0.035, 0.035),
          size.height * 0.86,
          size.depth * 1.18
        ),
        mullionMaterial
      );
      const transom = new THREE.Mesh(
        new THREE.BoxGeometry(
          size.width * 0.86,
          Math.max(size.height * 0.035, 0.035),
          size.depth * 1.18
        ),
        mullionMaterial.clone()
      );
      markSelectionHelper(mullion, 'window-frame-mullion');
      markSelectionHelper(transom, 'window-frame-transom');
      group.add(mullion, transom);
    }
    return;
  }

  if (component.type === 'room-zone') {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size.width, size.height, size.depth)),
      new THREE.LineBasicMaterial({ color: 0x475569 })
    );
    markSelectionHelper(outline, 'room-zone-outline');
    group.add(outline);
    return;
  }

  if (component.type === 'wall') {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(
        size.width * 1.02,
        Math.max(size.height * 0.03, 0.04),
        size.depth * 1.1
      ),
      new THREE.MeshStandardMaterial({ color: 0x111827, opacity: 0.24, transparent: true })
    );
    cap.position.set(0, size.height * 0.5, 0);
    markSelectionHelper(cap, 'wall-cap-helper');
    group.add(cap);
  }
}

function addComponentStateTreatment(
  group: THREE.Group,
  component: GeneratedHvacComponent,
  size: { width: number; height: number; depth: number },
  state: ViewerComponentVisualState
) {
  const treatment = componentStateTreatment(state);
  if (!treatment.accentColor) return;
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        size.width * treatment.outlineScale,
        size.height * treatment.outlineScale,
        size.depth * treatment.outlineScale
      )
    ),
    new THREE.LineBasicMaterial({ color: treatment.accentColor })
  );
  outline.userData.componentStateTreatment = state.invalidPlacement
    ? 'invalid-placement'
    : state.selected
      ? 'selected'
      : state.hovered
        ? 'hover'
        : component.locked
          ? 'locked'
          : 'none';
  markSelectionHelper(outline, 'component-state-outline');
  group.add(outline);

  if (state.selected || state.invalidPlacement) {
    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(size.width * 1.07, size.height * 1.07, size.depth * 1.07),
      new THREE.MeshBasicMaterial({
        color: treatment.accentColor,
        transparent: true,
        opacity: treatment.haloOpacity,
        depthWrite: false,
      })
    );
    halo.userData.componentStateTreatment = state.invalidPlacement
      ? 'invalid-placement'
      : 'selected';
    markSelectionHelper(halo, 'component-state-halo');
    group.add(halo);
  }

  if (component.locked) {
    const lockBand = new THREE.Mesh(
      new THREE.BoxGeometry(
        size.width * 1.04,
        Math.max(size.height * 0.035, 0.035),
        size.depth * 1.16
      ),
      new THREE.MeshStandardMaterial({
        color: VIEWER_STATE_ACCENT_TOKENS.locked,
        transparent: true,
        opacity: 0.72,
        roughness: 0.6,
      })
    );
    lockBand.position.set(0, size.height * 0.52, 0);
    markSelectionHelper(lockBand, 'component-locked-band');
    group.add(lockBand);
  }
}

function isVisible(component: GeneratedHvacComponent, visibility: GeneratedVisibility) {
  if (component.visibility === 'hidden') return false;
  if (component.systemKey === 'cooling' && !visibility.cooling) return false;
  if (component.systemKey === 'heating' && !visibility.heating) return false;
  if (component.systemKey === 'freshAir' && !visibility.freshAir) return false;
  if (isRouteComponent(component) && !visibility.pipes) return false;
  if (component.type === 'equipment' && !visibility.equipment) return false;
  return true;
}

function isFloorVisible(component: GeneratedHvacComponent, floorView: RouteFloorView) {
  if (floorView.mode !== 'single-floor') return true;
  if (isRouteComponent(component)) return routeHasFloorVisibility(component, floorView);
  return componentFloor(component) === floorView.floor;
}

function componentFloor(component: GeneratedHvacComponent): number {
  return Math.max(
    1,
    Math.round(
      num(
        component.floor ??
          component.businessMetadata?.floor ??
          component.businessMetadata?.floorIndex,
        1
      )
    )
  );
}

function fitCamera(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return new THREE.Vector3(0, 0, 0);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 12;
  const dist = maxDim * 1.35;
  camera.position.set(center.x + dist, center.y + dist * 0.8, center.z + dist);
  camera.lookAt(center);
  camera.near = 0.1;
  camera.far = maxDim * 20;
  camera.updateProjectionMatrix();
  return center;
}

function findComponent(object?: THREE.Object3D): GeneratedHvacComponent | null {
  return selectableComponentFromObject(object);
}

function findSelectableRoot(object?: THREE.Object3D): THREE.Object3D | null {
  return selectableRootFromObject(object);
}

function findRouteEditHandle(object?: THREE.Object3D):
  | { kind: 'point'; component: GeneratedHvacComponent; pointIndex: number }
  | {
      kind: 'segment';
      component: GeneratedHvacComponent;
      insertAfterIndex: number;
      point: PipePoint;
    }
  | null {
  let current = object;
  while (current) {
    if (current.userData.routePointIndex !== undefined && current.userData.component) {
      return {
        kind: 'point',
        component: current.userData.component as GeneratedHvacComponent,
        pointIndex: Number(current.userData.routePointIndex),
      };
    }
    if (current.userData.routeInsertAfterIndex !== undefined && current.userData.component) {
      return {
        kind: 'segment',
        component: current.userData.component as GeneratedHvacComponent,
        insertAfterIndex: Number(current.userData.routeInsertAfterIndex),
        point: current.userData.routeInsertPoint as PipePoint,
      };
    }
    current = current.parent || undefined;
  }
  return null;
}

function addRoutePointHandle(
  root: THREE.Object3D,
  component: GeneratedHvacComponent,
  pointIndex: number,
  point: PipePoint
) {
  const points = pipePoints(component);
  const endpoint = pointIndex === 0 || pointIndex === points.length - 1;
  const endpointRef = endpoint
    ? normalizeRouteEndpointRefs(component.route?.endpointRefs)[pointIndex === 0 ? 'from' : 'to']
    : undefined;
  const endpointColor =
    endpointRef?.status === 'stale'
      ? 0xef4444
      : endpointRef?.status === 'connected'
        ? 0x22c55e
        : endpoint
          ? 0xfacc15
          : 0x38bdf8;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(endpoint ? 0.32 : 0.26, 18, 18),
    new THREE.MeshStandardMaterial({
      color: endpointColor,
      emissive: new THREE.Color(endpoint ? endpointColor : 0x052f3f),
    })
  );
  mesh.position.set(point.x, point.y, point.z);
  markSelectionHelper(mesh, endpoint ? 'route-endpoint-handle' : 'route-bend-point-handle');
  mesh.userData.component = component;
  mesh.userData.routePointIndex = pointIndex;
  if (endpointRef) mesh.userData.routeEndpointConnectionStatus = endpointRef.status;
  root.add(mesh);
  return mesh;
}

function addRouteSegmentHandle(
  root: THREE.Object3D,
  component: GeneratedHvacComponent,
  insertAfterIndex: number,
  start: PipePoint,
  end: PipePoint
) {
  const point = closestSegmentMidpoint(start, end);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 14, 14),
    new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: new THREE.Color(0x221442),
      transparent: true,
      opacity: 0.9,
    })
  );
  mesh.position.set(point.x, point.y, point.z);
  markSelectionHelper(mesh, 'route-segment-insert-handle');
  mesh.userData.component = component;
  mesh.userData.routeInsertAfterIndex = insertAfterIndex;
  mesh.userData.routeInsertPoint = point;
  root.add(mesh);
  return mesh;
}

function closestSegmentMidpoint(start: PipePoint, end: PipePoint): PipePoint {
  return {
    x: roundCoord((start.x + end.x) / 2),
    y: start.y,
    z: roundCoord((start.z + end.z) / 2),
  };
}

function nearestRouteSegmentInsertion(
  points: PipePoint[],
  point: PipePoint
): { insertAfterIndex: number; point: PipePoint } | null {
  let best: { insertAfterIndex: number; point: PipePoint; distance: number } | null = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 0.000001) continue;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSq)
    );
    const projected = {
      x: roundCoord(start.x + dx * t),
      y: start.y,
      z: roundCoord(start.z + dz * t),
    };
    const candidateDistance = Math.hypot(point.x - projected.x, point.z - projected.z);
    if (!best || candidateDistance < best.distance) {
      best = { insertAfterIndex: index, point: projected, distance: candidateDistance };
    }
  }
  return best ? { insertAfterIndex: best.insertAfterIndex, point: best.point } : null;
}

function pointOnPipePlane(raycaster: THREE.Raycaster, plane: THREE.Plane): PipePoint | null {
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return { x: roundCoord(hit.x), y: roundCoord(hit.y), z: roundCoord(hit.z) };
}

function placementPlaneForElevation(elevation: number): THREE.Plane {
  return new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation);
}

function placementPlaneForComponent(
  component: GeneratedHvacComponent,
  floorHeight: number
): THREE.Plane {
  const anchor = componentPlacementAnchor(component);
  return placementPlaneForElevation(
    placementElevationFrom({
      floor: component.floor ?? component.businessMetadata?.floor,
      elevation: component.elevation ?? component.businessMetadata?.elevation,
      installHeight: component.installHeight ?? component.businessMetadata?.installHeight,
      floorHeight,
      fallbackElevation: anchor.y,
    })
  );
}

function pipePoints(component: GeneratedHvacComponent): PipePoint[] {
  const points = Array.isArray(component.geometry?.points) ? component.geometry.points : [];
  return points.map((point: any) => ({
    x: num(point.x, 0),
    y: num(point.y, 0.95),
    z: num(point.z, 0),
  }));
}

function isRouteComponent(component: GeneratedHvacComponent): boolean {
  return component.type === 'pipe-route' || component.type === 'duct-route';
}

function routeConnectionStatusForSummary(component: GeneratedHvacComponent): string {
  const refs = normalizeRouteEndpointRefs(component.route?.endpointRefs);
  if (refs.from?.status === 'stale' || refs.to?.status === 'stale') return 'stale';
  if (refs.from?.status === 'connected' || refs.to?.status === 'connected') return 'connected';
  return 'none';
}

function draftLinePoints(line: THREE.Line | null): PipePoint[] {
  const positions = line?.geometry.getAttribute('position');
  if (!positions) return [];
  const points: PipePoint[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    points.push({
      x: roundCoord(positions.getX(index)),
      y: roundCoord(positions.getY(index)),
      z: roundCoord(positions.getZ(index)),
    });
  }
  return points;
}

function writeEndpointDataset(
  canvas: HTMLCanvasElement,
  points: PipePoint[],
  camera: THREE.PerspectiveCamera
) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    delete canvas.dataset.selectedStartX;
    delete canvas.dataset.selectedStartY;
    delete canvas.dataset.selectedEndX;
    delete canvas.dataset.selectedEndY;
    return;
  }
  const start = projectPoint(first, camera, canvas);
  const end = projectPoint(last, camera, canvas);
  canvas.dataset.selectedStartX = start.x.toFixed(1);
  canvas.dataset.selectedStartY = start.y.toFixed(1);
  canvas.dataset.selectedEndX = end.x.toFixed(1);
  canvas.dataset.selectedEndY = end.y.toFixed(1);
}

function writeRouteEditDataset(
  canvas: HTMLCanvasElement,
  points: PipePoint[],
  camera: THREE.PerspectiveCamera
) {
  if (points.length < 2) {
    delete canvas.dataset.selectedRoutePoints2d;
    delete canvas.dataset.selectedRouteSegmentMidpoints2d;
    return;
  }
  canvas.dataset.selectedRoutePoints2d = JSON.stringify(
    points.map((point, index) => ({
      index,
      ...projectPoint(point, camera, canvas),
    }))
  );
  canvas.dataset.selectedRouteSegmentMidpoints2d = JSON.stringify(
    points.slice(0, -1).map((point, index) => ({
      insertAfterIndex: index,
      ...projectPoint(closestSegmentMidpoint(point, points[index + 1]), camera, canvas),
    }))
  );
}

function writeComponentAnchorDataset(
  canvas: HTMLCanvasElement,
  components: GeneratedHvacComponent[],
  camera: THREE.PerspectiveCamera,
  routeDraftElevation: number
) {
  canvas.dataset.componentAnchors2d = JSON.stringify(
    components.map((component) => {
      const anchor = componentPlacementAnchor(component);
      return {
        id: component.id,
        type: component.type,
        floor: componentFloor(component),
        anchor,
        screen: projectPoint(anchor, camera, canvas),
        routeDraftScreen: projectPoint({ ...anchor, y: routeDraftElevation }, camera, canvas),
      };
    })
  );
}

function writeRiserMarkerDataset(
  canvas: HTMLCanvasElement,
  model: GeneratedHvacModel,
  floorView: RouteFloorView,
  camera: THREE.PerspectiveCamera
) {
  const markers = model.components
    .filter((component) => isRouteComponent(component))
    .flatMap((component) =>
      routeRiserMarkers(component, floorView).map((marker) => ({
        routeId: component.id,
        direction: marker.direction,
        floor: marker.floor,
        otherFloor: marker.otherFloor,
        point: marker.point,
        screen: projectPoint(
          riserMarkerVisualPoint(marker.point, marker.direction),
          camera,
          canvas
        ),
      }))
    );
  canvas.dataset.riserMarkers2d = JSON.stringify(markers);
}

function riserMarkerVisualPoint(point: PipePoint, direction: 'riser-up' | 'riser-down'): PipePoint {
  return {
    ...point,
    y: point.y + (direction === 'riser-up' ? 0.75 : -0.75),
  };
}

function writePlacementCandidateDataset(
  canvas: HTMLCanvasElement,
  rawPoint: PipePoint,
  result: PlacementConstraintResult
) {
  writePlacementConstraintDataset(canvas, result);
  canvas.dataset.placementCandidate = result.valid ? 'valid' : 'invalid';
  canvas.dataset.lastRawPlacementPoint = `${rawPoint.x},${rawPoint.y},${rawPoint.z}`;
  canvas.dataset.lastConstrainedPlacementPoint = `${result.point.x},${result.point.y},${result.point.z}`;
}

function writePlacementConstraintDataset(
  canvas: HTMLCanvasElement,
  result: PlacementConstraintResult
) {
  canvas.dataset.placementConstraintState = result.state;
  canvas.dataset.placementInstallClass = result.installClass;
  canvas.dataset.placementOutsideMarginM = String(result.marginM);
  canvas.dataset.placementBounds = [
    result.bounds.minX,
    result.bounds.maxX,
    result.bounds.minZ,
    result.bounds.maxZ,
  ].join(',');
}

function projectPoint(
  point: PipePoint,
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement
) {
  const projected = new THREE.Vector3(point.x, point.y, point.z).project(camera);
  return {
    x: ((projected.x + 1) / 2) * canvas.clientWidth,
    y: ((-projected.y + 1) / 2) * canvas.clientHeight,
  };
}

function distance(a: PipePoint, b: PipePoint) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function routeLengthFromPoints(points: PipePoint[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function routeHasRenderableSegment(points: PipePoint[]) {
  for (let index = 1; index < points.length; index += 1) {
    if (distance(points[index - 1], points[index]) > 0.001) return true;
  }
  return false;
}

function roundCoord(value: number) {
  return Math.round(value * 100) / 100;
}

function editModeHint(mode: PipeEditMode) {
  if (mode === 'place-component') return '放置构件：从左侧拖拽构件到视口';
  if (mode === 'move-component') return '移动构件：拖拽已选构件，松开后保存位置';
  if (mode === 'draw-pipe') return '画管：按住地面拖拽，松开后新增管线';
  if (mode === 'edit-pipe') return '拖端点：先选中管线，再拖黄色端点';
  if (mode === 'add-riser') return 'Add riser: pick a plan position, then confirm target floor';
  if (mode === 'delete') return '删除：点击构件后直接删除';
  return '选择：点击构件查看信息，滚轮缩放';
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function num(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
