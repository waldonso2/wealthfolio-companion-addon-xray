// Fabricated demo data for the harness page (index.html → src/main.tsx): what the service would store and what
// Wealthfolio would answer, so the page can be checked in a browser without Wealthfolio. Nothing real.
import { INDEX, partKey, sha256, type Index, type Line, type Storage } from "./contract";
import type { Api, SdkHolding } from "./depot";

const COUNTRIES = ["US", "US", "US", "JP", "GB", "DE", "FR", "CH"];
const SECTORS = ["Information Technology", "Financials", "Health Care", "Industrials", "Consumer Discretionary"];

function fund(prefix: string, n: number, cover: number): Line[] {
  const out: Line[] = [];
  let left = cover;
  for (let i = 0; i < n; i++) {
    const w = i === n - 1 ? left : Math.round((cover / n) * (1.8 - (1.6 * i) / n) * 1e6) / 1e6;
    left = Math.round((left - w) * 1e6) / 1e6;
    out.push([`XS${String(i).padStart(10, "0")}`, `${prefix} Beispiel AG ${i + 1}`, String(w), COUNTRIES[i % 8], SECTORS[i % 5], i % 3 ? "USD" : "EUR"]);
  }
  return out;
}

export async function demo(state: string): Promise<{ storage: Storage; api: Api }> {
  const data = new Map<string, string>();
  const funds: [string, string, Line[], number][] = [
    ["a-world", "Beispiel World UCITS ETF", fund("Welt", 400, 0.995), 42000],
    ["a-em", "Beispiel Emerging Markets UCITS ETF", fund("Schwellen", 200, 0.98), 9000],
    ["a-tech", "Beispiel Tech UCITS ETF", fund("Welt", 60, 1), 6000],
  ];
  const index: Index = {
    schema: 1, generation: 1, written_at: new Date().toISOString(), service_version: "0.45.0", base_currency: "EUR",
    last_pass: { at: new Date().toISOString(), error: null },
    isins: { "a-world": "IE0000000001", "a-em": "IE0000000002", "a-tech": "IE0000000003", "a-stock": "XS0000000001", "a-ubs": "LU0000000001" },
    funds: {},
    missing: [{ asset_id: "a-ubs", name: "Beispiel UBS UCITS ETF", isin: "LU0000000001", reason: "Für UBS gibt es keinen automatischen Abruf. Lade seine Positionsliste unter „Einstellungen dieses ETFs“ hoch." }],
  };
  for (const [id, name, lines] of funds) {
    const h = id.padEnd(16, "0").slice(0, 16);
    data.set(partKey(h, 1, 0), JSON.stringify({ schema: 1, asset_id: id, part: 0, parts: 1, lines }));
    index.funds[id] = {
      h, name, isin: index.isins[id], issuer: "Beispiel", fetched_at: index.written_at, source: "issuer", note: null,
      ter: id === "a-em" ? null : "0.0020", ter_source: id === "a-em" ? null : "issuer", lines: lines.length,
      coverage: String(lines.reduce((s, l) => s + Number(l[2]), 0)), parts: 1, sha256: await sha256(JSON.stringify(lines)),
    };
  }
  if (state !== "empty") data.set(INDEX, JSON.stringify(index));
  const holding = (id: string, name: string, base: number): SdkHolding => ({
    holdingType: "security", instrument: { id, name }, localCurrency: "EUR", baseCurrency: "EUR",
    marketValue: { local: base, base }, asOfDate: new Date().toISOString().slice(0, 10),
  });
  const api: Api = {
    accounts: { getAll: async () => [{ id: "acc-1", name: "Depot" }, { id: "acc-2", name: "Verrechnungskonto" }] },
    portfolio: {
      getHoldings: async (account) =>
        account === "acc-1"
          ? [...funds.map(([id, name, , v]) => holding(id, name, v)), holding("a-stock", "Welt Beispiel AG 2", 3000), holding("a-ubs", "Beispiel UBS UCITS ETF", 2500)]
          : [{ holdingType: "cash", marketValue: { local: 12000, base: 12000 }, baseCurrency: "EUR" }],
    },
  };
  const storage: Storage = { get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
  return { storage, api };
}
