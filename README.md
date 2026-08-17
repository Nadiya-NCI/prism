# Prism — Agentic Crypto Research Copilot

A fully agentic organisation of five specialised AI agents serving retail crypto investors.

Pipeline: **Researcher → Designer → Maker → Communicator → Manager**

## Repository layout

| Path | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | GitHub Pages front end (static, repo root). Live CoinGecko fetch, live Google Sheet watchlist, chat UI. |
| `worker/` | Cloudflare Worker. Holds the Anthropic API key as a serverless secret; proxies chat calls; adds CORS. |
| `pipeline/` | Orchestration of the five Claude agents with live tool calls. Produces the handoff artifacts. |
| `output/` | Captured pipeline runs with transcripts (input, tool calls, output per stage). Safe to commit — no credentials. |

## Live data sources (all queried at runtime, no hardcoded values)

- CoinGecko (top-10 market snapshot, EUR) — keyless public API
- Google Sheets published-to-web CSV (user watchlist) — fetched live, keyless
- Alternative.me Fear & Greed index — keyless public API
- Frankfurter / ECB exchange rates — keyless public API

## Security model

- No secret or API key is committed. 
- The Anthropic key lives in `ANTHROPIC_API_KEY` (Cloudflare secret binding) and, on your machine, in the environment variable — never in repo files.
- `wrangler secret put ANTHROPIC_API_KEY` stores it server-side.

## Run the pipeline (needs your Claude key)

```
set ANTHROPIC_API_KEY=sk-ant-...
python pipeline\run_pipeline.py --run-label run1
```

Outputs are written to `output\run1\` (one markdown deliverable per agent + `transcript.json`).

## Deploy the worker

```
cd worker
wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

Copy the printed `https://prism.<subdomain>.workers.dev` URL into `site/app.js` (`WORKER_URL`).

## Publish the site

Push `site/` (or the whole repo) to GitHub, enable Pages, and set `Nadiya-NCI.github.io/prism`.