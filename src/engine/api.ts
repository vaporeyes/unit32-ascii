/* ABOUTME: Thin client for the Go gallery backend. */
/* ABOUTME: Base URL comes from VITE_API_URL, defaulting to localhost:8080. */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

export interface ArtworkMeta {
  id: string;
  title: string;
  author: string;
  width: number;
  height: number;
  created_at: string;
}

export interface PublishInput {
  title: string;
  author: string;
  width: number;
  height: number;
  buffer: Uint32Array;
}

export interface FetchedArtwork extends ArtworkMeta {
  buffer: Uint32Array;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function publishArtwork(input: PublishInput): Promise<ArtworkMeta> {
  const bytes = new Uint8Array(input.buffer.buffer, input.buffer.byteOffset, input.buffer.byteLength);
  const body = JSON.stringify({
    title: input.title,
    author: input.author,
    width: input.width,
    height: input.height,
    data: bytesToBase64(bytes),
  });
  const res = await fetch(`${API_BASE}/artworks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`Publish failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchArtwork(id: string): Promise<FetchedArtwork> {
  const res = await fetch(`${API_BASE}/artworks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const json = await res.json();
  const raw = base64ToBytes(json.data);
  const aligned = new Uint8Array(raw.byteLength);
  aligned.set(raw);
  const buffer = new Uint32Array(aligned.buffer);
  return {
    id: json.id,
    title: json.title,
    author: json.author,
    width: json.width,
    height: json.height,
    created_at: json.created_at,
    buffer,
  };
}

export async function listArtworks(): Promise<ArtworkMeta[]> {
  const res = await fetch(`${API_BASE}/artworks`);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export { API_BASE };
