const fs = require('node:fs');
const path = require('node:path');

function verifyDownstream(directory, name) {
  const read = file => fs.readFileSync(path.join(directory, file), 'utf8');
  const modules = path.join(directory, '.gitmodules');
  if (fs.existsSync(modules)) {
    for (const [, url] of read('.gitmodules').matchAll(/^\s*url\s*=\s*(\S+)/gm)) {
      if (!/^https:\/\/github\.com\/QAQ-Revival\/[\w.-]+\.git$/.test(url)) throw Error(`${name} introduces an unmanaged submodule; create and review its organization fork first`);
    }
  }
  if (name === 'UnityPy' && /AudioClipConverter/.test(read('UnityPy/export/__init__.py'))) throw Error('UnityPy audio exclusion needs review after the upstream merge');
}
module.exports = { verifyDownstream };
