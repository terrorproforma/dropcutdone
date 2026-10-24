export const LIMITS = Object.freeze({ files: 10, bytes: 12 * 1024 * 1024, pixels: 16_000_000, edge: 4096 });

export function validateFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Use a JPG, PNG, or WebP image.';
  if (!file.size) return 'This file is empty.';
  if (file.size > LIMITS.bytes) return 'This image is over the 12 MB limit.';
  return null;
}

export function normalizePixels(rgba) {
  const count = rgba.length / 4;
  const data = new Float32Array(count * 3);
  let max = 1;
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) max = Math.max(max, rgba[i * 4 + c]);
  const mean = [.485, .456, .406], std = [.229, .224, .225];
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) data[c * count + i] = (rgba[i * 4 + c] / max - mean[c]) / std[c];
  return data;
}

export function normalizeMask(values) {
  let min = Infinity, max = -Infinity;
  for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < .00001) throw new Error('No distinct foreground found. Try a clearer photo.');
  return Uint8ClampedArray.from(values, value => 255 * (value - min) / (max - min));
}

export function fitSize(width, height, edge = LIMITS.edge) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function outputName(name, index = 0) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'photo';
  return `${String(index + 1).padStart(2, '0')}-${stem}-dropcutdone.png`;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Store-mode ZIP: PNGs are already compressed. UTF-8 names, no third-party code.
export async function makeZip(entries) {
  const files = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(12, 0x21, true); // 1980-01-01, without exposing the source file's timestamps.
    lv.setUint32(14, crc, true); lv.setUint32(18, bytes.length, true); lv.setUint32(22, bytes.length, true);
    lv.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    files.push(local, bytes); directory.push(central); directorySize += central.length; offset += local.length + bytes.length;
  }
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
  return new Blob([...files, ...directory, end], { type: 'application/zip' });
}
