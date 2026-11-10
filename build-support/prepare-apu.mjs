// Flatten only the official JSNES audio modules, without changing their logic.
import fs from 'node:fs';
process.chdir(import.meta.dirname);
const order=['utils','channel-dm','channel-noise','channel-square','channel-triangle','index'];
const parts=order.map(name=>fs.readFileSync('../src/jsnes-apu/'+name+'.js','utf8')
 .replace(/^import .*;\r?\n/gm,'').replace(/^export default \w+;\r?\n?/gm,'').replace(/^export /gm,''));
fs.writeFileSync('../src/apu-jsnes.js','// JSNES 2.1.0 audio core, Apache-2.0. See LICENSE-JSNES.txt.\n// Source commit b8a45d088e922b6abcd87c4eb1b7237919e9d3d2.\nvar JSNESPAPU=(function(){\n'+parts.join('\n')+'\nreturn PAPU;\n})();\n');
