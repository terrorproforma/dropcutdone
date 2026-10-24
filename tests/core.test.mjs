import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizePixels, normalizeMask, validateFile, fitSize, outputName, makeZip, crc32 } from '../dist/core.js';

test('image validation rejects invalid or oversized files', () => {
  assert.equal(validateFile({type:'image/jpeg',size:1024}), null);
  assert.match(validateFile({type:'image/svg+xml',size:100}), /JPG/);
  assert.match(validateFile({type:'image/png',size:13*1024*1024}), /12 MB/);
  assert.match(validateFile({type:'image/png',size:0}), /empty/);
});
test('resizing caps large images without upscaling small images', () => {
  assert.deepEqual(fitSize(8000,4000), {width:4096,height:2048});
  assert.deepEqual(fitSize(500,1000), {width:500,height:1000});
});
test('model inputs use channel-first RGB and image maximum normalization', () => {
  const input = normalizePixels(new Uint8ClampedArray([100,50,0,255,0,100,50,255]));
  assert.equal(input.length, 6);
  assert.ok(Math.abs(input[0]-(1-.485)/.229)<1e-6);
  assert.ok(Math.abs(input[2]-(.5-.456)/.224)<1e-6);
  assert.ok([...normalizePixels(new Uint8ClampedArray(8))].every(Number.isFinite));
});
test('mask contrast maps to alpha and rejects unusable predictions', () => {
  assert.deepEqual([...normalizeMask([.1,.3,.5])], [0,127,255]);
  assert.throws(()=>normalizeMask([.2,.2]), /foreground/);
  assert.throws(()=>normalizeMask([NaN,1]), /foreground/);
});
test('download filenames cannot contain paths and remain unique by index', () => {
  assert.equal(outputName('../../my photo.jpg',2), '03-my-photo-dropcutdone.png');
  assert.notEqual(outputName('a.png',0),outputName('a.png',1));
});
test('ZIP is readable by Python standard library and contains exact bytes', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const dir = await mkdtemp(join(tmpdir(),'dropcutdone-'));
  try {
    const zip=await makeZip([{name:'01-test.png',blob:new Blob(['sample-data'])},{name:'02-é.png',blob:new Blob([new Uint8Array([0,255,123])])}]);
    const file=join(dir,'test.zip');await writeFile(file,new Uint8Array(await zip.arrayBuffer()));
    execFileSync('python',['-c',"import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read('01-test.png')==b'sample-data';assert z.read('02-é.png')==bytes([0,255,123]);assert len(z.namelist())==2",file]);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
