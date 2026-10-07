// ProRider — ponte da tela da TV com o atualizador (07/10a). Coloque no preload do Electron
// (ou faça require dele no preload que já existe). Com contextIsolation ligado:
const { contextBridge, ipcRenderer } = require('electron');
const api = {
  estado: () => ipcRenderer.invoke('pr-atu-estado'),
  instalar: m => ipcRenderer.invoke('pr-atu-instalar', m),
  confirmar: build => ipcRenderer.invoke('pr-atu-confirmar', build)
};
try { contextBridge.exposeInMainWorld('prAtualizador', api); }
catch (e) { window.prAtualizador = api; }   // contextIsolation desligado
