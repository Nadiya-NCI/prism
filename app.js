const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzByO3olSeexgzkXz8XC6U9TYaRRi98NK4SdCBRLuorHIBwu6ZXTD0DOf0C9ZiACrck2r4p9tePX8s/pub?output=csv";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h,7d";
const WORKER_URL = "https://prism.n-sydorenko-mail.workers.dev";

const $ = (id) => document.getElementById(id);
let marketData = [];
let watchlist = [];
let liveSnapshot = "";
let sortState = { key: "market_cap_eur", dir: -1 };

function fmtEUR(n) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: n >= 1 ? 2 : 4 }).format(n);
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
function pct(n) {
  return (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";
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
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function sparkSVG(points) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const step = Math.max(1, Math.floor(points.length / 36));
  const p = points.filter((_, i) => i % step === 0);
  const min = Math.min(...p), max = Math.max(...p), span = max - min || 1;
  const w = 66, h = 22;
  const pts = p.map((v, i) => `${(i / (p.length - 1)) * w},${h - ((v - min) / span) * h}`).join(" ");
  const color = p[p.length - 1] >= p[0] ? "#2ee6a8" : "#ff5b6a";
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function marketRows() {
  const data = marketData.slice().sort((a, b) => {
    const av = a[sortState.key], bv = b[sortState.key];
    if (typeof av === "string") return av.localeCompare(bv) * sortState.dir;
    return ((av || 0) - (bv || 0)) * sortState.dir;
  });
  return data.map((c, i) => {
    const ch = c.price_change_percentage_24h ?? 0;
    const ch7 = c.price_change_percentage_7d_in_currency ?? 0;
    const cls = (v) => v >= 0 ? "up" : "down";
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${c.name}</strong> <span class="muted">${c.symbol.toUpperCase()}</span></td>
      <td>${sparkSVG(c.sparkline_in_7d && c.sparkline_in_7d.price)}</td>
      <td>€${fmtBig(c.current_price)}</td>
      <td class="${cls(ch)}">${pct(ch)}</td>
      <td class="${cls(ch7)}">${pct(ch7)}</td>
      <td>€${fmtBig(c.market_cap)}</td>
      <td>€${fmtBig(c.total_volume)}</td>
    </tr>`;
  }).join("");
}

function renderTable() {
  $("coin-rows").innerHTML = marketData.length ? marketRows() : '<tr><td colspan="8" class="muted">no live data</td></tr>';
}

function renderMood() {
  const chs = marketData.map((c) => c.price_change_percentage_24h ?? 0);
  const avg = chs.reduce((a, b) => a + b, 0) / (chs.length || 1);
  const el = $("mood");
  el.className = "big-number " + (avg >= 0 ? "up" : "down");
  el.textContent = (avg >= 0 ? "+" : "") + avg.toFixed(2) + "%";
  $("mood-sub").textContent = avg >= 0 ? "risk-on bias across the top 10 today" : "risk-off bias across the top 10 today";
  $("mood-fetched").textContent = now();
}

function holdingBySymbol(sym) {
  return marketData.find((c) => c.symbol.toLowerCase() === sym.toLowerCase());
}

function renderWatchlist() {
  const rows = watchlist.map((w) => {
    const alloc = parseFloat(w.allocation || 0);
    const basis = parseFloat(w.cost_basis_eur || 0);
    const live = holdingBySymbol(w.symbol);
    const price = live ? live.current_price : null;
    const value = price != null ? price * alloc : basis;
    const delta = price != null ? ((price - basis) / (basis || 1)) * 100 : null;
    const dCls = delta == null ? "" : (delta >= 0 ? "up" : "down");
    return `<tr>
      <td><strong>${w.asset}</strong> <span class="muted">${String(w.symbol).toUpperCase()}</span></td>
      <td>${(alloc * 100).toFixed(0)}%</td>
      <td>${price != null ? fmtEUR(price) : '<span class="muted">n/a</span>'}</td>
      <td>€${fmtEUR(value)}</td>
      <td>€${fmtEUR(basis)}</td>
      <td class="${dCls}">${delta == null ? "—" : pct(delta)}</td>
      <td>${w.note || ""}</td>
    </tr>`;
  }).join("");
  const totalCost = watchlist.reduce((a, w) => a + parseFloat(w.cost_basis_eur || 0), 0);
  const totalValue = watchlist.reduce((a, w) => {
    const live = holdingBySymbol(w.symbol);
    const price = live ? live.current_price : null;
    return a + (price != null ? price * parseFloat(w.allocation || 0) : parseFloat(w.cost_basis_eur || 0));
  }, 0);
  const totalDelta = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  $("watchlist-rows").innerHTML = rows || '<tr><td colspan="7" class="muted">no rows in the sheet</td></tr>';
  $("portfolio-value").textContent = "€" + fmtEUR(totalValue);
  $("portfolio-cost").textContent = "€" + fmtEUR(totalCost);
  const g = $("portfolio-gain");
  g.className = totalDelta >= 0 ? "up" : "down";
  g.textContent = pct(totalDelta);
  const d = $("portfolio-delta");
  d.className = "big-number " + (totalDelta >= 0 ? "up" : "down");
  d.textContent = pct(totalDelta);
  $("sheet-fetched").textContent = now();
}

function buildSnapshot() {
  const top = marketData.slice(0, 5)
    .map((c) => `${c.name} (${c.symbol.toUpperCase()}): €${c.current_price}, 24h ${(c.price_change_percentage_24h ?? 0).toFixed(2)}%, 7d ${(c.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%`)
    .join("\n");
  const folio = watchlist
    .map((w) => `${w.symbol}: allocation ${w.allocation}, cost basis €${w.cost_basis_eur}, note "${w.note || ""}"`)
    .join("\n");
  liveSnapshot = `LIVE MARKET SNAPSHOT (fetched ${new Date().toISOString()}):\n${top}\n\nUSER WATCHLIST (live from Google Sheets):\n${folio || "(empty)"}\n\nGround your answer in these figures only. Max 180 words. If asked for financial advice, say you provide research support only.`;
  $("snapshot-at").textContent = new Date().toUTCString();
}

async function refreshData() {
  try {
    const cg = await fetchCoinGecko();
    marketData = Array.isArray(cg) ? cg : [];
    setPill("coingecko-status", "CoinGecko ✓ " + now(), true);
  } catch (e) {
    setPill("coingecko-status", "CoinGecko: " + e.message, false);
  }
  try {
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
  } catch (e) {
    setPill("sheet-status", "watchlist: " + e.message, false);
  }
  renderTable();
  renderMood();
  renderWatchlist();
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

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (sortState.key === key) { sortState.dir *= -1; }
    else { sortState.key = key; sortState.dir = key === "name" ? 1 : -1; }
    renderTable();
  });
});

$("client-time").textContent = "local: " + now();
setInterval(() => { $("client-time").textContent = "local: " + now(); }, 30000);
refreshData();
setInterval(refreshData, 120000);