// Every text the page shows has an English entry (the German text is the key), and no entry is left unused.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EN, formatters, translate } from "./i18n";

const sources = readdirSync("src")
  .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
  .map((f) => readFileSync(`src/${f}`, "utf8"))
  .join("\n");
const used = new Set([...sources.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`)));
for (const m of sources.matchAll(/\["\w+", "((?:[^"\\]|\\.)*)"\]/g)) if (/[A-ZÄÖÜ]/.test(m[1])) used.add(JSON.parse(`"${m[1]}"`));
for (const m of sources.matchAll(/^\s*(?:\w+): "((?:[^"\\]|\\.)*)",?$/gm)) if (m[1] in EN) used.add(m[1]);

describe("i18n", () => {
  it("has an English text for every German one used", () => {
    expect([...used].filter((k) => !(k in EN))).toEqual([]);
  });
  it("has no English text nobody uses", () => {
    const kinds = ["Einzelaktie", "Land", "Sektor", "Fremdwährung", "Überschneidung", "Effektive Titelzahl", "Bargeld auf einem Konto"];
    expect(Object.keys(EN).filter((k) => !used.has(k) && !kinds.includes(k))).toEqual([]);
  });
  it("fills parameters and keeps unknown ones", () => {
    expect(translate("en", "Top {n}", { n: 5 })).toBe("Top 5");
    expect(translate("de", "Top {n}")).toBe("Top {n}");
  });
  it("formats dates in German time, German and English", () => {
    expect(formatters("de", "EUR").date("2026-10-28T23:30:00Z")).toBe("29.10.2026");
    expect(formatters("en", "EUR").date("2026-10-28")).toBe("2026-10-28");
    expect(formatters("de", "EUR").date(null)).toBe("–");
    expect(formatters("de", "EUR").date("nonsense")).toBe("–");
  });
});
