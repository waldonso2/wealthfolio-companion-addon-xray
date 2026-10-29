// X-Ray: what the depot really holds - a port of the broker sync service's src/brokersync/xray.py (same rules, same
// order of the results). contract/xray/cases.json is computed by the service; src/xray.test.ts checks this port
// against it. Numbers are doubles: sums over a few thousand lines stay far below what is shown; EPS absorbs what a
// decimal would have made exactly zero.

export const UNASSIGNED = ""; // key of what the funds' weights leave open
const EPS = 1e-12;

export interface Constituent {
  key: string;
  name: string;
  weight: number; // share of the fund, 0..1
  country: string;
  sector: string;
  currency: string;
}

export interface Holding {
  id: string; // Wealthfolio asset id
  name: string;
  value: number; // in the base currency
  constituents: Constituent[];
}

export interface Exposure {
  key: string;
  name: string;
  country: string;
  sector: string;
  currency: string;
  value: number;
  share: number; // of the depot
  via: Map<string, number>; // holding id -> share of the depot
}

export interface Finding {
  key: string; // what the user accepts, e.g. "country:United States"
  kind: string; // a key of LIMITS
  name: string;
  value: number;
  limit: number;
}

export type Limits = Record<"stock" | "country" | "sector" | "currency" | "overlap" | "effective" | "cash", number>;

// Defaults as in the service; shares are of the depot, cash in the base currency.
export const LIMITS: Limits = {
  stock: 0.05,
  country: 0.6,
  sector: 0.3,
  currency: 0.5,
  overlap: 0.5,
  effective: 30,
  cash: 100000,
};

/** A single stock (or a fund without its list): itself at weight 1. */
export function stock(id: string, key: string, name: string, value: number, currency = ""): Holding {
  return { id, name, value, constituents: [{ key, name, weight: 1, country: "", sector: "", currency }] };
}

const cache = new WeakMap<Holding, Map<string, number>>();

/** Weight per company key; lines with the same key added up (share classes). */
export function weights(holding: Holding): Map<string, number> {
  let out = cache.get(holding);
  if (!out) {
    out = new Map();
    for (const c of holding.constituents) out.set(c.key, (out.get(c.key) ?? 0) + c.weight);
    cache.set(holding, out);
  }
  return out;
}

/** Every company once, largest first; UNASSIGNED collects what the funds leave open, last. */
export function exposures(holdings: Holding[]): Exposure[] {
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const rows = new Map<string, Exposure>();
  const add = (key: string, c: Constituent | undefined, h: Holding, weight: number) => {
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        name: c?.name ?? "",
        country: c?.country ?? "",
        sector: c?.sector ?? "",
        currency: c?.currency ?? "",
        value: 0,
        share: 0,
        via: new Map(),
      };
      rows.set(key, row);
    }
    const value = h.value * weight;
    row.value += value;
    row.via.set(h.id, (row.via.get(h.id) ?? 0) + value / total);
  };
  for (const h of holdings) {
    const first = new Map<string, Constituent>();
    for (const c of h.constituents) if (!first.has(c.key)) first.set(c.key, c);
    for (const [key, weight] of weights(h)) add(key, first.get(key), h, weight);
    const rest = 1 - h.constituents.reduce((s, c) => s + c.weight, 0);
    if (rest > EPS) add(UNASSIGNED, undefined, h, rest);
  }
  const out = [...rows.values()];
  for (const r of out) r.share = total ? r.value / total : 0;
  // A stable sort keeps the order of first appearance among equal values, as Python's sorted does.
  return out.sort((a, b) => Number(a.key === UNASSIGNED) - Number(b.key === UNASSIGNED) || b.value - a.value);
}

export function overlap(a: Holding, b: Holding): number {
  const wb = weights(b);
  let sum = 0;
  for (const [k, w] of weights(a)) if (wb.has(k)) sum += Math.min(w, wb.get(k) as number);
  return sum;
}

/** The part of a holding no other holding brings. */
export function ownShare(holding: Holding, others: Holding[]): number {
  const elsewhere = new Set<string>();
  for (const o of others) if (o.id !== holding.id) for (const k of weights(o).keys()) elsewhere.add(k);
  let sum = 0;
  for (const [k, w] of weights(holding)) if (!elsewhere.has(k)) sum += w;
  return sum;
}

/** 1 / sum of squared shares: how many equally weighted stocks the depot is worth. */
export function effectiveCount(rows: Exposure[]): number {
  const squares = rows.reduce((s, r) => (r.key === UNASSIGNED ? s : s + r.share * r.share), 0);
  return squares ? 1 / squares : 0;
}

export const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
// Legal forms and share classes: "APPLE INC" and "Apple Inc." are one company, "ALPHABET INC CLASS A" too.
const FORMS =
  /\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|AG|SA|SE|NV|AB|ASA|OYJ|SPA|HOLDINGS?|GROUP|CLASS [A-Z]|CL [A-Z]|REG|REGISTERED|ADR|ORD|SHS)\b/g;
// A par value after the name, as Invesco writes it: "APPLE INC USD0.00001", "SAP NPV".
const PAR = /\s(?:[A-Z]{3}\d+(?:[.,]\d+)?|NPV)\b/g;

export function plain(name: string): string {
  const cleaned = name.toUpperCase().replace(PAR, " ").replace(/[^A-Z0-9 ]/g, " ");
  // Python's re.sub replaces non-overlapping matches left to right, like a global JS replace.
  return cleaned.replace(FORMS, " ").split(/\s+/).filter(Boolean).join(" ");
}

/** Lines without an ISIN take the ISIN of a line with the same plain name; the rest meet by that name. */
export function unify(holdings: Holding[]): Holding[] {
  const alias = new Map<string, string>();
  for (const h of holdings)
    for (const c of h.constituents) if (ISIN.test(c.key) && !alias.has(plain(c.name))) alias.set(plain(c.name), c.key);
  const key = (c: Constituent) => (ISIN.test(c.key) ? c.key : alias.get(plain(c.name)) || `~${plain(c.name) || c.key}`);
  return holdings.map((h) => ({ ...h, constituents: h.constituents.map((c) => ({ ...c, key: key(c) })) }));
}

function by(rows: Exposure[], attr: "country" | "sector"): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const name = r[attr].trim();
    if (r.key !== UNASSIGNED && name) out.set(name, (out.get(name) ?? 0) + r.share);
  }
  return out;
}

/** Cluster risks over the limits, largest first within each kind. ``cash``: cash per account name. */
export function findings(holdings: Holding[], limits: Limits, base: string, cash: Map<string, number>): Finding[] {
  const rows = exposures(holdings);
  const out: Finding[] = rows
    .filter((r) => r.key !== UNASSIGNED && r.share > limits.stock + EPS)
    .map((r) => ({ key: `stock:${r.key}`, kind: "stock", name: r.name, value: r.share, limit: limits.stock }));
  for (const kind of ["country", "sector"] as const) {
    const groups = [...by(rows, kind)].sort((a, b) => b[1] - a[1]);
    for (const [name, share] of groups)
      if (share > limits[kind] + EPS) out.push({ key: `${kind}:${name}`, kind, name, value: share, limit: limits[kind] });
  }
  const foreign = rows.reduce((s, r) => (r.currency && r.currency !== base ? s + r.share : s), 0);
  if (foreign > limits.currency + EPS)
    out.push({ key: "currency", kind: "currency", name: base, value: foreign, limit: limits.currency });
  const funds = holdings.filter((h) => h.constituents.length > 1);
  for (let i = 0; i < funds.length; i++)
    for (let j = i + 1; j < funds.length; j++) {
      const o = overlap(funds[i], funds[j]);
      if (o > limits.overlap + EPS)
        out.push({
          key: `overlap:${funds[i].id}:${funds[j].id}`,
          kind: "overlap",
          name: `${funds[i].name} / ${funds[j].name}`,
          value: o,
          limit: limits.overlap,
        });
    }
  const count = effectiveCount(rows);
  if (count && count < limits.effective - EPS)
    out.push({ key: "effective", kind: "effective", name: "", value: count, limit: limits.effective });
  for (const [name, amount] of [...cash].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)))
    if (amount > limits.cash) out.push({ key: `cash:${name}`, kind: "cash", name, value: amount, limit: limits.cash });
  return out;
}
