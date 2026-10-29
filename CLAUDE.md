# PLACEHOLDER: project name

PLACEHOLDER: what it does. TypeScript + React web app built with Vite (`src/`), from `waldonso2/template-ts-react`
(quality-kit). Docs and UI texts German, CLAUDE.md, code and comments English. Node 24, pnpm 11 (`.tool-versions`).

## Commands

```bash
pnpm install
pnpm type-check && pnpm lint && pnpm test:coverage   # unit and component tests (jsdom, axe), coverage ≥ 90 %
pnpm build && pnpm test:ui                           # every page of the built app in Chromium
pnpm perf                                            # performance report, never blocking (after pnpm build)
```

## Quality rules (quality-kit - keep them)

- **Blocking:** `tsc` strict, ESLint without warnings (incl. jsx-a11y: a form field needs a label, a clickable
  element is a button for the keyboard too), Vitest with coverage ≥ 90 % and axe-core on every component test,
  `pnpm audit --prod`, dependency review, gitleaks, zizmor (≥ medium), CodeQL, and `e2e/ui.spec.ts`: every page in
  `e2e/pages.ts` in Chromium, light and dark, phone and desktop - no axe-core violation (contrast included), no CSP
  violation, script error or failed load, nothing wider than the phone. **A new page goes into `e2e/pages.ts`.**
- **Performance is only reported, never blocking** (owner's rule): `e2e/report.perf.ts` (`pnpm perf`) runs in CI with
  `continue-on-error` and writes its table to the run's summary; new measurements of the project's own main
  operations go there with a reference value. `KENNZAHLEN.md` lists every KPI.
- A deliberate exception carries its reason: `// eslint-disable-next-line <rule> -- <why>`.
- **CSP without `unsafe-inline`** (`SECURITY_HEADERS` in `vite.config.ts`, also for the production server): no inline
  `style`/`script` in `index.html`; colours as tokens in `src/style.css`, light and dark, each text colour ≥ 4.5:1.
  Tables have `<caption className="sr-only">`, `<thead>`, `<th scope="col">` and `data-label` on cells.
- **Logic apart from components** (like `src/words.ts`): tests and the performance report call it directly.
- **Dependencies:** only from `pnpm-lock.yaml` (`--frozen-lockfile`); pnpm installs only releases at least 7 days old
  (`minimumReleaseAge`), Dependabot waits the same week (`cooldown`).
- **GitHub Actions and quality-kit workflows pinned to commit SHAs** with the version as a comment.
- **Secrets never in the repo**; test data is fabricated (allowed test values in `.gitleaks.toml`).
- Questions to the owner go as a clickable list (the question tool), never as free text.
