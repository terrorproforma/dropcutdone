const core = import('./core.js');

const MODEL_HASH = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
let sessionPromise;
async function getSession(id) {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    postMessage({ id, type: 'progress', message: 'Loading the cutting engine. First time takes a little longer…' });
    importScripts('./vendor/ort.wasm.min.js');
    const ort = globalThis.ort;
    if (!ort) throw new Error('The cutting engine could not load. Refresh and try again.');
    ort.env.wasm.wasmPaths = new URL('./vendor/', self.location.href).href;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const response = await fetch(new URL('./models/u2netp.onnx', self.location.href), { signal: AbortSignal.timeout(90000), cache: 'force-cache' });
    if (!response.ok) throw new Error('The cutting model could not download. Check your connection and retry.');
    const bytes = await response.arrayBuffer();
    let hash;
    if (crypto.subtle) hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
    else { importScripts('./vendor/sha256.min.js'); hash = self.sha256(bytes); }
    if (hash !== MODEL_HASH) throw new Error('Model verification failed. Refresh and try again.');
    return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  })().catch(error => { sessionPromise = undefined; throw error; });
  return sessionPromise;
}

self.onmessage = async ({ data: { id, file } }) => {
  let bitmap;
  try {
    const { normalizePixels, normalizeMask, fitSize } = await core;
    const session = await getSession(id);
    postMessage({ id, type: 'progress', message: 'Finding your subject…' });
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitSize(bitmap.width, bitmap.height);
    const input = new OffscreenCanvas(320, 320), ic = input.getContext('2d', { willReadFrequently: true });
    ic.fillStyle = '#fff'; ic.fillRect(0, 0, 320, 320); ic.drawImage(bitmap, 0, 0, 320, 320);
    const pixels = ic.getImageData(0, 0, 320, 320).data;
    const tensor = new globalThis.ort.Tensor('float32', normalizePixels(pixels), [1, 3, 320, 320]);
    let outputs;
    let mask;
    try {
      outputs = await session.run({ [session.inputNames[0]]: tensor });
      mask = normalizeMask(outputs[session.outputNames[0]].data);
    } finally {
      tensor.dispose();
      if (outputs) for (const value of Object.values(outputs)) value.dispose();
    }
    postMessage({ id, type: 'progress', message: 'Finishing your cutout…' });
    const smallMask = new OffscreenCanvas(320, 320), sc = smallMask.getContext('2d');
    const maskPixels = sc.createImageData(320, 320);
    for (let i = 0; i < mask.length; i++) {
      maskPixels.data[i * 4] = 255; maskPixels.data[i * 4 + 1] = 255; maskPixels.data[i * 4 + 2] = 255; maskPixels.data[i * 4 + 3] = mask[i];
    }
    sc.putImageData(maskPixels, 0, 0);
    const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, width, height);
    context.globalCompositeOperation = 'destination-in';
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(smallMask, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3] > 24) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error('No foreground found. Try a clearer photo.');
    // A tiny crop margin preserves soft antialiased edges.
    left = Math.max(0, left - 3); top = Math.max(0, top - 3); right = Math.min(width - 1, right + 3); bottom = Math.min(height - 1, bottom + 3);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    postMessage({ id, type: 'done', blob, width, height, bounds: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 } });
  } catch (error) {
    console.error('Background removal engine:', error.message);
    const message = /foreground|verification|could not|Refresh/i.test(error.message || '') ? error.message : 'Processing failed. Try Retry, a smaller photo, or an up-to-date browser.';
    postMessage({ id, type: 'error', message, diagnostic: String(error.message) });
  } finally { bitmap?.close(); }
};
