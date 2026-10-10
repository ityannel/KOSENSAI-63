// 校内のディスプレイ（signage.html）：Enistagram の最新・人気の投稿、混雑、ピックアップ模擬店、ステージの「いま・次」、道案内、シェアの QR を、
// 色の帯の「つなぎ」をはさんで、ずっと流す。データは本サイトと同じ Firestore（読むだけ）。使い方は signage.html の先頭に書いてある
import { noticeOf, paintNotice } from "./notice.js";
import { FESTIVAL, STAGE, EVENTS, SPONSORS, CROWD, VENUES, MAP, SHOPS, HOMEROOMS, SIGNAGE } from "./config.js";
import { subscribePosts, loadPhoto } from "./posts.js";
import { subscribeCrowd, subscribeShops, subscribeLive } from "./live.js";
import { avatar, VERIFIED } from "./avatar.js";
import { routeMap } from "./signage-map.js";
import { watchSchedule, tStart, tEnd, tRange } from "./schedule.js"; // スケジュールの変更（本部コンソール）

const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 時刻（?now=2026-10-24T13:20 で、その時刻として動かして確かめられる。ほかのページと同じ書き方。?t= でも同じ） ----------
const T_PARAM = params.get("now") ?? params.get("t");
const T0 = T_PARAM ? Date.parse(T_PARAM.includes("+") ? T_PARAM : `${T_PARAM}+09:00`) : null;
const BOOT = Date.now();
const now = () => (T0 ? T0 + (Date.now() - BOOT) : Date.now());
const jp = (ms, o) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...o }).format(new Date(ms));
const hm = (ms) => jp(ms, { hour: "2-digit", minute: "2-digit", hour12: false });
const dateEn = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.month}.${p.day} ${p.weekday.toUpperCase()}`; }; // 10.24 SAT
const dayOf = (ms) => jp(ms, { month: "numeric", day: "numeric", weekday: "short" });
const ago = (ms) => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? "いま" : m < 60 ? `${m}分前` : `${Math.floor(m / 60)}時間前`; };

// ---------- 画面の大きさに合わせる ----------
const stage = $("#stage");
// 縦のディスプレイ：画面が縦長なら、自動で縦の並び（1080×1920）にする。?o=portrait（縦）／?o=landscape（横）で、決めてもよい
let SW = 1920, SH = 1080;
const fit = () => {
  const o = params.get("o"), portrait = o ? o === "portrait" : innerHeight > innerWidth;
  SW = portrait ? 1080 : 1920; SH = portrait ? 1920 : 1080;
  document.body.classList.toggle("portrait", portrait);
  stage.style.setProperty("--sw", `${SW}px`); stage.style.setProperty("--sh", `${SH}px`);
  stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / SW, innerHeight / SH)})`;
};
addEventListener("resize", fit); fit();
addEventListener("click", () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); });
navigator.wakeLock?.request?.("screen").catch(() => {});
setTimeout(() => location.reload(), 3 * 3600 * 1000); // 長く流しっぱなしでも、新しい版・メモリのために、ときどき読みこみなおす

// ---------- 時計 ----------
const tick = () => { $("#clock-t").textContent = hm(now()); $("#clock-d").textContent = dateEn(now()); };
tick(); setInterval(tick, 5000);

// ---------- データ ----------
let posts = [], crowd = {}, shopDocs = [];
const visibleTop = () => posts.filter((p) => p.visible && !p.reply_to && (p.text.trim() || p.has_photo));
let gotPosts = () => {}; // 最初の投稿が届いたら、流しはじめる（届く前に始めると、投稿の画面が空でとばされる）
const firstPosts = new Promise((r) => { gotPosts = r; });
subscribePosts((list) => {
  if (!list) return;
  posts = list; gotPosts();
  // 写真は、流れる前に先に読んでおく（出す直前に読むと間に合わず、真っ黒の枠になる）。新しい順・いいねの多い順に
  const top = visibleTop().filter((p) => p.has_photo);
  [...top.sort((a, b) => b.created_at - a.created_at).slice(0, 24), ...top.sort((a, b) => b.likes - a.likes).slice(0, 12)].forEach((p) => loadPhoto(p.id).catch(() => {}));
});
subscribeCrowd((d) => { crowd = d ?? {}; });
subscribeShops((l) => { shopDocs = l ?? []; });
// 本部のお知らせ（「全員のキャッシュ削除」を受けとるのも、この購読）。画面の上に、帯で出す。見た目・期間・場所は notice.js
let liveNow = null;
const sgNotice = document.createElement("div");
sgNotice.id = "sg-notice"; sgNotice.hidden = true;
sgNotice.innerHTML = '<div class="sgn-in"></div>';
document.getElementById("stage").append(sgNotice);
function paintSgNotice() {
  const n = noticeOf(liveNow, "signage", now());
  if ((n?.key ?? "") === (sgNotice.dataset.ntKey ?? "")) return;
  sgNotice.dataset.ntKey = n?.key ?? "";
  sgNotice.hidden = !n;
  paintNotice(sgNotice, n, sgNotice.firstElementChild);
}
subscribeLive((d) => { liveNow = d; paintSgNotice(); });
setInterval(paintSgNotice, 15000);

const norm = (t) => String(t ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const flat = (t) => String(t ?? "").replace(/\n/g, " ");
const shopDoc = (s) => { const room = s.room ?? HOMEROOMS[s.cls]; return shopDocs.find((d) => (d.map ? [s.name, s.cls, room].filter(Boolean).some((v) => norm(v) === norm(d.map)) : norm(d.name) === norm(s.name))) ?? null; };
const WAIT = { normal: ["待ちなし", "#2f9e6e"], "10min": ["10分待ち", "#e8a317"], "20min": ["20分以上待ち", "#d93025"], soldout: ["売り切れ", "#6b6b6b"], closed: ["休業中", "#4b5a8a"] };
const venueName = (id) => { const v = VENUES.find((x) => x.id === id); return v ? (v.alias ?? v.name) : id; };
const placeName = (id) => {
  if (!id) return "";
  const v = VENUES.find((x) => x.id === id); if (v) return v.alias ?? v.name;
  const p = MAP.places.find((x) => x.id === id || [].concat(x.room ?? []).includes(id)); if (p) return p.name;
  return /^pt-/.test(id) ? "校内" : id;
};

// ---------- 場所（?at=） ----------
const at = params.get("at");
const spot = SIGNAGE.spots[at] ?? null;
// ---------- 小道具 ----------
// アイコン（絵文字は使わない。線の絵）
const IC = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9h16M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M5 12v8h14v-8M10 20v-5h4v5"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l8-8"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7"/>',
  firework: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6M16 5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 3.5 2.6 3.5 6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  heart: '<path d="M12 20s-7-4.3-9-9c-1.4-3.4.6-6.5 3.8-6.5 2 0 3.4 1 4.2 2.5.8-1.5 2.2-2.5 4.2-2.5 3.2 0 5.2 3.1 3.8 6.5-2 4.7-9 9-9 9z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-4 4 3 3-2 6 4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M12 9l-3 3 3 2-1 5M12 9l4 2 3-1M9 12l-4 1M12 14l4 5"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n] ?? IC.info}</svg>`;
// 数字は、見出しと同じ字（WDXL Lubrifont）で、少し大きく。文の中の数字（12:15・3分・2F など）を .num で包む
function numify(root) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\d/.test(n.nodeValue) && !n.parentElement.closest(".num, em[data-n], #bgclock, .cd, script, style") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const f = document.createDocumentFragment();
    n.nodeValue.split(/(\d+(?:[:.,]\d+)*)/).forEach((t, k) => { if (k % 2) { const s = document.createElement("span"); s.className = "num"; s.textContent = t; f.append(s); } else if (t) f.append(t); });
    n.replaceWith(f);
  }
}
const chars = (text) => [...text].map((c, k) => (c === "\n" ? "<br>" : `<span class="ch${/[A-Za-z]/.test(c) ? " lat" : ""}" style="--k:${k}">${esc(c === " " ? " " : c)}</span>`)).join("");
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3 4.5 6.5 4.5c2 0 3.6 1.1 4.5 2.7h2c.9-1.6 2.5-2.7 4.5-2.7 3.5 0 5.6 3.5 4.1 7.1C19.5 16.4 12 21 12 21z"/></svg>';
const ARROW = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M12 50h66M52 22l28 28-28 28" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ROT = { right: 0, downright: 45, down: 90, downleft: 135, left: 180, upleft: 225, up: 270, upright: 315 };
const arrow = (dir, cls = "ar") => `<span class="${cls}" style="--rot:${ROT[dir] ?? 0}deg">${ARROW}</span>`;
const qr = (text, size = 440) => {
  if (!window.QRCode) return "";
  const box = document.createElement("div");
  new window.QRCode(box, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
  return box.querySelector("canvas")?.toDataURL("image/png") ?? "";
};
const siteUrl = (path) => new URL(path, location.href).href;
async function photos(list) { // 写真は、出す前に読んでおく（空の枠が出ないように。2.5秒まで待つ）
  const got = {};
  await Promise.race([Promise.all(list.filter((p) => p.has_photo).map((p) => loadPhoto(p.id).then((s) => { got[p.id] = s; }).catch(() => {}))), sleep(7000)]);
  return got;
}

// ---------- 投稿の画面 ----------
function postCard(p, i, got, crown) {
  const hue = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 17);
  const photo = p.has_photo && got[p.id];
  const place = placeName(p.place || p.shop || "");
  return `<article class="pc" style="--i:${i}">
    ${crown ? `<span class="crown" style="--i:${i}"><b>${crown}</b><small>位</small></span>` : ""}
    ${photo ? `<div class="pc-ph"><img src="${photo}" alt=""></div>` : `<div class="pc-ph txt" style="--h:${hue}"><q>${esc(p.text)}</q></div>`}
    <div class="pc-b">
      <header>${avatar(p.author)}<b>${esc(p.author)}${p.official ? VERIFIED : ""}</b>${place ? `<span class="pc-pl">${esc(place)}</span>` : ""}</header>
      ${photo && p.text ? `<p>${esc(p.text)}</p>` : ""}
      <footer><span class="heart">${heart}<em data-n="${p.likes}">0</em></span><time>${ago(p.created_at)}</time></footer>
    </div></article>`;
}
function countUp(root) {
  root.querySelectorAll("em[data-n]").forEach((e) => {
    const n = +e.dataset.n, t0 = performance.now() + 900;
    const step = (t) => { const k = Math.min(1, Math.max(0, (t - t0) / 900)); e.textContent = Math.round(n * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
let newOffset = 0;
const slidePosts = {
  async build() {
    const all = visibleTop().sort((a, b) => b.created_at - a.created_at).slice(0, 12);
    if (!all.length) return null;
    const rot = all.map((_, k) => all[(newOffset + k) % all.length]);
    newOffset += 3;
    const got = await photos(rot.slice(0, 6));
    const pick = rot.filter((p) => !p.has_photo || got[p.id]).slice(0, 3); // 写真が読めなかった投稿は、出さない（真っ黒の枠にしない）
    if (!pick.length) return null;
    return { dur: 15000, cls: "posts", after: countUp, bgPhoto: got[pick.find((p) => got[p.id])?.id] ?? null, html: `
      <span class="tag slide-l"><i>${ic("image")}</i><img class="elogo-s" src="assets/img/enistagram.webp" alt="Enistagram">　最新の投稿</span>
      <h1 class="ttl">${chars("みんなの「いま」")}</h1>
      <div class="row">${pick.map((p, i) => postCard(p, i, got)).join("")}</div>` };
  },
};
const slidePopular = {
  async build() {
    const all = visibleTop();
    const liked = all.filter((p) => p.likes > 0).sort((a, b) => b.likes - a.likes || b.created_at - a.created_at);
    const got = await photos(liked.slice(0, 6));
    const pick = liked.filter((p) => !p.has_photo || got[p.id]).slice(0, 3); // 写真が読めなかった投稿は、出さない
    if (pick.length < 2) return null; // いいねが集まっていないときは出さない（最新の画面があるので）
    return { dur: 14000, cls: "posts popular", after: countUp, bgPhoto: got[pick.find((p) => got[p.id])?.id] ?? null, html: `
      <span class="tag slide-l"><i>${ic("heart")}</i><img class="elogo-s" src="assets/img/enistagram.webp" alt="Enistagram">　人気の投稿</span>
      <h1 class="ttl">${chars("いま、いちばん人気！")}</h1>
      <div class="row">${pick.map((p, i) => postCard(p, i, got, i + 1)).join("")}</div>` };
  },
};

// ---------- ピックアップ模擬店 ----------
let shopOrder = [], shopPtr = 0;
function nextShop() {
  if (!shopOrder.length) shopOrder = SHOPS.map((_, i) => i).sort(() => Math.random() - 0.5);
  for (let n = 0; n < shopOrder.length; n++) {
    const s = SHOPS[shopOrder[shopPtr++ % shopOrder.length]];
    const st = shopDoc(s)?.status;
    if (st !== "soldout" && st !== "closed") return s; // 売り切れ・休業のお店は、ピックアップしない
  }
  return SHOPS[shopOrder[shopPtr++ % shopOrder.length]]; // 全部が売り切れ・休業のとき（開催前など）も、画面を出す
}
const slideShop = {
  async build() {
    const s = nextShop();
    if (!s) return null;
    const d = shopDoc(s);
    const room = s.room ?? HOMEROOMS[s.cls];
    const where = `${s.bldg ? `${s.bldg}棟` : ""}${s.floor ? String(s.floor).replace(/F$/, "階") : ""}` || s.where || ""; // 場所は「B棟3階」だけ（部屋番号・「場所」の文字は出さない）
    const w = d && d.status !== "closed" && WAIT[d.status]; // 休業中の札は出さない（開催前は、全部が休業中のことがある）
    // ディスプレイの場所から、そのお店の教室までの道順の地図（場所と、教室の部屋番号がわかるときだけ）
    const rm = spot && room && !/^pt-/.test(room) ? await routeMap(spot.here, room).catch((e) => { console.warn(e); return null; }) : null;
    const lines = String(s.note ?? "").split(/\n/).filter(Boolean);
    const name = flat(s.name);
    return { dur: rm ? 16000 : 13000, cls: "shop", after: (root) => rm?.play(root), html: `
      <span class="tag slide-l"><i>${ic("store")}</i>ピックアップ模擬店</span>
      <div class="body">
        <i class="ghost" aria-hidden="true">${esc(s.group ?? "")}</i>
        <div>
          ${[...name].length > 9 ? `<h2 class="long rise" style="--i:1">${esc(name)}</h2>` : `<h2>${chars(name)}</h2>`}
          <div class="grp">${s.group ? `<span class="chip a rise" style="--i:6">${esc(s.group)}</span>` : ""}${(s.genre ?? []).map((g, i) => `<span class="chip rise" style="--i:${7 + i}">${esc(g)}</span>`).join("")}</div>
          <div class="note">${lines.map((l, i) => `<span class="rise" style="--i:${9 + i}">${esc(l)}</span>`).join("")}</div>
        </div>
        <div class="side">
          ${where ? `<div class="plate pop wkp" style="--i:5"><b>${esc(where)}</b>${rm ? `<span class="wk">歩いて約${rm.minutes}分</span>` : ""}</div>` : ""}
          ${rm ? `<div class="mapbox pop" style="--i:6">${rm.html}</div>` : ""}
          ${w ? `<div class="plate live pop" style="--i:6;--c:${w[1]}"><small>いまのようす</small><b>${w[0]}</b>${d.message ? `<q>${esc(d.message)}</q>` : ""}</div>` : ""}
        </div>
      </div>` };
  },
};

// ---------- 混雑 ----------
const slideCrowd = {
  async build() {
    const cards = CROWD.venues.map((id, i) => {
      const c = crowd[id], lv = CROWD.levels[c?.level] ?? null;
      const stale = c?.updated_at && Date.now() - c.updated_at > CROWD.staleMinutes * 60000;
      const v = VENUES.find((x) => x.id === id);
      const col = lv && !stale ? lv.color : "#9a948c";
      const level = c?.level ?? -1;
      return `<div class="cv rise" style="--i:${i};--c:${col === "#F1D08A" ? "#c99a2e" : col === "#6CBAB5" ? "#2a9d96" : col}">
        <h3>${esc(v?.alias ?? v?.name ?? id)}</h3><span class="al">${esc(v?.alias ? v.name : MAP.places.find((p) => p.id === id)?.sub ?? "")}</span>
        <div class="lv">${lv && !stale ? lv.label : "情報なし"}</div>
        <div class="meter">${[0, 1, 2, 3].map((k) => `<i class="${k <= level && !stale ? "on" : ""}" style="--k:${k}"></i>`).join("")}</div>
        <small class="t">${c?.updated_at ? `${ago(c.updated_at)}に更新${stale ? "（古い情報）" : ""}` : "まだ知らせがありません"}</small></div>`;
    }).join("");
    const fresh = shopDocs.filter((d) => d.updated_at && Date.now() - d.updated_at < 40 * 60000);
    const easy = fresh.filter((d) => d.status === "normal").slice(0, 5);
    const busy = fresh.filter((d) => d.status === "20min" || d.status === "soldout").slice(0, 5);
    const li = (d) => `<li><span>${esc(flat(d.name))}</span><em style="--c:${WAIT[d.status]?.[1]}">${WAIT[d.status]?.[0]}</em></li>`;
    return { dur: 11000, cls: "crowd", html: `
      <span class="tag slide-l"><i>${ic("people")}</i>いまの混雑</span>
      <h1 class="ttl">${chars("人の多さは、どのくらい？")}</h1>
      <div class="row">${cards}</div>
      ${easy.length || busy.length ? `<div class="lists${easy.length && busy.length ? "" : " one"}">
        ${easy.length ? `<div class="ls slide-l" style="--i:5"><h4>すぐ買えるお店</h4><ul>${easy.map(li).join("")}</ul></div>` : ""}
        ${busy.length ? `<div class="ls slide-r" style="--i:5"><h4>待ち時間が長い・売り切れ</h4><ul>${busy.map(li).join("")}</ul></div>` : ""}
      </div>` : ""}` };
  },
};

// ---------- ステージ・企画 ----------
let ACTS = STAGE.acts.map((a) => ({ ...a, s: Date.parse(a.start), e: Date.parse(a.end) }));
let EVS = EVENTS.filter((e) => !e.stage).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) }));
function stageState(t) {
  const cur = ACTS.find((a) => t >= a.s && t < a.e) ?? null;
  const nxt = ACTS.find((a) => a.s > t) ?? null;
  const onEv = EVS.filter((e) => t >= e.s && t < e.e && !e.internal);
  const nextEv = EVS.filter((e) => e.s > t).sort((a, b) => a.s - b.s)[0] ?? null;
  return { cur, nxt, onEv, nextEv };
}
// 急げ！：10分以内に始まるもの（ステージの出演は、いまの出演のあいだは出さない）
function hurryItem(t) {
  const { cur, nxt, nextEv } = stageState(t);
  const list = [];
  if (nxt && !cur && nxt.s - t <= 10 * 60000) list.push({ title: nxt.name, venue: STAGE.venue, s: nxt.s });
  if (nextEv && nextEv.s - t <= 10 * 60000) list.push({ title: nextEv.title, venue: nextEv.venue, s: nextEv.s });
  return list.sort((a, b) => a.s - b.s)[0] ?? null;
}
// 種類・ひとことの札（まだ届いていない団体は、札なし）
// 種類と時刻は丸い札、一言は長いので、札にせず1行の文で（札にすると、細長くつぶれる）
const phList = (x) => [x.photo, ...(x.more ?? [])].filter(Boolean);
const phOf = (x) => phList(x).map((s, k) => `<img class="ph${k ? "" : " on"}" style="--tilt:${[3, -3, 2, -2][k % 4]}deg" src="/${esc(String(s).replace(/^\//, ""))}" alt="" decoding="async">`).join(""); // 出演団体の写真は、あるぶん全部（1枚ずつ、順にかわる）
const chips = (x, extra = "") => { const l = [x.kind].filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join("") + extra; return (l ? `<div class="kind">${l}</div>` : "") + (x.mood ? `<p class="mood">${esc(x.mood)}</p>` : ""); };
const slideStage = {
  async build() {
    const t = now(), { cur, nxt, onEv, nextEv } = stageState(t);
    if (!cur && !nxt && !onEv.length && !nextEv) return null;
    const hot = hurryItem(t);
    const main = cur
      ? `<div class="now slide-l${cur.photo ? " has-ph" : ""}"><span class="lab">NOW ON STAGE</span>${phOf(cur)}<div class="eq">${Array.from({ length: 30 }, (_, k) => `<i style="--k:${k};--h:${30 + Math.round(Math.random() * 55)}%"></i>`).join("")}</div>
          <h2>${esc(cur.name)}</h2>${chips(cur)}
          ${cur.copy ? `<p>${esc(cur.copy).replace(/\n/g, "<br>")}</p>` : ""}
          <div class="barw"><time>${tStart(cur)}</time><div class="bar"><i style="width:${Math.round(((t - cur.s) / (cur.e - cur.s)) * 100)}%"></i></div><time>${tEnd(cur)}</time></div></div>`
      : nxt
        ? `<div class="now wait slide-l${nxt.photo ? " has-ph" : ""}"><span class="lab">NEXT</span>${phOf(nxt)}
          <h2 class="nm">${esc(nxt.name)}</h2>${chips(nxt, `<span class="chip">${tRange(nxt)}</span>`)}
          ${nxt.copy ? `<p>${esc(nxt.copy).replace(/\n/g, "<br>")}</p>` : ""}</div>`
        : `<div class="now wait slide-l"><span class="lab">STAGE</span><h2>おやすみ</h2></div>`; // 出演がないときだけ
    // このあとの出演を、次の1つだけでなく、どんどん並べる（企画があれば、その分は1つ減らす）
    const row = (small, title, time, sub, hotRow, n) => `<div class="nx ${small === "NEXT" ? "is-next" : "is-then"} ${hotRow ? "hot" : ""} rise" style="--i:${n}"><span class="t">${time}</span><span class="w"><small>${small}</small><b class="nm">${esc(title)}</b><i>${esc(sub)}</i></span></div>`;
    const later = ACTS.filter((a) => a.s > t).slice(cur ? 0 : 1).slice(0, (nextEv ? 3 : 4) - (hot ? 1 : 0)); // 出演中でなければ、次の出演は左のカードに出すので、右には2つ目から // 急げ！の帯が出ているときは、場所が狭いので1つ減らす
    const nx = later.map((a, k) => row(k === 0 && cur ? "NEXT" : "THEN", a.name, tStart(a), [a.kind, a.mood].filter(Boolean).join("　"), k === 0 && hot && !cur && hot.s === a.s && hot.title === a.name, 2 + k));
    if (nextEv) nx.push(row(dayOf(nextEv.s) === dayOf(t) ? "このあと" : "つぎの企画", nextEv.title, tStart(nextEv), `${dayOf(nextEv.s) === dayOf(t) ? "" : `${dayOf(nextEv.s)}　`}${venueName(nextEv.venue)}${nextEv.internal ? "（学内の方限定）" : ""}`, hot && hot.s === nextEv.s && hot.title === nextEv.title, 2 + later.length));
    const mini = onEv.length ? `<p class="mini rise" style="--i:4">開催中：${onEv.map((e) => `<em class="nm">${esc(e.title)}</em>（${esc(venueName(e.venue))}）`).join("　")}</p>` : "";
    return { dur: hot ? 15000 : 13000, cls: "stage", after(el) {
      const imgs = [...el.querySelectorAll(".now .ph")];
      if (imgs.length < 2) return;
      let k = 0;
      const id = setInterval(() => { if (!el.isConnected) return clearInterval(id); imgs[k].classList.remove("on"); k = (k + 1) % imgs.length; imgs[k].classList.add("on"); }, 3200);
    }, html: `
      <span class="tag slide-l"><i>${ic("mic")}</i>ステージ・企画</span>
      <h1 class="ttl">${chars(hot ? "まもなく、はじまる！" : "いま、ステージでは")}</h1>
      <div class="grid">${main}<div class="nxt">${nx.join("")}${mini}</div></div>` };
  },
};
// 画面の下の「急げ！」の帯
let hurryKey = "";
function paintHurry() {
  const h = hurryItem(now());
  const el = $("#hurry"), key = h ? `${h.title}|${h.s}` : "";
  if (key === hurryKey) { if (h) { const m = Math.max(0, Math.ceil((h.s - now()) / 60000)); const mm = el.querySelector("[data-min]"); if (mm) { mm.textContent = m ? `あと${m}分` : "まもなく"; numify(mm); } } return; }
  hurryKey = key;
  document.body.classList.toggle("is-hurry", !!h);
  if (!h) { el.hidden = true; el.innerHTML = ""; return; }
  const d = SIGNAGE.dests[h.venue], r = spot?.routes.find((x) => x.to === h.venue);
  const m = Math.max(0, Math.ceil((h.s - now()) / 60000));
  el.hidden = false;
  el.innerHTML = `<span class="run">${ic("run")}</span><span class="big">急げ！</span>
    <span class="txt"><b><span data-min>${m ? `あと${m}分` : "まもなく"}</span>で　<span class="nm">${esc(h.title)}</span></b></span>
    ${r ? arrow(r.dir, "arr") : ""}`;
  numify(el);
}

// 本部がスケジュールを変えたら、出演・企画の一覧を作りなおす（画面は、次に作るときから新しい時間）
function rebuildSchedule() {
  ACTS = STAGE.acts.map((a) => ({ ...a, s: Date.parse(a.start), e: Date.parse(a.end) }));
  EVS = EVENTS.filter((e) => !e.stage).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) }));
}
watchSchedule(rebuildSchedule);
rebuildSchedule();

// ---------- 道案内 ----------
const slideWay = {
  async build() {
    if (!spot) return null;
    const url = siteUrl(`map.html?here=${encodeURIComponent(spot.here)}`);
    const t = now(), hot = hurryItem(t)?.venue;
    const routes = [...spot.routes].sort((x, y) => (y.to === hot) - (x.to === hot)).slice(0, hot ? 4 : 5); // 急げ！の帯が出ているときは、場所が狭いので4つ。行き先の優先は、急ぐ先を上に
    return { dur: 14000, cls: "way", html: `
      <span class="tag slide-l"><i>${ic("compass")}</i>道案内</span>
      <h1 class="ttl">${chars(`${spot.name}から`)}</h1>
      <div class="body">
        <ul>${routes.map((r, i) => { const d = SIGNAGE.dests[r.to]; return `<li class="slide-l ${r.to === hot ? "hot" : ""}" style="--i:${i}"><span class="mk">${ic(d?.mark)}</span>
          <span class="nm">${esc(d?.name ?? r.to)}<small>${esc(d?.sub ?? "")}</small></span><span class="sy">${esc(r.say)}<small>歩いて${r.min}分</small></span>${arrow(r.dir)}</li>`; }).join("")}</ul>
        <div class="qrbox pop" style="--i:6"><img src="${qr(url, 320)}" alt=""><b>スマホで道案内</b><small>QR を読みこむと、ここから行き先まで地図で案内</small></div>
      </div>` };
  },
};

// ---------- シェア ----------
// 顔の絵文字が上からたくさん降ってきて、画面いっぱいに積もっていく（あとから降るものほど、上に重なる）
const FACES = ["😀", "😃", "😄", "😁", "😆", "🥳", "😍", "🤩", "😎", "😊", "😋", "😜", "🤪", "😂", "🥰", "😇", "🤗", "😺", "😻", "🙌", "😆", "😄", "🤣", "😏", "🥹"];
const OTHERS = ["📷", "🍡", "🎤", "✨", "❤️", "🎆", "🎵", "🎉", "⭐", "🎈"];
// 物理：丸い剛体として、重力で落ちて、ぶつかり合って、積もる（重ならない）。シェア画面の間だけ動かす
function emojiRain(root) {
  const box = root.querySelector(".rain");
  if (!box) return;
  // 描くのは、1枚の canvas（絵文字を1つずつ DOM にすると、表示の PC によっては重いので）
  const cv = document.createElement("canvas"), W0 = SW, H0 = SH;
  cv.width = W0; cv.height = H0; cv.className = "rainc";
  box.append(cv);
  const ctx = cv.getContext("2d");
  const W = SW, FLOOR = SH - 62, N = 92, G = 2600, DT = 1 / 60;
  const bodies = [];
  let spawned = 0, last = performance.now(), nextSpawn = last + 700, calm = 0;
  function spawn() {
    const size = 140 + Math.random() * 90, r = size * 0.43;
    const pool = Math.random() < 0.82 ? FACES : OTHERS; // 主に顔の絵文字
    const spr = document.createElement("canvas"), s = Math.round(size * 1.25);
    spr.width = spr.height = s;
    const g = spr.getContext("2d");
    g.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(pool[Math.floor(Math.random() * pool.length)], s / 2, s / 2 + size * 0.06);
    bodies.push({ spr, s, size, r, x: r + Math.random() * (W - 2 * r), y: -r - 20, vx: (Math.random() - 0.5) * 240, vy: 200 + Math.random() * 200, a: Math.random() * 6.28, av: (Math.random() - 0.5) * 4 });
  }
  function step() {
    for (const b of bodies) { b.vy += G * DT; b.x += b.vx * DT; b.y += b.vy * DT; b.a += b.av * DT; }
    for (let it = 0; it < 6; it++) {
      for (const b of bodies) { // 壁と床
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        if (b.y > FLOOR - b.r) { b.y = FLOOR - b.r; if (b.vy > 0) b.vy = -b.vy * 0.18; b.vx *= 0.94; b.av *= 0.9; }
      }
      for (let i = 0; i < bodies.length; i++) {
        for (let k = i + 1; k < bodies.length; k++) {
          const p = bodies[i], q = bodies[k], dx = q.x - p.x, dy = q.y - p.y, min = p.r + q.r, d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = (min - d) / 2;
          p.x -= nx * over; p.y -= ny * over; q.x += nx * over; q.y += ny * over; // めりこみを押し戻す
          const rv = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny; // ぶつかる向きの速さ
          if (rv < 0) { const j = -rv * 0.6; p.vx -= nx * j; p.vy -= ny * j; q.vx += nx * j; q.vy += ny * j; }
          const tv = (q.vx - p.vx) * -ny + (q.vy - p.vy) * nx; // 横にこすれる分は、回る向きへ
          p.av += tv * 0.0016; q.av += tv * 0.0016;
          p.vx *= 0.995; q.vx *= 0.995;
        }
      }
    }
    for (const b of bodies) b.av *= 0.985;
  }
  let acc = 0;
  function frame(now) {
    if (!box.isConnected) return;
    acc += Math.min(0.05, (now - last) / 1000); last = now;
    if (spawned < N && now >= nextSpawn) { spawn(); spawned++; nextSpawn = now + 110 + Math.random() * 60; }
    while (acc >= DT) { step(); acc -= DT; }
    let fast = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W0, H0);
    for (const b of bodies) {
      const c = Math.cos(b.a), s = Math.sin(b.a);
      ctx.setTransform(c, s, -s, c, b.x, b.y);
      ctx.drawImage(b.spr, -b.s / 2, -b.s / 2);
      fast = Math.max(fast, Math.abs(b.vx) + Math.abs(b.vy));
    }
    calm = fast < 12 && spawned >= N ? calm + 1 : 0;
    if (calm < 60) requestAnimationFrame(frame); // 全部おちついたら止める
  }
  requestAnimationFrame(frame);
}
const slideShare = {
  async build() {
    const url = siteUrl("map.html?tab=feed");
    return { dur: 16000, cls: "share", after: emojiRain, html: `
      <div class="rain" aria-hidden="true"></div>
      <div class="wrap">
        <div>
          <h1>あなたも<br><img class="elogo" src="assets/img/enistagram.webp" alt="Enistagram">${chars("でシェア！")}</h1>
          <div class="how">
            <div class="rise" style="--i:6"><i>1</i>QR を読みこむ</div>
            <div class="rise" style="--i:7"><i>2</i>写真かひとことを書く</div>
            <div class="rise" style="--i:8"><i>3</i>場所をえらんで、投稿！</div>
          </div>
        </div>
        <div class="scan pop" style="--i:4"><i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i><img src="${qr(url)}" alt=""><span class="cap">スマホのカメラでピッ</span></div>
      </div>` };
  },
};

// ---------- はじまり（「ようこそ」と「縁」のロゴだけ） ----------
const slideIntro = {
  async build() {
    return { dur: 7000, cls: "intro", html: `
      <span class="en pop" style="--i:0"><img src="assets/img/logo-s.webp" alt="縁"></span>
      <h1>${chars("ようこそ")}</h1>` };
  },
};

// ---------- 一般公開の終了（その日の公開時間が終わってから、5分間だけ。そのあとは、ふだんの画面に戻って案内を続ける） ----------
const CLOSING_MIN = 5;
function closedState(t) {
  const days = FESTIVAL.days.map((d) => ({ close: Date.parse(d.close) }));
  const i = days.findIndex((d) => t >= d.close && t < d.close + CLOSING_MIN * 60000);
  return i < 0 ? null : { final: i === days.length - 1 };
}
const slideClosing = {
  async build() {
    const c = closedState(now());
    return { dur: 60000, cls: "closing", html: `
      <span class="en pop" style="--i:0"><img src="assets/img/logo-s.webp" alt="縁"></span>
      <h1 class="rise" style="--i:2">${c?.final === false ? "本日の" : ""}一般公開は終了しました</h1>
      <p class="rise" style="--i:4">ご来場ありがとうございました</p>` };
  },
};

// ---------- 花火（学内の方限定）：花火の時間は、画面に「花火！」とだけ出し、背景に花火を打ち上げる ----------
const fwEvent = () => EVENTS.find((e) => e.title === "花火");
function fireworksNow(t = now()) { const e = fwEvent(); return !!e && t >= Date.parse(e.start) && t < Date.parse(e.end); }
const slideFireworks = {
  async build() {
    return { dur: 90000, cls: "fwslide", html: `<h1 class="fwt">${chars("花火！")}</h1>` }; // 「花火！」の字だけ（時間・場所の案内は出さない）
  },
};
// 背景の花火：1枚の canvas に、ロケットが昇って開く（花火の時間のあいだだけ動かす）
const fwCv = $("#fw"), fwCtx = fwCv.getContext("2d");
let fwOn = false;
function fwStart() {
  if (fwOn) return;
  fwOn = true; fwCv.width = SW; fwCv.height = SH;
  const rockets = [], parts = [];
  let last = performance.now(), nextAt = last + 300;
  const burst = (x, y, hue) => {
    const n = 90 + Math.floor(Math.random() * 40), ring = Math.random() < 0.35, sp = 260 + Math.random() * 260;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.1, v = ring ? sp : sp * (0.25 + Math.random() * 0.75);
      parts.push({ x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.5 + Math.random() * 0.9, hue: hue + (Math.random() - 0.5) * (ring ? 20 : 70) });
    }
  };
  function frame(now) {
    if (!fwOn) { fwCtx.clearRect(0, 0, SW, SH); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (fwCv.width !== SW || fwCv.height !== SH) { fwCv.width = SW; fwCv.height = SH; }
    if (now >= nextAt) {
      rockets.push({ x: SW * (0.12 + Math.random() * 0.76), y: SH + 10, vx: (Math.random() - 0.5) * 120, vy: -(SH * (0.9 + Math.random() * 0.35)), ty: SH * (0.14 + Math.random() * 0.34), hue: Math.floor(Math.random() * 360), px: 0, py: 0 });
      nextAt = now + 300 + Math.random() * 500;
    }
    fwCtx.clearRect(0, 0, SW, SH);
    fwCtx.globalCompositeOperation = "lighter"; fwCtx.lineCap = "round";
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.px = r.x; r.py = r.y; r.x += r.vx * dt; r.y += r.vy * dt;
      fwCtx.strokeStyle = "rgba(255, 230, 170, .9)"; fwCtx.lineWidth = 5; fwCtx.beginPath(); fwCtx.moveTo(r.px, r.py + 26); fwCtx.lineTo(r.x, r.y); fwCtx.stroke();
      if (r.y <= r.ty) { burst(r.x, r.y, r.hue); rockets.splice(i, 1); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.px = p.x; p.py = p.y; p.vx *= 1 - 1.4 * dt; p.vy = p.vy * (1 - 1.4 * dt) + 360 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const al = 1 - p.life / p.max;
      fwCtx.strokeStyle = `hsla(${p.hue}, 100%, 68%, ${al})`; fwCtx.lineWidth = 9 * al + 2;
      fwCtx.beginPath(); fwCtx.moveTo(p.px, p.py); fwCtx.lineTo(p.x, p.y); fwCtx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
const fwStop = () => { fwOn = false; };
function syncFireworks() { const on = fireworksNow(); document.body.classList.toggle("is-fw", on); on ? fwStart() : fwStop(); }
setInterval(syncFireworks, 2000); syncFireworks();

// ---------- 流れ ----------
const SLIDES = { intro: slideIntro, stage: slideStage, closing: slideClosing, fireworks: slideFireworks, posts: slidePosts, popular: slidePopular, shop: slideShop, crowd: slideCrowd, way: slideWay, share: slideShare };
function plan() {
  if (closedState(now())) return ["closing"]; // 一般公開が終わって5分間は、この1枚だけ
  if (fireworksNow()) return ["fireworks"]; // 花火の時間は、この1枚だけ（背景に花火）
  const base = ["intro", "stage", "posts", "shop", "crowd", "popular", "shop", "way", "shop", "share"];
  if (hurryItem(now())) base.splice(5, 0, "stage"); // 急げ！のときは、ステージの画面を多めに
  return base;
}
let order = [], idx = -1, timer = null, busy = false, dir = 1;
const slide = $("#slide"), wipe = $("#wipe");

// 画面の切りかえ：「縁」のはんこと一緒に、「Sponsored by」と協賛企業のロゴを1社ずつ（1周で8社が、ひととおり出る）
const SPON = SPONSORS.list.filter((x) => x.logo).slice(0, 8);
SPON.forEach((x) => { const im = new Image(); im.src = x.logo; }); // 先に読んでおく
let wipeN = 0;
async function cover() {
  wipe.querySelectorAll("i.b2").forEach((b) => b.getAnimations().forEach((x) => x.cancel())); // 前の切りかえの虹の帯を、もとにもどす
  const wsp = wipe.querySelector("#wsp"), sp = SPON.length ? SPON[wipeN++ % SPON.length] : null;
  if (wsp) wsp.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  wipe.classList.toggle("has-spon", !!(wsp && sp));
  const portrait = document.body.classList.contains("portrait");
  if (wsp && sp) {
    wsp.querySelector("img").src = sp.logo; wsp.querySelector("img").alt = sp.name ?? "";
    // 「縁」が左へ動いたあと（1.7秒ごろ）、右（縦の画面は下）から、ふわっと乗る
    const from = portrait ? "translate(-50%, calc(-50% + 90px)) scale(.85)" : "translate(calc(-50% + 110px), -50%) scale(.85)";
    wsp.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "translate(-50%, -50%) scale(1.02)", offset: .7 }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }], { duration: 900, delay: 1700, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
  }
  const bars = [...wipe.querySelectorAll("i:not(.b2)")], seal = wipe.querySelector("b");
  const inn = bars.map((b, k) => b.animate([{ transform: "translateX(-120%) skewX(-14deg)" }, { transform: "translateX(0) skewX(-14deg)" }], { duration: 520, delay: k * 70, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" }));
  seal.animate([{ opacity: 0, transform: "scale(2.2) rotate(-14deg)" }, { opacity: 1, transform: "scale(1) rotate(-6deg)", offset: .55 }, { opacity: 1, transform: "scale(1) rotate(-6deg)" }], { duration: 900, delay: 330, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" });
  // ロゴが出るときは、押されたあと、左へふわっと動く（縦の画面は、上へ）。少し小さくなって、ロゴに場所をゆずる
  if (sp) seal.animate([{ transform: "translate(0, 0) scale(1) rotate(-6deg)" }, { transform: portrait ? "translate(0, -300px) scale(.8) rotate(-4deg)" : "translate(-470px, 0) scale(1) rotate(-4deg)" }], { duration: 1000, delay: 1250, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" });
  // 紙吹雪：はんこが押されるときに、いろいろな色が四方へ散る
  const COL = ["#d9669b", "#2f8fe0", "#a061c9", "#ffd24a", "#3BF53D", "#FEEBC4", "#ff6b5e"];
  wipe.querySelectorAll("s").forEach((d, k, all) => {
    const ang = (k / all.length) * Math.PI * 2 + 0.3, far = 360 + (k % 3) * 120;
    d.style.setProperty("--c", COL[k % COL.length]); d.style.setProperty("--s", `${22 + (k % 4) * 8}px`);
    d.animate([{ opacity: 1, transform: "translate(0, 0) scale(.3) rotate(0)" }, { opacity: 1, transform: `translate(${Math.cos(ang) * far}px, ${Math.sin(ang) * far}px) scale(1) rotate(${k * 70}deg)`, offset: .7 }, { opacity: 0, transform: `translate(${Math.cos(ang) * far * 1.15}px, ${Math.sin(ang) * far * 1.15 + 60}px) scale(.8) rotate(${k * 90}deg)` }], { duration: 1000, delay: 480, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" });
  });
  await Promise.all(inn.map((a) => a.finished.catch(() => {}))); // 全画面にしたときなどに、動きが取り消されても止まらない
  if (sp) await sleep(2800); // 「縁」が動いて、ロゴが乗るまで待ち、しっかり見せる（帯がおおったまま、止める）
  return () => {
    // 次の画面が映るとき：「縁」とロゴは、そのまま残し、虹色の帯がその上を通って消していく（帯が全部おおったところで、下のものを片づける）
    const top = [...wipe.querySelectorAll("i.b2")];
    const pass = top.map((b, k) => b.animate([{ transform: "translateX(-120%) skewX(-14deg)" }, { transform: "translateX(120%) skewX(-14deg)" }], { duration: 1100, delay: k * 70, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" }));
    setTimeout(() => {
      bars.forEach((b) => b.getAnimations().forEach((x) => x.cancel()));
      seal.getAnimations().forEach((x) => x.cancel());
      wsp?.getAnimations({ subtree: true }).forEach((x) => x.cancel());
    }, 3 * 70 + 560);
    return Promise.all(pass.map((a) => a.finished.catch(() => {})));
  };
}
// 画面ごとの背景（ポスターの空の色。上→下）。差し色はその上の色
const BG = { intro: ["#3f9f99", "#9BD7D0"], posts: ["#2f8fe0", "#9BD7D0"], popular: ["#d9669b", "#F2A96A"], shop: ["#ee7b30", "#efc696"], crowd: ["#3f9f99", "#F1D08A"],
  stage: ["#ee7b30", "#B5655A"], way: ["#B5655A", "#F2A96A"], share: ["#a061c9", "#2f8fe0"], fireworks: ["#0b1030", "#3a1d5c"], closing: ["#3f9f99", "#9BD7D0"] };
// ステージのカードの紹介（セットリストなど）が長くて、画面の下からはみ出す・下の帯に隠れるときは、行を減らして「…」で省略する
function fitNow(el) {
  const limit = () => slide.getBoundingClientRect().bottom - 8;
  // 右の「このあと」の列が、画面の下からはみ出すときは、いちばん下から減らす（カードも、その高さにそろうので）
  const nxs = [...el.querySelectorAll(".nx")];
  while (nxs.length > 1 && nxs[nxs.length - 1].getBoundingClientRect().bottom > limit()) nxs.pop().remove();
  const p = el.querySelector(".now > p:not(.mood)");
  if (!p) return;
  // 紹介の最後の行が、画面の下（と、カードの下の余白）に収まる行数まで減らす。1行でも入らなければ出さない
  const pad = parseFloat(getComputedStyle(p.parentElement).paddingBottom) || 0;
  const over = () => p.getBoundingClientRect().bottom + pad > limit();
  let n = 8;
  p.style.webkitLineClamp = String(n);
  while (n > 1 && over()) { n--; p.style.webkitLineClamp = String(n); }
  if (over()) p.style.display = "none";
}
async function show(i, first = false) {
  if (busy) return;
  busy = true; clearTimeout(timer);
  try {
    if (!order.length || i >= order.length) { order = params.get("only") ? [params.get("only")] : plan(); i = 0; }
    if (i < 0) i = order.length - 1;
    // 出す中身を先に作る（写真を読む・QR を作る）。作れない（データがない）画面は、とばす
    let built = null, tries = 0;
    while (!built && tries++ < order.length) {
      built = await SLIDES[order[i]].build().catch((e) => { console.warn(e); return null; });
      if (!built) i = (i + dir + order.length) % order.length;
    }
    if (!built) { built = await slideShare.build(); order = ["share"]; i = 0; }
    const key = order[i];
    let uncover = null;
    if (!first) uncover = await cover();
    slide.innerHTML = `<section class="sl ${built.cls}">${built.html}</section>`;
    const [c1, c2] = BG[key] ?? BG.intro;
    stage.style.setProperty("--bg1", c1); stage.style.setProperty("--bg2", c2); stage.style.setProperty("--a", c1);
    const el = slide.firstElementChild;
    numify(el);
    fitNow(el);
    // 写真つきの投稿の画面では、その写真を、背景にうっすら重ねる
    const bp = $("#bgphoto");
    if (!bp) { /* 古い signage.html（背景の写真の場所がない）のとき */ } else if (built.bgPhoto) { bp.style.backgroundImage = `url("${built.bgPhoto}")`; bp.classList.add("on"); } else bp.classList.remove("on");
    idx = i;
    if (uncover) { const p = uncover(); await sleep(120); el.classList.add("go"); built.after?.(el); await p; } else { el.classList.add("go"); built.after?.(el); }
    if (!params.get("only")) timer = setTimeout(() => { dir = 1; go(idx + 1); }, built.dur);
    else timer = setTimeout(() => { dir = 1; go(idx); }, built.dur);
  } finally { busy = false; }
}
function go(i) { const el = slide.firstElementChild; if (el) el.classList.add("out"); return show(i); }
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "ArrowRight") { dir = 1; go(idx + 1); }
  else if (e.key === "ArrowLeft") { dir = -1; go(idx - 1); }
  else if (e.key === "f") document.documentElement.requestFullscreen?.().catch(() => {});
});
setInterval(paintHurry, 15000);

(async () => {
  await Promise.race([firstPosts, sleep(7000)]); await sleep(1200); // データ（投稿・混雑・お店）が届くのを待ってから始める
  paintHurry();
  show(0, true);
})();

// ---------- テスト用パネル（?test=1 のときだけ。全ページ共通の test-loader.js が読みこむ）：画面を送る操作だけ、ここから渡す ----------
globalThis.kosenHooks = { signage: { step: (d) => { dir = d; go(idx + d); } } };
