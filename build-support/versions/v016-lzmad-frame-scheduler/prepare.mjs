import fs from 'node:fs';
import path from 'node:path';

const support = import.meta.dirname;
const root = path.resolve(support, '../../..');
const release = path.join(root, 'dist/v016-lzmad-frame-scheduler');
const fast = path.join(root, 'dist/v015-6-lzmad-timer-at-start');
const deadline = path.join(root, 'dist/v015-5-lzmad-landscape-outer-controls');
if (fs.existsSync(path.join(release, 'RELEASED.json'))) throw new Error('V016 is finalized');

function copyTree(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (!filter(entry.name, entry)) continue;
    const src = path.join(from, entry.name), dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst, filter);
    else fs.copyFileSync(src, dst);
  }
}

const source = path.join(release, 'source');
fs.rmSync(source, { recursive: true, force: true });
copyTree(path.join(fast, 'source'), source, name => /\.(js|html)$/.test(name));

// V015-6 differs from V015-5 only in nes.js. Restore that exact timing code,
// while retaining the rest of the V015-6 source snapshot.
fs.copyFileSync(path.join(deadline, 'source/nes.js'), path.join(source, 'nes.js'));
copyTree(path.join(fast, 'tools/roadroller-fast'), path.join(release, 'tools/roadroller-fast'));
fs.mkdirSync(path.join(release, 'search'), { recursive: true });
fs.copyFileSync(path.join(fast, 'search/initial-options.json'), path.join(release, 'search/initial-options.json'));
copyTree(path.join(deadline, 'build/tests'), path.join(release, 'build/tests'));
fs.mkdirSync(path.join(release, 'licenses'), { recursive: true });
for (const name of ['LICENSE-JSNES.txt', 'THIRD_PARTY_NOTICES.md']) {
  const file = path.join(root, 'build-support', name);
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(release, 'licenses', name));
}

// Reuse the already-searched O2 options from the two exact source variants.
// This makes the comparison reproducible without a second parameter search.
const parameterName = 'roadroller.parameters.landscape-outer-controls.json';
for (const [variant, from] of [
  ['baseline', path.join(fast, 'build/roadroller/baseline', parameterName)],
  ['candidate', path.join(deadline, 'build/roadroller/candidate', parameterName)],
]) {
  const toDir = path.join(release, 'build/roadroller', variant);
  fs.mkdirSync(toDir, { recursive: true });
  fs.copyFileSync(from, path.join(toDir, parameterName));
}

console.log(JSON.stringify({
  release,
  basedOn: 'V015-6 with source/nes.js restored byte-for-byte from V015-5',
  restored: 'performance.now deadline scheduling with accumulated frame deadlines and three-frame resync',
}, null, 2));
