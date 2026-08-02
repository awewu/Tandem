const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LEGACY_PUBLIC = path.join(ROOT, 'archive', 'legacy-ui', 'public');

function readPublic(file) {
  return fs.readFileSync(path.join(LEGACY_PUBLIC, file), 'utf8');
}

describe('marketing portal visual surface contract', () => {
  test.each(['index.html', 'index-ready.html', 'privacy.html', 'consent.html'])(
    '%s remains an available marketing portal surface',
    (file) => {
      const html = readPublic(file);
      expect(html).toContain('<html');
      expect(html).not.toContain('/rysnova-bim-designer.html');
      expect(html).not.toContain('/designer.html');
    }
  );

  test('browser visual acceptance covers the active marketing portal pages', () => {
    const script = fs.readFileSync(
      path.join(ROOT, 'scripts', 'agent-guards', 'browser-visual-acceptance.js'),
      'utf8'
    );

    expect(script).toContain("path: '/index.html'");
    expect(script).toContain("path: '/index-ready.html'");
    expect(script).not.toContain('designer-workbench');
    expect(script).not.toContain('runViewerAcceptance');
  });
});
