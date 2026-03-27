const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcController', {
  getConfig: () => {
    return {
      serverUrl: process.env.PC_CONTROLLER_SERVER_URL || 'http://localhost:3000',
      pcId: process.env.PC_CONTROLLER_ID || 'pc-1'
    };
  },
  onStatusUpdate: (cb) => {
    ipcRenderer.on('pc-controller-status', (event, data) => cb(data));
  },
  requestPairCode: (serverUrl, pcId) => ipcRenderer.invoke('pc-controller-request-pair', { serverUrl, pcId }),
  requestRegister: (pcId, pairCode) => ipcRenderer.invoke('pc-controller-register', { pcId, pairCode }),
  saveSettings: (serverUrl, pcId) => ipcRenderer.invoke('pc-controller-save-settings', { serverUrl, pcId }),
  sendCommand: (command, payload) => ipcRenderer.invoke('pc-controller-send-command', { command, payload })
});
