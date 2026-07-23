const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ({ version: '2.0.0', mode: 'desktop' })
});
