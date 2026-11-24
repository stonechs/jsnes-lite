import fs from 'node:fs';
import path from 'node:path';
const support=import.meta.dirname;
const root=path.resolve(support,'../../..');
const release=path.join(root,'dist/v017-2-centered-controls');
const baseline=path.join(root,'dist/v017-1-canvas-width-columns');
if(fs.existsSync(path.join(release,'RELEASED.json'))) throw new Error('V017-2 is finalized');
function copyTree(from,to){fs.mkdirSync(to,{recursive:true});for(const e of fs.readdirSync(from,{withFileTypes:true})){const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())copyTree(a,b);else fs.copyFileSync(a,b);}}
copyTree(path.join(baseline,'source'),path.join(release,'source'));
fs.copyFileSync(path.join(root,'interfaces/ui.html'),path.join(release,'source/ui.html'));
fs.copyFileSync(path.join(support,'README.md'),path.join(release,'README.md'));
copyTree(path.join(baseline,'tools/roadroller-fast'),path.join(release,'tools/roadroller-fast'));
copyTree(path.join(baseline,'licenses'),path.join(release,'licenses'));
fs.copyFileSync(path.join(baseline,'search/initial-options.json'),path.join(release,'search/initial-options.json'));
copyTree(path.join(baseline,'build/tests'),path.join(release,'build/tests'));
const params=path.join(baseline,'build/roadroller/candidate/roadroller.parameters.landscape-outer-controls.json');
for(const id of ['baseline','candidate']){const out=path.join(release,'build/roadroller',id);fs.mkdirSync(out,{recursive:true});fs.copyFileSync(params,path.join(out,'roadroller.parameters.landscape-outer-controls.json'));}
console.log(JSON.stringify({release,baseline:'V017-1 sources',ui:'root interfaces/ui.html'},null,2));