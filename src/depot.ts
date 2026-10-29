// The depot as Wealthfolio holds it now (values live from the SDK) and the funds' lists from the service: the
// holdings X-Ray computes with, as the service's lookthrough.read_depot / lookthrough.holdings build them.
import type { Line, Store } from "./contract";
import { stock, unify, type Holding } from "./xray";

/** What the addon needs of the SDK (ctx.api.accounts / ctx.api.portfolio), structurally. */
export interface Api {
  accounts: { getAll(): Promise<{ id: string; name: string; isActive?: boolean }[]> };
  portfolio: { getHoldings(accountId: string): Promise<SdkHolding[]> };
}

export interface SdkHolding {
  holdingType: string;
  instrument?: { id: string; symbol?: string; name?: string | null } | null;
  quantity?: number;
  localCurrency?: string;
  baseCurrency?: string;
  marketValue: { local: number; base: number };
  asOfDate?: string;
}

export interface Position {
  id: string;
  name: string;
  currency: string;
  value: number;
}

export interface Depot {
  positions: Position[]; // largest first, value > 0
  cash: Map<string, number>; // per account name, in the base currency
  base: string;
  asOf: string;
}

/** Every open position of every account, added up per asset; alternative assets are left out. */
export async function readDepot(api: Api): Promise<Depot> {
  const positions = new Map<string, Position>();
  const cash = new Map<string, number>();
  let base = "EUR";
  let asOf = "";
  for (const account of await api.accounts.getAll()) {
    if (account.isActive === false) continue;
    for (const h of await api.portfolio.getHoldings(account.id)) {
      const value = h.marketValue?.base ?? 0;
      base = h.baseCurrency || base;
      if (h.asOfDate && h.asOfDate > asOf) asOf = h.asOfDate;
      const kind = (h.holdingType || "").toLowerCase();
      if (kind === "cash") cash.set(account.name, (cash.get(account.name) ?? 0) + (value || h.quantity || 0));
      if (kind !== "security" || !h.instrument?.id) continue;
      const id = h.instrument.id;
      const p = positions.get(id) ?? {
        id,
        name: h.instrument.name || h.instrument.symbol || id,
        currency: h.localCurrency || "",
        value: 0,
      };
      p.value += value;
      positions.set(id, p);
    }
  }
  const sorted = [...positions.values()].filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  return { positions: sorted, cash, base, asOf };
}

function constituents(lines: Line[]) {
  return lines.map(([key, name, weight, country, sector, currency]) => ({
    key,
    name,
    weight: Number(weight),
    country,
    sector,
    currency,
  }));
}

/** A position with its fund's list is a fund, any other one a stock of its own (keyed by its ISIN, else its id). */
export function holdings(depot: Depot, store: Extract<Store, { kind: "ok" }>): Holding[] {
  return unify(
    depot.positions.map((p) => {
      const lines = store.lines.get(p.id);
      return lines
        ? { id: p.id, name: p.name, value: p.value, constituents: constituents(lines) }
        : stock(p.id, store.index.isins[p.id] || p.id, p.name, p.value, p.currency);
    }),
  );
}
