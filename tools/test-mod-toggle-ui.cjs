const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
async function run() {
  const output = path.join(root, 'test-results', 'toggle-feedback', String(Date.now()));
  fs.mkdirSync(output, { recursive: true });
  const { build } = await import('vite');
  await build({ configFile: false, root: path.join(root, 'tests/renderer/mod-toggle'), base: './',
    resolve: { alias: { react: path.join(root, 'app/node_modules/react'), 'react-dom': path.join(root, 'app/node_modules/react-dom') } },
    build: { outDir: path.join(output, 'renderer'), target: 'chrome142', emptyOutDir: false, chunkSizeWarningLimit: 1000 }, logLevel: 'warn' });
  const version = require('./release-config.json').electronVersion;
  const executable = path.join(root, `.cache/electron-${version}-win32-x64/electron.exe`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  // This hidden test process loads only our local fixture and mocked IPC. Some
  // Windows test accounts cannot start Chromium's sandbox; production is unchanged.
  const result = spawnSync(executable, [path.join(root, 'tests/renderer/mod-toggle/electron.cjs'), output, '--no-sandbox', '--enable-logging=stderr'],
    { env, windowsHide: true, encoding: 'utf8', timeout: 45000 });
  console.log(result.stdout);
  if (result.error || result.status) throw result.error || Error(`Renderer exited with ${result.status}, signal ${result.signal}: ${result.stderr}`);
  console.log(`Renderer evidence: ${output}`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
