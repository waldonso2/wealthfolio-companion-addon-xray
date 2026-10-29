// The data Wealthfolio Companion leaves in this addon's storage (contract/xray/README.md, schema 1). Read only: the
// addon never writes a key of the service (they start with "xray:").

export const ADDON_ID = "broker-sync-xray";
export const SUPPORTED_SCHEMA = 1;
export const INDEX = "xray:index";

/** [key, name, weight, country, sector, currency], numbers as strings. */
export type Line = [string, string, string, string, string, string];

export interface FundEntry {
  h: string;
  name: string;
  isin: string;
  issuer: string | null;
  fetched_at: string;
  source: "issuer" | "upload" | "saved_page";
  note: string | null;
  ter: string | null;
  ter_source: "manual" | "issuer" | "finanzfluss" | null;
  lines: number;
  coverage: string;
  parts: number;
  sha256: string;
}

export interface Missing {
  asset_id: string;
  name: string;
  isin: string;
  reason: string;
}

export interface Index {
  schema: number;
  generation: number;
  written_at: string;
  service_version: string;
  base_currency: string;
  last_pass: { at?: string | null; error?: string | null };
  isins: Record<string, string>;
  funds: Record<string, FundEntry>;
  missing: Missing[];
}

/** What the addon needs of the SDK's storage (ctx.api.storage). */
export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export type Store =
  | { kind: "none" } // the service wrote nothing (yet), or was switched off
  | { kind: "newer"; schema: number } // written by a newer service: update the addon
  | { kind: "ok"; index: Index; lines: Map<string, Line[]>; updating: string[] };

export function partKey(h: string, generation: number, part: number): string {
  return `xray:f:${h}:${generation}:${part}`;
}

// SHA-256 of the UTF-8 text, in plain JS: Wealthfolio's addon sandbox is an opaque-origin iframe, where
// crypto.subtle (secure contexts only) is undefined.
const K = Uint32Array.from(
  "428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da 983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2"
    .split(" ")
    .map((h) => parseInt(h, 16)),
);

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const blocks = Math.ceil((data.length + 9) / 64);
  const bytes = new Uint8Array(blocks * 64);
  bytes.set(data);
  bytes[data.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 8, Math.floor(data.length / 0x20000000));
  view.setUint32(bytes.length - 4, (data.length * 8) >>> 0);
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let b = 0; b < blocks; b++) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(b * 64 + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      [hh, g, f, e, d, c, bb, a] = [g, f, e, (d + t1) >>> 0, c, bb, a, (t1 + t2) >>> 0];
    }
    [a, bb, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) >>> 0));
  }
  return [...h].map((v) => v.toString(16).padStart(8, "0")).join("");
}

async function readIndex(storage: Storage): Promise<Index | null> {
  const raw = await storage.get(INDEX);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Index;
  } catch {
    return null;
  }
}

/** One fund's lines, or null when a part is missing or the lines don't match their hash (the service is writing). */
async function readFund(storage: Storage, fund: FundEntry, generation: number): Promise<Line[] | null> {
  const lines: Line[] = [];
  for (let p = 0; p < fund.parts; p++) {
    const raw = await storage.get(partKey(fund.h, generation, p));
    if (!raw) return null;
    lines.push(...(JSON.parse(raw) as { lines: Line[] }).lines);
  }
  // The service hashes Python's compact JSON (ensure_ascii=False); JSON.stringify writes the same for these strings.
  return (await sha256(JSON.stringify(lines))) === fund.sha256 ? lines : null;
}

/** The index and every fund's lines; a fund caught mid-write is read once more with a fresh index, then given up. */
export async function readStore(storage: Storage): Promise<Store> {
  for (let attempt = 0; ; attempt++) {
    const index = await readIndex(storage);
    if (!index) return { kind: "none" };
    if (index.schema > SUPPORTED_SCHEMA) return { kind: "newer", schema: index.schema };
    const lines = new Map<string, Line[]>();
    const updating: string[] = [];
    for (const [asset, fund] of Object.entries(index.funds)) {
      const got = await readFund(storage, fund, index.generation);
      if (got) lines.set(asset, got);
      else updating.push(asset);
    }
    if (!updating.length || attempt === 1) return { kind: "ok", index, lines, updating };
  }
}
