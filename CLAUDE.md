# X-Ray addon for Wealthfolio

A Wealthfolio addon (≥ 3.11): ETF look-through, computed in the browser from the funds' lists Wealthfolio
Companion (`waldonso2/wealthfolio-companion`) stores in this addon's storage, and the positions' values read
live through the SDK. Spec: waldonso2/wealthfolio-importer-addon#146. Docs and UI texts German (UI also English),
CLAUDE.md, code and comments English. Node 24, pnpm 11 (`.tool-versions`). From `waldonso2/template-ts-react`.

## Commands

```bash
pnpm install
pnpm type-check && pnpm lint && pnpm test:coverage   # unit and component tests (jsdom, axe), coverage ≥ 90 %
pnpm build && pnpm test:ui                           # the harness page in Chromium (axe incl. contrast, CSP, phone)
pnpm perf                                            # performance report, never blocking (after pnpm build)
pnpm bundle                                          # dist/wealthfolio-companion-addon-xray.zip (manifest, addon.js, addon.css)
```

## Layout

| Path | Purpose |
|---|---|
| `src/addon.tsx` | Entry: sidebar item and route `/addons/broker-sync-xray` (component mounted by the host); `Ctx` types what is used of the SDK's `AddonContext` structurally - the SDK is not a dependency |
| `src/contract.ts` | Data contract (schema 1): `readStore` reads `xray:index` and every part of its generation, checks each fund's `sha256`, reads the index once more when a fund is caught mid-write |
| `src/xray.ts` | 1:1 port of the service's `xray.py` (`exposures`, `overlap`, `ownShare`, `effectiveCount`, `plain`, `unify`, `findings`); doubles, `EPS` where a decimal would be exactly zero |
| `src/depot.ts` | Positions per asset over all accounts (`marketValue.base`), cash per account, alternative assets left out; holdings for X-Ray like `lookthrough.holdings` |
| `src/model.ts` / `src/matrix.ts` | Everything the page shows, pure (`compute`); the matrix like the service's `_matrix` |
| `src/settings.ts` | The user's limits and accepted risks under `addon:settings` - the only key this addon writes |
| `src/i18n.ts` | German text is the key, `EN` its English text; the language from `<html lang>` (set by the sandbox) |
| `src/XRayPage.tsx` | Display only; folded cards (`<details>`), tables with caption/`scope`/`data-label` |
| `src/addon.css` | Wealthfolio's theme variables first (`--background`, `--card`, …), Flexoki fallbacks (AA in light and dark) |
| `src/demo.ts`, `src/main.tsx`, `index.html` | Harness page with fabricated data for the browser test and `pnpm dev`; not in the addon |
| `contract/xray/` | Copy of the service's contract (README, `cases.json`); CI job `contract` diffs it against the service's `main` |

## Rules (keep them)

- **No network**: the manifest has no `network` permission and the code makes no request; nothing but the host's API.
- **Writes nothing into Wealthfolio** but `addon:settings` in its own storage; never a key of the service (`xray:`).
- **Same numbers as the service**: a change to the computation starts in the service's `xray.py`; `contract/xray/`
  is copied from there and `src/xray.test.ts` must stay green. Nothing guessed: what weights leave open stays
  "nicht zugeordnet", an unknown TER stays unknown.
- **Versions follow Wealthfolio**: `major.minor` = the Wealthfolio line (`sdkVersion`, `minWealthfolioVersion`),
  the patch counts our releases; version in `manifest.json` and `package.json` with a `CHANGELOG.md` section
  `## <version>`. The release workflow publishes when the tag is missing.
- Quality-kit rules: `tsc` strict, ESLint without warnings (jsx-a11y), coverage ≥ 90 %, axe on every component test
  and in `e2e/ui.spec.ts` (every state in `e2e/pages.ts`, light and dark, phone and desktop), no inline styles,
  performance only reported (`e2e/report.perf.ts`, KENNZAHLEN.md), dependencies only from the lockfile and ≥ 7 days
  old, Actions pinned to SHAs, test data fabricated, secrets never in the repo.
- Questions to the owner go as a clickable list (the question tool), never as free text.
