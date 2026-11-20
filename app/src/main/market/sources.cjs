"use strict";

module.exports = {
  registerIpc,
  get pawchiveService() {
    return pawchiveService;
  },
  get kemonoService() {
    return kemonoService;
  }
};
const electron = require("electron");
const {
  registerPawchiveIpc
} = require("./pawchive.cjs");
const {
  registerRevivalIpc
} = require("./mega/task-manager.cjs");
const {
  registerSoftwareUpdates
} = require("../runtime/software-updates.cjs");
const {
  registerHotkeyTranslation
} = require("../overlay/hotkey-translation.cjs");
const marketSettings = require("./settings.cjs");
let pawchiveService;
let kemonoService;
function registerIpc() {
  registerHotkeyTranslation({
    ipcMain: electron.ipcMain,
    fetch: (...args) => electron.net.fetch(...args)
  });
  pawchiveService = registerPawchiveIpc({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    powerMonitor: electron.powerMonitor,
    userData: electron.app.getPath("userData"),
    fetch: (...args) => electron.net.fetch(...args)
  });
  kemonoService = registerPawchiveIpc({
    source: 'kemono',
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    powerMonitor: electron.powerMonitor,
    userData: electron.app.getPath("userData"),
    fetch: (...args) => electron.net.fetch(...args)
  });
  registerRevivalIpc({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    shell: electron.shell,
    userData: electron.app.getPath("userData"),
    getCacheDir: marketSettings.ensureMarketDownloadCacheDir
  });
  registerSoftwareUpdates({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    powerMonitor: electron.powerMonitor,
    shell: electron.shell,
    userData: electron.app.getPath("userData"),
    fetch: (...args) => electron.net.fetch(...args)
  });
}
