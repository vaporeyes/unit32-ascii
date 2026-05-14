/* ABOUTME: Encode and decode grid state for shareable URLs. */
/* ABOUTME: Format: header (width/height, u32 LE) + cell buffer, deflate-raw, base64url. */

const MAGIC = 0x55334121; // 'U3A!'

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return bytes;
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes as BufferSource);
  writer.close();
  return await readAll(stream.readable);
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') return bytes;
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes as BufferSource);
  writer.close();
  return await readAll(stream.readable);
}

async function readAll(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function b64uEncode(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): Uint8Array {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SharedState {
  width: number;
  height: number;
  buffer: Uint32Array;
}

export async function encodeShare(width: number, height: number, buffer: Uint32Array): Promise<string> {
  const header = new ArrayBuffer(12);
  const view = new DataView(header);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, width, true);
  view.setUint32(8, height, true);
  const combined = new Uint8Array(12 + buffer.byteLength);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), 12);
  const compressed = await deflate(combined);
  return b64uEncode(compressed);
}

export async function decodeShare(token: string): Promise<SharedState | null> {
  try {
    const compressed = b64uDecode(token);
    const raw = await inflate(compressed);
    if (raw.length < 12) return null;
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const magic = view.getUint32(0, true);
    if (magic !== MAGIC) return null;
    const width = view.getUint32(4, true);
    const height = view.getUint32(8, true);
    const cellBytes = width * height * 4;
    if (raw.length < 12 + cellBytes) return null;
    const cellsCopy = new Uint8Array(cellBytes);
    cellsCopy.set(raw.subarray(12, 12 + cellBytes));
    const buffer = new Uint32Array(cellsCopy.buffer);
    return { width, height, buffer };
  } catch {
    return null;
  }
}
