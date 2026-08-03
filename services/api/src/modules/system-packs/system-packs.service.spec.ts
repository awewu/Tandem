import { SystemPacksService } from './system-packs.service';

describe('SystemPacksService', () => {
  let svc: SystemPacksService;

  beforeEach(() => {
    svc = new SystemPacksService();
  });

  it('lists all packs by default', () => {
    const packs = svc.list();
    expect(packs.length).toBe(4);
  });

  it('filters by category', () => {
    const packs = svc.list({ category: 'hot_water' });
    expect(packs.length).toBe(1);
    expect(packs[0].id).toBe('rheem-central-hot-water');
  });

  it('filters by role', () => {
    const anchors = svc.list({ role: 'anchor' });
    expect(anchors.length).toBe(3);
    expect(anchors.every((p) => p.plugAndPlayRole === 'anchor')).toBe(true);
  });

  it('getPack returns pack by id', () => {
    const pack = svc.getPack('rheem-heating');
    expect(pack).not.toBeNull();
    expect(pack!.name).toContain('采暖');
  });

  it('getPack returns null for unknown id', () => {
    expect(svc.getPack('nonexistent')).toBeNull();
  });

  it('compose merges modules from selected packs', () => {
    const result = svc.compose({ selectedPackIds: ['rheem-central-hot-water', 'rheem-heating'] });
    expect(result.packs.length).toBe(3); // 2 selected + smart-control auto-added
    expect(result.modules).toContain('hotWaterLoad');
    expect(result.modules).toContain('heatingLoad');
    expect(result.modules).toContain('deviceBinding'); // from smart-control
  });

  it('compose auto-includes smart-control', () => {
    const result = svc.compose({ selectedPackIds: ['rheem-heating'] });
    const ids = result.packs.map((p) => p.id);
    expect(ids).toContain('rheem-smart-control');
  });

  it('compose uses recommendation when no packIds given', () => {
    const result = svc.compose({ context: { area: 200, houseType: 'villa' } });
    expect(result.packs.length).toBeGreaterThan(0);
  });

  it('recommend suggests hot-water for large area with multiple bathrooms', () => {
    const result = svc.recommend({ area: 150, bathrooms: 2 });
    const ids = result.packs.map((p) => p.id);
    expect(ids).toContain('rheem-central-hot-water');
  });

  it('recommend suggests heating for cold climate', () => {
    const result = svc.recommend({ cityClimate: 'cold' });
    const ids = result.packs.map((p) => p.id);
    expect(ids).toContain('rheem-heating');
  });

  it('recommend suggests whole-air for villa', () => {
    const result = svc.recommend({ houseType: 'villa', area: 200 });
    const ids = result.packs.map((p) => p.id);
    expect(ids).toContain('rheem-whole-air');
  });

  it('recommend falls back to central-hot-water when no match', () => {
    const result = svc.recommend({});
    expect(result.packs.length).toBe(1);
    expect(result.packs[0].id).toBe('rheem-central-hot-water');
  });

  it('compose produces standards evidence with hierarchy', () => {
    const result = svc.compose({ selectedPackIds: ['rheem-central-hot-water'] });
    expect(result.standardsEvidence.hierarchy).toHaveLength(3);
    expect(result.standardsEvidence.hierarchy[0].level).toBe('L1');
    expect(result.standardsEvidence.mandatoryBlockers).toContain('GB 55020');
  });

  it('compose produces implementation notes', () => {
    const result = svc.compose({ selectedPackIds: ['rheem-central-hot-water', 'rheem-heating'] });
    expect(result.implementationNotes.length).toBeGreaterThan(1);
    expect(result.implementationNotes.some((n) => n.includes('热水'))).toBe(true);
    expect(result.implementationNotes.some((n) => n.includes('采暖'))).toBe(true);
  });

  it('compose produces iot capabilities with lifecycle bridge', () => {
    const result = svc.compose({ selectedPackIds: ['rheem-heating'] });
    expect(result.iot.handoverRequired).toBe(true);
    expect(result.iot.lifecycleBridge).toBe('/api/v2/lifecycle/handover');
    expect(result.iot.capabilities.length).toBeGreaterThan(0);
  });
});
