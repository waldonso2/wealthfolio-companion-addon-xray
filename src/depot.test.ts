import { describe, expect, it } from "vitest";
import type { Index } from "./contract";
import { holdings, readDepot, type Api } from "./depot";

const api: Api = {
  accounts: { getAll: async () => [{ id: "1", name: "Depot" }, { id: "2", name: "Giro" }, { id: "3", name: "Alt", isActive: false }] },
  portfolio: {
    getHoldings: async (id) =>
      id === "1"
        ? [
            { holdingType: "security", instrument: { id: "a", name: "World ETF" }, localCurrency: "USD", baseCurrency: "EUR", marketValue: { local: 1, base: 100 }, asOfDate: "2026-10-28" },
            { holdingType: "security", instrument: { id: "s", symbol: "SAP.DE" }, marketValue: { local: 1, base: 50 } },
            { holdingType: "AlternativeAsset", instrument: { id: "house" }, marketValue: { local: 1, base: 9e5 } },
            { holdingType: "security", instrument: { id: "z" }, marketValue: { local: 0, base: 0 } },
          ]
        : id === "2"
          ? [
              { holdingType: "security", instrument: { id: "a", name: "World ETF" }, marketValue: { local: 1, base: 25 }, asOfDate: "2026-10-29" },
              { holdingType: "cash", quantity: 300, marketValue: { local: 0, base: 0 } },
            ]
          : [{ holdingType: "security", instrument: { id: "gone" }, marketValue: { local: 1, base: 1 } }],
  },
};

describe("readDepot", () => {
  it("adds a position up over accounts, keeps cash per account, skips alternative assets and inactive accounts", async () => {
    const d = await readDepot(api);
    expect(d.positions).toEqual([
      { id: "a", name: "World ETF", currency: "USD", value: 125 },
      { id: "s", name: "SAP.DE", currency: "", value: 50 },
    ]);
    expect([...d.cash]).toEqual([["Giro", 300]]);
    expect([d.base, d.asOf]).toEqual(["EUR", "2026-10-29"]);
  });
  it("makes a fund of a position with a list and a stock of any other, keyed by its ISIN", async () => {
    const d = await readDepot(api);
    const index = { isins: { s: "DE0007164600" } } as unknown as Index;
    const h = holdings(d, { kind: "ok", index, lines: new Map([["a", [["DE0007164600", "SAP SE", "0.1", "DE", "IT", "EUR"]]]]), updating: [] });
    expect(h.map((x) => [x.id, x.constituents.map((c) => [c.key, c.weight])])).toEqual([
      ["a", [["DE0007164600", 0.1]]],
      ["s", [["DE0007164600", 1]]],
    ]);
  });
});
