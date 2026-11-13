import fs from 'node:fs';
import path from 'node:path';

process.chdir(import.meta.dirname);
const root=path.resolve('../../..');
const release=path.join(root,'dist/v013-mobile-touch-controls');
const source=path.join(root,'dist/v012-oam-address-reset/source');
const interfacePatch=path.resolve('interface');
if(fs.existsSync(path.join(release,'RELEASED.json')))throw new Error('V013 is finalized');
for(const dir of ['source','search','licenses'])fs.mkdirSync(path.join(release,dir),{recursive:true});
for(const name of fs.readdirSync(source).filter(n=>/\.(js|html)$/.test(n)))
  fs.copyFileSync(path.join(source,name),path.join(release,'source',name));
for(const name of ['ui.html','ui.js'])
  fs.copyFileSync(path.join(interfacePatch,name),path.join(release,'source',name));
fs.copyFileSync(path.join(root,'dist/v012-oam-address-reset/search/winner.json'),path.join(release,'search/winner.json'));
for(const name of ['LICENSE-JSNES.txt','THIRD_PARTY_NOTICES.md'])
  fs.copyFileSync(path.join(root,'build-support',name),path.join(release,'licenses',name));
console.log(JSON.stringify({release,source:'V012 snapshot plus V013 touch UI',sourceFiles:fs.readdirSync(path.join(release,'source')).length,roadrollerParameters:'reused from V011'}));
