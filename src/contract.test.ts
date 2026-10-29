import { describe, expect, it } from "vitest";
import { INDEX, partKey, readStore, sha256, type Index, type Line, type Storage } from "./contract";

const LINES: Line[] = [
  ["US0378331005", 'Müller "AG"', "0.5", "US", "IT", "USD"],
  ["DE0007164600", "SAP SE", "0.4", "DE", "IT", "EUR"],
];

async function store(opts: { schema?: number; parts?: Line[][]; hash?: string; generation?: number } = {}) {
  const data = new Map<string, string>();
  const parts = opts.parts ?? [LINES.slice(0, 1), LINES.slice(1)];
  const g = opts.generation ?? 3;
  parts.forEach((lines, i) => data.set(partKey("h1", g, i), JSON.stringify({ schema: 1, asset_id: "a", part: i, parts: parts.length, lines })));
  const index: Index = {
    schema: opts.schema ?? 1, generation: g, written_at: "2026-10-29T08:00:00Z", service_version: "0.45.0",
    base_currency: "EUR", last_pass: {}, isins: { a: "IE00B4L5Y983" }, missing: [],
    funds: { a: { h: "h1", name: "A", isin: "IE00B4L5Y983", issuer: null, fetched_at: "", source: "issuer", note: null, ter: null,
      ter_source: null, lines: 2, coverage: "0.9", parts: parts.length, sha256: opts.hash ?? (await sha256(JSON.stringify(parts.flat()))) } },
  };
  data.set(INDEX, JSON.stringify(index));
  const storage: Storage = { get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
  return { data, storage };
}

describe("readStore", () => {
  it("reads a fund over several parts", async () => {
    const s = await readStore((await store()).storage);
    expect(s.kind === "ok" && s.lines.get("a")).toEqual(LINES);
  });
  it("hashes the lines exactly as the service does (Python's compact JSON, non-ASCII as is)", async () => {
    // json.dumps([["X", "Ä \\"q\\""]], ensure_ascii=False, separators=(",", ":")) in the service
    expect(await sha256(JSON.stringify([["X", 'Ä "q"']]))).toBe(await sha256('[["X","Ä \\"q\\""]]'));
  });
  it("is none without an index, newer for a newer schema", async () => {
    expect((await readStore({ get: async () => null, set: async () => {} })).kind).toBe("none");
    expect((await readStore({ get: async () => "{broken", set: async () => {} })).kind).toBe("none");
    expect(await readStore((await store({ schema: 2 })).storage)).toEqual({ kind: "newer", schema: 2 });
  });
  it("reads the index once more when a part is missing, and gives the fund up after that", async () => {
    const { data, storage } = await store();
    const missing = partKey("h1", 3, 1);
    const saved = data.get(missing) as string;
    data.delete(missing);
    let reads = 0;
    const racing: Storage = {
      get: async (k) => {
        if (k === INDEX && ++reads === 2) data.set(missing, saved); // the service finished writing meanwhile
        return storage.get(k);
      },
      set: storage.set,
    };
    const s = await readStore(racing);
    expect(s.kind === "ok" && s.lines.get("a")).toEqual(LINES);
    data.delete(missing);
    const gone = await readStore(storage);
    expect(gone.kind === "ok" && gone.updating).toEqual(["a"]);
  });
  it("gives a fund up whose lines don't match their hash", async () => {
    const s = await readStore((await store({ hash: "0".repeat(64) })).storage);
    expect(s.kind === "ok" && [s.lines.size, s.updating]).toEqual([0, ["a"]]);
  });
});
