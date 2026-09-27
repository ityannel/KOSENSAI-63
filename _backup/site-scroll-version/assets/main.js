import {
  FESTIVAL, NAV, MESSAGE, ABOUT, VENUES, CROWD, GUIDES, EVENTS,
  PICKUP_SHOPS, PICKUP_EVENTS, NOTICES, GARBAGE, SPONSORS,
} from "./config.js";
import { subscribeLive, subscribeCrowd } from "./live.js";
import { initRally } from "./rally.js";

// ---------- 時刻（テスト用に ?now=2026-10-24T11:00 / ?phase=during で上書きできる） ----------
const params = new URLSearchParams(location.search);
const nowParam = params.get("now");
const timeOffset = nowParam ? new Date(nowParam.includes("+") ? nowParam : nowParam + "+09:00") - Date.now() : 0;
// performance.now() はミリ秒の小数部まで持っているので、マイクロ秒の表示に使う
const nowMs = () => performance.timeOrigin + performance.now() + timeOffset;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const venueName = (id) => {
  const v = VENUES.find((x) => x.id === id);
  return v ? (v.alias ?? v.name) : (id ?? "");
};
const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

const OPEN = Date.parse(FESTIVAL.days[0].open);
const CLOSE = Date.parse(FESTIVAL.days.at(-1).close);

let live = null; // Firestore の site_live/current（無ければ null）

function currentPhase(t = nowMs()) {
  const forced = params.get("phase") ?? live?.phase_override;
  if (["before", "during", "after"].includes(forced)) return forced;
  if (t < OPEN) return "before";
  if (t > CLOSE) return "after";
  return "during";
}

// ---------- 静的セクション ----------
function renderStatic() {
  const timeText = FESTIVAL.days.map((d) => `${d.label} ${hhmm(d.open)}〜${hhmm(d.close)}`).join("　/　");
  $("#date-time").textContent = timeText;

  $("#about-body").innerHTML = ABOUT.map((p) => `<p>${esc(p)}</p>`).join("");
  $("#message").innerHTML = `
    ${MESSAGE.photo
      ? `<img class="message-photo" src="${esc(MESSAGE.photo)}" alt="${esc(MESSAGE.name)}">`
      : `<div class="message-photo placeholder" aria-hidden="true">写真</div>`}
    <blockquote>${MESSAGE.body.map((p) => `<p>${esc(p)}</p>`).join("")}</blockquote>
    <figcaption>${esc(MESSAGE.name)}</figcaption>`;

  $("#venue-list").innerHTML = VENUES.map((v) => `
    <li>${v.alias ? `<b>${esc(v.alias)}</b><small>${esc(v.name)}</small>` : `<b>${esc(v.name)}</b>`}</li>`).join("");

  $("#guide-grid").innerHTML = GUIDES.map((g) => `
    <a class="guide-card" href="${esc(g.href)}">
      <span class="guide-icon" aria-hidden="true">${esc(g.icon)}</span>
      <span class="guide-text">
        <b>${esc(g.title)}${g.internal ? '<em class="tag">学内のみ</em>' : ""}</b>
        <small>${esc(g.desc)}</small>
      </span>
      <span class="guide-arrow" aria-hidden="true">→</span>
    </a>`).join("");

  const card = (c, meta) => `
    <article class="pick-card">
      <p class="pick-meta">${esc(meta)}</p>
      <h4>${esc(c.name)}</h4>
      <p>${esc(c.note)}</p>
      <p class="pick-place">📍 ${esc(venueName(c.venue))}</p>
    </article>`;
  $("#pickup-shops").innerHTML = PICKUP_SHOPS.map((s) => card(s, s.group)).join("");
  $("#pickup-events").innerHTML = PICKUP_EVENTS.map((e) => card(e, e.when)).join("");

  $("#notice-list").innerHTML = NOTICES.map((n) => `<li>${esc(n)}</li>`).join("");
  $("#garbage-grid").innerHTML = GARBAGE.map((g) => `
    <div class="garbage-card" style="--bin:${esc(g.color)}">
      <b>${esc(g.kind)}</b><small>${esc(g.examples)}</small>
    </div>`).join("");

  $("#sponsor-lead").innerHTML = SPONSORS.count
    ? `計<b>${SPONSORS.count}</b>社の提供により開催しております。<br>ご協力いただいた皆さまに心より感謝申し上げます。`
    : "計<b>●</b>社の提供により開催しております。<br>ご協力いただいた皆さまに心より感謝申し上げます。";
  $("#sponsor-list").innerHTML = SPONSORS.list.map((s) =>
    `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}</li>`).join("");

  $("#insta-link").href = FESTIVAL.instagram;

  $("#stage-poster").src = FESTIVAL.poster;
  $(".stage-blur").style.backgroundImage = `url("${FESTIVAL.poster}")`;
  renderNav();
}

// ---------- カウントダウン ----------
const cdEls = Object.fromEntries([...document.querySelectorAll("[data-cd]")].map((el) => [el.dataset.cd, el]));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastSecond = -1;

function tickCountdown() {
  const remain = Math.max(0, OPEN - nowMs()); // ミリ秒（小数あり）
  const totalSec = Math.floor(remain / 1000);
  const us = Math.floor((remain % 1000) * 1000); // 1秒未満をマイクロ秒で
  if (!reduceMotion) cdEls.us.textContent = String(us).padStart(6, "0");
  if (totalSec !== lastSecond) {
    lastSecond = totalSec;
    cdEls.d.textContent = Math.floor(totalSec / 86400);
    cdEls.h.textContent = String(Math.floor(totalSec / 3600) % 24).padStart(2, "0");
    cdEls.m.textContent = String(Math.floor(totalSec / 60) % 60).padStart(2, "0");
    cdEls.s.textContent = String(totalSec % 60).padStart(2, "0");
    if (reduceMotion) cdEls.us.textContent = String(us).padStart(6, "0");
  }
}

// ---------- 開催中：今やっているイベント・生配信 ----------
function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.pathname.startsWith("/live/") || u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
    else id = u.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1` : null;
  } catch {
    return null;
  }
}

let currentStream = null;
function renderDuring() {
  const t = nowMs();
  // Firestore に now_events があればそちらを優先（当日の急な変更用）
  const running = live?.now_events?.length
    ? live.now_events
    : EVENTS.filter((e) => Date.parse(e.start) <= t && t < Date.parse(e.end));
  const next = EVENTS.filter((e) => Date.parse(e.start) > t).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];

  const item = (e, label) => `
    <div class="now-item${label === "NOW" ? "" : " next"}">
      <span class="now-label${label === "NOW" ? "" : " is-next"}">${label}</span>
      <b>${esc(e.title)}</b>
      <small>${e.venue ? `📍 ${esc(venueName(e.venue))}` : ""}${e.start ? `　${hhmm(e.start)}〜${e.end ? hhmm(e.end) : ""}` : ""}</small>
    </div>`;
  const inHours = FESTIVAL.days.some((d) => Date.parse(d.open) <= t && t < Date.parse(d.close));
  let html = running.map((e) => item(e, "NOW")).join("");
  if (!running.length) html = `<p class="now-empty">${inHours ? "会場をお楽しみください！" : "本日の公開は終了しました。明日もお待ちしています！"}</p>`;
  if (next) {
    const sameDay = (a, b) => new Date(a).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) === new Date(b).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
    html += item(next, sameDay(t, next.start) ? "NEXT" : "明日");
  }
  $("#now-events").innerHTML = html;

  // 生配信：Firestore で stream_active、または live:true のイベント中なら自動でトップに出す
  const liveEvent = EVENTS.some((e) => e.live && Date.parse(e.start) <= t && t < Date.parse(e.end));
  const url = live?.stream_url && (live.stream_active || liveEvent) ? toEmbedUrl(live.stream_url) : null;
  if (url !== currentStream) {
    currentStream = url;
    const box = $("#live-stream");
    $("#live").hidden = !url;
    box.innerHTML = url
      ? `<p class="stream-title">🔴 抽選会 生配信中</p><div class="stream-frame"><iframe src="${esc(url)}" title="抽選会 生配信" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
      : "";
  }
}

// ---------- 食レポ・写真・お知らせ（Firestore） ----------
function renderLiveContent() {
  const reports = live?.food_reports ?? [];
  $("#food-reports").innerHTML = reports.length
    ? reports.map((r) => `
      <article class="report-card">
        ${r.photo ? `<img src="${esc(r.photo)}" alt="${esc(r.shop)}" loading="lazy">` : ""}
        <div><h4>${esc(r.shop)}</h4><p>${esc(r.text)}</p></div>
      </article>`).join("")
    : `<p class="empty">食レポは当日ここに追加されていきます。お楽しみに！</p>`;

  const photos = live?.photos ?? [];
  $("#photo-grid").innerHTML = photos.length
    ? photos.map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.caption ?? "")}" loading="lazy">${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`).join("")
    : `<p class="empty">写真は当日随時アップします。</p>`;

  const bar = $("#notice-bar");
  bar.hidden = !live?.notice;
  bar.textContent = live?.notice ?? "";
}

// ---------- 電線の短冊（ナビ） ----------
// ポスター（1057×1488）上の一番上の電線は、ほぼ y = 324 + (1050 - x) × 0.203 の直線。
// 電柱の右、「第63回 高専祭」の文字の左の空いたところに吊るす。
const POSTER_W = 1057, POSTER_H = 1488;
const wireY = (x) => 324 + (1050 - x) * 0.203;
const TANZAKU_COLORS = ["#9BD7D0", "#FBE1BC", "#E0874A", "#FFFDF8", "#B5655A", "#6CBAB5"];

function renderNav() {
  $("#tanzaku-nav").innerHTML = NAV.map((n, i) => {
    const x = 294 + i * 37;
    return `<a class="tanzaku" href="${esc(n.href)}" style="
      --x:${(x / POSTER_W) * 100}%; --y:${(wireY(x) / POSTER_H) * 100}%;
      --c:${TANZAKU_COLORS[i % TANZAKU_COLORS.length]};
      --dur:${(3.2 + (i % 3) * 0.7).toFixed(1)}s; --delay:${(-i * 0.9).toFixed(1)}s">${esc(n.label)}</a>`;
  }).join("");
  $("#topnav-links").innerHTML = NAV.map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join("");
}

// ---------- いまの函館の空（ポスターの色を時刻で変える。?sky=night などで確認できる） ----------
const SKIES = [
  { id: "night", from: 0, label: "夜" },
  { id: "dawn", from: 5, label: "明け方" },
  { id: "day", from: 7, label: "昼" },
  { id: "sunset", from: 15.5, label: "夕焼け" },
  { id: "dusk", from: 17.5, label: "日暮れ" },
  { id: "night", from: 19, label: "夜" },
];
function updateSky() {
  const d = new Date(nowMs());
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  const hour = h + m / 60;
  const forced = SKIES.find((s) => s.id === params.get("sky"));
  const sky = forced ?? [...SKIES].reverse().find((s) => hour >= s.from);
  document.body.dataset.sky = sky.id;
  $("#sky-caption").textContent = `いまの函館の空 ― ${sky.label} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ポスターを通り過ぎたら上のナビを出す
new IntersectionObserver(([e]) => document.body.classList.toggle("past-stage", !e.isIntersecting), {
  rootMargin: "-60% 0px 0px 0px",
}).observe($("#stage"));

// ---------- 会場の混雑状況 ----------
let crowd = null;
function agoText(ms) {
  const min = Math.floor((nowMs() - ms) / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}
function renderCrowd() {
  $("#crowd-list").innerHTML = CROWD.venues.map((id) => {
    const c = crowd?.[id];
    const level = CROWD.levels[c?.level];
    const stale = c?.updated_at && nowMs() - c.updated_at > CROWD.staleMinutes * 60000;
    const meter = CROWD.levels.map((_, i) => `<i class="${level && i <= c.level ? "on" : ""}"></i>`).join("");
    return `
      <article class="crowd-card${stale ? " is-stale" : ""}${level ? "" : " is-empty"}" style="--lv:${level?.color ?? "transparent"}">
        <h3>${esc(venueName(id))}${VENUES.find((v) => v.id === id)?.alias ? `<small>${esc(VENUES.find((v) => v.id === id).name)}</small>` : ""}</h3>
        <p class="crowd-level">${level ? esc(level.label) : "当日ここに表示します"}</p>
        <div class="crowd-meter" aria-hidden="true">${meter}</div>
        <p class="crowd-time">${c?.updated_at ? `${agoText(c.updated_at)}に更新${stale ? "（情報が古いかもしれません）" : ""}` : "　"}</p>
      </article>`;
  }).join("");
}

// ---------- ループ ----------
let phase = null;
function update() {
  const p = currentPhase();
  if (p !== phase) {
    phase = p;
    document.body.dataset.phase = p;
  }
  if (p === "during") renderDuring();
  updateSky();
}

renderStatic();
renderLiveContent();
update();
setInterval(update, 1000);

(function frame() {
  if (phase === "before") tickCountdown();
  requestAnimationFrame(frame);
})();

initRally(nowMs);
renderCrowd();
setInterval(renderCrowd, 30000); // 「○分前に更新」を進める
subscribeCrowd((data) => {
  crowd = data;
  renderCrowd();
});

subscribeLive((data) => {
  live = data;
  renderLiveContent();
  update();
});
