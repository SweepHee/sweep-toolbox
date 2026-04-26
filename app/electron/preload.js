const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Conversion ──────────────────────────────────────────────────────────────
  convertFile: (request) => ipcRenderer.invoke('convert-file', request),
  getSupportedFormats: () => ipcRenderer.invoke('get-supported-formats'),

  // ── History ─────────────────────────────────────────────────────────────────
  loadHistory: () => ipcRenderer.invoke('load-history'),
  appendHistory: (entry) => ipcRenderer.invoke('append-history', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onHistoryUpdated: (cb) => ipcRenderer.on('history-updated', cb),

  // ── File system ─────────────────────────────────────────────────────────────
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  saveAs: (args) => ipcRenderer.invoke('save-as', args),

  // ── Window controls ─────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // ── Settings ─────────────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

  // ── Notes ────────────────────────────────────────────────────────────────────
  noteGetAll: () => ipcRenderer.invoke('note-get-all'),
  noteGetData: (noteId) => ipcRenderer.invoke('note-get-data', noteId),
  noteCreate: () => ipcRenderer.invoke('note-create'),
  noteDelete: (noteId) => ipcRenderer.invoke('note-delete', noteId),
  noteUpdate: (noteId, patch) => ipcRenderer.invoke('note-update', noteId, patch),
  noteShow: (noteId) => ipcRenderer.invoke('note-show', noteId),
  noteHide: (noteId) => ipcRenderer.invoke('note-hide', noteId),
  noteSetCollapsed: (noteId, collapsed) => ipcRenderer.invoke('note-set-collapsed', noteId, collapsed),
  noteFocus: (noteId) => ipcRenderer.invoke('note-focus', noteId),
  noteArrange: (type) => ipcRenderer.invoke('note-arrange', type),
  noteResetSize: () => ipcRenderer.invoke('note-reset-size'),
  noteCollapseAll: () => ipcRenderer.invoke('note-collapse-all'),
  noteExpandAll: () => ipcRenderer.invoke('note-expand-all'),
  noteSetAlwaysOnTop: (noteId, value) => ipcRenderer.invoke('note-set-always-on-top', noteId, value),
  noteSetOpacity: (noteId, value) => ipcRenderer.invoke('note-set-opacity', noteId, value),
  notePickImage: () => ipcRenderer.invoke('note-pick-image'),
  showNoteContextMenu: (state) => ipcRenderer.invoke('show-note-context-menu', state),
  onNoteContextMenuAction: (cb) => {
    const handler = (_, action) => cb(action);
    ipcRenderer.on('note-context-menu-action', handler);
    return () => ipcRenderer.removeListener('note-context-menu-action', handler);
  },
  onNotesUpdated: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('notes-updated', handler);
    return () => ipcRenderer.removeListener('notes-updated', handler);
  },
  onNoteUpdated: (cb) => {
    ipcRenderer.on('note-updated', cb);
    return () => ipcRenderer.removeListener('note-updated', cb);
  },

  // ── Platform info ────────────────────────────────────────────────────────────
  platform: process.platform,
});
