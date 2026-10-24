import { LIMITS, validateFile, outputName, makeZip } from './core.js';

const $ = selector => document.querySelector(selector);
const records = [];
let worker, activeId, watchdog, zipURL, generation = 0, adding = Promise.resolve(), serial = 0, exporting = false;
const options = { background: 'transparent', size: 'original' };
const notice = message => { $('#notice').textContent = message; $('#notice').hidden = !message; };
const state = () => records.map(({ id, name, status, message, width, height }) => ({ id, name, status, message, width, height }));

function emit(type, detail = {}) {
  // Local-only hooks. No analytics network request or photo content.
  window.dispatchEvent(new CustomEvent(`dropcutdone:${type}`, { detail }));
}
function controls() {
  $('#workbench').hidden = records.length === 0;
  $('#download-all').disabled = exporting || !records.some(r => r.status === 'done') || records.some(r => ['queued', 'processing'].includes(r.status));
}
function clearZip() {
  if (zipURL) URL.revokeObjectURL(zipURL);
  zipURL = null; $('#zip-ready').hidden = true; $('#zip-link').removeAttribute('href');
}
function createCard(record) {
  const article = document.createElement('article'); article.className = 'result';
  article.innerHTML = '<div class="result-image checker"><img alt=""><div class="result-status" role="status" aria-live="polite"></div></div><div class="result-info"><p class="result-name"></p><div class="result-meta"></div><div class="result-actions"><button class="text-button compare" hidden>View original</button><button class="dark-button download" disabled>Download PNG ↓</button><button class="dark-button retry" hidden>Retry ↻</button></div></div>';
  article.querySelector('.result-name').textContent = record.name;
  article.querySelector('img').alt = record.name;
  article.querySelector('img').src = record.originalURL;
  article.querySelector('.compare').onclick = () => {
    record.showOriginal = !record.showOriginal;
    article.querySelector('img').src = record.showOriginal ? record.originalURL : record.resultURL;
    article.querySelector('.compare').textContent = record.showOriginal ? 'View cutout' : 'View original';
  };
  article.querySelector('.download').onclick = async () => {
    const button = article.querySelector('.download'); button.disabled = true;
    try { const blob = await exportResult(record.id); save(blob, outputName(record.name, records.indexOf(record))); emit('download', { count: 1 }); }
    catch { notice('This download could not be created. Please try again.'); }
    finally { button.disabled = record.status !== 'done'; }
  };
  article.querySelector('.retry').onclick = () => { record.status = 'queued'; record.message = 'Queued'; updateCard(record); runQueue(); };
  record.element = article; $('#results').append(article); updateCard(record);
}
function updateCard(record) {
  const el = record.element, status = el.querySelector('.result-status');
  el.classList.toggle('error', record.status === 'error');
  status.replaceChildren();
  if (record.status === 'processing') { const spin = document.createElement('span'); spin.className = 'spinner'; spin.setAttribute('aria-hidden', 'true'); status.append(spin); }
  status.append(document.createTextNode(record.message));
  status.hidden = record.status === 'done';
  el.querySelector('.retry').hidden = record.status !== 'error';
  el.querySelector('.download').hidden = record.status === 'error';
  el.querySelector('.download').disabled = record.status !== 'done';
  el.querySelector('.compare').hidden = record.status !== 'done';
  if (record.status === 'done') el.querySelector('.result-meta').textContent = `${record.width} × ${record.height} cutout · PNG`;
  controls();
}

async function addFiles(files) {
  clearZip();
  const mine = generation;
  const list = Array.from(files);
  adding = adding.then(async () => {
    if (mine !== generation) return;
    if (!('Worker' in window) || !('OffscreenCanvas' in window) || !('createImageBitmap' in window)) { notice('Please use an up-to-date Chrome, Edge, Firefox, or Safari browser to process photos on your device.'); return; }
    const errors = [];
    for (const file of list) {
      if (mine !== generation) return;
      if (records.length >= LIMITS.files) { errors.push('This batch is full. Clear your photos to start another batch (10 photos maximum).'); break; }
      const problem = validateFile(file);
      if (problem) { errors.push(`${file.name}: ${problem}`); continue; }
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
        if (bitmap.width * bitmap.height > LIMITS.pixels) { errors.push(`${file.name}: please resize to 16 megapixels or less.`); continue; }
      } catch { errors.push(`${file.name}: this image could not be opened.`); continue; }
      finally { bitmap?.close(); }
      if (mine !== generation) return;
      const record = { id: ++serial, file, name: file.name, originalURL: URL.createObjectURL(file), status: 'queued', message: 'Queued', previewVersion: 0 };
      records.push(record); createCard(record); emit('accepted', { count: 1 });
    }
    notice(errors.join(' '));
    if (records.length) { $('#workbench').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); runQueue(); }
  });
  return adding;
}

function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL('./engine-worker.js', import.meta.url));
  worker.onmessage = async ({ data }) => {
    const record = records.find(r => r.id === data.id);
    if (!record || data.id !== activeId) return;
    if (data.type === 'progress') { record.message = data.message; updateCard(record); return; }
    clearTimeout(watchdog);
    if (data.type === 'done') {
      Object.assign(record, { blob: data.blob, width: data.width, height: data.height, bounds: data.bounds, status: 'done', message: 'Ready' });
      try { await updatePreview(record); emit('processed', { count: 1 }); }
      catch { record.status = 'error'; record.message = 'The preview could not be created. Try a smaller image.'; }
    } else { console.error('DropCutDone:', data.diagnostic); record.status = 'error'; record.message = data.message; emit('error', { stage: 'process' }); }
    if (!records.includes(record) || activeId !== record.id) return;
    updateCard(record); activeId = null; runQueue();
  };
  worker.onerror = event => { event.preventDefault(); failActive('The cutting engine stopped. Retry or try an up-to-date browser.'); };
}
function failActive(message) {
  const record = records.find(r => r.id === activeId);
  clearTimeout(watchdog); worker?.terminate(); worker = null; activeId = null;
  if (record) { record.status = 'error'; record.message = message; updateCard(record); }
  runQueue();
}
function runQueue() {
  if (activeId) return;
  const record = records.find(r => r.status === 'queued'); controls();
  if (!record) return;
  try {
    activeId = record.id; ensureWorker(); record.status = 'processing'; record.message = 'Starting your cutout…'; updateCard(record);
    watchdog = setTimeout(() => failActive('This photo took too long. Retry with a smaller image.'), 180000);
    worker.postMessage({ id: record.id, file: record.file });
  } catch { failActive('The cutting engine could not start. Refresh your browser and try again.'); }
}

export async function exportResult(id, selected = { ...options }) {
  const record = records.find(r => r.id === id);
  if (!record?.blob) throw new Error('This cutout is not ready.');
  if (!['transparent', 'white'].includes(selected.background) || !['original', 'square', 'portrait'].includes(selected.size)) throw new Error('Invalid export options.');
  if (selected.size === 'original' && selected.background === 'transparent') return record.blob;
  const bitmap = await createImageBitmap(record.blob);
  try {
    const width = selected.size === 'original' ? record.width : 1080;
    const height = selected.size === 'original' ? record.height : selected.size === 'square' ? 1080 : 1350;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (selected.background === 'white') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    if (selected.size === 'original') context.drawImage(bitmap, 0, 0);
    else {
      const b = record.bounds, scale = Math.min(width * .84 / b.width, height * .84 / b.height);
      const dw = b.width * scale, dh = b.height * scale;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, b.x, b.y, b.width, b.height, (width - dw) / 2, (height - dh) / 2, dw, dh);
    }
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Export failed.')), 'image/png'));
  } finally { bitmap.close(); }
}
async function updatePreview(record) {
  const version = ++record.previewVersion, mine = generation;
  const blob = await exportResult(record.id);
  if (version !== record.previewVersion || mine !== generation) return;
  if (record.resultURL) URL.revokeObjectURL(record.resultURL);
  record.resultURL = URL.createObjectURL(blob); record.showOriginal = false;
  record.element.querySelector('img').src = record.resultURL;
  record.element.querySelector('.compare').textContent = 'View original';
}
function setOptions(next) {
  clearZip();
  if (next.background !== undefined && !['transparent', 'white'].includes(next.background)) throw new Error('Invalid background.');
  if (next.size !== undefined && !['original', 'square', 'portrait'].includes(next.size)) throw new Error('Invalid canvas.');
  if (next.background !== undefined) options.background = next.background;
  if (next.size !== undefined) options.size = next.size;
  document.querySelectorAll('[data-bg]').forEach(button => { const selected = button.dataset.bg === options.background; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  $('#size').value = options.size;
  return Promise.all(records.filter(r => r.status === 'done').map(r => updatePreview(r))).catch(() => notice('A preview could not update. Try downloading again or use a smaller image.'));
}
function clear() {
  clearZip();
  generation++; clearTimeout(watchdog); worker?.terminate(); worker = null; activeId = null;
  for (const record of records) { URL.revokeObjectURL(record.originalURL); if (record.resultURL) URL.revokeObjectURL(record.resultURL); }
  records.length = 0; $('#results').replaceChildren(); $('#files').value = ''; controls(); notice('');
}
function save(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function loadSample() {
  const button = $('#sample'); button.disabled = true; notice('');
  const mine = generation;
  try { const response = await fetch('/assets/sample-shoe.jpg'); if (!response.ok) throw new Error(); const blob = await response.blob(); if (mine === generation) await addFiles([new File([blob], 'sample-shoe.jpg', { type: 'image/jpeg' })]); }
  catch { notice('The sample could not load. Try one of your own photos.'); }
  finally { button.disabled = false; }
}
$('#files').onchange = event => { addFiles(event.target.files); event.target.value = ''; };
$('#sample').onclick = loadSample; $('#clear').onclick = clear;
$('#size').onchange = event => setOptions({ size: event.target.value });
document.querySelectorAll('[data-bg]').forEach(button => button.onclick = () => setOptions({ background: button.dataset.bg }));
$('#download-all').onclick = async () => {
  const button = $('#download-all'), mine = generation;
  exporting = true; controls(); button.textContent = 'Preparing ZIP…';
  try {
    const selected = { ...options }, done = records.filter(r => r.status === 'done'), entries = [];
    for (const record of done) entries.push({ name: outputName(record.name, records.indexOf(record)), blob: await exportResult(record.id, selected) });
    const zip = await makeZip(entries);
    if (mine === generation) {
      clearZip(); zipURL = URL.createObjectURL(zip);
      $('#zip-link').href = zipURL; $('#zip-link').onclick = () => emit('download', { count: entries.length });
      $('#zip-ready').hidden = false;
    }
  } catch { notice('The ZIP could not be created. Try downloading photos individually.'); }
  finally { exporting = false; button.textContent = 'Download all (.zip) ↓'; controls(); }
};
const dropzone = $('#dropzone');
for (const type of ['dragenter', 'dragover']) dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('dragover'); });
for (const type of ['dragleave', 'drop']) dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
// Prevent a missed file drop from navigating away and destroying the current batch.
window.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
window.addEventListener('drop', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
window.dropcutdone = Object.freeze({ version: '0.1.0', addFiles, getState: state, setOptions, exportResult, clear, loadSample });
