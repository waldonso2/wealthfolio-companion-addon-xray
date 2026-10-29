# PLATZHALTER: Projektname

PLATZHALTER: was das Projekt macht, in zwei Sätzen.

Aus der Vorlage [`template-ts-react`](https://github.com/waldonso2/template-ts-react) des
[quality-kit](https://github.com/waldonso2/quality-kit): Sicherheit, Barrierefreiheit und Leistung werden in der CI
geprüft, die Kennzahlen stehen in [`KENNZAHLEN.md`](KENNZAHLEN.md).

## Nach „Use this template“ ersetzen

- [ ] `PLATZHALTER` in `README.md`, `CLAUDE.md`, `KENNZAHLEN.md`; `name` in `package.json`, `<title>` in `index.html`
- [ ] die Beispiel-Logik (`src/words.ts`) und die Startseite (`src/App.tsx`)
- [ ] der Produktionsserver sendet die Header aus `vite.config.ts` (`SECURITY_HEADERS`)
- [ ] die Einstellungen aus [`SETUP.md`](https://github.com/waldonso2/quality-kit/blob/main/SETUP.md) setzen

## Entwickeln

```bash
pnpm install
pnpm dev                                  # Entwicklungsserver
pnpm type-check && pnpm lint && pnpm test:coverage
pnpm build && pnpm exec playwright install chromium && pnpm test:ui   # jede Seite im Browser
pnpm perf                                 # Performance-Bericht (perf-report.md), nach pnpm build
```
