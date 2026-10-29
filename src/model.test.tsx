import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FundEntry, Index, Line, Storage } from "./contract";
import { INDEX, partKey, sha256 } from "./contract";
import type { Api } from "./depot";
import { top } from "./matrix";
import { compute, heat } from "./model";
import { defaults } from "./settings";
import { XRayPage } from "./XRayPage";

afterEach(cleanup);

const entry = (over: Partial<FundEntry>): FundEntry => ({
  h: "h", name: "F", isin: "", issuer: null, fetched_at: "", source: "issuer", note: null, ter: null, ter_source: null,
  lines: 1, coverage: "1", parts: 1, sha256: "", ...over,
});
const line = (key: string, w: string): Line => [key, key, w, "US", "IT", "USD"];

describe("compute", () => {
  it("gives the four largest funds a column each, the rest one together, and leaves updating funds out", () => {
    const ids = ["a", "b", "c", "d", "e", "u"];
    const lines = new Map(ids.filter((i) => i !== "u").map((i) => [i, [line("US0378331005", "0.5"), line(`X${i}`, "0.5")]]));
    const index = { isins: { u: "IE0000000009" }, missing: [], funds: Object.fromEntries(ids.map((i) => [i, entry({ name: i })])) } as unknown as Index;
    const positions = ids.map((id, n) => ({ id, name: id, currency: "EUR", value: 100 - n }));
    const m = compute({ kind: "ok", index, lines, updating: ["u"] }, { positions, cash: new Map(), base: "EUR", asOf: "" }, defaults());
    expect(m.columns.map((h) => h.id)).toEqual(["a", "b", "c", "d"]);
    expect(m.moreFunds).toBe(true);
    expect(m.updating).toEqual([{ id: "u", name: "u" }]);
    const apple = m.matrix.find((r) => r.row.key === "US0378331005");
    expect(apple && apple.others).toBeCloseTo(48);
    expect(m.matrix.some((r) => r.row.key === "IE0000000009")).toBe(false); // still without a list: no row
    expect(top(m.matrix, "x")).toHaveLength(Math.min(10, m.matrix.length));
    expect([heat(0), heat(0.5), heat(1)]).toEqual(["heat-0", "heat-3", "heat-5"]);
  });
});

describe("a fund's card", () => {
  it("names a swap fund, a TER from Finanzfluss or the user's own, and a list being updated", async () => {
    const data = new Map<string, string>();
    const lines: Line[] = [line("US0378331005", "0.6"), line("US5949181045", "0.4")];
    const funds: Record<string, FundEntry> = {};
    for (const [id, over] of [["s", { note: "swap", ter: "0.003", ter_source: "finanzfluss" }], ["m", { ter: "0.001", ter_source: "manual" }]] as const) {
      data.set(partKey(id, 1, 0), JSON.stringify({ lines }));
      funds[id] = entry({ h: id, name: `Fonds ${id}`, sha256: await sha256(JSON.stringify(lines)), ...over });
    }
    funds.u = entry({ h: "u", name: "Fonds u" });
    data.set(INDEX, JSON.stringify({ schema: 1, generation: 1, written_at: new Date().toISOString(), last_pass: {}, isins: {}, missing: [], base_currency: "EUR", funds }));
    const storage: Storage = { get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
    const api: Api = {
      accounts: { getAll: async () => [{ id: "1", name: "Depot" }] },
      portfolio: { getHoldings: async () => ["s", "m", "u"].map((id) => ({ holdingType: "security", instrument: { id, name: `Fonds ${id}` }, marketValue: { local: 1, base: 100 } })) },
    };
    const { container } = render(<XRayPage storage={storage} api={api} />);
    await screen.findByText("Kennzahlen");
    container.querySelectorAll("details").forEach((d) => (d.open = true));
    expect(screen.getByText(/Synthetischer ETF/)).toBeTruthy();
    expect(screen.getByText(/von Finanzfluss/)).toBeTruthy();
    expect(screen.getByText(/eigene/)).toBeTruthy();
    expect(screen.getByText("Die Liste wird gerade aktualisiert.")).toBeTruthy();
  });
});
