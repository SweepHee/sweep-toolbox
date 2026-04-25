const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Conversion
  convertFile: (request) => ipcRenderer.invoke('convert-file', request),
  getSupportedFormats: () => ipcRenderer.invoke('get-supported-formats'),

  // History
  loadHistory: () => ipcRenderer.invoke('load-history'),
  appendHistory: (entry) => ipcRenderer.invoke('append-history', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onHistoryUpdated: (cb) => ipcRenderer.on('history-updated', cb),

  // File system
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  saveAs: (args) => ipcRenderer.invoke('save-as', args),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Platform info
  platform: process.platform,
});
