import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the standalone Shouchao app.
 *
 * This does not replace capacitor.config.ts. Tandem App keeps its existing
 * appId/appName and can still include /shouchao; this config produces the
 * second mobile shell that opens only the Shouchao product surface.
 */
const serverUrl =
  process.env.SHOUCHAO_MOBILE_SERVER_URL ??
  process.env.TANDEM_MOBILE_SERVER_URL ??
  'https://ai.rhautt.com/shouchao';
const isHttp = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'com.rhautt.shouchao',
  appName: '搭子手抄',
  webDir: 'dist/mobile',
  server: {
    androidScheme: isHttp ? 'http' : 'https',
    url: serverUrl,
    allowNavigation: ['ai.rhautt.com', '*.rhautt.com'],
    cleartext: isHttp,
    errorPath: 'offline.html',
  },
  android: {
    path: 'android-shouchao',
    allowMixedContent: isHttp,
    backgroundColor: '#FFFFFF',
  },
  ios: {
    path: 'ios-shouchao',
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
      style: 'LIGHT',
    },
  },
};

export default config;
