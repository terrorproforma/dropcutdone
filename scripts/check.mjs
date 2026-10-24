import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
for (const file of ['dist/core.js','dist/app.js','dist/engine-worker.js']) execFileSync(process.execPath,['--check',file]);
const model=readFileSync('dist/models/u2netp.onnx');
assert.equal(createHash('sha256').update(model).digest('hex'),'309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8');
for(const name of ['ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) assert.ok(statSync(`dist/vendor/${name}`).size>1000);
for(const html of readdirSync('dist').filter(x=>x.endsWith('.html'))) {
  const text=readFileSync(`dist/${html}`,'utf8');
  for(const [,path] of text.matchAll(/(?:src|href)="(\/[^"#]*)"/g)) if(path && path!='/') assert.ok(statSync(`dist${path}`).isFile(),`${html} missing ${path}`);
}
console.log('Syntax, internal links, runtime assets, and model integrity passed.');
