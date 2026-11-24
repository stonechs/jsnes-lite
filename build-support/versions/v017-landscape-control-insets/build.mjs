import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { encode, decode, packSixBit, unpackSixBit, scriptLiteral } from '../../packaging/base122.mjs';
import { trimBase122Loader } from '../../packaging/loader-trim.mjs';
const support = import.meta.dirname;
const root = path.resolve(support, '../../..');
process.chdir(support);
const release = path.join(root, 'dist/v017-landscape-control-insets');
const mode = process.argv[2] || 'all';
if (!['all', 'compile', 'pack'].includes(mode)) throw new Error('Use all, compile, or pack');
if (fs.existsSync(path.join(release, 'RELEASED.json'))) throw new Error('V017 is finalized');
if (mode === 'all' || mode === 'compile') cp.execFileSync(process.execPath, [path.join(support, 'prepare.mjs')], { stdio: 'inherit' });
const compiler = path.join(root, 'build-support/tools/closure-20261108.0.0/package/compiler.exe');
const fork = path.join(release, 'tools/roadroller-fast');
const base122Path = path.join(release, 'build/base122');
const closureStaging = path.join(release, 'build/staging');
fs.mkdirSync(base122Path, { recursive: true });
fs.mkdirSync(closureStaging, { recursive: true });
function createPackerClass() {
  const sandbox = { TextDecoder, TextEncoder, performance, WebAssembly, console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  for (const name of ['js-token.js', 'wasm.js', 'deflate.js', 'index.js']) vm.runInContext(fs.readFileSync(path.join(fork, name), 'utf8'), sandbox, { filename: name });
  vm.runInContext('globalThis.FastPacker=Packer', sandbox);
  return sandbox.FastPacker;
}
const order = ['nes', 'rom', 'cpu', 'memory', 'mappers', 'controller', '6502', 'papu', 'ppu'];
const variants = [
  { id: 'baseline', title: 'V016 released layout', source: path.join(root, 'dist/v016-lzmad-frame-scheduler/source'), adapter: false, output: path.join(release, 'build/comparison/v016-released') },
  { id: 'candidate', title: 'V017 32px landscape control insets', source: path.join(release, 'source'), adapter: false, output: release },
];
function sourceFor(variant) {
  const dir = variant.source;
  const header = fs.readFileSync(path.join(dir, 'ui.html'), 'utf8').trim();
  const adapter = variant.adapter ? fs.readFileSync(path.join(dir, 'lzmad-7z-adapter.js'), 'utf8').trim() : '';
  const core = order.map(name => fs.readFileSync(path.join(dir, name + '.js'), 'utf8')).join('\n;\n') + '\n;\n' + fs.readFileSync(path.join(dir, 'archive.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(dir, 'ui.js'), 'utf8');
  return { header, adapter, core, readable: adapter ? adapter + '\n;\n' + core : core };
}
function closureCompile(variant) {
  fs.mkdirSync(variant.output, { recursive: true });
  const { header, adapter, core, readable } = sourceFor(variant);
  const compileDir = path.join(release, 'build/closure', variant.id);
  fs.mkdirSync(compileDir, { recursive: true });
  const tokenSandbox = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(variant.source, '6502.js'), 'utf8'), tokenSandbox);
  const tokens = new Set(tokenSandbox.O.flatMap(fn => fn.toString().match(/[A-Za-z_$][\w$]*/g) || []));
  const names = Object.keys(tokenSandbox).filter(name => tokens.has(name));
  const externs = path.join(compileDir, 'closure.externs.js');
  fs.writeFileSync(externs, '/** @externs */\nvar ' + names.join(',') + ';\n');
  let declarations = [];
  const input = path.join(compileDir, 'closure.input.js');
  const pass1 = path.join(compileDir, 'pass1.js');
  const pass2 = path.join(compileDir, 'pass2.js');
  const args = ['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',externs];
  let pass1Result;
  for (let attempt = 0; attempt < 8; attempt++) {
    fs.writeFileSync(input, (declarations.length ? 'var ' + declarations.join(',') + ';\n' : '') + (adapter ? adapter + '\n;\n' : '') + core);
    pass1Result = cp.spawnSync(compiler, [...args, '--js', input, '--js_output_file', pass1], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    fs.writeFileSync(path.join(compileDir, 'closure.pass1.log'), (pass1Result.stdout || '') + (pass1Result.stderr || ''));
    if (pass1Result.status === 0) break;
    const missing = [...(pass1Result.stderr || '').matchAll(/variable (\w+) is undeclared/g)].map(match => match[1]).filter(name => !declarations.includes(name));
    if (!missing.length || attempt === 7) throw new Error(`${variant.id} Closure pass 1 failed: ${pass1Result.stderr}`);
    declarations = [...new Set([...declarations, ...missing])].sort();
  }
  fs.copyFileSync(input, path.join(compileDir, 'closure.input.js'));
  const firstBytes = fs.statSync(pass1).size;
  const pass2Result = cp.spawnSync(compiler, [...args, '--js', pass1, '--js_output_file', pass2], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(compileDir, 'closure.pass2.log'), (pass2Result.stdout || '') + (pass2Result.stderr || ''));
  if (pass2Result.status !== 0) throw new Error(`${variant.id} Closure pass 2 failed: ${pass2Result.stderr}`);
  const secondBytes = fs.statSync(pass2).size;
  const chosen = secondBytes < firstBytes ? pass2 : pass1;
  fs.copyFileSync(chosen, path.join(compileDir, 'closure.min.js'));
  const wrap = js => header + '\n<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>\n';
  fs.writeFileSync(path.join(variant.output, 'jsnes-lite.readable.html'), wrap(readable));
  fs.writeFileSync(path.join(variant.output, 'jsnes-lite.readable.js'), 'document.open();document.write(' + JSON.stringify(header) + ');document.close();\n' + readable);
  fs.writeFileSync(path.join(compileDir, 'closure.min.html'), wrap(fs.readFileSync(chosen, 'utf8')));
  fs.writeFileSync(path.join(compileDir, 'closure.passes.json'), JSON.stringify({ passes: 2, pass1Bytes: firstBytes, pass2Bytes: secondBytes, selectedPass: secondBytes < firstBytes ? 2 : 1, selectedBytes: Math.min(firstBytes, secondBytes), extraClosureAdvancedForBase122Loader: true }, null, 2) + '\n');
  return { header, closurePath: path.join(compileDir, 'closure.min.js'), sourceBytes: Buffer.byteLength(readable), closureBytes: Math.min(firstBytes, secondBytes), pass1Bytes: firstBytes, pass2Bytes: secondBytes, selectedPass: secondBytes < firstBytes ? 2 : 1 };
}
function decodedProgram(code) {
  let decoded = '';
  new vm.Script(code).runInNewContext({ eval(value) { decoded = value; return value; } }, { timeout: 30000 });
  return decoded;
}
async function pack(variant, compiled) {
  const { header } = compiled;
  const Packer = createPackerClass();
  const setup = 'document.open();document.write(' + JSON.stringify(header) + ');document.close();\n';
  const input = setup + fs.readFileSync(compiled.closurePath, 'utf8');
  const buildDir = path.join(release, 'build/roadroller', variant.id);
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, 'roadroller.input.js'), input);
  const startOptions = JSON.parse(fs.readFileSync(path.join(release, 'search/initial-options.json'), 'utf8')).options;
  const parameterPath = path.join(buildDir, 'roadroller.parameters.landscape-outer-controls.json');
  let options, searchMs, bestSize;
  if (fs.existsSync(parameterPath)) {
    const saved = JSON.parse(fs.readFileSync(parameterPath, 'utf8'));
    options = saved.options; searchMs = saved.searchMs; bestSize = saved.bestSize;
  } else {
    const search = new Packer([{ data: input, type: 'js', action: 'eval' }], { ...startOptions, exe: 0 });
    const started = performance.now();
    const optimization = await search.optimize(2, info => {
      if (info.bestUpdated) console.log(`${variant.id} O2 ${info.pass}: best=${info.bestSize}`);
    });
    searchMs = Math.round(performance.now() - started);
    options = { ...search.options };
    delete options.resourcePool;
    bestSize = optimization.bestSize;
    fs.writeFileSync(parameterPath, JSON.stringify({ tool: 'da0ka/roadroller community fork', commit: '64614b5fc6c7a97d75315c4d8c9ca407e6f233a3', optimizationLevel: 2, exe: 0, searchMs, bestSize, options }, null, 2) + '\n');
  }
  const packer = new Packer([{ data: input, type: 'js', action: 'eval' }], options);
  const decoder = packer.makeDecoder();
  const roadroller = decoder.firstLine + '\n' + decoder.secondLine;
  const begin = decoder.firstLine.indexOf("[M='") + 4, end = decoder.firstLine.lastIndexOf("'");
  if (begin < 4 || end < begin) throw new Error(`${variant.id}: unexpected Roadroller output`);
  const stream = decoder.firstLine.slice(begin, end), binary = packSixBit(stream), payload = encode(binary);
  if (unpackSixBit(decode(payload), stream.length) !== stream) throw new Error(`${variant.id}: Base122 round-trip failed`);
  const second = decoder.secondLine;
  if (!second.includes('M.charCodeAt(d++)&63') || !second.includes('")([],')) throw new Error(`${variant.id}: unexpected Roadroller decoder`);
  const directSecond = second.replace('M.charCodeAt(d++)&63', '(M[d*3>>2]<<8|M[(d*3>>2)+1])>>(10-(d++*6&7))&63').replace('")([],' ,'\")([data],');
  const loader = decode.toString() + '\n(()=>{const data=decode("__BASE122_PAYLOAD__");(0,eval)(Function("[M"' + directSecond + '})();';
  fs.writeFileSync(path.join(buildDir, 'roadroller.min.js'), roadroller);
  fs.writeFileSync(path.join(buildDir, 'roadroller.parameters.json'), JSON.stringify({ tool: 'da0ka/roadroller community fork', commit: '64614b5fc6c7a97d75315c4d8c9ca407e6f233a3', optimizationLevel: 2, exe: 0, searchMs, bestSize, options }, null, 2) + '\n');
  fs.writeFileSync(path.join(buildDir, 'roadroller.search.log'), `best=${bestSize}\nsearchMs=${searchMs}\n`);
  fs.writeFileSync(path.join(buildDir, 'roadroller-payload.bin'), binary);
  fs.writeFileSync(path.join(buildDir, 'base122.loader.readable.js'), loader);
  const loaderJs = path.join(buildDir, 'loader.js'), loaderMin = path.join(buildDir, 'loader.min.js');
  fs.writeFileSync(loaderJs, loader);
  const loaderResult = cp.spawnSync(compiler, ['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--isolation_mode','IIFE','--warning_level','QUIET','--js',loaderJs,'--js_output_file',loaderMin], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(buildDir, 'base122.compiler.log'), (loaderResult.stdout || '') + (loaderResult.stderr || ''));
  if (loaderResult.status !== 0) throw new Error(`${variant.id} Base122 loader Closure failed: ${loaderResult.stderr}`);
  const compact = trimBase122Loader(fs.readFileSync(loaderMin, 'utf8'));
  fs.writeFileSync(path.join(buildDir, 'base122.loader.min.js'), compact);
  const wrapped = compact.replace('"__BASE122_PAYLOAD__"', () => scriptLiteral(payload));
  const minJs = path.join(variant.output, 'jsnes-lite.min.js');
  const minHtml = path.join(variant.output, 'jsnes-lite.min.html');
  fs.writeFileSync(minJs, wrapped);
  fs.writeFileSync(minHtml, '\ufeff<!doctype html><script>' + wrapped.replace(/<\/script/gi, '<\\/script') + '</script>');
  const decoded = decodedProgram(wrapped);
  const htmlMatch = decoded.match(/document\.write\(("(?:\\.|[^"\\])*")\)/);
  if (!htmlMatch || new vm.Script(`(${htmlMatch[1]})`).runInNewContext() !== header) throw new Error(`${variant.id}: decoded header mismatch`);
  const close = decoded.indexOf('document.close();', htmlMatch.index);
  if (close < 0) throw new Error(`${variant.id}: decoded setup missing`);
  const decodedCore = decoded.slice(close + 'document.close();'.length).trim();
  const expectedCore = fs.readFileSync(compiled.closurePath, 'utf8');
  for (const [name, code] of [['decoded', decodedCore], ['expected', expectedCore]]) {
    const inFile = path.join(buildDir, `${name}.js`), outFile = path.join(buildDir, `${name}.normalized.js`);
    fs.writeFileSync(inFile, code);
    const normalized = cp.spawnSync(compiler, ['--compilation_level','WHITESPACE_ONLY','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--warning_level','QUIET','--js',inFile,'--js_output_file',outFile], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (normalized.status !== 0) throw new Error(`${variant.id}: decoded source check failed: ${normalized.stderr}`);
  }
  if (!fs.readFileSync(path.join(buildDir,'decoded.normalized.js')).equals(fs.readFileSync(path.join(buildDir,'expected.normalized.js')))) throw new Error(`${variant.id}: decoded program differs from Closure output`);
  return { roadrollerBytes: Buffer.byteLength(roadroller), finalJsBytes: fs.statSync(minJs).size, finalHtmlBytes: fs.statSync(minHtml).size, searchMs, bestSize, loaderBytes: Buffer.byteLength(compact), payloadBytes: Buffer.byteLength(payload) };
}
const compiled = {};
for (const variant of variants) compiled[variant.id] = closureCompile(variant);
if (mode === 'all' || mode === 'pack') {
  for (const variant of variants) compiled[variant.id].pack = await pack(variant, compiled[variant.id]);
}
if (mode === 'all' || mode === 'pack') {
  const candidate = compiled.candidate, baseline = compiled.baseline;
  const summarize = item => ({ sourceBytes: item.sourceBytes, closureBytes: item.closureBytes, pass1Bytes: item.pass1Bytes, pass2Bytes: item.pass2Bytes, selectedPass: item.selectedPass, ...item.pack });
  const result = {
    version: 'V017', status: 'unfinalized build',
    scope: 'V016 released layout versus V017 landscape control inset adjustment',
    settings: { applicationClosurePasses: 2, closureCompiler: '20261108.0.0', roadroller: 'da0ka community fork at 64614b5fc6c7a97d75315c4d8c9ca407e6f233a3', roadrollerLevel: 2, roadrollerExe: 0, base122: true, sameInitialRoadrollerOptions: true },
    baseline: summarize(compiled.baseline), candidate: summarize(compiled.candidate),
    comparison: {
      readableSourceBytesDelta: candidate.sourceBytes - baseline.sourceBytes,
      nesSourceBytesDelta: fs.statSync(path.join(variants[1].source, 'nes.js')).size - fs.statSync(path.join(variants[0].source, 'nes.js')).size,
      closureBytesDelta: candidate.closureBytes - baseline.closureBytes,
      roadrollerBytesDelta: candidate.pack.roadrollerBytes - baseline.pack.roadrollerBytes,
      finalHtmlBytesDelta: candidate.pack.finalHtmlBytes - baseline.pack.finalHtmlBytes,
    },
    tools: { node: process.version, closure: '20261108.0.0', roadroller: 'da0ka/roadroller 64614b5fc6c7a97d75315c4d8c9ca407e6f233a3 (O2; exe:0)' },
  };
  fs.writeFileSync(path.join(release, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(release, 'build/comparison.json'), JSON.stringify(result, null, 2) + '\n');
  const files = {};
  for (const [label, file] of [
    ['candidate/jsnes-lite.min.html', path.join(release, 'jsnes-lite.min.html')],
    ['candidate/jsnes-lite.min.js', path.join(release, 'jsnes-lite.min.js')],
    ['candidate/jsnes-lite.readable.html', path.join(release, 'jsnes-lite.readable.html')],
    ['candidate/jsnes-lite.readable.js', path.join(release, 'jsnes-lite.readable.js')],
    ['baseline/jsnes-lite.min.html', path.join(variants[0].output, 'jsnes-lite.min.html')],
    ['baseline/jsnes-lite.min.js', path.join(variants[0].output, 'jsnes-lite.min.js')],
    ['baseline/jsnes-lite.readable.html', path.join(variants[0].output, 'jsnes-lite.readable.html')],
    ['baseline/jsnes-lite.readable.js', path.join(variants[0].output, 'jsnes-lite.readable.js')],
    ['closure/baseline.js', compiled.baseline.closurePath],
    ['closure/candidate.js', compiled.candidate.closurePath],
    ['source-baseline/nes.js', path.join(variants[0].source, 'nes.js')],
    ['source-candidate/nes.js', path.join(variants[1].source, 'nes.js')],
  ]) {
    const data = fs.readFileSync(file);
    files[label] = { bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
  }
  fs.writeFileSync(path.join(release, 'sizes.json'), JSON.stringify({ version: 'V017', status: 'unfinalized', settings: result.settings, tools: result.tools, comparison: result.comparison, files }, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
