// Safe bridge between the page and the main process. The page never sees the API key.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('daylight', {
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
    testKey: (key) => ipcRenderer.invoke('apify:test', key),
    runActor: (timeoutSec, body) => ipcRenderer.invoke('apify:run', timeoutSec, body),
    checkLicense: () => ipcRenderer.invoke('license:check'),
    saveReport: (opts) => ipcRenderer.invoke('report:save', opts),
    openExternal: (url) => ipcRenderer.invoke('open:external', url),
    platform: process.platform,
});
