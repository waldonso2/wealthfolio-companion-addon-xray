// Performance report (KENNZAHLEN.md): measured, compared with the reference values, never failing. `pnpm perf` after
// `pnpm build`; CI runs it with continue-on-error. The table goes to $GITHUB_STEP_SUMMARY and to perf-report.md.
import { test } from "@playwright/test";
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { Index, Line } from "../src/contract";
import { compute } from "../src/model";
import { defaults } from "../src/settings";
import { PAGES } from "./pages";

const rows: string[][] = [];

function record(area: string, measure: string, value: number, unit: string, good?: number, source = "") {
  const verdict = good === undefined ? "–" : value <= good ? "✅" : "⚠️";
  const reference = good === undefined ? "" : `≤ ${good} ${unit} (${source})`;
  rows.push([area, measure, `${value.toLocaleString("en", { maximumFractionDigits: 1 })} ${unit}`, reference, verdict]);
}

test.afterAll(() => {
  const text = [
    "## Performance (nur Bericht, hält die CI nicht an)",
    "",
    "| Bereich | Messung | Wert | Referenz | |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.join(" | ")} |`),
    "",
  ].join("\n");
  console.log(text);
  writeFileSync(process.env.PERF_REPORT ?? "perf-report.md", text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
});

test("Core Web Vitals of every page (phone)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 740 } });
  const page = await context.newPage();
  const all: { ttfb: number; lcp: number; cls: number; bytes: number }[] = [];
  for (const path of PAGES) {
    await page.goto(path);
    all.push(
      await page.evaluate(
        () =>
          new Promise<{ ttfb: number; lcp: number; cls: number; bytes: number }>((done) => {
            const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
            let lcp = 0;
            let cls = 0;
            new PerformanceObserver((l) => l.getEntries().forEach((e) => (lcp = e.startTime))).observe({
              type: "largest-contentful-paint",
              buffered: true,
            });
            new PerformanceObserver((l) =>
              l.getEntries().forEach((e) => {
                const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
                if (!shift.hadRecentInput) cls += shift.value;
              }),
            ).observe({ type: "layout-shift", buffered: true });
            const bytes = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).reduce(
              (s, r) => s + r.encodedBodySize,
              nav.encodedBodySize,
            );
            setTimeout(() => done({ ttfb: nav.responseStart - nav.requestStart, lcp, cls, bytes }), 300);
          }),
      ),
    );
  }
  await context.close();
  const worst = (k: "ttfb" | "lcp" | "cls" | "bytes") => Math.max(...all.map((v) => v[k]));
  // Core Web Vitals "good" (web.dev) - here on the CI runner, without a real network.
  record("Web-UI", "TTFB, langsamste Seite", worst("ttfb"), "ms", 800, "Core Web Vitals");
  record("Web-UI", "LCP, schlechteste Seite", worst("lcp"), "ms", 2500, "Core Web Vitals");
  record("Web-UI", "CLS, schlechteste Seite", worst("cls"), "", 0.1, "Core Web Vitals");
  record("Web-UI", "Übertragen, größte Seite", worst("bytes") / 1024, "KiB", 500, "Seitengewicht");
});

test("bundle size and core logic", () => {
  const addon = readFileSync("dist/addon.js");
  record("Paket", "dist/addon.js, gzip", gzipSync(addon).length / 1024, "KiB", 50, "eigenes Budget");
  const js = readdirSync("dist/harness/assets").filter((f) => f.endsWith(".js"));
  const bundle = Buffer.concat(js.map((f) => readFileSync(`dist/harness/assets/${f}`)));
  record("Paket", "Testseite mit React, gzip", gzipSync(bundle).length / 1024, "KiB", 170, "Budget für schnelle Mobilnetze");
  // 10 funds of 3,500 lines each (#146: under 500 ms), half of the companies shared between funds.
  const lines = new Map<string, Line[]>();
  const index = { isins: {}, funds: {}, missing: [] } as unknown as Index;
  const positions = [];
  for (let f = 0; f < 10; f++) {
    const id = `f${f}`;
    lines.set(id, Array.from({ length: 3500 }, (_, i): Line => [
      `XS${String(i < 1750 ? i : f * 10000 + i).padStart(10, "0")}`, `Firma ${i}`, String(1 / 3600), "US", "IT", "USD"]));
    (index.funds as Record<string, unknown>)[id] = { name: id };
    positions.push({ id, name: id, currency: "EUR", value: 1000 * (f + 1) });
  }
  const t = performance.now();
  compute({ kind: "ok", index, lines, updating: [] }, { positions, cash: new Map(), base: "EUR", asOf: "" }, defaults());
  record("Kern", "X-Ray: 10 Fonds × 3.500 Zeilen", performance.now() - t, "ms", 500, "#146");
});
