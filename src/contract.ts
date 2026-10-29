// The data the broker sync service leaves in this addon's storage (contract/xray/README.md, schema 1). Read only: the
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

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
