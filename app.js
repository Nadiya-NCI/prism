const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzByO3olSeexgzkXz8XC6U9TYaRRi98NK4SdCBRLuorHIBwu6ZXTD0DOf0C9ZiACrck2r4p9tePX8s/pub?output=csv";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h,7d";
const WORKER_URL = "https://prism.n-sydorenko-mail.workers.dev";

const $ = (id) => document.getElementById(id);
let marketData = [];
let watchlist = [];
let liveSnapshot = "";
let sortState = { key: "market_cap_eur", dir: -1 };
let filter = "";

function rankMap() {
  const m = new Map();
  marketData.slice().sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).forEach((c, i) => m.set(c.id, i + 1));
  return m;
}

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
  let data = marketData.slice();
  const ranks = rankMap();
  if (filter) data = data.filter((c) => (c.name + " " + c.symbol).toLowerCase().includes(filter));
  data.sort((a, b) => {
    const av = a[sortState.key], bv = b[sortState.key];
    if (typeof av === "string") return av.localeCompare(bv) * sortState.dir;
    return ((av || 0) - (bv || 0)) * sortState.dir;
  });
  return data.map((c) => {
    const ch = c.price_change_percentage_24h ?? 0;
    const ch7 = c.price_change_percentage_7d_in_currency ?? 0;
    const cls = (v) => v >= 0 ? "up" : "down";
    return `<tr class="clickable" data-id="${c.id}" title="click for details">
      <td><span class="rank">${ranks.get(c.id) ?? "—"}</span></td>
      <td><span class="coin-name"><img class="coin-logo" src="${c.image || ""}" alt="" loading="lazy"><strong>${c.name}</strong> <span class="muted">${c.symbol.toUpperCase()}</span></span></td>
      <td>${sparkSVG(c.sparkline_in_7d && c.sparkline_in_7d.price)}</td>
      <td class="price">€${fmtBig(c.current_price)}</td>
      <td class="${cls(ch)}">${pct(ch)}</td>
      <td class="${cls(ch7)}">${pct(ch7)}</td>
      <td>€${fmtBig(c.market_cap)}</td>
      <td>€${fmtBig(c.total_volume)}</td>
    </tr>`;
  }).join("");
}

function buildTicker() {
  const track = $("ticker-track");
  if (!track) return;
  const seg = marketData.map((c) => {
    const ch = c.price_change_percentage_24h ?? 0;
    return `<span class="ticker-item"><b>${c.symbol.toUpperCase()}</b> €${fmtBig(c.current_price)} <span class="${ch >= 0 ? "up" : "down"}">${pct(ch)}</span></span>`;
  }).join("");
  track.innerHTML = seg + seg;
}

function renderTable() {
  let html;
  if (!marketData.length) html = '<tr><td colspan="8" class="muted">no live data</td></tr>';
  else {
    const rows = marketRows();
    html = rows || (filter ? `<tr><td colspan="8" class="muted">no coins match "${filter}"</td></tr>` : '<tr><td colspan="8" class="muted">no live data</td></tr>');
  }
  $("coin-rows").innerHTML = html;
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.classList.remove("sort-up", "sort-down");
    if (th.dataset.sort === sortState.key) th.classList.add(sortState.dir === 1 ? "sort-up" : "sort-down");
  });
  buildTicker();
}

function animateNum(el, to, fmt) {
  const from = parseFloat(String(el.textContent).replace(/[^0-9.\-]/g, "")) || 0;
  if (!isFinite(to)) { el.textContent = fmt(to); return; }
  const start = performance.now();
  const dur = 700;
  const tick = (t) => {
    const p = Math.min((t - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderMood() {
  const chs = marketData.map((c) => c.price_change_percentage_24h ?? 0);
  const avg = chs.reduce((a, b) => a + b, 0) / (chs.length || 1);
  const el = $("mood");
  el.className = "big-number " + (avg >= 0 ? "up" : "down");
  $("mood-card").className = "card glass " + (avg >= 0 ? "pos" : "neg");
  animateNum(el, avg, (v) => (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
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
      <td>${fmtEUR(value)}</td>
      <td>${fmtEUR(basis)}</td>
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
  animateNum($("portfolio-value"), totalValue, fmtEUR);
  $("portfolio-cost").textContent = fmtEUR(totalCost);
  const g = $("portfolio-gain");
  g.className = totalDelta >= 0 ? "up" : "down";
  animateNum(g, totalDelta, pct);
  const d = $("portfolio-delta");
  d.className = "big-number " + (totalDelta >= 0 ? "up" : "down");
  $("portfolio-card").className = "card glass " + (totalDelta >= 0 ? "pos" : "neg");
  animateNum(d, totalDelta, pct);
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

async function fetchNews() {
  const list = $("news-list");
  try {
    const res = await fetch(WORKER_URL + "/news", { cache: "no-store" });
    if (!res.ok) throw new Error("news HTTP " + res.status);
    const data = await res.json();
    if (!data.items || !data.items.length) throw new Error("empty feed");
    list.innerHTML = "";
    data.items.forEach((it, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = it.title;
      a.href = it.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const meta = document.createElement("span");
      meta.className = "news-meta";
      if (data.source) {
        const s = document.createElement("span");
        s.className = "src muted";
        s.textContent = data.source;
        meta.appendChild(s);
      }
      if (it.date) {
        const d = new Date(it.date);
        if (!isNaN(d)) {
          const s = document.createElement("span");
          s.className = "news-date muted";
          s.textContent = d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
          meta.appendChild(s);
        }
      }
      if (i === 0) {
        li.className = "story-lead";
        const tag = document.createElement("span");
        tag.className = "tag-top";
        tag.textContent = "Top story";
        li.appendChild(tag);
        li.appendChild(a);
        li.appendChild(meta);
      } else {
        li.appendChild(a);
        li.appendChild(meta);
      }
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = '<li class="muted">Headlines temporarily unavailable.</li>';
  }
}

function openDetail(id) {
  const c = marketData.find((x) => x.id === id);
  if (!c) return;
  const ch = c.price_change_percentage_24h ?? 0;
  const ch7 = c.price_change_percentage_7d_in_currency ?? 0;
  const eta = "€" + (c.high_24h != null ? fmtBig(c.high_24h) : "—");
  const etb = "€" + (c.low_24h != null ? fmtBig(c.low_24h) : "—");
  $("detail-title").textContent = `${c.name} (${c.symbol.toUpperCase()})`;
  const big = sparkSVG(c.sparkline_in_7d && c.sparkline_in_7d.price).replace('width="66"', 'width="360"').replace('height="22"', 'height="96"');
  $("detail-body").innerHTML = `
    <div class="detail-grid">
      <div class="d-item"><span class="muted">Live price (EUR)</span><b>€${fmtBig(c.current_price)}</b></div>
      <div class="d-item"><span class="muted">Market cap</span><b>€${fmtBig(c.market_cap)}</b></div>
      <div class="d-item"><span class="muted">24h</span><b class="${ch >= 0 ? "up" : "down"}">${pct(ch)}</b></div>
      <div class="d-item"><span class="muted">7d</span><b class="${ch7 >= 0 ? "up" : "down"}">${pct(ch7)}</b></div>
      <div class="d-item"><span class="muted">24h volume</span><b>€${fmtBig(c.total_volume)}</b></div>
      <div class="d-item"><span class="muted">24h high</span><b>${eta}</b></div>
      <div class="d-item"><span class="muted">24h low</span><b>${etb}</b></div>
    </div>
    <div class="detail-spark">${big || '<p class="muted">7-day trend unavailable</p>'}</div>
  `;
  $("coin-detail").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  $("coin-detail").classList.add("hidden");
  document.body.style.overflow = "";
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
  fetchNews();
}

function addMsg(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + role;
  d.textContent = role === "ai" ? cleanText(text) : text;
  $("chat-log").appendChild(d);
  $("chat-log").scrollTop = $("chat-log").scrollHeight;
}

function cleanText(s) {
  return String(s)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/`([^`]*)`/g, "$1")
    .trim();
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
    const res = await fetch(WORKER_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: q, snapshot: liveSnapshot })
    });
    if (!res.ok) {
      let msg = "Worker HTTP " + res.status;
      try { const e = await res.json(); msg = e.error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
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

$("coin-filter").addEventListener("input", (e) => {
  filter = e.target.value.trim().toLowerCase();
  renderTable();
});

$("coin-rows").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (tr) openDetail(tr.dataset.id);
});

$("close-detail").addEventListener("click", closeDetail);
$("coin-detail").addEventListener("click", (e) => {
  if (e.target === $("coin-detail") || e.target.closest(".close")) closeDetail();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

$("refresh-btn").addEventListener("click", () => {
  const b = $("refresh-btn");
  const orig = b.textContent;
  b.textContent = "Refreshing…";
  refreshData().then(() => {
    b.textContent = "✓ Updated " + now();
    setTimeout(() => { b.textContent = orig; }, 3000);
  });
});

$("client-time").textContent = "local: " + now();
setInterval(() => { $("client-time").textContent = "local: " + now(); }, 30000);
refreshData();
setInterval(refreshData, 120000);