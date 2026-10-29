// Performance report (KENNZAHLEN.md): measured, compared with the reference values, never failing. `pnpm perf` after
// `pnpm build`; CI runs it with continue-on-error. The table goes to $GITHUB_STEP_SUMMARY and to perf-report.md.
import { test } from "@playwright/test";
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { wordCounts } from "../src/words";
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
  const js = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
  const bundle = Buffer.concat(js.map((f) => readFileSync(`dist/assets/${f}`)));
  record("Paket", "JavaScript, gzip", gzipSync(bundle).length / 1024, "KiB", 170, "Budget für schnelle Mobilnetze");
  const text = Array.from({ length: 1_000_000 }, (_, i) => `wort${i % 5000}`).join(" ");
  const t = performance.now();
  wordCounts(text);
  record("Kern", "wordCounts über 1 Mio. Wörter", performance.now() - t, "ms", 1000, "Nielsen 1 s");
});
