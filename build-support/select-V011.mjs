import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

const release = path.resolve(import.meta.dirname, '../dist/v011-mapper30');
const searchDir = path.join(release, 'search');
const ranked = JSON.parse(fs.readFileSync(path.join(searchDir, 'candidates.json'), 'utf8')).slice(0, 10);
const previous = JSON.parse(fs.readFileSync(path.join(searchDir, 'winner.json'), 'utf8'));
const optionsByKey = new Map();
for (const candidate of [...ranked, previous]) optionsByKey.set(JSON.stringify(candidate.options), candidate);
const finalists = [];
const packScript = path.resolve(import.meta.dirname, 'build-V011.mjs');
for (const [index, candidate] of [...optionsByKey.values()].entries()) {
  fs.writeFileSync(path.join(searchDir, 'winner.json'), JSON.stringify(candidate, null, 2));
  const result = cp.spawnSync(process.execPath, [packScript, 'pack'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Pack failed (${result.status})`);
  const bytes = fs.statSync(path.join(release, 'jsnes-lite.min.html')).size;
  const finalist = { tag: candidate.tag, score: candidate.score, bytes, options: candidate.options };
  finalists.push(finalist);
  console.log(JSON.stringify({ candidate: index + 1, tag: finalist.tag, score: finalist.score, bytes }));
}
finalists.sort((a, b) => a.bytes - b.bytes || a.score - b.score);
const winner = { ...finalists[0], selection: 'smallest standalone Base122 HTML bytes among Roadroller finalists' };
fs.writeFileSync(path.join(searchDir, 'finalists.json'), JSON.stringify(finalists, null, 2));
fs.writeFileSync(path.join(searchDir, 'winner.json'), JSON.stringify(winner, null, 2));
const result = cp.spawnSync(process.execPath, [packScript, 'pack'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Final pack failed (${result.status})`);
console.log(JSON.stringify({ done: true, bestBytes: winner.bytes, tag: winner.tag, finalists: finalists.length }));
