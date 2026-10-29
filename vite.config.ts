import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The production server must send the same headers (CSP without 'unsafe-inline'); the browser test
// (e2e/ui.spec.ts) checks the built app through `vite preview` with them.
export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
    "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default defineConfig({
  plugins: [react()],
  preview: { headers: SECURITY_HEADERS },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
