import argparse
import json
import os
import sys
from datetime import datetime

from anthropic import Anthropic

from agent_prompts import AGENTS, PIPELINE_ORDER, PREVIOUS_STAGE_LABEL
from tools import LIVE_TOOLS

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
TOOLS_PER_AGENT = {
    "Researcher": ["get_live_market", "get_market_sentiment", "get_exchange_rate"],
    "Designer": ["get_portfolio_sheet"],
    "Maker": ["get_portfolio_sheet", "get_market_sentiment"],
    "Communicator": ["get_market_sentiment"],
    "Manager": ["get_portfolio_sheet", "get_live_market", "get_exchange_rate"],
}


def api_key():
    k = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not k:
        k = input("ANTHROPIC_API_KEY: ").strip()
    if not k:
        sys.exit("No Anthropic API key provided.")
    return k


def run_agent(client, agent, prev_output, run_id):
    persona = agent["system"]
    role = agent["role"]
    stage_idx = PIPELINE_ORDER.index(role)
    context = (
        "You are working in the Prism agentic organisation. "
        f"This is stage {stage_idx + 1} of 5: {role}.\n\n"
    )
    if prev_output:
        context += PREVIOUS_STAGE_LABEL + "\n" + prev_output + "\n\n"
    else:
        context += (
            "You are the FIRST agent. There is no previous output yet. "
            "Begin your work now from your live tool calls.\n\n"
        )
    context += "Produce your deliverable now, complete and in the format your role requires."

    tools = [
        {
            "name": name,
            "description": LIVE_TOOLS[name]["description"],
            "input_schema": LIVE_TOOLS[name]["input_schema"],
        }
        for name in TOOLS_PER_AGENT[role]
    ]
    messages = [{"role": "user", "content": context}]
    tool_log = []
    final_text = ""

    while True:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=8000,
            system=persona,
            messages=messages,
            tools=tools,
            tool_choice={"type": "auto"},
        )
        messages.append({"role": "assistant", "content": resp.content})
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            final_text = "".join(
                b.text for b in resp.content if b.type == "text"
            ).strip()
            break
        results = []
        for tu in tool_uses:
            try:
                result = LIVE_TOOLS[tu.name]["fn"]()
            except Exception as exc:
                result = {"error": str(exc)}
            tool_log.append(
                {
                    "tool": tu.name,
                    "input": tu.input,
                    "result": result,
                    "time": datetime.utcnow().isoformat(),
                }
            )
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result, default=str),
                }
            )
        messages.append({"role": "user", "content": results})

    return final_text, tool_log, messages


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="output")
    parser.add_argument("--run-label", default=datetime.now().strftime("%Y%m%d-%H%M"))
    args = parser.parse_args()

    outdir = os.path.join(args.out, args.run_label)
    os.makedirs(outdir, exist_ok=True)

    client = Anthropic(api_key=api_key())
    transcript = {"model": MODEL, "run": args.run_label, "stages": []}
    prev_output = None

    for agent in AGENTS:
        role = agent["role"]
        print(f"\n=== {role.upper()} — {agent['name']} ===", flush=True)
        final, tool_log, messages = run_agent(client, agent, prev_output, args.run_label)

        safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in role.lower())
        with open(os.path.join(outdir, f"{PIPELINE_ORDER.index(role) + 1}_{safe}.md"), "w", encoding="utf-8") as f:
            f.write(final + "\n")

        transcript["stages"].append(
            {
                "role": role,
                "agent": agent["name"],
                "tool_calls": tool_log,
                "output": final,
            }
        )
        print(f"tool calls: {[t['tool'] for t in tool_log]}")
        print(f"output chars: {len(final)}")
        prev_output = final

        with open(os.path.join(outdir, "transcript.json"), "w", encoding="utf-8") as f:
            json.dump(transcript, f, indent=2, default=str)

    print("\nPipeline complete. Outputs in", outdir)


if __name__ == "__main__":
    main()