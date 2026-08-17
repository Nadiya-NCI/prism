import os
import pathlib
import sys
import docx
from docx.shared import Pt

SRC = r"C:\Users\Probook\NCIRL 2025-2026\NCIRL CEAI\CA 3\x25128442_PGDAIBUS_Sydorenko_Nadiya_CEAI_CA3.docx"
DST = r"C:\Users\Probook\NCIRL 2025-2026\NCIRL CEAI\CA 3\x25128442_PGDAIBUS_Sydorenko_Nadiya_CEAI_CA3.docx"

from docx.oxml.ns import qn
from docx.oxml import OxmlElement

repo = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo))
from pipeline.agent_prompts import AGENTS


def set_para_text(p, text):
    for child in list(p._element):
        if child.tag != qn("w:pPr"):
            p._element.remove(child)
    p.add_run(text)


doc = docx.Document(SRC)

for tb in list(doc.tables):
    flat = " ".join(c.text for row in tb.rows for c in row.cells)
    if "Consumed by" in flat:
        tb._tbl.getparent().remove(tb._tbl)

paras = list(doc.paragraphs)
delete_from = None
for i, p in enumerate(paras):
    if p.style.name == "Heading 1" and p.text.strip().startswith("Introduction"):
        delete_from = i
        break

for p in paras[delete_from:]:
    p._element.getparent().remove(p._element)


def add(text, style="Normal", bold=None):
    p = doc.add_paragraph()
    p.style = doc.styles[style]
    r = p.add_run(text)
    if bold is not None:
        r.bold = bold
    return p


def add_heading(text):
    add(text, "Heading 1")


def add_subheading(text):
    add(text, "Heading 2")


def _boxed(p):
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    for edge in ("top", "left", "bottom", "right"):
        e = OxmlElement("w:" + edge)
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), "8")
        e.set(qn("w:space"), "4")
        e.set(qn("w:color"), "6C7CFF")
        pBdr.append(e)
    pPr.append(pBdr)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), "EDEFFF")
    pPr.append(shd)


def add_fig(n, title, what):
    p = doc.add_paragraph()
    _boxed(p)
    r = p.add_run("[ INSERT FIGURE " + str(n) + " HERE ]")
    r.bold = True
    p.add_run("\n" + title)
    cap = doc.add_paragraph()
    cr = cap.add_run("Figure " + str(n) + ". " + title + ". " + what)
    cr.italic = True


def add_table(header, rows):
    t = doc.add_table(rows=len(rows) + 1, cols=len(header))
    t.style = doc.styles["Table Grid"]
    for j, h in enumerate(header):
        t.rows[0].cells[j].text = h
    for i, row in enumerate(rows):
        for j, v in enumerate(row):
            t.rows[i + 1].cells[j].text = v
    doc.add_paragraph()
    return t


add_heading("Introduction")
add(
    "This report documents the design, build and live demonstration of Prism, a fully agentic organisation "
    "of five specialised AI agents serving retail crypto investors with trustworthy, live-sourced research. "
    "Each agent embodies one archetype \u2014 Researcher, Designer, Maker, Communicator, Manager \u2014 and hands its "
    "full output to the next in a fixed pipeline, producing an opportunity brief, a product concept, a GitHub "
    "Pages prototype, a go-to-market plan and an executive summary. Researcher, Designer, Maker and Manager "
    "execute live tool calls against CoinGecko, a user-owned Google Sheet, Alternative.me and the open "
    "ExchangeRate-API, and no API key is committed anywhere."
)

add_heading("1. Your Organisation")
add(
    "Prism is a fictional, AI-native venture serving retail-investor archetypes who bought digital assets "
    "near market peaks, are underwater, and distrust hype. Its challenge is engagement in a fear-driven "
    "market: attracting anxious investors, engaging them with evidence, and retaining them through honesty. "
    "Live data observed during the run \u2014 a watchlist portfolio at roughly \u221261% versus book cost, Fear & Greed "
    "at 34 \u2014 is exactly the anxiety this organisation addresses."
)
add(
    "The challenge suits an agentic approach because no single agent could research markets, design, build, "
    "write and govern at once. The pipeline is cumulative: each stage ingests the previous deliverable in "
    "full, so the output exceeds what one agent could produce alone. A research copilot is only as "
    "trustworthy as the freshness it can display in real time."
)

add_heading("2. Agent Designs")
add(
    "Members intervene in order; each has a distinct system prompt, personality and live-data tools. The "
    "exact prompts below are reproduced verbatim from pipeline/agent_prompts.py."
)

agents_meta = [
    (
        "2.1 Vera Vector — Researcher (archetype: deep analyst)",
        "Rigorous, numbers-first, mildly sceptical. Tools: get_live_market (CoinGecko), get_market_sentiment "
        "(Alternative.me), get_exchange_rate (ExchangeRate-API), get_portfolio_sheet (live Google Sheet). "
        "Produces a research brief.",
    ),
    (
        "2.2 Maya M\u00f6bius — Designer (archetype: creative strategist)",
        "Imaginative, user-obsessed, allergic to clutter. Tool: get_portfolio_sheet. Produces a solution "
        "concept with persona, journey, feature spec and constraints.",
    ),
    (
        "2.3 Code Flint — Maker (archetype: craftsman)",
        "Pragmatic, allergic to scope creep; claims only what the build proves. Tools: get_portfolio_sheet, "
        "get_market_sentiment. Produces a build report plus product_spec.json, consumed by the deployed site.",
    ),
    (
        "2.4 Riley Rhetoric — Communicator (archetype: storyteller)",
        "Magnetic storyteller; refuses hype. Tool: get_market_sentiment. Produces positioning, campaign "
        "concept, drafted copy and compliance guardrails.",
    ),
    (
        "2.5 Atlas — Manager (archetype: orchestrator)",
        "Calm, accountable, synthesis-oriented. Tools: get_portfolio_sheet, get_live_market, "
        "get_exchange_rate, re-fetched at review. Produces an executive summary, risk register and a final "
        "decision tag.",
    ),
]

for (title, desc), agent in zip(agents_meta, AGENTS):
    add(title, "Normal", bold=True)
    add(desc)
    add("System prompt (verbatim): " + agent["system"])

add(
    "Differentiation: the five agents differ in temperament, skill, allowed tools and output format, so each "
    "works unlike the others despite sharing one codebase."
)

add_heading("3. The Pipeline in Action")
add(
    "Each stage receives the previous stage's full output as its input (PREVIOUS STAGE OUTPUT) and adds its "
    "own layer; deliverables accumulate into one decision-ready package. Evidence, 16/08/2026 23:06 UTC "
    "(output/free-run/ and transcript.json):"
)
add(
    "The Researcher tool-called CoinGecko, Alternative.me, the ExchangeRate-API and the live watchlist "
    "(get_portfolio_sheet), grounding the \u221261% position, and produced the brief. The Designer tool-called the "
    "sheet and produced the concept; the Maker tool-called the sheet and sentiment, then shipped the site "
    "(market table, watchlist valuation, mood chip, chat) and committed product_spec.json. The Communicator "
    "tool-called sentiment and drafted the 'See Clearly' campaign. The Manager re-fetched CoinGecko, the "
    "sheet and FX, independently confirmed \u221261%, and issued the summary with APPROVED."
)
add(
    "Cumulative output: a research brief \u2192 a concept \u2192 a deployed working prototype \u2192 a go-to-market "
    "plan \u2192 an executive summary. No single agent could have produced the deployed, marketed, governed "
    "organisation alone. The screenshots below show each stage's actual output; the prototype URL is in "
    "Section 6 and the chat worker at https://prism.n-sydorenko-mail.workers.dev."
)

add_subheading("3.1 Stage handoff evidence")
add_fig(
    1,
    "Stage 1 — Research brief (Vera Vector)",
    "live top-10 prices, Fear & Greed 34, FX and the \u221261% watchlist position read via get_portfolio_sheet "
    "(01_researcher.md).",
)
add_fig(
    2,
    "Stage 2 — Solution concept (Maya M\u00f6bius)",
    "the 'Denis' persona from the \u221261% finding, the user journey and feature spec F1-F5 (02_designer.md).",
)
add_fig(
    3,
    "Stage 3 — Build report (Code Flint)",
    "tech stack, feature-to-build mapping, live connections, product_spec.json and test evidence "
    "(03_maker.md).",
)
add_fig(
    4,
    "Stage 4 — Go-to-market plan (Riley Rhetoric)",
    "the 'See Clearly' campaign, three-channel rollout and compliance guardrails (04_communicator.md).",
)
add_fig(
    5,
    "Stage 5 — Executive summary (Atlas)",
    "alignment review, KPIs, risk register, four-week plan and the APPROVED decision (05_manager.md).",
)
add_fig(
    6,
    "Live tool-call transcript",
    "timestamped tool_calls per stage proving every agent queried live sources (transcript.json).",
)

add_subheading("3.2 Handoff traceability")
add(
    "Each stage's deliverable, live tools and onward handoff are summarised below; full texts are in "
    "output/free-run/."
)
add_table(
    ["Stage", "Input from", "Live tools called", "Deliverable", "Consumed by"],
    [
        ["Researcher", "\u2014 (first)", "market, sentiment, FX, sheet", "Research brief", "Designer"],
        ["Designer", "Research brief", "sheet", "Concept (F1-F5)", "Maker"],
        ["Maker", "Concept", "sheet, sentiment", "Build report + product_spec.json + site", "Communicator"],
        ["Communicator", "Build report", "sentiment", "Go-to-market plan", "Manager"],
        ["Manager", "all four", "sheet, market, FX", "Executive summary + APPROVED", "Submission"],
    ],
)

add_subheading("3.3 The working prototype")
add(
    "The prototype is live at https://nadiya-nci.github.io/prism/ (no login). Data refreshes on load and "
    "every two minutes; every card carries fetch timestamps."
)
add_fig(
    7,
    "Live site, full page (top)",
    "hero, price ticker, mood and portfolio cards with timestamps, and the market table with logos and "
    "sparklines.",
)
add_fig(
    8,
    "Live watchlist valuation",
    "holdings card computing current value vs cost basis live from the published Google Sheet (~\u221261%).",
)
add_fig(
    9,
    "Live chat interaction",
    "a grounded question and answer showing the research-not-advice boundary, served via the Cloudflare Worker.",
)

add_heading("4. Regulatory and Ethical Considerations")
add(
    "Data privacy. Prism runs no accounts and collects no personal data: the watchlist is the user's own "
    "Google Sheet, read from a published CSV on each fetch and never stored, and chat input travels only to "
    "the worker and model provider for one response. This honours GDPR minimisation (Article 5(1)(c)) and "
    "storage limitation (5(1)(e)); production would add a lawful basis and a data-processing agreement with "
    "the provider."
)
add(
    "EU AI Act. High-risk status under Regulation (EU) 2024/1689 follows Article 6 read with Annex III; "
    "point 5 of Annex III covers creditworthiness assessment for lending and insurance, not general financial "
    "research, so research support as described is unlikely to be high-risk, subject to legal review. Prism "
    "still applies Article 50 transparency: AI responses are disclosed, every figure carries its source and "
    "timestamp, and the interface states the user is chatting with an AI."
)
add(
    "Advice boundary and trust. System prompts ban instruction verbs such as buy/sell and every footer "
    "repeats research-not-advice. Data freshness is engineered, not assumed: figures are fetched live with "
    "timestamps and failures surface in status pills; credentials live only in a serverless secret store."
)

add_heading("5. Reflection")
add(
    "Overall this worked better than expected. The pipeline behaved like an organisation: the Researcher read "
    "the watchlist and live prices, identified the \u221261% opportunity, and that finding survived the whole "
    "chain; the Manager independently confirmed it and issued APPROVED. That cumulative consistency convinced "
    "me the handoff model works \u2014 and is why I added an explicit decision tag: the last stage became a "
    "go/no-go gate, not a summary."
)
add(
    "Plenty went wrong, and fixing it taught me more than what went right. The first FX source returned HTTP "
    "522 repeatedly, so I switched to a reliable open API; the failure stays visible in git. The chat broke "
    "with a 'not found' error traced to the client posting the wrong URL, which I fixed and verified live. "
    "Renaming CryptoNova to Prism showed how quickly a name change ripples through prompts, files and reports."
)
add(
    "The biggest surprise was how much the personas shaped output: different system prompts produced "
    "genuinely different voices on one codebase. The trade-off was equally clear \u2014 five sequential calls add "
    "latency and cost, so the pipeline suits a report cadence while real-time chat stays a single-agent "
    "copilot. I would keep the pipeline narrow: the Manager's re-verification earns its cost, but a sixth "
    "strategy agent would not."
)
add(
    "Given more time, I would rerun on another day to show live figures moving, add short-term memory to "
    "chat, and make the news feed resilient to outages."
)

add_heading("Conclusion")
add(
    "The project set out to build an agentic organisation, not describe one. Five agents, each with its own "
    "prompt, personality and live-data tools, worked in a fixed pipeline and produced a brief, a concept, a "
    "deployed prototype, a go-to-market plan and an executive summary. Every stage queried live data at the "
    "moment of use, no credential was committed, and the prototype stays reachable on GitHub Pages. The "
    "clearest proof of the handoff chain is cumulative: the \u221261% finding survived design, build and marketing "
    "and was re-confirmed in the Manager's final decision."
)

add_heading("6. Artefacts and Availability")
add(
    "Live prototype: https://nadiya-nci.github.io/prism/ (no login). Source: "
    "https://github.com/Nadiya-NCI/prism. Chat worker: https://prism.n-sydorenko-mail.workers.dev, API key "
    "server-side. The demo watchlist is a Google Sheet read live via published CSV, so a reviewer can edit "
    "holdings and watch the valuation recompute. Pages, repository and sheet remain reachable for at least "
    "eight weeks after submission."
)

add_heading("References")
add(
    "AI usage and attribution. The pipeline (pipeline/) ran on a free opencode assistant model on 16/08/2026 "
    "(output/free-run/transcript.json), with prompts in pipeline/agent_prompts.py reproduced verbatim in "
    "Section 2. The chat copilot calls Claude (claude-sonnet-4-5) via a Cloudflare Worker, key server-side. "
    "This report was drafted with assistance, then reviewed and edited by the author before submission."
)
add(
    "European Parliament and Council. (2016) Regulation (EU) 2016/679 (General Data Protection Regulation). "
    "OJ L 119, 4.5.2016."
)
add(
    "European Union. (2024) Regulation (EU) 2024/1689 (Artificial Intelligence Act). OJ L, 12.7.2024. "
    "Articles 6 and 50; Annex III (high-risk list)."
)
add(
    "Anthropic. (2026) Claude Sonnet model family: Messages API and tool calling. "
    "https://docs.anthropic.com (Accessed 16 August 2026)."
)
add(
    "CoinGecko. (2026) Public API \u2014 /coins/markets. https://www.coingecko.com/en/api (Accessed 16 August 2026)."
)
add(
    "Alternative.me. (2026) Crypto Fear & Greed Index API. https://alternative.me/crypto/fear-and-greed-index/ "
    "(Accessed 16 August 2026)."
)
add(
    "ExchangeRate-API. (2026) Open endpoint, latest EUR rates (daily-updated). https://open.er-api.com/v6/latest/EUR "
    "(Accessed 16 August 2026)."
)

doc.save(DST)

body = doc.element.body
words = 0
in_body = False
for p in doc.paragraphs:
    t = p.text.strip()
    if p.style.name == "Heading 1" and t.startswith("Introduction"):
        in_body = True
    if in_body and t:
        words += len(t.split())
seen = False
for child in body:
    if child.tag == qn("w:p"):
        p = docx.text.paragraph.Paragraph(child, doc)
        if p.style.name == "Heading 1" and p.text.strip().startswith("Introduction"):
            seen = True
    elif seen and child.tag == qn("w:tbl"):
        for row in docx.table.Table(child, doc).rows:
            for cell in row.cells:
                words += len(cell.text.split())
print("saved:", DST, os.path.getsize(DST), "bytes")
print("body word count (incl. captions, tables; from Introduction):", words)