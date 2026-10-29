import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// The performance report (e2e/*.perf.ts): only measured and reported, see KENNZAHLEN.md.
export default defineConfig({ ...base, testMatch: "*.perf.ts" });
