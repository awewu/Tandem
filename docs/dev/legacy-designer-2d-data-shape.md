# Legacy Designer 2D Data Shape

Issue 13 uses `apps/consumer-diagnosis/public/designer.html` as the 2D source of truth. It does not depend on `4003/floor-plan`.

## Source State

The legacy designer persists and exports a project object under local storage key `rh-design-current` and through `exportJSON()`:

```ts
type LegacyDesignerProject = {
  name: string;
  walls: Array<{ id: string; points: number[] }>;
  devices: Array<{ id: string; type: string; x: number; y: number; rotation?: number }>;
  pipes: Array<{ id: string; type: string; points: number[] }>;
  doors: Array<{ id: string; x: number; y: number; rotation?: number }>;
  windows: Array<{ id: string; x: number; y: number; rotation?: number }>;
  texts: Array<{ id: string; x: number; y: number; text: string; size?: number }>;
};
```

## Units

- `GRID = 50`, so 50 canvas pixels equal 1 meter.
- Wall and pipe `points` are flat `[x1, y1, x2, y2, ...]` arrays in canvas pixels.
- Device, door, window and text `x/y` are canvas pixels.
- The 3D conversion maps legacy `x` to 3D `x` meters and legacy `y` to 3D `z` meters.
- Default wall height is 3 m and default wall thickness is 0.24 m.
- Default door opening is 0.9 m x 2.1 m. Default window opening is 1.5 m x 1.2 m at 0.9 m sill elevation.

## Conversion Contract

The conversion writes the existing viewer `generatedModel` component instance contract:

- walls -> `type: "wall"`, `systemKey: "envelope"`, box geometry with length, thickness, height, position and rotation.
- doors/windows -> `type: "door" | "window"`, `systemKey: "envelope"`, opening metadata and optional nearest host-wall metadata.
- texts -> `type: "room-zone"`, `systemKey: "zone"`, room/zone boxes with area metadata.
- devices -> `type: "equipment"`, HVAC system key inferred from legacy device catalog id/name.
- pipes -> `type: "pipe-route" | "duct-route"`, polyline geometry and BOM length metadata.

Converted components are persisted through `viewer_design_drafts.generated_model`, the same PostgreSQL-backed draft storage used by manual 3D component CRUD.
