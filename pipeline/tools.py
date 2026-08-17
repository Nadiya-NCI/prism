import urllib.request
import json
import csv
import io

COINGECKO_MARKETS = (
    "https://api.coingecko.com/api/v3/coins/markets?"
    "vs_currency=eur&order=market_cap_desc&per_page=10&page=1&sparkline=false"
)
SENTIMENT_URL = "https://api.alternative.me/fng/?limit=1"
FX_URL = "https://open.er-api.com/v6/latest/EUR"
SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzByO3olSeexgzkXz8XC6U9TYaRRi98NK4SdCBRLuorHIBwu6ZXTD0DOf0C9ZiACrck2r4p9tePX8s/pub?output=csv"


def _get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "PrismAgent/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _get_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "PrismAgent/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def get_live_market():
    data = _get_json(COINGECKO_MARKETS)
    rows = [
        {
            "name": c["name"],
            "symbol": c["symbol"].upper(),
            "price_eur": round(c["current_price"], 4),
            "change_24h_pct": round(c["price_change_percentage_24h"] or 0, 2),
            "market_cap_eur": c["market_cap"],
            "volume_24h_eur": c["total_volume"],
        }
        for c in data
    ]
    return {"fetched_at": str(__import__("datetime").datetime.utcnow()), "top_10_by_cap": rows}


def get_market_sentiment():
    data = _get_json(SENTIMENT_URL)
    v = data.get("data", [{}])[0]
    return {
        "fetched_at": str(__import__("datetime").datetime.utcnow()),
        "fear_greed_index": v.get("value"),
        "classification": v.get("value_classification"),
    }


def get_exchange_rate():
    data = _get_json(FX_URL)
    rates = data.get("rates", {})
    return {
        "fetched_at": str(__import__("datetime").datetime.utcnow()),
        "base": data.get("base_code"),
        "rates": {"USD": rates.get("USD"), "GBP": rates.get("GBP")},
        "last_update_utc": data.get("time_last_update_utc"),
    }


def get_portfolio_sheet():
    if "REPLACE_WITH" in SHEET_CSV_URL:
        return {"error": "Sheet CSV URL not configured in pipeline/tools.py"}
    raw = _get_text(SHEET_CSV_URL)
    rows = list(csv.reader(io.StringIO(raw)))
    header_idx = 0
    for i, r in enumerate(rows):
        lowered = [h.strip().lower() for h in r]
        if "symbol" in lowered and "asset" in lowered:
            header_idx = i
            break
    header = [h.strip().lower() for h in rows[header_idx]]
    records = []
    for r in rows[header_idx + 1:]:
        if not any(c.strip() for c in r):
            continue
        o = {}
        for i, h in enumerate(header):
            o[h] = r[i].strip() if i < len(r) else ""
        records.append(o)
    return {"fetched_at": str(__import__("datetime").datetime.utcnow()), "watchlist": records}


LIVE_TOOLS = {
    "get_live_market": {
        "description": "Fetch the current top-10 cryptocurrencies by market cap with live EUR price, 24h change, market cap and volume. Uses the live CoinGecko API.",
        "fn": get_live_market,
        "input_schema": {"type": "object", "properties": {}},
    },
    "get_market_sentiment": {
        "description": "Fetch the live crypto fear & greed index (00-100) and its classification. Uses the live Alternative.me API.",
        "fn": get_market_sentiment,
        "input_schema": {"type": "object", "properties": {}},
    },
    "get_exchange_rate": {
        "description": "Fetch the latest EUR-based exchange rates from the open, keyless ExchangeRate-API v6 endpoint (daily-updated ECB-derived rates).",
        "fn": get_exchange_rate,
        "input_schema": {"type": "object", "properties": {}},
    },
    "get_portfolio_sheet": {
        "description": "Read the user's live portfolio watchlist from a published Google Sheet (published-to-web CSV). Columns: symbol, asset, allocation, cost_basis_eur, note.",
        "fn": get_portfolio_sheet,
        "input_schema": {"type": "object", "properties": {}},
    },
}