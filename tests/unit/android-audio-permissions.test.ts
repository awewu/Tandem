import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const audioPermissions = [
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.RECORD_AUDIO',
];

const cases = [
  ['Tandem Android app', 'android/app/src/main/AndroidManifest.xml'],
  ['Shouchao Android app', 'android-shouchao/app/src/main/AndroidManifest.xml'],
] as const;

describe('Android audio permissions', () => {
  for (const [name, manifestPath] of cases) {
    const manifestExists = existsSync(manifestPath);
    it.skipIf(!manifestExists)(`${name} declares all permissions requested by Capacitor WebView audio capture`, () => {
      const manifest = readFileSync(manifestPath, 'utf8');

      for (const permission of audioPermissions) {
        expect(manifest).toContain(`android:name="${permission}"`);
      }
    });
  }
});
