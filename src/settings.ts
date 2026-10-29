// The user's own limits and accepted cluster risks, in this addon's storage under "addon:settings" (never a key of
// the service). The service's limits are not taken over: each side keeps its own.
import type { Storage } from "./contract";
import { LIMITS, type Limits } from "./xray";

export const SETTINGS = "addon:settings";

export interface Settings {
  limits: Limits;
  accepted: string[];
}

export function defaults(): Settings {
  return { limits: { ...LIMITS }, accepted: [] };
}

export async function load(storage: Storage): Promise<Settings> {
  const out = defaults();
  try {
    const saved = JSON.parse((await storage.get(SETTINGS)) || "{}") as { limits?: Record<string, string>; accepted?: string[] };
    for (const k of Object.keys(out.limits) as (keyof Limits)[]) {
      const v = Number(saved.limits?.[k]);
      if (saved.limits?.[k] !== undefined && Number.isFinite(v) && v >= 0) out.limits[k] = v;
    }
    out.accepted = Array.isArray(saved.accepted) ? saved.accepted.filter((a) => typeof a === "string") : [];
  } catch {
    // unreadable: the defaults
  }
  return out;
}

export async function save(storage: Storage, s: Settings): Promise<void> {
  const limits = Object.fromEntries(Object.entries(s.limits).map(([k, v]) => [k, String(v)]));
  await storage.set(SETTINGS, JSON.stringify({ schema: 1, limits, accepted: s.accepted }));
}

/** A limit as typed: percent for shares, a plain number otherwise; null when it is no finite number in range. */
export function parseLimit(key: keyof Limits, text: string): number | null {
  const v = Number(text.replace(",", "."));
  if (!text.trim() || !Number.isFinite(v) || v < 0) return null;
  if (key === "effective" || key === "cash") return v <= 1e9 ? v : null;
  return v <= 100 ? v / 100 : null;
}
