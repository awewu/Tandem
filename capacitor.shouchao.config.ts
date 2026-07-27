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
  'http://10.0.2.2:3005/shouchao';
const isHttp = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'local.shouchao.mobile',
  appName: '搭子手抄',
  webDir: 'dist/mobile',
  server: {
    androidScheme: isHttp ? 'http' : 'https',
    url: serverUrl,
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
      resize: 'body',
      resizeOnFullScreen: true,
      style: 'LIGHT',
    },
  },
};

export default config;
