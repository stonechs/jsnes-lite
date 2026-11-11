import fs from 'node:fs';
import path from 'node:path';
import { Packer } from './packaging/roadroller-standalone.mjs';

const release = path.resolve(import.meta.dirname, '../dist/v011-mapper30');
const searchDir = path.join(release, 'search');
fs.mkdirSync(searchDir, { recursive: true });
const header = fs.readFileSync(path.join(release, 'source/ui.html'), 'utf8').trim();
const input = 'document.open();document.write(' + JSON.stringify(header) +
  ');document.close();\n' + fs.readFileSync(path.join(release, 'build/closure.min.js'), 'utf8');
const clean = options => Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'resourcePool'));
const seedFile = path.resolve(import.meta.dirname, '../dist/v010-extreme-runtime/search/winner.json');
const seed = clean(JSON.parse(fs.readFileSync(seedFile, 'utf8')).options);
const history = [];
const candidates = [];
let globalBest = Infinity;

async function run(tag, options, seconds = 120) {
  let best = {}, score = Infinity, evaluations = 0;
  const started = Date.now();
  const packer = new Packer([{ data: input, type: 'js', action: 'eval' }], options);
  try {
    await packer.optimize(2, info => {
      evaluations++;
      if (info.bestUpdated) {
        best = { ...info.best };
        score = info.bestSize;
        const candidate = { tag, score, options: clean({ ...options, ...best }) };
        candidates.push(candidate);
        if (score < globalBest) {
          globalBest = score;
          fs.writeFileSync(path.join(searchDir, 'best-score.json'), JSON.stringify(candidate, null, 2));
          console.log(JSON.stringify({ tag, evaluations, score, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
        }
      }
      if (Date.now() - started > seconds * 1000) return false;
    });
  } catch (error) {
    if (error.message !== 'search aborted') throw error;
  }
  history.push({ tag, evaluations, score, elapsedMs: Date.now() - started });
  fs.writeFileSync(path.join(searchDir, 'history.json'), JSON.stringify(history, null, 2));
  fs.writeFileSync(path.join(searchDir, 'candidates.json'), JSON.stringify(candidates.sort((a, b) => a.score - b.score), null, 2));
  console.log(JSON.stringify({ completed: tag, evaluations, score }));
}

await run('v010-seed-warm', seed);
const bestAfterWarm = candidates.reduce((a, b) => a.score <= b.score ? a : b);
await run('v011-seed-refine', bestAfterWarm.options);
// A separate default-model seed explores a different Roadroller parameter basin.
await run('default-model', {});
const best = candidates.reduce((a, b) => a.score <= b.score ? a : b);
console.log(JSON.stringify({ done: true, bestScore: best.score, searches: history.length,
  evaluations: history.reduce((sum, result) => sum + result.evaluations, 0) }));
