// The overall matrix as the service's X-Ray page shows it (routes/lookthrough._matrix): per stock its value through
// each of the COLUMNS largest funds, through the other funds, and held directly.
import { UNASSIGNED, type Exposure, type Holding } from "./xray";

export const COLUMNS = 4;
export const TOPS = ["10", "25", "50", "100", "all"] as const;

export interface MatrixRow {
  row: Exposure;
  columns: (number | undefined)[];
  others: number;
  direct: number;
  total: number;
}

/** ``waiting``: keys of funds still without a list - never a row of their own. */
export function matrix(rows: Exposure[], funds: Holding[], total: number, waiting: Set<string>): MatrixRow[] {
  const columns = funds.slice(0, COLUMNS).map((h) => h.id);
  const others = new Set(funds.slice(COLUMNS).map((h) => h.id));
  return rows
    .filter((r) => r.key !== UNASSIGNED && !waiting.has(r.key))
    .map((row) => {
      const via = new Map([...row.via].map(([k, share]) => [k, share * total]));
      let o = 0;
      let d = 0;
      for (const [k, v] of via) {
        if (others.has(k)) o += v;
        else if (!columns.includes(k)) d += v;
      }
      return { row, columns: columns.map((k) => via.get(k)), others: o, direct: d, total: row.value };
    });
}

export function top(rows: MatrixRow[], choice: string): MatrixRow[] {
  return choice === "all" ? rows : rows.slice(0, Number(choice) || 10);
}
