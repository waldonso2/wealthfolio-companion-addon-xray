// Every page of the built app in Chromium: axe-core (accessibility incl. contrast, light and dark), no CSP
// violation, no script error, no failed load, nothing wider than a phone. Blocking.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

for (const colorScheme of ["light", "dark"] as const) {
  for (const [name, viewport] of [
    ["phone", { width: 375, height: 740 }],
    ["desktop", { width: 1280, height: 900 }],
  ] as const) {
    test(`every page passes axe, CSP and fits (${colorScheme}, ${name})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme, viewport });
      const page = await context.newPage();
      const problems: Record<string, string[]> = {};
      for (const path of PAGES) {
        const found: string[] = [];
        page.removeAllListeners();
        page.on("console", (m) => {
          if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) found.push(m.text());
        });
        page.on("pageerror", (e) => found.push(String(e)));
        page.on("response", (r) => {
          if (r.status() >= 400) found.push(`${r.status()} ${r.url()}`);
        });
        await page.goto(path);
        const { violations } = await new AxeBuilder({ page }).analyze();
        found.push(...violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`));
        if (name === "phone" && (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
          found.push("wider than the phone screen");
        if (found.length) problems[path] = found;
      }
      await context.close();
      expect(problems).toEqual({});
    });
  }
}
