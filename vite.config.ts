import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The harness page (index.html, `vite build`) is served with these headers in the browser test (e2e/ui.spec.ts):
// a CSP without 'unsafe-inline' and without any connect target but itself - the addon makes no network requests.
export const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
    "connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// Wealthfolio provides React to its addons; they stay out of dist/addon.js.
const HOST = ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  preview: { headers: SECURITY_HEADERS },
  define: mode === "addon" ? { "process.env.NODE_ENV": JSON.stringify("production") } : {},
  build:
    mode === "addon"
      ? {
          // The addon: dist/addon.js and dist/addon.css (the sandbox installs a packaged stylesheet).
          lib: { entry: "src/addon.tsx", formats: ["es"], fileName: () => "addon.js", cssFileName: "addon" },
          rollupOptions: { external: HOST },
          outDir: "dist",
          emptyOutDir: false,
          minify: false,
          sourcemap: false,
        }
      : { outDir: "dist/harness" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/demo.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
}));
