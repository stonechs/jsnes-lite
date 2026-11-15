import fs from 'node:fs';
import path from 'node:path';

process.chdir(import.meta.dirname);
const root=path.resolve('../../..');
const release=path.join(root,'dist/v014-community-roadroller-o2');
const source=path.join(root,'dist/v013-mobile-touch-controls/source');
if(fs.existsSync(path.join(release,'RELEASED.json')))throw new Error('V014 is finalized');
for(const dir of ['source','search','licenses','tools/roadroller-fast'])fs.mkdirSync(path.join(release,dir),{recursive:true});
for(const name of fs.readdirSync(source).filter(n=>n.endsWith('.js')))
  fs.copyFileSync(path.join(source,name),path.join(release,'source',name));
fs.copyFileSync(path.join(root,'interfaces/ui.html'),path.join(release,'source/ui.html'));
const winner=path.join(release,'search/winner.json');
const seed=fs.existsSync(winner)?winner:path.join(root,'dist/v013-mobile-touch-controls/search/winner.json');
fs.copyFileSync(seed,path.join(release,'search/initial-options.json'));
for(const name of ['LICENSE-JSNES.txt','THIRD_PARTY_NOTICES.md'])
  fs.copyFileSync(path.join(root,'build-support',name),path.join(release,'licenses',name));
const fork='C:/Users/maco/Documents/Codex/2026-11-13/referenced-chatgpt-conversation-this-is-an-3/outputs/html-singlefile-pack/vendor/roadroller-fast';
for(const name of ['index.js','js-token.js','wasm.js','deflate.js','LICENSE.txt','README.md'])
  fs.copyFileSync(path.join(fork,name),path.join(release,'tools/roadroller-fast',name));
console.log(JSON.stringify({release,source:'V013 emulator snapshot plus root UI',roadroller:'da0ka/roadroller at 64614b5fc6c7a97d75315c4d8c9ca407e6f233a3',optimizationLevel:2}));
