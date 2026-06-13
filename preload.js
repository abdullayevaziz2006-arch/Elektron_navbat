const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  quitApp: () => ipcRenderer.send('quit-app'),
  openRole: (role) => ipcRenderer.send('open-role', role),
  silentPrint: () => ipcRenderer.invoke('silent-print'),
  getPrinters: () => ipcRenderer.invoke('get-printers')
});
