import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const release = path.join(root, 'dist/v017-2-centered-controls');
const ui = fs.readFileSync(path.join(release, 'source/ui.html'), 'utf8');
if (!ui.includes('.dpad,.actions{position:absolute;top:40%;left:50%;transform:translateX(-50%)}')) throw new Error('Landscape controls are not centered');
if (!ui.includes('.dpad,.actions,.system,.tools,.right .side-note{position:static;transform:none}')) throw new Error('Portrait controls should remain centered in normal flow');

if (!ui.includes('grid-template-columns:minmax(0,1fr) 107dvh minmax(0,1fr)')) throw new Error('Equal side columns missing');
if (!ui.includes('canvas{place-self:start center;width:100%;max-height:100dvh}')) throw new Error('Canvas must fill the center column');
for (const [width,height] of [[844,390],[667,375],[568,320]]) { const canvas=height*1.07; const side=(width-canvas-4)/2; if(side<0) throw new Error('Grid columns exceed viewport at '+width+'x'+height); }
const vectors = JSON.parse(fs.readFileSync(path.join(release, 'build/tests/lzma1-vectors.json'), 'utf8')).cases;
const element = { addEventListener() {}, setAttribute() {}, requestFullscreen() {}, style: {}, dataset: {}, files: [] };
const document = { open() {}, write() {}, close() {}, querySelector() { return element; }, getElementById() { return element; }, querySelectorAll() { return []; }, addEventListener() {}, fullscreenElement: null };
const packed = { document, Uint8Array, DataView, ArrayBuffer, Math, Error, Set, Map, Promise, Number, String, Array, Object, RegExp, parseInt, console };
packed.window = packed;
packed.globalThis = packed;
packed.addEventListener = () => {};
vm.createContext(packed);
vm.runInContext(fs.readFileSync(path.join(release, 'jsnes-lite.min.js'), 'utf8'), packed, { timeout: 20000 });
const sourceContext = { window: {}, Uint8Array, DataView, ArrayBuffer, Math, Error, Number, Array, Map, Set };
vm.createContext(sourceContext);
vm.runInContext(fs.readFileSync(path.join(release, 'source/archive.js'), 'utf8'), sourceContext);
let streamChecks = 0;
for (const vector of vectors) {
  const expected = Buffer.from(vector.expected, 'base64');
  const actual = Buffer.from(sourceContext.decodeLzma(Uint8Array.from(Buffer.from(vector.packed, 'base64')), Uint8Array.from(Buffer.from(vector.properties, 'base64')), expected.length));
  if (!actual.equals(expected)) throw new Error(`Integrated source mismatch: ${vector.name}, lc=${vector.lc}, lp=${vector.lp}, pb=${vector.pb}`);
  streamChecks++;
}
const archiveBytes = Uint8Array.from(fs.readFileSync(path.join(release, 'build/tests/synthetic-lzma1.7z')));
const expectedArchive = Buffer.alloc(16 + 16384);
expectedArchive.set([0x4e, 0x45, 0x53, 0x1a, 1, 0]);
for (let i = 16; i < expectedArchive.length; i++) expectedArchive[i] = (((i - 16) * 17 + 3) & 255);
const archiveOutput = Buffer.from(sourceContext.readSevenZip(archiveBytes));
if (!archiveOutput.equals(expectedArchive)) throw new Error('Synthetic LZMA1 .7z output mismatch');
const lzma2Vectors = JSON.parse(fs.readFileSync(path.join(release, 'build/tests/lzma2-vectors.json'), 'utf8')).cases;
for (const vector of lzma2Vectors) {
  const bytes = Uint8Array.from(fs.readFileSync(path.join(release, 'build/tests', vector.file)));
  const output = Buffer.from(sourceContext.readSevenZip(bytes));
  const hash = crypto.createHash('sha256').update(output).digest('hex');
  if (output.length !== vector.expectedBytes || hash !== vector.sha256) throw new Error(`Synthetic LZMA2 .7z mismatch: ${vector.file}`);
  vector.actualBytes = output.length;
  vector.exact = true;
}
const result = { standalone: 'V017-2 Base122 + Roadroller O2 loaded', layout: 'center matches canvas; side columns share remaining width', controlLayout: 'directional pad and A/B centered in side columns', portraitLayout: 'unchanged', lzma1StreamVectors: streamChecks, syntheticLzma1ArchiveBytes: archiveBytes.length, syntheticLzma1OutputBytes: archiveOutput.length, syntheticLzma2Archives: lzma2Vectors, exact: true };
fs.writeFileSync(path.join(release, 'build/tests/test-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
