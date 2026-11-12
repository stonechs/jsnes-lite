import fs from 'node:fs';
import path from 'node:path';

process.chdir(import.meta.dirname);
const root = path.resolve('../../..');
const release = path.join(root, 'dist/v012-oam-address-reset');
if (fs.existsSync(path.join(release, 'RELEASED.json'))) throw new Error('V012 is finalized');
for (const dir of ['source', 'search', 'licenses']) fs.mkdirSync(path.join(release, dir), { recursive: true });

for (const inputDir of ['src', 'interfaces']) {
  for (const name of fs.readdirSync(path.join(root, inputDir)).filter(n => /\.(js|html)$/.test(n)).sort()) {
    fs.copyFileSync(path.join(root, inputDir, name), path.join(release, 'source', name));
  }
}
for (const name of ['LICENSE-JSNES.txt', 'THIRD_PARTY_NOTICES.md']) {
  fs.copyFileSync(path.join(root, 'build-support', name), path.join(release, 'licenses', name));
}
fs.copyFileSync(path.join(root, 'dist/v011-mapper30/search/winner.json'), path.join(release, 'search/winner.json'));
console.log(JSON.stringify({ release, sourceFiles: fs.readdirSync(path.join(release, 'source')).length, roadrollerParameters: 'reused from V011' }));
