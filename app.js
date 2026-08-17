const SHEET_CSV_URL = "REPLACE_WITH_YOUR_PUBLISHED_GOOGLE_SHEET_CSV_LINK";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=10&page=1&sparkline=false";
const WORKER_URL = "https://prism.n-sydorenko-mail.workers.dev";

const $ = (id) => document.getElementById(id);
let marketData = [];
let watchlist = [];
let liveSnapshot = "";

function fmtEUR(n) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}
function fmtBig(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  return n.toFixed(0);
}
function now() {
  return new Date().toLocaleTimeString();
}

function setPill(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.className = "pill" + (ok ? " ok" : " err");
}

async function fetchCoinGecko() {
  const res = await fetch(COINGECKO_URL);
  if (!res.ok) throw new Error("CoinGecko HTTP " + res.status);
  return res.json();
}

async function fetchWatchlist() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Sheets HTTP " + res.status);
  return res.text();
}

function parseCSV(text) {
  const rows = [];
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function renderTable() {
  $("coin-rows").innerHTML = marketData.map((c, i) => {
    const ch = c.price_change_percentage_24h ?? 0;
    const cls = ch >= 0 ? "up" : "down";
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${c.name}</strong> <span class="muted">${c.symbol.toUpperCase()}</span></td>
      <td>${fmtEUR(c.current_price)}</td>
      <td class="${cls}">${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%</td>
      <td>€${fmtBig(c.market_cap)}</td>
      <td>€${fmtBig(c.total_volume)}</td>
    </tr>`;
  }).join("");
}

function renderMood() {
  const chs = marketData.map((c) => c.price_change_percentage_24h ?? 0);
  const avg = chs.reduce((a, b) => a + b, 0) / (chs.length || 1);
  const el = $("mood");
  el.className = "big-number " + (avg >= 0 ? "up" : "down");
  el.textContent = (avg >= 0 ? "+" : "") + avg.toFixed(2) + "%";
  $("mood-sub").textContent = avg >= 0 ? "risk-on tone across the top 10" : "risk-off tone across the top 10";
  $("mood-fetched").textContent = now();
}

function renderPortfolio() {
  let cost = 0, value = 0;
  for (const w of watchlist) {
    const alloc = parseFloat(w.allocation || 0);
    const basis = parseFloat(w.cost_basis_eur || 0);
    const live = marketData.find((c) => c.symbol.toLowerCase() === String(w.symbol).toLowerCase());
    cost += basis;
    value += live ? live.current_price * alloc : basis;
  }
  const gainPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
  const el = $("portfolio-gain");
  el.className = "big-number " + (gainPct >= 0 ? "up" : "down");
  el.textContent = (gainPct >= 0 ? "+" : "") + gainPct.toFixed(2) + "%  (€" + fmtEUR(value) + " vs €" + fmtEUR(cost) + ")";
  $("portfolio-sub").textContent = "assumes holdings of the numeric values in the watchlist sheet";
  $("sheet-fetched").textContent = now();
}

function buildSnapshot() {
  const top = marketData.slice(0, 5)
    .map((c) => `${c.name} (${c.symbol.toUpperCase()}): €${c.current_price}, 24h ${(c.price_change_percentage_24h ?? 0).toFixed(2)}%`)
    .join("\n");
  const folio = watchlist
    .map((w) => `${w.symbol}: allocation ${w.allocation}, cost basis €${w.cost_basis_eur}, note "${w.note || ""}"`)
    .join("\n");
  liveSnapshot = `LIVE MARKET SNAPSHOT (fetched ${new Date().toISOString()}):\n${top}\n\nUSER WATCHLIST (live from Google Sheets):\n${folio || "(empty watchlist)"}\n\nAnswer in plain text, max 180 words. If asked for financial advice, say you provide research support only.`;
}

async function refreshData() {
  try {
    const cg = await fetchCoinGecko();
    marketData = Array.isArray(cg) ? cg : [];
    renderTable();
    setPill("coingecko-status", "CoinGecko ✓ " + now(), true);
  } catch (e) {
    setPill("coingecko-status", "CoinGecko: " + e.message, false);
  }

  try {
    if (SHEET_CSV_URL.indexOf("REPLACE_WITH") === -1) {
      const csv = await fetchWatchlist();
      const rows = parseCSV(csv);
      let hi = 0;
      for (let i = 0; i < rows.length; i++) {
        const l = rows[i].map((h) => h.trim().toLowerCase());
        if (l.indexOf("symbol") !== -1 && l.indexOf("asset") !== -1) { hi = i; break; }
      }
      const header = rows[hi].map((h) => h.trim().toLowerCase());
      watchlist = rows.slice(hi + 1).filter((r) => r.join("").trim() !== "").map((r) => {
        const o = {};
        header.forEach((h, i) => { o[h] = r[i] ? r[i].trim() : ""; });
        return o;
      });
      setPill("sheet-status", "Watchlist ✓ " + watchlist.length + " rows", true);
    } else {
      setPill("sheet-status", "watchlist: set your sheet URL in app.js", false);
    }
  } catch (e) {
    setPill("sheet-status", "watchlist: " + e.message, false);
  }

  renderMood();
  renderPortfolio();
  buildSnapshot();
}

function addMsg(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  d.textContent = text;
  $("chat-log").appendChild(d);
  $("chat-log").scrollTop = $("chat-log").scrollHeight;
}

$("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("chat-input").value.trim();
  if (!q) return;
  $("chat-input").value = "";
  addMsg("user", q);
  if (!marketData.length) await refreshData();
  addMsg("ai", "Thinking…");

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, snapshot: liveSnapshot })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Worker HTTP " + res.status);
    const last = $("chat-log").lastChild;
    if (last && last.textContent === "Thinking…") last.remove();
    addMsg("ai", data.text || "[empty response]");
  } catch (err) {
    const last = $("chat-log").lastChild;
    if (last && last.textContent === "Thinking…") last.remove();
    addMsg("ai", "Error: " + err.message);
  }
});

$("client-time").textContent = "local: " + now();
setInterval(() => { $("client-time").textContent = "local: " + now(); }, 30000);
refreshData();
setInterval(refreshData, 120000);