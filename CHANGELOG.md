# Changelog

## 3.11.1

- Fix: works inside Wealthfolio's addon sandbox. The funds' checksums are computed without `crypto.subtle`, which the sandbox iframe doesn't have ("Cannot read properties of undefined (reading 'digest')").

## 3.11.0

- First release: X-Ray inside Wealthfolio. One page shows key figures, every stock across all positions (top 10 … all) with what each of the four largest ETFs adds, the overlap of the ETFs as a heatmap, each ETF with its largest lines, TER and own contribution, and the cluster risks with their limits ("Bewusst so" takes one out).
- Reads the funds' lists the broker sync service (0.45.0 or later, service *X-Ray in Wealthfolio*) stores in the addon's storage, and the positions' values from Wealthfolio. No network, writes nothing into Wealthfolio but its own settings.
- Computes exactly what the service computes (shared cases in `contract/xray/`).
