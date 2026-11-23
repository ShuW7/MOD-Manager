const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('captureToggleTest', name => ipcRenderer.invoke('capture-toggle-test', name));
