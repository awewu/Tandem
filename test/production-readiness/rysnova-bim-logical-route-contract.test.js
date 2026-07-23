const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Rysnova BIM logical route contract', () => {
  test('OpenAPI exposes viewer draft component CRUD and logical route shape', () => {
    const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
    const paths = spec.paths;
    const schemas = spec.components.schemas;

    expect(paths['/api/v2/rysnova-bim/viewer-drafts']).toBeDefined();
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}']).toBeDefined();
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components']).toBeDefined();
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components/{componentId}']).toBeDefined();
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components/{componentId}/riser']).toBeDefined();
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components'].post.requestBody.$ref)
      .toBe('#/components/requestBodies/RysnovaViewerDraftComponentBody');
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components/{componentId}'].put.responses['200'].$ref)
      .toBe('#/components/responses/RysnovaViewerDraftSuccess');
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components/{componentId}/riser'].post.requestBody.$ref)
      .toBe('#/components/requestBodies/RysnovaViewerDraftRiserBody');
    expect(paths['/api/v2/rysnova-bim/viewer-drafts/{id}/components/{componentId}/riser'].post.responses['200'].$ref)
      .toBe('#/components/responses/RysnovaViewerDraftSuccess');

    expect(schemas.RysnovaGeneratedHvacComponentInput.properties.route.anyOf)
      .toEqual(expect.arrayContaining([{ $ref: '#/components/schemas/RysnovaLogicalRouteShapeInput' }, { type: 'null' }]));
    expect(schemas.RysnovaGeneratedHvacComponent.allOf[1].properties.route.anyOf)
      .toEqual(expect.arrayContaining([{ $ref: '#/components/schemas/RysnovaLogicalRouteShape' }, { type: 'null' }]));
    expect(schemas.RysnovaLogicalRouteShape.required).toEqual(expect.arrayContaining([
      'points',
      'floors',
      'crossFloorTransitions',
      'systemKey',
      'routeType',
      'size',
      'visibility',
      'locked',
      'bomMapping',
      'summary',
    ]));
    expect(schemas.RysnovaLogicalRoutePoint3.required).toEqual(['x', 'y', 'z']);
    expect(schemas.RysnovaLogicalRoutePoint3.properties.y.maximum).toBe(200);
    expect(schemas.RysnovaViewerDraftRiserInput.required).toEqual(['targetFloor', 'point']);
    expect(schemas.RysnovaLogicalRouteCrossFloorTransition.properties.sourceFloorId.type).toBe('string');
    expect(schemas.RysnovaLogicalRouteCrossFloorTransition.properties.sourceElevation.maximum).toBe(200);
    expect(schemas.RysnovaLogicalRouteCrossFloorTransition.properties.installHeight.maximum).toBe(50);
    expect(schemas.RysnovaLogicalRouteShape.properties.coordinateSystem.properties.ySemantics.enum)
      .toEqual(['absolute-model-elevation-m']);
  });

  test('service validates route ownership geometry floors and backend-derived length', () => {
    const service = read('services/api/src/modules/rysnova-bim/viewer-draft.service.ts');

    expect(service).toContain('normalizeLogicalRoute');
    expect(service).toContain('route projectId must match viewer draft projectId');
    expect(service).toContain('cross-floor transition must connect different floors');
    expect(service).toContain('route floors are required');
    expect(service).toContain('riser target floor must be different from source floor');
    expect(service).toContain('riser segment must change y between floors');
    expect(service).toContain('floorLevelReviewStatus');
    expect(service).toContain('estimatedLengthM: acceptedLength');
    expect(service).toContain('route.summary.totalLengthM');
  });
});
