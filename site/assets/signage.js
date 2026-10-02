// 校内のディスプレイ（signage.html）：Enistagram の最新・人気の投稿、混雑、ピックアップ模擬店、ステージの「いま・次」、道案内、シェアの QR を、
// 色の帯の「つなぎ」をはさんで、ずっと流す。データは本サイトと同じ Firestore（読むだけ）。使い方は signage.html の先頭に書いてある
import { FESTIVAL, STAGE, EVENTS, CROWD, VENUES, MAP, SHOPS, HOMEROOMS, SIGNAGE } from "./config.js";
import { subscribePosts, loadPhoto } from "./posts.js";
import { subscribeCrowd, subscribeShops, subscribeLive } from "./live.js";
import { avatar, VERIFIED } from "./avatar.js";

const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 時刻（?t=2026-10-24T13:20 で、その時刻として動かして確かめられる） ----------
const T0 = params.get("t") ? Date.parse(params.get("t").includes("+") ? params.get("t") : `${params.get("t")}+09:00`) : null;
const BOOT = Date.now();
const now = () => (T0 ? T0 + (Date.now() - BOOT) : Date.now());
const jp = (ms, o) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...o }).format(new Date(ms));
const hm = (ms) => jp(ms, { hour: "2-digit", minute: "2-digit", hour12: false });
const dateEn = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.month}.${p.day} ${p.weekday.toUpperCase()}`; }; // 10.24 SAT
const dayOf = (ms) => jp(ms, { month: "numeric", day: "numeric", weekday: "short" });
const ago = (ms) => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? "いま" : m < 60 ? `${m}分前` : `${Math.floor(m / 60)}時間前`; };

// ---------- 画面の大きさに合わせる ----------
const stage = $("#stage");
const fit = () => { stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
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
subscribePosts((list) => {
  if (!list) return;
  posts = list;
  // 写真は、流れる前に先に読んでおく（出す直前に読むと間に合わず、真っ黒の枠になる）。新しい順・いいねの多い順に
  const top = visibleTop().filter((p) => p.has_photo);
  [...top.sort((a, b) => b.created_at - a.created_at).slice(0, 24), ...top.sort((a, b) => b.likes - a.likes).slice(0, 12)].forEach((p) => loadPhoto(p.id).catch(() => {}));
});
subscribeCrowd((d) => { crowd = d ?? {}; });
subscribeShops((l) => { shopDocs = l ?? []; });
subscribeLive(() => {}); // 「全員のキャッシュ削除」を受けとる（live.js の中で、読みこみなおす）

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
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (/\d/.test(n.nodeValue) && !n.parentElement.closest(".num, em[data-n], #bgclock, script, style") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) {
    const f = document.createDocumentFragment();
    n.nodeValue.split(/(\d+(?:[:.,]\d+)*)/).forEach((t, k) => { if (k % 2) { const s = document.createElement("span"); s.className = "num"; s.textContent = t; f.append(s); } else if (t) f.append(t); });
    n.replaceWith(f);
  }
}
const chars = (text) => [...text].map((c, k) => (c === "\n" ? "<br>" : `<span class="ch" style="--k:${k}">${esc(c)}</span>`)).join("");
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
    ${crown ? `<span class="crown" style="--i:${i}">${crown}位</span>` : ""}
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
  return null;
}
const slideShop = {
  async build() {
    const s = nextShop();
    if (!s) return null;
    const d = shopDoc(s);
    const room = s.room ?? HOMEROOMS[s.cls];
    const where = `${s.bldg ? `${s.bldg}棟` : ""}${s.floor ? String(s.floor).replace(/F$/, "階") : ""}` || s.where || ""; // 場所は「B棟3階」だけ（部屋番号・「場所」の文字は出さない）
    const w = d && WAIT[d.status];
    const lines = String(s.note ?? "").split(/\n/).filter(Boolean);
    const name = flat(s.name);
    return { dur: 13000, cls: "shop", html: `
      <span class="tag slide-l"><i>${ic("store")}</i>ピックアップ模擬店</span>
      <div class="body">
        <i class="ghost" aria-hidden="true">${esc(s.group ?? "")}</i>
        <div>
          <h2>${chars(name)}</h2>
          <div class="grp">${s.group ? `<span class="chip a rise" style="--i:6">${esc(s.group)}</span>` : ""}${(s.genre ?? []).map((g, i) => `<span class="chip rise" style="--i:${7 + i}">${esc(g)}</span>`).join("")}</div>
          <div class="note">${lines.map((l, i) => `<span class="rise" style="--i:${9 + i}">${esc(l)}</span>`).join("")}</div>
        </div>
        <div class="side">
          ${where ? `<div class="plate pop" style="--i:5"><b>${esc(where)}</b></div>` : ""}
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
const ACTS = STAGE.acts.map((a) => ({ ...a, s: Date.parse(a.start), e: Date.parse(a.end) }));
const EVS = EVENTS.filter((e) => !e.stage).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) }));
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
const slideStage = {
  async build() {
    const t = now(), { cur, nxt, onEv, nextEv } = stageState(t);
    if (!cur && !nxt && !onEv.length && !nextEv) return null;
    const hot = hurryItem(t);
    const main = cur
      ? `<div class="now slide-l"><span class="lab">NOW ON STAGE</span><div class="eq">${[0, 1, 2, 3, 4].map((k) => `<i style="--k:${k}"></i>`).join("")}</div>
          <h2>${esc(cur.name)}</h2><div class="kind"><span class="chip">${esc(cur.kind)}</span><span class="chip">${esc(cur.mood)}</span><span class="chip">〜${hm(cur.e)}</span></div>
          <p>${esc(cur.copy).replace(/\n/g, "<br>")}</p>
          <div class="bar"><i style="width:${Math.round(((t - cur.s) / (cur.e - cur.s)) * 100)}%"></i></div></div>`
      : `<div class="now wait slide-l"><span class="lab">STAGE</span>
          <h2>${nxt ? "まもなく" : "おやすみ"}</h2>${nxt ? `<p>${hm(nxt.s)}〜　<span class="nm">${esc(nxt.name)}</span></p>` : ""}</div>`;
    const nx = [];
    if (nxt) nx.push(`<div class="nx ${hot && !cur && hot.s === nxt.s && hot.title === nxt.name ? "hot" : ""} rise" style="--i:2"><small>NEXT</small><b>${esc(nxt.name)}</b><time>${hm(nxt.s)}〜　${esc(nxt.kind)}</time></div>`);
    if (nextEv) nx.push(`<div class="nx ${hot && hot.s === nextEv.s && hot.title === nextEv.title ? "hot" : ""} rise" style="--i:3"><small>${dayOf(nextEv.s) === dayOf(t) ? "このあと" : "つぎの企画"}</small><b>${esc(nextEv.title)}</b><time>${dayOf(nextEv.s) === dayOf(t) ? "" : `${dayOf(nextEv.s)} `}${hm(nextEv.s)}〜　${esc(venueName(nextEv.venue))}${nextEv.internal ? "（学内の方限定）" : ""}</time></div>`);
    const mini = onEv.length ? `<p class="mini rise" style="--i:4">開催中：${onEv.map((e) => `<em class="nm">${esc(e.title)}</em>（${esc(venueName(e.venue))}）`).join("　")}</p>` : "";
    return { dur: hot ? 15000 : 13000, cls: "stage", html: `
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
    <span class="txt"><b><span data-min>${m ? `あと${m}分` : "まもなく"}</span>で　<span class="nm">${esc(h.title)}</span></b><small>${esc(d?.sub ?? venueName(h.venue))}${r ? `　→　${esc(r.say)}（歩いて${r.min}分）` : ""}</small></span>
    ${r ? arrow(r.dir, "arr") : ""}`;
  numify(el);
}

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
const slideShare = {
  async build() {
    const url = siteUrl("map.html?tab=feed");
    return { dur: 13000, cls: "share", html: `
      ${["camera", "store", "mic", "spark", "heart"].map((e, i) => `<span class="float" style="--i:${i};left:${[6, 44, 80, 30, 92][i]}%;top:${[12, 70, 6, 82, 50][i]}%">${ic(e)}</span>`).join("")}
      <div class="wrap">
        <div>
          <h1>あなたも<br><img class="elogo" src="assets/img/enistagram.webp" alt="Enistagram"><br>${chars("でシェア！")}</h1>
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

// ---------- はじまり ----------
const slideIntro = {
  async build() {
    const t = now(), first = Date.parse(FESTIVAL.days[0].open), last = Date.parse(FESTIVAL.days.at(-1).close);
    let big = "";
    if (t < first) {
      const m = Math.floor((first - t) / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
      big = `<div class="big pop" style="--i:5"><span>開幕まで あと</span>${d ? `<b>${d}</b><span>日</span>` : ""}<b>${h}</b><span>時間</span><b>${m % 60}</b><span>分</span></div>`;
    } else if (t >= last) {
      big = `<div class="big pop" style="--i:5"><span>ご来場、ありがとうございました</span></div>`;
    } else {
      const day = FESTIVAL.days.find((x) => t < Date.parse(x.close));
      big = `<div class="big pop" style="--i:5"><span class="d">${dateEn(Date.parse(day.open))}</span><b>${hm(Date.parse(day.open))}</b><span>〜</span><b>${hm(Date.parse(day.close))}</b></div>`;
    }
    return { dur: 9000, cls: "intro", html: `
      <span class="en pop" style="--i:0"><img src="assets/img/logo-s.webp" alt="縁"></span>
      <h1>${chars("ようこそ、縁へ")}</h1>
      <p class="fade" style="--i:4">第63回 函館高専祭</p>${big}` };
  },
};

// ---------- 流れ ----------
const SLIDES = { intro: slideIntro, stage: slideStage, posts: slidePosts, popular: slidePopular, shop: slideShop, crowd: slideCrowd, way: slideWay, share: slideShare };
function plan() {
  const base = ["intro", "stage", "posts", "shop", "crowd", "popular", "shop", "way", "shop", "share"];
  if (hurryItem(now())) base.splice(5, 0, "stage"); // 急げ！のときは、ステージの画面を多めに
  return base;
}
let order = [], idx = -1, timer = null, busy = false, dir = 1;
const slide = $("#slide"), wipe = $("#wipe");

async function cover() {
  const bars = [...wipe.querySelectorAll("i")], seal = wipe.querySelector("b");
  const inn = bars.map((b, k) => b.animate([{ transform: "translateX(-120%) skewX(-14deg)" }, { transform: "translateX(0) skewX(-14deg)" }], { duration: 520, delay: k * 70, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" }));
  seal.animate([{ opacity: 0, transform: "scale(2.2) rotate(-14deg)" }, { opacity: 1, transform: "scale(1) rotate(-6deg)", offset: .55 }, { opacity: 1, transform: "scale(1) rotate(-6deg)" }], { duration: 900, delay: 330, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" });
  // 紙吹雪：はんこが押されるときに、いろいろな色が四方へ散る
  const COL = ["#d9669b", "#2f8fe0", "#a061c9", "#ffd24a", "#3BF53D", "#FEEBC4", "#ff6b5e"];
  wipe.querySelectorAll("s").forEach((d, k, all) => {
    const ang = (k / all.length) * Math.PI * 2 + 0.3, far = 360 + (k % 3) * 120;
    d.style.setProperty("--c", COL[k % COL.length]); d.style.setProperty("--s", `${22 + (k % 4) * 8}px`);
    d.animate([{ opacity: 1, transform: "translate(0, 0) scale(.3) rotate(0)" }, { opacity: 1, transform: `translate(${Math.cos(ang) * far}px, ${Math.sin(ang) * far}px) scale(1) rotate(${k * 70}deg)`, offset: .7 }, { opacity: 0, transform: `translate(${Math.cos(ang) * far * 1.15}px, ${Math.sin(ang) * far * 1.15 + 60}px) scale(.8) rotate(${k * 90}deg)` }], { duration: 1000, delay: 480, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" });
  });
  await Promise.all(inn.map((a) => a.finished));
  return () => {
    seal.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.8) rotate(-6deg)" }], { duration: 300, fill: "forwards" });
    return Promise.all(bars.map((b, k) => b.animate([{ transform: "translateX(0) skewX(-14deg)" }, { transform: "translateX(120%) skewX(-14deg)" }], { duration: 560, delay: 240 + k * 70, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" }).finished));
  };
}
// 画面ごとの背景（ポスターの空の色。上→下）。差し色はその上の色
const BG = { intro: ["#3f9f99", "#9BD7D0"], posts: ["#2f8fe0", "#9BD7D0"], popular: ["#d9669b", "#F2A96A"], shop: ["#ee7b30", "#efc696"], crowd: ["#3f9f99", "#F1D08A"],
  stage: ["#ee7b30", "#B5655A"], way: ["#B5655A", "#F2A96A"], share: ["#a061c9", "#2f8fe0"] };
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
  await sleep(1800); // データ（投稿・混雑・お店）が届くのを、少し待ってから始める
  paintHurry();
  show(0, true);
})();

// ---------- テスト用の操作パネル（?test=1 のときだけ。本ページの ?test=1 と同じ使い方：値を変えて読みこみなおす） ----------
if (params.has("test")) {
  document.documentElement.style.cursor = "auto"; document.body.style.cursor = "auto";
  const TIMES = [["いま（本当の時刻）", ""], ["開幕前（11:50）", "2026-10-24T11:50"], ["開催中・出演中（13:20）", "2026-10-24T13:20"], ["出演の合間（急げ！）", "2026-10-24T12:08"],
    ["1日目の夜", "2026-10-24T18:00"], ["2日目の朝", "2026-10-25T08:30"], ["結果発表の直前（15:55）", "2026-10-25T15:55"], ["終了後", "2026-10-26T10:00"]];
  const PLACES = [["なし（道案内は出ない）", ""], ["第1講義室の前", "lecture1"], ["総務課の横の廊下の角", "soumu"], ["インフォメーション前", "info"]];
  const SCREENS = [["全部流す", ""], ["ようこそ", "intro"], ["ステージ", "stage"], ["最新の投稿", "posts"], ["人気の投稿", "popular"], ["模擬店", "shop"], ["混雑", "crowd"], ["道案内", "way"], ["シェア", "share"]];
  const reloadWith = (ch) => { const p = new URLSearchParams(location.search); for (const [k, v] of Object.entries(ch)) { if (v === "" || v == null || v === false) p.delete(k); else p.set(k, v === true ? "1" : v); } p.set("test", "1"); location.search = p; };
  const cur = (k) => params.get(k) ?? "";
  const opt = (list, v) => list.map(([l, x]) => `<option value="${esc(x)}"${x === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const box = document.createElement("div");
  box.className = "tp";
  box.innerHTML = `<button type="button" class="tp-t">テスト</button><div class="tp-b" hidden>
    <label>時刻<select data-k="t">${opt(TIMES, cur("t"))}</select></label>
    <label>場所<select data-k="at">${opt(PLACES, cur("at"))}</select></label>
    <label class="chk"><input type="checkbox" data-k="demo"${params.has("demo") ? " checked" : ""}>見本の投稿・混雑・お店</label>
    <div class="tp-s">${SCREENS.map(([l, x]) => `<button type="button" data-only="${x}" aria-pressed="${cur("only") === x}">${l}</button>`).join("")}</div>
    <div class="tp-n"><button type="button" data-step="-1">前へ</button><button type="button" data-step="1">次へ</button></div></div>`;
  document.body.append(box);
  const open = sessionStorage.getItem("kosen63-sg-test") === "1";
  box.querySelector(".tp-b").hidden = !open;
  box.querySelector(".tp-t").addEventListener("click", () => { const b = box.querySelector(".tp-b"); b.hidden = !b.hidden; try { sessionStorage.setItem("kosen63-sg-test", b.hidden ? "0" : "1"); } catch { /* 保存できない */ } });
  box.addEventListener("click", (e) => e.stopPropagation()); // 全画面にする、画面クリックを、パネルでは起こさない
  box.addEventListener("change", (e) => { const k = e.target.dataset.k; if (k) reloadWith({ [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }); });
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.only != null) reloadWith({ only: b.dataset.only });
    else if (b.dataset.step) { dir = +b.dataset.step; go(idx + dir); }
  });
}
