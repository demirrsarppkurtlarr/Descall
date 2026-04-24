const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Platform
  platform: process.platform,
  
  // Is electron
  isElectron: true,
  
  // Download
  downloadFile: (url, filename) => ipcRenderer.send('download-file', { url, filename }),
  
  // Listen for events from main
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Log preload loaded
console.log('[Preload] Electron API exposed');
