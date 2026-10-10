const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const WIN = 5 * 60000;
const JST = "Asia/Tokyo";
const dayKey = (ms) => new Intl.DateTimeFormat("sv-SE", { timeZone: JST }).format(new Date(ms));
const hourOf = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: JST, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)).slice(0, 2);
const hm = (ms) => new Intl.DateTimeFormat("ja-JP", { timeZone: JST, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
const md = (day) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const mdw = (day) => `${md(day)}（${"日月火水木金土"[new Date(`${day}T12:00:00Z`).getUTCDay()]}）`;
const num = (n) => Number(n ?? 0).toLocaleString("ja-JP");

function scale(max) {
  const m = Math.max(1, max);
  const raw = m / 4, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p);
  const top = Math.ceil(m / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}
const yAxis = (s) => `<div class="st-y" aria-hidden="true">${s.ticks.map((t) => `<span style="bottom:${(t / s.top) * 100}%">${num(t)}</span>`).join("")}</div>`;
const grid = (s) => s.ticks.slice(1).map((t) => `<i class="st-grid" style="bottom:${(t / s.top) * 100}%"></i>`).join("");
const table = (head, rows) => `<details class="st-table"><summary>表で見る</summary><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join("")}</tr>`).join("")}</tbody></table></details>`;

function columns(items, { unit, every = 1, label }) {
  const s = scale(Math.max(0, ...items.map((x) => x.value)));
  const cols = items.map((x, i) => `<button type="button" class="st-col${x.now ? " is-now" : ""}" data-tip="${esc(x.tip)}" data-val="${esc(num(x.value))}${esc(unit)}" style="--h:${(x.value / s.top) * 100}%" aria-label="${esc(x.tip)} ${esc(num(x.value))}${esc(unit)}">
      <i class="st-bar">${x.mark && x.value ? `<b>${esc(num(x.value))}</b>` : ""}</i><small${i % every ? " hidden" : ""}>${esc(x.label)}</small></button>`).join("");
  return `<div class="st-chart" role="group" aria-label="${esc(label)}">${yAxis(s)}<div class="st-plot">${grid(s)}<div class="st-cols" style="--n:${items.length}">${cols}</div></div></div>`;
}

function nowSeries(presence, now) {
  const w1 = Math.floor(now / WIN), N = 24;
  return Array.from({ length: N }, (_, k) => { const w = w1 - (N - 1 - k); return { w, n: presence[w] ?? 0, from: w * WIN }; });
}
const nowCount = (presence, now) => { const w = Math.floor(now / WIN); return Math.max(presence[w] ?? 0, presence[w - 1] ?? 0); };
function nowChart(series) {
  const s = scale(Math.max(0, ...series.map((p) => p.n)));
  const X = (i) => (i / (series.length - 1)) * 100, Y = (n) => 100 - (n / s.top) * 100;
  const pts = series.map((p, i) => `${X(i).toFixed(2)},${Y(p.n).toFixed(2)}`);
  const last = series.at(-1);
  const xl = series.map((p, i) => (new Date(p.from).getUTCMinutes() % 30 === 0 ? `<span style="left:${X(i)}%">${hm(p.from)}</span>` : "")).join("");
  return `<div class="st-chart is-line" role="group" aria-label="直近2時間の、5分ごとの端末の数">${yAxis(s)}
    <div class="st-plot" data-line='${esc(JSON.stringify(series.map((p) => [`${hm(p.from)}〜${hm(p.from + WIN)}`, p.n])))}'>${grid(s)}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon class="st-area" points="0,100 ${pts.join(" ")} 100,100"/><polyline class="st-line" points="${pts.join(" ")}"/></svg>
      <i class="st-cross" hidden></i>
      <i class="st-dot" style="left:100%; bottom:${(last.n / s.top) * 100}%"></i>
      <b class="st-end" style="bottom:${(last.n / s.top) * 100}%">${num(last.n)}</b>
      <div class="st-xl" aria-hidden="true">${xl}</div>
    </div></div>`;
}

const DEVICES = [["phone", "スマホ"], ["pc", "パソコン"], ["tablet", "タブレット"]];
function deviceRow(name, d) {
  const all = DEVICES.reduce((a, [k]) => a + (d?.[k] ?? 0), 0);
  if (!all) return `<div class="st-dev"><span class="st-dev-name">${esc(name)}</span><p class="muted st-none">まだ数えていません</p></div>`;
  const segs = DEVICES.map(([k, ja]) => { const n = d[k] ?? 0, p = (n / all) * 100; return n ? `<button type="button" class="st-seg is-${k}" style="flex:${n}" data-tip="${esc(name)}・${ja}" data-val="${num(n)}台（${Math.round(p)}%）" aria-label="${esc(name)} ${ja} ${num(n)}台 ${Math.round(p)}%">${p >= 14 ? `<b>${Math.round(p)}%</b>` : ""}</button>` : ""; }).join("");
  return `<div class="st-dev"><span class="st-dev-name">${esc(name)}</span><div class="st-stack">${segs}</div><span class="st-dev-sum">${num(all)}台</span></div>`;
}

export function renderStats(root, data) {
  const { visits, devices, hours, presence, now } = data;
  const today = dayKey(now);
  const days = [...new Set([...Object.keys(visits), today])].sort();
  const day = days.includes(data.day) ? data.day : today;
  const H = hours[day] ?? {}, hNow = hourOf(now);
  const total = Object.values(visits).reduce((a, b) => a + b, 0);
  const series = nowSeries(presence, now);

  const tiles = [
    ["いま見ている", num(nowCount(presence, now)), "台（直近5分）"],
    ["この1時間", num(hours[today]?.[hNow] ?? 0), `台（${Number(hNow)}時台）`],
    ["きょう", num(visits[today] ?? 0), "台（1日1回まで）"],
    ["これまで", num(total), "台（のべ）"],
  ].map(([l, v, s]) => `<div class="kpi is-static"><small>${l}</small><b>${v}</b><span>${s}</span></div>`).join("");

  const hourMax = Math.max(0, ...Object.values(H));
  const hourItems = Array.from({ length: 24 }, (_, h) => { const k = String(h).padStart(2, "0"), v = H[k] ?? 0; const cur = day === today && k === hNow; return { label: `${h}時`, tip: `${md(day)} ${h}時台`, value: v, now: cur, mark: v > 0 && (v === hourMax || cur) }; });
  const dayMax = Math.max(0, ...days.map((d) => visits[d] ?? 0));
  const dayItems = days.map((d) => { const v = visits[d] ?? 0; return { label: md(d), tip: mdw(d), value: v, now: d === today, mark: v > 0 && (v === dayMax || d === today) }; });
  const devAll = { phone: 0, tablet: 0, pc: 0 };
  for (const d of Object.values(devices)) for (const k of Object.keys(devAll)) devAll[k] += d[k] ?? 0;

  const html = `
    <div class="kpis">${tiles}</div>
    <article class="card">
      <header class="card-head"><h2>いまのようす</h2><small class="muted">直近2時間・5分ごとの、サイトを開いていた端末の数</small></header>
      ${nowChart(series)}
      ${table(["時間", "台"], series.map((p) => [`${hm(p.from)}〜${hm(p.from + WIN)}`, num(p.n)]).reverse())}
    </article>
    <div class="st-filter"><label for="stats-day">くわしく見る日</label><select id="stats-day">${[...days].reverse().map((d) => `<option value="${d}"${d === day ? " selected" : ""}>${mdw(d)}${d === today ? "・きょう" : ""}</option>`).join("")}</select></div>
    <div class="grid-2">
      <article class="card">
        <header class="card-head"><h2>時間ごと</h2><small class="muted">${mdw(day)}・1時間ごとの端末の数（同じ端末は、1時間に1回）</small></header>
        ${columns(hourItems, { unit: "台", every: 3, label: `${md(day)} の、1時間ごとの端末の数` })}
        ${table(["時間", "台"], hourItems.map((x) => [x.label, num(x.value)]))}
      </article>
      <article class="card">
        <header class="card-head"><h2>端末</h2><small class="muted">スマホ・パソコン・タブレットの割合</small></header>
        <ul class="st-legend">${DEVICES.map(([k, ja]) => `<li><i class="is-${k}"></i>${ja}</li>`).join("")}</ul>
        ${deviceRow(md(day), devices[day])}
        ${deviceRow("これまで", devAll)}
        ${table(["", ...DEVICES.map(([, ja]) => ja)], [[md(day), ...DEVICES.map(([k]) => num(devices[day]?.[k] ?? 0))], ["これまで", ...DEVICES.map(([k]) => num(devAll[k]))]])}
        <p class="muted st-note">端末の種類は、10/7 から数えています。それより前の閲覧は、入っていません。</p>
      </article>
    </div>
    <article class="card">
      <header class="card-head"><h2>日ごと</h2><small class="muted">1日ごとの端末の数（同じ端末は、1日に1回）</small></header>
      ${columns(dayItems, { unit: "台", every: Math.ceil(days.length / 12), label: "1日ごとの端末の数" })}
      ${table(["日", "台"], [...dayItems].reverse().map((x) => [x.tip, num(x.value)]))}
    </article>`;
  if (root._html === html) return;
  if (root.contains(document.activeElement) && document.activeElement.tagName === "SELECT") return;
  const open = [...root.querySelectorAll("details")].map((d) => d.open);
  root.innerHTML = root._html = html;
  root.querySelectorAll("details").forEach((d, i) => { d.open = !!open[i]; });
}

export function wireStats(root) {
  const tip = document.createElement("div");
  tip.className = "st-tip"; tip.hidden = true;
  tip.innerHTML = "<b></b><span></span>";
  document.body.append(tip);
  const show = (x, y, val, label) => {
    tip.firstChild.textContent = val; tip.lastChild.textContent = label; tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
    tip.style.top = `${Math.max(8, y - h - 12)}px`;
  };
  const hide = () => { tip.hidden = true; root.querySelectorAll(".st-cross").forEach((c) => (c.hidden = true)); };
  const mark = (el) => { const r = (el.querySelector(".st-bar") ?? el).getBoundingClientRect(); show(r.left + r.width / 2, r.top, el.dataset.val, el.dataset.tip); };
  root.addEventListener("pointermove", (e) => {
    const m = e.target.closest?.("[data-tip]");
    if (m) return mark(m);
    const plot = e.target.closest?.("[data-line]");
    if (!plot) return hide();
    const pts = JSON.parse(plot.dataset.line), r = plot.getBoundingClientRect();
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1))));
    const cross = plot.querySelector(".st-cross");
    cross.hidden = false; cross.style.left = `${(i / (pts.length - 1)) * 100}%`;
    show(r.left + (i / (pts.length - 1)) * r.width, r.top + 6, `${num(pts[i][1])}台`, pts[i][0]);
  });
  root.addEventListener("pointerleave", hide);
  root.addEventListener("focusin", (e) => { const m = e.target.closest?.("[data-tip]"); if (m) mark(m); });
  root.addEventListener("focusout", hide);
  addEventListener("scroll", hide, { passive: true });
}
export { dayKey, WIN };
