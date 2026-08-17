import json
import pathlib

out = pathlib.Path("output/free-run")
stages = [
    ("Researcher", "Vera Vector", ["get_live_market", "get_market_sentiment", "get_exchange_rate"], "01_researcher.md"),
    ("Designer", "Maya Mobius", ["get_portfolio_sheet"], "02_designer.md"),
    ("Maker", "Code Flint", ["get_portfolio_sheet", "get_market_sentiment"], "03_maker.md"),
    ("Communicator", "Riley Rhetoric", ["get_market_sentiment"], "04_communicator.md"),
    ("Manager", "Atlas", ["get_portfolio_sheet", "get_live_market", "get_exchange_rate"], "05_manager.md"),
]
rec = [
    {"role": r, "agent": a, "tool_calls": t, "output": (out / f).read_text(encoding="utf-8")}
    for r, a, t, f in stages
]
doc = {
    "mode": "free-run",
    "model": "opencode assistant (free; Anthropic key reserved for the Chat Copilot only)",
    "fetched_utc": "2026-08-16 23:06",
    "stages": rec,
}
(out / "transcript.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
print("stages:", len(rec), "size:", (out / "transcript.json").stat().st_size)