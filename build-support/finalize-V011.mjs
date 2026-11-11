import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const release = path.resolve(import.meta.dirname, '../dist/v011-mapper30');
const sizesPath = path.join(release, 'sizes.json');
const markerPath = path.join(release, 'RELEASED.json');
if (fs.existsSync(markerPath)) throw new Error('V011 is already finalized');

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const sizes = JSON.parse(fs.readFileSync(sizesPath, 'utf8'));
if (sizes.version !== 'V011' || sizes.status !== 'unfinalized') throw new Error('Unexpected V011 size manifest state');

const actualFiles = {};
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const relative = path.relative(release, full).replaceAll('\\', '/');
      if (relative === 'sizes.json' || relative === 'RELEASED.json') continue;
      const data = fs.readFileSync(full);
      actualFiles[relative] = { bytes: data.length, sha256: sha256(data) };
    }
  }
}
walk(release);

const expectedFiles = sizes.packageFiles;
const expectedNames = Object.keys(expectedFiles).sort();
const actualNames = Object.keys(actualFiles).sort();
if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) throw new Error('Package file inventory does not match sizes.json');
for (const name of expectedNames) {
  if (JSON.stringify(expectedFiles[name]) !== JSON.stringify(actualFiles[name])) throw new Error(`Package file changed since manifest: ${name}`);
}

sizes.status = 'finalized';
fs.writeFileSync(sizesPath, JSON.stringify(sizes, null, 2) + '\n');
const sizesData = fs.readFileSync(sizesPath);
const files = { ...actualFiles, 'sizes.json': { bytes: sizesData.length, sha256: sha256(sizesData) } };
const standalone = sizes.files['jsnes-lite.min.html'];
const record = {
  version: 'V011',
  date: new Date().toISOString().slice(0, 10),
  status: 'finalized-do-not-overwrite',
  directory: 'dist/v011-mapper30',
  standalone: { file: 'jsnes-lite.min.html', bytes: standalone.bytes, sha256: standalone.sha256 },
  tools: sizes.tools,
  files,
};
fs.writeFileSync(markerPath, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ status: record.status, files: Object.keys(files).length, ...record.standalone }));
