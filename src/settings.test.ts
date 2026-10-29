import { describe, expect, it } from "vitest";
import type { Storage } from "./contract";
import { defaults, load, parseLimit, save, SETTINGS } from "./settings";

function mem(initial?: string): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>(initial ? [[SETTINGS, initial]] : []);
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v) };
}

describe("settings", () => {
  it("start from the defaults and round-trip through the addon's own key", async () => {
    const s = mem();
    expect(await load(s)).toEqual(defaults());
    await save(s, { limits: { ...defaults().limits, stock: 0.1 }, accepted: ["country:US"] });
    expect(JSON.parse(s.data.get(SETTINGS) as string).limits.stock).toBe("0.1");
    expect(await load(s)).toEqual({ limits: { ...defaults().limits, stock: 0.1 }, accepted: ["country:US"] });
  });
  it("ignore what is broken or out of range", async () => {
    expect(await load(mem("{broken"))).toEqual(defaults());
    const odd = await load(mem(JSON.stringify({ limits: { stock: "-1", cash: "x" }, accepted: [1, "k"] })));
    expect(odd).toEqual({ ...defaults(), accepted: ["k"] });
  });
  it("parse a typed limit: percent for shares, a number otherwise", () => {
    expect(parseLimit("stock", "7,5")).toBe(0.075);
    expect(parseLimit("effective", "25")).toBe(25);
    expect(parseLimit("stock", "101")).toBeNull();
    expect(parseLimit("cash", "1e10")).toBeNull();
    expect(parseLimit("stock", "")).toBeNull();
    expect(parseLimit("stock", "Infinity")).toBeNull();
  });
});
