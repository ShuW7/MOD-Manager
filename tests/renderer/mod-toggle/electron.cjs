const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = process.argv[2];
app.setPath('userData', path.join(output, 'user-data'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1200, height: 850,
    webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') } });
  window.webContents.on('console-message', event => {
    if (event.level === 'error') console.error(event.message);
  });
  ipcMain.handle('capture-toggle-test', async (_event, name) => {
    if (!['list-pending.png', 'gallery-pending.png'].includes(name)) throw Error('Invalid capture name');
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(output, name), image.toPNG());
  });
  try {
    await window.loadFile(path.join(output, 'renderer/index.html'));
    const result = await window.webContents.executeJavaScript('window.runToggleFeedbackTest()');
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    app.exit(0);
  } catch (error) {
    console.error(error.stack);
    fs.writeFileSync(path.join(output, 'failure.png'), (await window.webContents.capturePage()).toPNG());
    app.exit(1);
  }
});
