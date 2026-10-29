// Everything the page shows, computed from the store, the depot and the settings - pure, so tests and the
// performance report call it directly.
import type { FundEntry, Missing, Store } from "./contract";
import { holdings as toHoldings, type Depot } from "./depot";
import { matrix, type MatrixRow } from "./matrix";
import type { Settings } from "./settings";
import { effectiveCount, exposures, findings, overlap, ownShare, UNASSIGNED, type Finding, type Holding } from "./xray";

export interface FundCard {
  holding: Holding;
  entry: FundEntry;
  ownShare: number;
  updating: boolean;
}

export interface Model {
  total: number;
  matrix: MatrixRow[];
  columns: Holding[];
  moreFunds: boolean;
  pending: (Missing & { held: boolean })[];
  updating: { id: string; name: string }[];
  funds: FundCard[];
  overlap: { funds: Holding[]; cells: number[][] };
  effective: number;
  unassigned: number;
  findings: Finding[];
  accepted: Finding[];
}

export function compute(store: Extract<Store, { kind: "ok" }>, depot: Depot, settings: Settings): Model {
  const holdings = toHoldings(depot, store);
  const rows = exposures(holdings);
  const total = depot.positions.reduce((s, p) => s + p.value, 0);
  const held = new Set(depot.positions.map((p) => p.id));
  const withList = holdings.filter((h) => store.lines.has(h.id)).sort((a, b) => b.value - a.value);
  const pending = store.index.missing.filter((m) => held.has(m.asset_id)).map((m) => ({ ...m, held: true }));
  const updating = store.updating.filter((id) => held.has(id)).map((id) => ({ id, name: store.index.funds[id].name }));
  // A fund still without its list is never a row of the matrix: it counts as one position, named above it.
  const waiting = new Set([...pending.map((m) => m.isin || m.asset_id), ...updating.map((u) => store.index.isins[u.id] || u.id)]);
  const all = findings(holdings, settings.limits, depot.base, depot.cash);
  const accepted = new Set(settings.accepted);
  return {
    total,
    matrix: matrix(rows, withList, total, waiting),
    columns: withList.slice(0, 4),
    moreFunds: withList.length > 4,
    pending,
    updating,
    funds: withList.map((h) => ({
      holding: h,
      entry: store.index.funds[h.id],
      ownShare: ownShare(h, holdings),
      updating: false,
    })),
    overlap: { funds: withList, cells: withList.map((a) => withList.map((b) => (a === b ? 1 : overlap(a, b)))) },
    effective: effectiveCount(rows),
    unassigned: rows.find((r) => r.key === UNASSIGNED)?.share ?? 0,
    findings: all.filter((f) => !accepted.has(f.key)),
    accepted: all.filter((f) => accepted.has(f.key)),
  };
}

/** heat-0 … heat-5 for an overlap share. */
export function heat(share: number): string {
  return `heat-${Math.min(5, Math.floor(share * 6))}`;
}
