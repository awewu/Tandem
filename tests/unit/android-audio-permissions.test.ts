import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const audioPermissions = [
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.RECORD_AUDIO',
];

describe('Android audio permissions', () => {
  it.each([
    ['Tandem Android app', 'android/app/src/main/AndroidManifest.xml'],
    ['Shouchao Android app', 'android-shouchao/app/src/main/AndroidManifest.xml'],
  ])('%s declares all permissions requested by Capacitor WebView audio capture', (_name, manifestPath) => {
    const manifest = readFileSync(manifestPath, 'utf8');

    for (const permission of audioPermissions) {
      expect(manifest).toContain(`android:name="${permission}"`);
    }
  });
});
