# SOLUTION CONCEPT — Maya Möbius, HEAD OF PRODUCT DESIGN
Input: Researcher's brief (H1–H3; live Fear 34; portfolio ≈ −61% vs cost). My watchlist input read LIVE from the Google Sheet.

## 1. Target persona
**"Denis, 34, long-term holder, currently underwater."** Bought BTC/ETH in 2024 near the top, now wants to know whether to hold, trim or rebalance — but distrusts hype youtube and exchange pop-ups. He will never read a 40-page report. He *will* ask a copilot one nervous question and expect a sourced, plain answer.

## 2. Core user journey
1. Landing → live market table renders instantly (proof of wakefulness) with per-figure fetch timestamps.
2. Watchlist card → live valuation of *his* sheet vs book cost ("−61%") — the honest mirror that earns trust.
3. Mood chip → "Fear 34" framed: *what it implies, not what to do*.
4. Ask the copilot a question → grounded answer citing only his displayed live data; never advice.
5. Revisit later → data refreshes every 2 minutes; page is a living instrument, not a static board.

## 3. Feature specification (must-build, v0)
- **F1 Live market table** — top-10 by cap, EUR price, 24h%, mcap, volume; refresh on load + every 120s; timestamps per card.
- **F2 Live watchlist valuation** — reads the published sheet CSV at runtime; computes current value vs cost-basis delta.
- **F3 Mood/context chip** — live sentiment classification with plain-language explanation.
- **F4 Copilot chat** — answers grounded in F1+F2 snapshot; system-prompt enforced research-only boundary; disclaimer visible.
- **F5 Integrity footer** — states the organisation, the pipeline order, that data is fetched live, and that no keys are committed.

## 4. Success metrics
- Time-to-first-render < 3 s; live timestamps visibly updating = "alive" signal.
- ≥ 1 successful live watchlist valuation per session (not a fallback/zero).
- Copilot never issues an instruction ("buy/sell") — audited in transcripts.

## 5. Constraints for the Maker
- Static site only (GitHub Pages) — all dynamic work in browser JS; no backend server for data.
- Data connections live in code (CoinGecko fetch, Google Sheets published-CSV fetch) — zero hardcoded values, zero credentials client-side.
- Chat routed via Cloudflare Worker (key server-side; never in the page or repo).
- Fail gracefully: on network error, show the error in the status pill, never fake data.

<HANDOFF_TO_MAKER_PREPARED>