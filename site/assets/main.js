import {
  FESTIVAL, NAV, MESSAGE, ABOUT, VENUES, CROWD, GUIDES, EVENTS, STAGE,
  NOTICES, GARBAGE, SPONSORS, FX, SECRETS,
} from "./config.js";
import { subscribeLive, subscribeCrowd, subscribeChatter, startPresence } from "./live.js";
import { renderMini } from "./rally.js";
import { initScene, setChatter, say, setAwake } from "./scene.js";
import { initAsk } from "./ask.js";
import { createFireworks, initShake, initParallax } from "./fx.js";
import { initWeather } from "./weather.js";
import { upcomingTickets, ticketHtml } from "./tickets.js";
import { drawThread, watchThread } from "./thread.js";
import { wireDetails } from "./detail.js";
import "./offline.js";

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
// 開催中の NOW／NEXT は、ステージを「ステージパフォーマンス」のひとまとまりではなく、出演する団体ごとに出す
const ACTS = STAGE.acts.map((a) => ({ ...a, title: a.name, venue: STAGE.venue }));
const NOW_LIST = ACTS.length ? [...EVENTS.filter((e) => !e.stage), ...ACTS] : EVENTS;
const upcoming = (t) => NOW_LIST.filter((e) => Date.parse(e.start) > t).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
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
  // 絵のすぐ下の日付：10.24 SAT ／ 12:00 ~ 17:00
  const md = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso)).replace("/", ".");
  const wd = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(new Date(iso)).toUpperCase();
  $("#k-days").innerHTML = FESTIVAL.days.map((d) => `
    <p class="k-day"><span class="k-date">${esc(md(d.open))}<small>${esc(wd(d.open))}</small></span><span class="k-time">${hhmm(d.open)} ~ ${hhmm(d.close)}</span></p>`).join("");

  $("#about-body").innerHTML = ABOUT.map((p) => `<p>${esc(p)}</p>`).join("");
  $("#message").innerHTML = `
    <figcaption class="k-msg-title">学生主事より</figcaption>
    <blockquote class="k-msg-body"><p>${MESSAGE.body.map((l) => esc(l).replace(/\d+/g, '<span class="k-num">$&</span>')).join("<br>")}</p></blockquote>
    ${MESSAGE.photo ? `<img class="k-msg-photo" src="${esc(MESSAGE.photo)}" width="466" height="532" alt="${esc(MESSAGE.name)}" loading="lazy" decoding="async">` : ""}`;

  $("#guide-grid").innerHTML = GUIDES.map((g) => `
    <a class="guide-card" href="${esc(g.href)}">
      <span class="guide-icon" aria-hidden="true">${esc(g.icon)}</span>
      <span class="guide-text">
        <b>${esc(g.title)}${g.internal ? '<em class="tag">学内のみ</em>' : ""}</b>
        <small>${esc(g.desc)}</small>
      </span>
      <span class="guide-arrow" aria-hidden="true">→</span>
    </a>`).join("");

  $("#notice-list").innerHTML = NOTICES.map((n) => `<li>${esc(n)}</li>`).join("");
  $("#garbage-grid").innerHTML = GARBAGE.map((g) => `
    <div class="garbage-card" style="--bin:${esc(g.color)}">
      <b>${esc(g.kind)}</b><small>${esc(g.examples)}</small>
    </div>`).join("");

  // 協賛：ロゴ（なければ会社名）を白い札に。まだ決まっていないあいだは、ロゴの入る場所だけ見せる
  $("#sponsor-lead").innerHTML = `計<b class="spon-num">${SPONSORS.count || "●"}</b>社のご協賛により開催しております。<br>ご協力いただいた皆さまに、<br>心より感謝申し上げます。`;
  const sponsorTile = (s) => {
    const inner = s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy" decoding="async">` : `<span>${esc(s.name)}</span>`;
    return `<li>${s.url ? `<a class="spon-tile" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<span class="spon-tile">${inner}</span>`}</li>`;
  };
  $("#sponsor-list").innerHTML = SPONSORS.list.length
    ? SPONSORS.list.map(sponsorTile).join("")
    : Array.from({ length: 6 }, () => '<li aria-hidden="true"><span class="spon-tile is-empty">LOGO</span></li>').join("");

  $("#insta-link").href = FESTIVAL.instagram;

  renderNav();
}

// ---------- カウントダウン ----------
const cdEls = Object.fromEntries([...document.querySelectorAll("[data-cd]")].map((el) => [el.dataset.cd, el]));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastSecond = -1;

// マイクロ秒は Figma のデザインに合わせて今は出していない。
// index.html に <b data-cd="us"> を足せば、また1秒未満まで動く
function tickCountdown() {
  const remain = Math.max(0, OPEN - nowMs()); // ミリ秒（小数あり）
  const totalSec = Math.floor(remain / 1000);
  const us = Math.floor((remain % 1000) * 1000); // 1秒未満をマイクロ秒で
  if (cdEls.us && !reduceMotion) cdEls.us.textContent = String(us).padStart(6, "0");
  if (totalSec !== lastSecond) {
    lastSecond = totalSec;
    cdEls.d.textContent = Math.floor(totalSec / 86400);
    cdEls.h.textContent = String(Math.floor(totalSec / 3600) % 24).padStart(2, "0");
    cdEls.m.textContent = String(Math.floor(totalSec / 60) % 60).padStart(2, "0");
    cdEls.s.textContent = String(totalSec % 60).padStart(2, "0");
    if (cdEls.us && reduceMotion) cdEls.us.textContent = String(us).padStart(6, "0");
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
let lastNowHtml = "";

// 企画名が枠に収まらないときは、電光掲示板のように横に流す
function fitTitles() {
  for (const t of document.querySelectorAll(".now-title")) {
    const over = t.firstElementChild.scrollWidth - t.clientWidth;
    t.classList.toggle("is-long", over > 2);
    t.style.setProperty("--over", `${over}px`);
    t.style.setProperty("--dur", `${Math.max(5, over / 25 + 3)}s`);
  }
}
addEventListener("resize", () => requestAnimationFrame(fitTitles));

function renderDuring() {
  const t = nowMs();
  // Firestore に now_events があればそちらを優先（当日の急な変更用）
  const running = runningEvents(t);
  const next = upcoming(t);

  // Figma の開催中の画面：NOW（緑の札）と NEXT（白い札）。企画の間は NEXT だけ、その日が終わったら翌日の最初の企画
  const row = (e, tag) => `
    <div class="now-row${tag === "NOW" ? " is-now" : ""}">
      <span class="now-tag">${tag}</span>
      <b class="now-title"><span>${esc(e.title)}</span></b>
      <small class="now-sub">${e.start ? `${hhmm(e.start)} ~ ${e.end ? hhmm(e.end) : ""}` : ""}${e.venue ? ` @ ${esc(venueName(e.venue))}` : ""}${e.kind ? `・${esc(e.kind)}` : ""}${e.internal ? "・学内のみ" : ""}</small>
    </div>`;
  const inHours = FESTIVAL.days.some((d) => Date.parse(d.open) <= t && t < Date.parse(d.close));
  const sameDay = (a, b) => new Date(a).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) === new Date(b).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const today = FESTIVAL.days.find((d) => sameDay(t, d.open));
  const beforeOpen = !inHours && today && t < Date.parse(today.open); // 2日目の朝など、開場前
  let html = running.map((e) => row(e, "NOW")).join("");
  if (next) html += row(next, sameDay(t, next.start) ? "NEXT" : "明日");
  if (beforeOpen) html = `<p class="now-closed">本日 ${hhmm(today.open)} 開場</p>` + html;
  else if (!inHours) html = `<p class="now-closed">本日の公開は終了しました</p>` + html;
  else if (!running.length && !next) html = `<p class="now-closed">会場をお楽しみください！</p>`;
  // 毎秒呼ばれるので、中身が変わったときだけ書き換える（横に流れる文字が止まらないように）
  if (html !== lastNowHtml) {
    lastNowHtml = html;
    $("#now-events").innerHTML = html;
    requestAnimationFrame(fitTitles);
  }
  const top = $("#live-badge");
  top.textContent = inHours ? "開催中！" : beforeOpen ? "まもなく開場" : "本日は終了";
  top.classList.toggle("is-closed", !inHours);

  // 生配信：Firestore で stream_active、または live:true のイベント中なら自動でトップに出す
  const liveEvent = EVENTS.some((e) => e.live && Date.parse(e.start) <= t && t < Date.parse(e.end));
  const url = live?.stream_url && (live.stream_active || liveEvent) ? toEmbedUrl(live.stream_url) : null;
  if (url !== currentStream) {
    currentStream = url;
    const box = $("#live-stream");
    $("#live").hidden = !url;
    document.body.classList.toggle("streaming", !!url); // 配信中は「縁」のロゴと入れ替わる
    box.innerHTML = url
      ? `<p class="stream-title"><i class="live-dot" aria-hidden="true"></i>抽選会 生配信中</p><div class="stream-frame"><iframe src="${esc(url)}" title="抽選会 生配信" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
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
// 電柱の右、タイトルの文字の左の空いたところに吊るす。
// 座標は絵（1215×1845）上のピクセル。一番上の電線は、ほぼ y = 515 + (1202 - x) × 0.203 の直線
const POSTER_W = 1215, POSTER_H = 1845;
const wireY = (x) => 515 + (1202 - x) * 0.203;
const TANZAKU_COLORS = ["#9BD7D0", "#FBE1BC", "#E0874A", "#FFFDF8", "#B5655A", "#6CBAB5"];

function renderNav() {
  $("#tanzaku-nav").innerHTML = NAV.map((n, i) => {
    const x = 316 + i * 40;
    return `<a class="tanzaku" href="${esc(n.href)}" style="
      --x:${(x / POSTER_W) * 100}%; --y:${(wireY(x) / POSTER_H) * 100}%;
      --c:${TANZAKU_COLORS[i % TANZAKU_COLORS.length]};
      --dur:${(3.2 + (i % 3) * 0.7).toFixed(1)}s; --delay:${(-i * 0.9).toFixed(1)}s">${esc(n.label)}</a>`;
  }).join("");
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
// どの空の絵を出すか。夜と日暮れは時間を優先し、それ以外は天気を優先する
// （絵は tools/make-skies.py で作った assets/img/sky-*.webp）
function skyImageFor(time, wx) {
  if (time === "night" || time === "dusk") return time;
  if (wx === "rain" || wx === "thunder") return "rain";
  if (wx === "snow") return "snow";
  if (wx === "cloudy" || wx === "fog") return "cloudy";
  return time; // dawn / day / sunset
}
let shownSky = null;
function setSkyImage(name) {
  if (name === shownSky) return;
  shownSky = name;
  document.body.dataset.skyimg = name; // 余白の色も合わせる
  document.documentElement.dataset.tintLocked = "1"; // 差し色も、この空の色に（theme.js）
  window.kosenTheme?.setTint(name);
  const imgs = [$("#sky-a"), $("#sky-b")];
  const next = imgs.find((i) => !i.classList.contains("is-shown")) ?? imgs[0];
  const show = () => {
    if (shownSky !== name) return; // 読み込み中に別の空に変わった
    imgs.forEach((i) => i.classList.toggle("is-shown", i === next));
  };
  const src = `assets/img/sky-${name}.webp`;
  if (next.getAttribute("src") === src && next.complete) return show(); // 前に読んだ空に戻るとき
  next.onload = show;
  next.src = src;
}

function updateSky() {
  const d = new Date(nowMs());
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  const hour = h + m / 60;
  const forced = SKIES.find((s) => s.id === params.get("sky"));
  const sky = forced ?? [...SKIES].reverse().find((s) => hour >= s.from);
  document.body.dataset.sky = sky.id;
  setSkyImage(skyImageFor(sky.id, weather?.kind));
  const parts = [`いまの函館の空 ― ${sky.label}${weather && weather.kind !== "clear" ? `・${weather.label}` : ""} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`];
  if (viewers) parts.push(`${viewers}人がこの絵を見ています`);
  $("#sky-caption").textContent = parts.join("　／　");
}

// ---------- タイムテーブル ----------
const runningEvents = (t = nowMs()) => (live?.now_events?.length
  ? live.now_events
  : NOW_LIST.filter((e) => Date.parse(e.start) <= t && t < Date.parse(e.end)));

// ---------- みどころ（Figma のチケット。形は tickets.js） ----------
// いまやっているもの → これから始まるもの の順に3枚。全部は「ほかの見どころも見る」→ みどころのページ（mido.html）。
// 全部終わったら、みどころごと出さない
let lastMido = "";
wireDetails($("#mido-tickets"), nowMs); // チケットを押すと詳しいシート（地図へはそこから）
function renderMido(t = nowMs()) {
  const list = upcomingTickets(t).slice(0, 3);
  const html = list.map((e, i) => ticketHtml(e, i, t)).join("");
  if (html === lastMido) return;
  lastMido = html;
  $("#mido-tickets").innerHTML = html;
  $("#pickup").hidden = !list.length;
  watchThread($("#mido-tickets"));
  drawThread($("#mido-tickets"));
}

// タイムテーブルのステージの中の出演順
function actsOf(day, t) {
  const acts = ACTS.filter((a) => a.start.startsWith(day));
  if (!acts.length) return "";
  return `<ol class="acts">${acts.map((a) => {
    const now = Date.parse(a.start) <= t && t < Date.parse(a.end);
    const past = Date.parse(a.end) <= t;
    return `<li class="${now ? "is-now" : ""}${past ? " is-past" : ""}"><time>${hhmm(a.start)}</time><span><b>${esc(a.name)}</b><small>${esc(a.kind)}</small></span></li>`;
  }).join("")}</ol>${STAGE.tentative ? '<p class="acts-note">【仮】出演者と時間は仮のものです</p>' : ""}`;
}

function renderSchedule() {
  const t = nowMs();
  renderMido(t);
  $("#timetable").innerHTML = FESTIVAL.days.map((d) => {
    const day = d.open.slice(0, 10);
    const events = EVENTS.filter((e) => e.start.startsWith(day)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    return `
      <h3 class="sub-title">${esc(d.label)}<small>${hhmm(d.open)}〜${hhmm(d.close)}</small></h3>
      <ol class="timeline">${events.map((e) => {
        const now = Date.parse(e.start) <= t && t < Date.parse(e.end);
        const past = Date.parse(e.end) <= t;
        return `
          <li class="${now ? "is-now" : ""}${past ? " is-past" : ""}">
            <time>${hhmm(e.start)}</time>
            <div><b>${esc(e.title)}${e.internal ? '<em class="tag">学内のみ</em>' : ""}${now ? '<em class="tag">NOW</em>' : ""}</b><a class="to-map" href="map.html#${esc(e.venue)}">@${esc(venueName(e.venue))}</a></div>${e.stage ? actsOf(day, t) : ""}
          </li>`;
      }).join("")}</ol>`;
  }).join("");
}

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

  // 電柱の看板（縦書き。色の丸が混雑の度合い）
  $("#pole-sign").innerHTML = `<span class="pole-head">混雑</span>` + CROWD.venues.map((id) => {
    const c = crowd?.[id];
    const level = CROWD.levels[c?.level];
    const stale = c?.updated_at && nowMs() - c.updated_at > CROWD.staleMinutes * 60000;
    return `<span class="pole-row${stale ? " is-stale" : ""}"><i style="--lv:${level?.color ?? "#8a8580"}"></i>${esc(CROWD.short?.[id] ?? venueName(id))}</span>`;
  }).join("");
}

// ---------- 今この絵を見ている人の灯り ----------
// 2本目の電線（y = 540 + (1202 - x) × 0.204）に、右から順に吊るす。絵の中が埋まったら外へ
let viewers = 0;
let weather = null;
const wire2Y = (x) => 540 + (1202 - x) * 0.204;
function renderLanterns(n) {
  viewers = n;
  const shown = Math.min(n, FX.presence.maxLanterns);
  const box = $("#lanterns");
  const have = box.children.length;
  for (let i = have; i < shown; i++) {
    // 絵の中（1191 → 825、タイトルの文字にかからないところ）を先に、そのあと右の外へ
    const x = i < 11 ? 1191 - i * 36.6 : 1248 + (i - 11) * 36.6;
    const el = document.createElement("i");
    el.className = "lantern";
    el.style.cssText = `left:${(x / POSTER_W) * 100}%; top:${(wire2Y(x) / POSTER_H) * 100}%; --flicker:${(2 + Math.random() * 2).toFixed(2)}s`;
    box.append(el);
  }
  while (box.children.length > shown) box.lastChild.remove();
  updateSky();
}

// ---------- 花火 ----------
const fireworks = createFireworks($("#fireworks"));
// 開幕の瞬間：空が暗くなって「開幕」、花火が上がる
function playOpening() {
  document.body.classList.add("opening");
  fireworks.show(9000);
  setTimeout(() => document.body.classList.remove("opening"), 9500);
}
// 花火の時間（学内のみ）は、その間ずっと空に花火
function checkFireworksTime() {
  if (!FX.fireworks.start) return;
  const start = Date.parse(FX.fireworks.start);
  const t = nowMs();
  if (t >= start && t < start + FX.fireworks.minutes * 60000) fireworks.show(3000);
}

// ---------- ループ ----------
let phase = null;
function update() {
  const p = currentPhase();
  if (p !== phase) {
    // 開いたまま待っていた人だけが見られる、カウントダウン0の瞬間
    if (phase === "before" && p === "during") playOpening();
    phase = p;
    document.body.dataset.phase = p;
  }
  if (p === "during") renderDuring();
  updateSky();
  checkFireworksTime();
}

renderStatic();
renderLiveContent();
update();
setInterval(update, 1000);

// カウントダウン：ふだんは秒の変わり目に1回（電池のため）。1秒未満（us）を出しているときだけ毎フレーム
(function tick() {
  if (phase === "before") tickCountdown();
  if (phase === "before" && cdEls.us && !reduceMotion) requestAnimationFrame(tick);
  else setTimeout(tick, 1000 - (nowMs() % 1000) + 10);
})();

// スタンプラリー：縁日の下の小さなスタンプカード。前に印刷したお店の QR（トップページ ?s=&c=）で来たら、スタンプカードのページへ
if (params.has("s") && params.has("c")) location.replace(`rally.html${location.search}`);
renderMini($("#rally-mini"));
initScene(() => {
  const e = phase === "during" ? runningEvents()[0] : null;
  return { phase, nowEvent: e ? { title: e.title, venueName: venueName(e.venue) } : null };
});
// 5人に聞く：答えを作るのに必要な「今の様子」を渡す
initAsk({
  say,
  getState: () => {
    const t = nowMs();
    const next = upcoming(t) ?? null;
    return { phase, now: t, running: runningEvents(t), next, crowd, live, agoText };
  },
});
renderCrowd();
renderSchedule();
setInterval(() => { renderCrowd(); renderSchedule(); }, 30000); // 「○分前に更新」やNOWの印を進める
subscribeCrowd((data) => {
  crowd = data;
  renderCrowd();
});

subscribeLive((data) => {
  live = data;
  renderLiveContent();
  update();
});
subscribeChatter(setChatter);

// 隠しスポットのごほうび
$("#secret-reward").textContent = SECRETS.reward;
$("#secret-download").href = SECRETS.wallpaper;

const shake = initShake($("#shake-btn"));
initParallax();
initWeather($("#weather-fx"), (wx) => { weather = wx; updateSky(); });
if (FX.presence.enabled) {
  startPresence(renderLanterns, { windowMinutes: FX.presence.windowMinutes, isOff: () => !!live?.presence_off });
}
// 開幕から90秒以内に開いた人にも見せる。?fireworks=1 でいつでも確認できる
if (params.has("fireworks") || (nowMs() >= OPEN && nowMs() < OPEN + 90000)) {
  setTimeout(playOpening, document.body.classList.contains("intro") ? 3800 : 600);
}

// ---------- テスト用パネル（?test=1 のときだけ） ----------
if (params.has("test")) {
  import("./test.js").then(({ initTest }) => initTest({ playOpening, setAwake, shake }));
}
