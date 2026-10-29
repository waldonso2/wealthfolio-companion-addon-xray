// The port against contract/xray/cases.json, which the service computes with its xray.py (tolerance 1e-9).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { effectiveCount, exposures, findings, LIMITS, overlap, ownShare, plain, unify, type Holding, type Limits } from "./xray";

interface Case {
  name: string;
  holdings: { id: string; name: string; value: string; lines: string[][] }[];
  cash: Record<string, string>;
  base: string;
  expect: {
    unify: Record<string, string[]>;
    exposures: { key: string; name: string; share: string; via: Record<string, string> }[];
    overlap: Record<string, string>;
    own_share: Record<string, string>;
    effective_count: string;
    findings: { key: string; value: string }[];
  };
}

const file = JSON.parse(readFileSync(resolve(process.cwd(), "contract/xray/cases.json"), "utf8")) as {
  limits: Record<string, string>;
  cases: Case[];
};

const close = (a: number, b: string) => expect(Math.abs(a - Number(b))).toBeLessThan(1e-9);

function holdingsOf(c: Case): Holding[] {
  return c.holdings.map((h) => ({
    id: h.id,
    name: h.name,
    value: Number(h.value),
    constituents: h.lines.map(([key, name, weight, country, sector, currency]) => ({
      key, name, weight: Number(weight), country, sector, currency,
    })),
  }));
}

describe("the service's limits", () => {
  it("are the defaults here too", () => {
    expect(Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, v]))).toEqual(
      Object.fromEntries(Object.entries(file.limits).map(([k, v]) => [k, Number(v)])),
    );
  });
});

describe.each(file.cases)("$name", (c) => {
  const holdings = unify(holdingsOf(c));
  it("unifies the keys", () => {
    expect(Object.fromEntries(holdings.map((h) => [h.id, h.constituents.map((x) => x.key)]))).toEqual(c.expect.unify);
  });
  it("computes the exposures in the same order", () => {
    const rows = exposures(holdings);
    expect(rows.map((r) => [r.key, r.name])).toEqual(c.expect.exposures.map((r) => [r.key, r.name]));
    rows.forEach((r, i) => {
      close(r.share, c.expect.exposures[i].share);
      expect([...r.via.keys()].sort()).toEqual(Object.keys(c.expect.exposures[i].via));
      for (const [k, v] of r.via) close(v, c.expect.exposures[i].via[k]);
    });
    close(effectiveCount(rows), c.expect.effective_count);
  });
  it("computes overlap and own share", () => {
    const funds = holdings.filter((h) => h.constituents.length > 1);
    const pairs: Record<string, number> = {};
    for (let i = 0; i < funds.length; i++)
      for (let j = i + 1; j < funds.length; j++) pairs[`${funds[i].id}:${funds[j].id}`] = overlap(funds[i], funds[j]);
    expect(Object.keys(pairs)).toEqual(Object.keys(c.expect.overlap));
    for (const [k, v] of Object.entries(pairs)) close(v, c.expect.overlap[k]);
    for (const h of funds) close(ownShare(h, holdings), c.expect.own_share[h.id]);
  });
  it("finds the same cluster risks", () => {
    const limits = Object.fromEntries(Object.entries(file.limits).map(([k, v]) => [k, Number(v)])) as Limits;
    const found = findings(holdings, limits, c.base, new Map(Object.entries(c.cash).map(([k, v]) => [k, Number(v)])));
    expect(found.map((f) => f.key)).toEqual(c.expect.findings.map((f) => f.key));
    found.forEach((f, i) => close(f.value, c.expect.findings[i].value));
  });
});

describe("plain", () => {
  it("drops legal forms, classes and par values", () => {
    expect(plain("APPLE INC USD0.00001")).toBe("APPLE");
    expect(plain("Alphabet Inc. Class A")).toBe("ALPHABET");
    expect(plain("SAP SE NPV")).toBe("SAP");
  });
});
