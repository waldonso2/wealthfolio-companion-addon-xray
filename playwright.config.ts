import { defineConfig } from "@playwright/test";

// The built app through `vite preview` (with the production headers from vite.config.ts). Chromium from
// `pnpm exec playwright install chromium`; CHROMIUM_PATH points to another build.
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  webServer: { command: "pnpm preview", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
});
