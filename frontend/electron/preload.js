const { contextBridge, ipcRenderer } = require('electron');

// Window control API
contextBridge.exposeInMainWorld('electronWindow', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  fullscreen: () => ipcRenderer.invoke('window-fullscreen'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  isFullscreen: () => ipcRenderer.invoke('window-is-fullscreen'),
});

// App API
contextBridge.exposeInMainWorld('electronApp', {
  quit: () => ipcRenderer.invoke('app-quit'),
  getVersion: () => ipcRenderer.invoke('app-version'),
  platform: process.platform,
});

// Notifications API
contextBridge.exposeInMainWorld('electronNotify', {
  show: (title, body, icon) => ipcRenderer.invoke('show-notification', title, body, icon),
});

// Update API
contextBridge.exposeInMainWorld('electronUpdater', {
  onUpdateMessage: (callback) => ipcRenderer.on('update-message', (event, message) => callback(message)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, progress) => callback(progress)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, error) => callback(error)),
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('update-message');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  }
});

// Protocol handler (deep links)
contextBridge.exposeInMainWorld('electronProtocol', {
  onProtocolUrl: (callback) => ipcRenderer.on('protocol-url', (event, url) => callback(url)),
  removeProtocolListener: () => ipcRenderer.removeAllListeners('protocol-url'),
});

// Utility API
contextBridge.exposeInMainWorld('electronUtils', {
  isElectron: true,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  }
});
