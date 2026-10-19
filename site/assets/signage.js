import { noticeOf, paintNotice } from "./notice.js";
import { watchDevice } from "./signage-device.js";
import { needSetup, openSetup, offerSetup, wireSetupTriggers } from "./signage-setup.js";
import { FESTIVAL, STAGE, EVENTS, CROWD, VENUES, MAP, SHOPS, HOMEROOMS, SIGNAGE, RALLY } from "./config.js";
import { subscribePosts, loadPhoto } from "./posts.js";
import { subscribeCrowd, subscribeShops, subscribeLive } from "./live.js";
import { avatar, VERIFIED } from "./avatar.js";
import { routeMap, pointRoutes } from "./signage-map.js";
import { watchSchedule, tStart, tEnd, tRange } from "./schedule.js";

const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T_PARAM = params.get("now") ?? params.get("t");
const T0 = T_PARAM ? Date.parse(T_PARAM.includes("+") ? T_PARAM : `${T_PARAM}+09:00`) : null;
const BOOT = Date.now();
const now = () => (T0 ? T0 + (Date.now() - BOOT) : Date.now());
const jp = (ms, o) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...o }).format(new Date(ms));
const hm = (ms) => jp(ms, { hour: "2-digit", minute: "2-digit", hour12: false });
const dateEn = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.month}.${p.day} ${p.weekday.toUpperCase()}`; };
const dayOf = (ms) => jp(ms, { month: "numeric", day: "numeric", weekday: "short" });
const ago = (ms) => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? "いま" : m < 60 ? `${m}分前` : `${Math.floor(m / 60)}時間前`; };

const stage = $("#stage");
let SW = 1920, SH = 1080;
let devCfg = null, facing = 0;
const fit = () => {
  const o = params.get("o") || (devCfg?.orient === "portrait" || devCfg?.orient === "landscape" ? devCfg.orient : null), portrait = o ? o === "portrait" : innerHeight > innerWidth;
  SW = portrait ? 1080 : 1920; SH = portrait ? 1920 : 1080;
  document.body.classList.toggle("portrait", portrait);
  stage.style.setProperty("--sw", `${SW}px`); stage.style.setProperty("--sh", `${SH}px`);
  stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / SW, innerHeight / SH)})`;
};
addEventListener("resize", fit); fit();
addEventListener("click", () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); });
navigator.wakeLock?.request?.("screen").catch(() => {});
setTimeout(() => location.reload(), 3 * 3600 * 1000);

const tick = () => { $("#clock-t").textContent = hm(now()); $("#clock-d").textContent = dateEn(now()); };
tick(); setInterval(tick, 5000);

let posts = [], crowd = {}, shopDocs = [];
const visibleTop = () => posts.filter((p) => p.visible && !p.reply_to && (p.text.trim() || p.has_photo));
let gotPosts = () => {};
const firstPosts = new Promise((r) => { gotPosts = r; });
subscribePosts((list) => {
  if (!list) return;
  posts = list; gotPosts();
  const top = visibleTop().filter((p) => p.has_photo);
  [...top.sort((a, b) => b.created_at - a.created_at).slice(0, 24), ...top.sort((a, b) => b.likes - a.likes).slice(0, 12)].forEach((p) => loadPhoto(p.id).catch(() => {}));
});
subscribeCrowd((d) => { crowd = d ?? {}; });
subscribeShops((l) => { shopDocs = l ?? []; });
let liveNow = null;
const sgNotice = document.createElement("div");
sgNotice.id = "sg-notice"; sgNotice.hidden = true;
sgNotice.innerHTML = '<div class="sgn-in"></div>';
document.getElementById("stage").append(sgNotice);
function paintSgNotice() {
  if (devCfg?.banner && Date.now() < (devCfg.banner_until ?? 0)) {
    const key = `dev:${devCfg.banner}`;
    if (sgNotice.dataset.ntKey !== key) {
      sgNotice.dataset.ntKey = key;
      sgNotice.hidden = false;
      sgNotice.classList.remove("is-urgent");
      sgNotice.firstElementChild.textContent = devCfg.banner;
    }
    return;
  }
  if ((sgNotice.dataset.ntKey ?? "").startsWith("dev:")) sgNotice.dataset.ntKey = "";
  const raw = noticeOf(liveNow, "signage", now());
  const n = raw?.urgent ? raw : null;
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

const at = params.get("at");
let spot = SIGNAGE.spots[at] ?? null;
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
const arrow = (dir, cls = "ar") => `<span class="${cls}" style="--rot:${((ROT[dir] ?? 0) + facing) % 360}deg">${ARROW}</span>`;
const qr = (text, size = 440, colors = {}) => {
  if (!window.QRCode) return "";
  const box = document.createElement("div");
  new window.QRCode(box, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M, ...colors });
  return box.querySelector("canvas")?.toDataURL("image/png") ?? "";
};
const siteUrl = (path) => new URL(path, location.href).href;
const sgQr = document.createElement("div");
sgQr.id = "sg-qr";
document.getElementById("stage").append(sgQr);
const ALT = {
  stage: [null, { url: "mido.html", label: "見どころの見かた", kind: "mido" }],
  shop: [null, { url: "map.html", label: "模擬店のさがしかた", kind: "shops" }],
  popular: [{ url: "ai.html", label: "AIくんに聞いてみよう", kind: "ai" }],
  crowd: [{ url: "./", label: "ホームの機能いろいろ", kind: "home" }],
};
const altN = {};
function pickDemo(key, built) {
  const list = ALT[key];
  if (!list) return built;
  const n = altN[key] = (altN[key] ?? -1) + 1;
  const a = list[n % list.length];
  return a ? { ...built, qrUrl: siteUrl(a.url), qrLabel: a.label, qrKind: a.kind } : built;
}
const demoSrc = (u) => { const [base, hash = ""] = u.split("#"); return `${base}${base.includes("?") ? "&" : "?"}sgphone=1${hash ? `#${hash}` : ""}`; };
let sgQrUrl = "", sgQrLabel = "", sgQrKind = "", demoToken = 0;
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
async function runDemo(frame, kind, token) {
  const alive = () => token === demoToken && frame.isConnected;
  const doc = () => { try { return frame.contentDocument ?? null; } catch { return null; } };
  const until = async (fn, ms = 9000) => {
    const t0 = Date.now();
    while (alive() && Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch {  } await waitMs(150); }
    return null;
  };
  const tap = (el) => {
    const r = el.getBoundingClientRect(), ps = parseFloat(getComputedStyle(frame.closest(".ss-phone")).getPropertyValue("--ps")) || 0.65;
    const d = document.createElement("i");
    d.className = "ss-tap";
    d.style.left = `${(r.left + r.width / 2) * ps}px`; d.style.top = `${(r.top + r.height / 2) * ps}px`;
    frame.parentElement.append(d);
    setTimeout(() => d.remove(), 900);
  };
  const glide = (sc, to, ms = 1700) => new Promise((res) => {
    const from = sc.scrollTop, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      sc.scrollTop = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);
      if (k < 1 && alive()) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  await until(() => doc()?.readyState === "complete" && !doc().querySelector("#m-loading"), 12000);
  if (!alive()) return;
  if (!doc()) return;
  await waitMs(1600);
  if (kind === "place") {
    const btn = await until(() => doc().querySelector('.sh-btn[data-act="route"]'), 4000);
    if (btn && alive()) { tap(btn); await waitMs(350); btn.click(); }
    await waitMs(1500);
    const q = doc().querySelector("#m-q");
    if (q && alive()) {
      tap(q); q.focus(); await waitMs(800);
      for (const ch of ["玄", "関"]) { if (!alive()) return; q.value += ch; q.dispatchEvent(new (doc().defaultView.Event)("input", { bubbles: true })); await waitMs(420); }
      await waitMs(1000);
      const first = doc().querySelector("#m-results [data-go]");
      if (first && alive()) { tap(first); await waitMs(350); first.click(); }
    }
  } else if (kind === "search") {
    const q = doc().querySelector("#m-q");
    if (!q) return;
    tap(q); q.focus(); await waitMs(900);
    for (const ch of ["ト", "イ", "レ"]) { if (!alive()) return; q.value += ch; q.dispatchEvent(new (doc().defaultView.Event)("input", { bubbles: true })); await waitMs(380); }
    await waitMs(1100);
    const first = doc().querySelector("#m-results [data-go]");
    if (first && alive()) { tap(first); await waitMs(350); first.click(); }
  } else if (kind === "home" || kind === "mido") {
    const sc = doc().scrollingElement;
    if (kind === "mido") {
      const tk = await until(() => doc().querySelector("#mido-tickets .tk"), 5000);
      if (tk && alive()) { await glide(sc, 260); await waitMs(400); const t1 = doc().querySelector("#mido-tickets .tk"); if (t1) { tap(t1); await waitMs(350); t1.click(); await waitMs(2600); doc().querySelector("[data-dt-close]")?.click(); await waitMs(600); } }
    }
    for (const y of [500, 1100, 1700, 2300, 2900]) { if (!alive()) return; await glide(sc, y); await waitMs(900); }
  } else if (kind === "shops") {
    const chip = await until(() => [...doc().querySelectorAll("#m-chips .m-chip")].find((b) => /模擬店/.test(b.textContent)), 5000);
    if (chip && alive()) {
      tap(chip); await waitMs(350); chip.click(); await waitMs(1800);
      const first = await until(() => doc().querySelector("#m-sheet-body [data-go]"), 3000);
      if (first && alive()) { tap(first); await waitMs(350); first.click(); }
    }
  } else if (kind === "ai") {
    const box = await until(() => doc().querySelector("#ai-q"), 5000);
    if (box) {
      const type = async (chars) => { box.value = ""; for (const ch of chars) { if (!alive()) return; box.value += ch; box.dispatchEvent(new (doc().defaultView.Event)("input", { bubbles: true })); await waitMs(420); } };
      tap(box); box.focus(); await waitMs(700);
      await type(["ト", "イ"]); await waitMs(2400);
      await type(["ス", "テ"]); await waitMs(2400);
      await type(["ス", "タ"]); await waitMs(2400);
      box.value = ""; box.dispatchEvent(new (doc().defaultView.Event)("input", { bubbles: true }));
    }
  } else if (kind === "feed") {
    const list = await until(() => doc().querySelector("#m-feed-list"), 5000);
    if (list) for (const y of [300, 700, 1100]) { if (!alive()) return; await glide(list, y); await waitMs(900); }
  }
  if (alive()) { await waitMs(2500); if (alive()) { frame.src = demoSrc(sgQrUrl); runDemo(frame, kind, token).catch(() => {}); } }
}
function setSgQr(url = siteUrl("./"), label = "サイトを見る", kind = "") {
  if (url === sgQrUrl && label === sgQrLabel && kind === sgQrKind && sgQr.dataset.ok) return;
  const src = qr(url, 400, { colorDark: "#1d1612", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel.L });
  if (!src) return;
  const same = url === sgQrUrl;
  sgQrUrl = url; sgQrLabel = label; sgQrKind = kind;
  if (same) {
    sgQr.querySelector(".ss-label").textContent = label;
    const frame = sgQr.querySelector("iframe");
    if (frame && kind) { const token = ++demoToken; frame.src = demoSrc(url); runDemo(frame, kind, token).catch(() => {}); }
  } else {
    const portrait = document.body.classList.contains("portrait");
    const phone = portrait ? "" : `<div class="ss-phone" aria-hidden="true"><i class="ss-island"></i><div class="ss-screen"><iframe src="${esc(demoSrc(url))}" title="" tabindex="-1" scrolling="no"></iframe></div></div>`;
    sgQr.innerHTML = `<h2>スマホで見る！</h2>${phone}<b class="ss-qr"><img src="${src}" alt=""></b><p class="ss-label">${esc(label)}</p>`;
    const token = ++demoToken;
    const frame = sgQr.querySelector("iframe");
    if (frame && kind) runDemo(frame, kind, token).catch(() => {});
  }
  sgQr.dataset.ok = "1";
}
let qrInTimer = 0;
function qrIn() {
  if (!sgQr.dataset.ok) return;
  clearTimeout(qrInTimer);
  sgQr.classList.remove("qr-in");
  void sgQr.offsetWidth;
  sgQr.classList.add("qr-in");
  qrInTimer = setTimeout(() => sgQr.classList.remove("qr-in"), 2000);
}
const sgQrTimer = setInterval(() => { setSgQr(sgQrUrl || undefined, sgQrLabel || undefined, sgQrKind); if (sgQr.dataset.ok) clearInterval(sgQrTimer); }, 500);
setSgQr();
async function photos(list) {
  const got = {};
  await Promise.race([Promise.all(list.filter((p) => p.has_photo).map((p) => loadPhoto(p.id).then((s) => { got[p.id] = s; }).catch(() => {}))), sleep(7000)]);
  return got;
}

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
    const pick = rot.filter((p) => !p.has_photo || got[p.id]).slice(0, 3);
    if (!pick.length) return null;
    return { dur: 15000, cls: "posts", qrUrl: siteUrl("map.html?tab=feed"), qrLabel: "みんなの投稿を見る", qrKind: "feed", after: countUp, bgPhoto: got[pick.find((p) => got[p.id])?.id] ?? null, html: `
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
    const pick = liked.filter((p) => !p.has_photo || got[p.id]).slice(0, 3);
    if (pick.length < 2) return null;
    return { dur: 14000, cls: "posts popular", qrUrl: siteUrl("map.html?tab=feed"), qrLabel: "人気の投稿を見る", qrKind: "feed", after: countUp, bgPhoto: got[pick.find((p) => got[p.id])?.id] ?? null, html: `
      <span class="tag slide-l"><i>${ic("heart")}</i><img class="elogo-s" src="assets/img/enistagram.webp" alt="Enistagram">　人気の投稿</span>
      <h1 class="ttl">${chars("いま、いちばん人気！")}</h1>
      <div class="row">${pick.map((p, i) => postCard(p, i, got, i + 1)).join("")}</div>` };
  },
};

let shopOrder = [], shopPtr = 0;
function nextShop() {
  if (!shopOrder.length) shopOrder = SHOPS.map((_, i) => i).sort(() => Math.random() - 0.5);
  for (let n = 0; n < shopOrder.length; n++) {
    const s = SHOPS[shopOrder[shopPtr++ % shopOrder.length]];
    const st = shopDoc(s)?.status;
    if (st !== "soldout" && st !== "closed") return s;
  }
  return SHOPS[shopOrder[shopPtr++ % shopOrder.length]];
}
const slideShop = {
  async build() {
    const s = nextShop();
    if (!s) return null;
    const d = shopDoc(s);
    const room = s.room ?? HOMEROOMS[s.cls];
    const where = `${s.bldg ? `${s.bldg}棟` : ""}${s.floor ? String(s.floor).replace(/F$/, "階") : ""}` || s.where || "";
    const w = d && d.status !== "closed" && WAIT[d.status];
    const rm = spot && room && !/^pt-/.test(room) ? await routeMap(spot.here, room).catch((e) => { console.warn(e); return null; }) : null;
    const lines = String(s.note ?? "").split(/\n/).filter(Boolean);
    const name = flat(s.name);
    return { dur: rm ? 16000 : 13000, cls: "shop", qrUrl: siteUrl(`map.html${room || s.place ? `#${encodeURIComponent(room || s.place)}` : ""}`), qrLabel: "このお店の場所を見る", qrKind: "place", after: (root) => rm?.play(root), html: `
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
    return { dur: 11000, cls: "crowd", qrUrl: siteUrl("map.html"), qrLabel: "混雑を地図で見る", qrKind: "search", html: `
      <span class="tag slide-l"><i>${ic("people")}</i>いまの混雑</span>
      <h1 class="ttl">${chars("人の多さは、どのくらい？")}</h1>
      <div class="row">${cards}</div>
      ${easy.length || busy.length ? `<div class="lists${easy.length && busy.length ? "" : " one"}">
        ${easy.length ? `<div class="ls slide-l" style="--i:5"><h4>すぐ買えるお店</h4><ul>${easy.map(li).join("")}</ul></div>` : ""}
        ${busy.length ? `<div class="ls slide-r" style="--i:5"><h4>待ち時間が長い・売り切れ</h4><ul>${busy.map(li).join("")}</ul></div>` : ""}
      </div>` : ""}` };
  },
};

let ACTS = STAGE.acts.map((a) => ({ ...a, s: Date.parse(a.start), e: Date.parse(a.end) }));
let EVS = EVENTS.filter((e) => !e.stage).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) }));
function stageState(t) {
  const cur = ACTS.find((a) => t >= a.s && t < a.e) ?? null;
  const nxt = ACTS.find((a) => a.s > t) ?? null;
  const onEv = EVS.filter((e) => t >= e.s && t < e.e && !e.internal);
  const nextEv = EVS.filter((e) => e.s > t).sort((a, b) => a.s - b.s)[0] ?? null;
  return { cur, nxt, onEv, nextEv };
}
function hurryItem(t) {
  const { cur, nxt, nextEv } = stageState(t);
  const list = [];
  if (nxt && !cur && nxt.s - t <= 10 * 60000) list.push({ title: nxt.name, venue: STAGE.venue, s: nxt.s });
  if (nextEv && nextEv.s - t <= 10 * 60000) list.push({ title: nextEv.title, venue: nextEv.venue, s: nextEv.s });
  return list.sort((a, b) => a.s - b.s)[0] ?? null;
}
const phList = (x) => [x.photo, ...(x.more ?? [])].filter(Boolean);
const phOf = (x) => phList(x).map((s, k) => `<img class="ph${k ? "" : " on"}" src="/${esc(String(s).replace(/^\//, ""))}" alt="" decoding="async">`).join("");
const chips = (x, extra = "") => { const l = [x.kind].filter(Boolean).map((t) => `<span class="chip">${esc(t)}</span>`).join("") + extra; return (l ? `<div class="kind">${l}</div>` : "") + (x.mood ? `<p class="mood">${esc(x.mood)}</p>` : ""); };
const slideStage = {
  async build() {
    const t = now(), { cur, nxt, onEv, nextEv } = stageState(t);
    if (!cur && !nxt && !onEv.length && !nextEv) return null;
    const hot = hurryItem(t);
    const main = cur
      ? `<div class="now slide-l${cur.photo ? " has-ph" : ""}"><span class="lab">NOW ON STAGE</span>${phOf(cur)}<div class="eq">${Array.from({ length: 30 }, (_, k) => `<i style="--k:${k};--h:${30 + Math.round(Math.random() * 55)}%"></i>`).join("")}</div>
          <h2>${esc(cur.name)}</h2>${chips(cur)}
          ${(cur.copyNoSet ?? cur.copy) ? `<p class="cp"><span class="in">${esc(cur.copyNoSet ?? cur.copy).replace(/\n/g, "<br>")}</span></p>` : ""}
          <div class="barw"><time>${tStart(cur)}</time><div class="bar"><i style="width:${Math.round(((t - cur.s) / (cur.e - cur.s)) * 100)}%"></i></div><time>${tEnd(cur)}</time></div></div>`
      : nxt
        ? `<div class="now wait slide-l${nxt.photo ? " has-ph" : ""}"><span class="lab">${dayOf(nxt.s) === dayOf(t) ? "NEXT" : `あした ${dayOf(nxt.s)}`}</span>${phOf(nxt)}
          <h2 class="nm">${esc(nxt.name)}</h2>${chips(nxt, `<span class="chip">${tRange(nxt)}</span>`)}
          ${(nxt.copyNoSet ?? nxt.copy) ? `<p class="cp"><span class="in">${esc(nxt.copyNoSet ?? nxt.copy).replace(/\n/g, "<br>")}</span></p>` : ""}</div>`
        : `<div class="now wait slide-l"><span class="lab">STAGE</span><h2>おやすみ</h2></div>`;
    const row = (small, title, time, sub, hotRow, n, photo = "") => `<div class="nx ${small === "NEXT" ? "is-next" : "is-then"} ${hotRow ? "hot" : ""}${photo ? " has-ph" : ""} rise" style="--i:${n}${photo ? `;--ph:url('/${esc(String(photo).replace(/^\//, ""))}')` : ""}"><span class="t">${time}</span><span class="w"><small>${small}</small><b class="nm">${esc(title)}</b><i>${esc(sub)}</i></span></div>`;
    const later = ACTS.filter((a) => a.s > t).slice(cur ? 0 : 1).slice(0, (nextEv ? 3 : 4) - (hot ? 1 : 0));
    const nx = later.map((a, k) => row(dayOf(a.s) !== dayOf(t) ? `あした ${dayOf(a.s)}` : k === 0 && cur ? "NEXT" : "THEN", a.name, tStart(a), [a.kind, a.mood].filter(Boolean).join("　"), k === 0 && hot && !cur && hot.s === a.s && hot.title === a.name, 2 + k, a.photo));
    if (nextEv) nx.push(row(dayOf(nextEv.s) === dayOf(t) ? "このあと" : "つぎの企画", nextEv.title, tStart(nextEv), `${dayOf(nextEv.s) === dayOf(t) ? "" : `${dayOf(nextEv.s)}　`}${venueName(nextEv.venue)}${nextEv.internal ? "（学内の方限定）" : ""}`, hot && hot.s === nextEv.s && hot.title === nextEv.title, 2 + later.length));
    const mini = onEv.length ? `<p class="mini rise" style="--i:4">開催中：${onEv.map((e) => `<em class="nm">${esc(e.title)}</em>（${esc(venueName(e.venue))}）`).join("　")}</p>` : "";
    return { dur: hot ? 15000 : 13000, cls: "stage", qrUrl: siteUrl(`map.html#${STAGE.venue}`), qrLabel: "ステージの場所を見る", qrKind: "place", after(el) {
      const fill = el.querySelector(".barw .bar i");
      if (fill && cur) { const upd = () => { if (!el.isConnected) return clearInterval(bid); fill.style.width = `${Math.min(100, Math.max(0, Math.round(((now() - cur.s) / (cur.e - cur.s)) * 1000) / 10))}%`; }; const bid = setInterval(upd, 1000); upd(); }
      const card = el.querySelector(".now.has-ph"), imgs = [...el.querySelectorAll(".now .ph")];
      if (!card) return;
      const tone = (img) => { try { const c = document.createElement("canvas"); c.width = c.height = 24; const g = c.getContext("2d"); g.drawImage(img, img.naturalWidth * 0.4, 0, img.naturalWidth * 0.6, img.naturalHeight, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; return s / (d.length / 4) > 140 ? "light" : "dark"; } catch { return "dark"; } };
      const paint = (img) => { card.dataset.tone = img.dataset.tone ?? "dark"; };
      imgs.forEach((img) => { const set = () => { img.dataset.tone = tone(img); if (img.classList.contains("on")) paint(img); }; img.complete ? set() : img.addEventListener("load", set, { once: true }); });
      if (imgs.length < 2) return;
      let k = 0;
      const id = setInterval(() => { if (!el.isConnected) return clearInterval(id); imgs[k].classList.remove("on"); k = (k + 1) % imgs.length; imgs[k].classList.add("on"); paint(imgs[k]); }, 3200);
    }, html: `
      <span class="tag slide-l"><i>${ic("mic")}</i>ステージ・企画</span>
      <h1 class="ttl">${chars(hot ? "まもなく、はじまる！" : "いま、ステージでは")}</h1>
      <div class="grid">${main}<div class="nxt">${nx.join("")}${mini}</div></div>` };
  },
};
let hurryKey = "";
function paintHurry() {
  const h = hurryItem(now());
  const el = $("#hurry"), key = h ? `${h.title}|${h.s}` : "";
  if (key === hurryKey) { if (h) { const m = Math.max(0, Math.ceil((h.s - now()) / 60000)); const mm = el.querySelector("[data-min]"); if (mm) { mm.textContent = m ? `あと${m}分` : "まもなく"; numify(mm); } } return; }
  hurryKey = key;
  document.body.classList.toggle("is-hurry", !!h);
  if (!h) { el.classList.add("out"); setTimeout(() => { if (!hurryKey) { el.hidden = true; el.innerHTML = ""; el.classList.remove("out"); } }, 500); return; }
  const d = SIGNAGE.dests[h.venue], r = spot?.routes.find((x) => x.to === h.venue);
  const m = Math.max(0, Math.ceil((h.s - now()) / 60000));
  el.classList.remove("out");
  el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  el.hidden = false;
  el.innerHTML = `<span class="run"><i>🏃</i></span><span class="big">急げ！</span>
    <span class="txt"><b><span data-min>${m ? `あと${m}分` : "まもなく"}</span>で　<span class="nm">${esc(h.title)}</span></b></span>
    ${r ? arrow(r.dir, "arr") : ""}`;
  numify(el);
}

function rebuildSchedule() {
  ACTS = STAGE.acts.map((a) => ({ ...a, s: Date.parse(a.start), e: Date.parse(a.end) }));
  EVS = EVENTS.filter((e) => !e.stage).map((e) => ({ ...e, s: Date.parse(e.start), e: Date.parse(e.end) }));
}
watchSchedule(rebuildSchedule);
rebuildSchedule();

const FACES = ["😀", "😃", "😄", "😁", "😆", "🥳", "😍", "🤩", "😎", "😊", "😋", "😜", "🤪", "😂", "🥰", "😇", "🤗", "😺", "😻", "🙌", "😆", "😄", "🤣", "😏", "🥹"];
const OTHERS = ["📷", "🍡", "🎤", "✨", "❤️", "🎆", "🎵", "🎉", "⭐", "🎈"];
function emojiRain(root) {
  const box = root.querySelector(".rain");
  if (!box) return;
  const cv = document.createElement("canvas"), W0 = SW, H0 = SH;
  cv.width = W0; cv.height = H0; cv.className = "rainc";
  box.append(cv);
  const ctx = cv.getContext("2d");
  const W = SW, FLOOR = SH - 62, N = 92, G = 2600, DT = 1 / 60;
  const bodies = [];
  let spawned = 0, last = performance.now(), nextSpawn = last + 700, calm = 0;
  function spawn() {
    const size = 140 + Math.random() * 90, r = size * 0.43;
    const pool = Math.random() < 0.82 ? FACES : OTHERS;
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
      for (const b of bodies) {
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        if (b.y > FLOOR - b.r) { b.y = FLOOR - b.r; if (b.vy > 0) b.vy = -b.vy * 0.18; b.vx *= 0.94; b.av *= 0.9; }
      }
      for (let i = 0; i < bodies.length; i++) {
        for (let k = i + 1; k < bodies.length; k++) {
          const p = bodies[i], q = bodies[k], dx = q.x - p.x, dy = q.y - p.y, min = p.r + q.r, d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = (min - d) / 2;
          p.x -= nx * over; p.y -= ny * over; q.x += nx * over; q.y += ny * over;
          const rv = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (rv < 0) { const j = -rv * 0.6; p.vx -= nx * j; p.vy -= ny * j; q.vx += nx * j; q.vy += ny * j; }
          const tv = (q.vx - p.vx) * -ny + (q.vy - p.vy) * nx;
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
    if (calm < 60) requestAnimationFrame(frame);
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

const slideStamp = {
  async build() {
    const url = siteUrl("rally.html");
    const goal = Math.max(1, RALLY.goal);
    const TILT = [-9, 7, -4, 11, -12, 5];
    const slots = Array.from({ length: goal }, (_, i) => `<li class="rc-slot" style="--tilt:${TILT[i % TILT.length]}deg"><span class="rc-ring"><b>${i + 1}</b><i class="rc-hanko">縁</i><i class="rc-pon">ポンッ</i></span></li>`).join("");
    const CONFETTI = ["#d9669b", "#2f8fe0", "#a061c9", "#ffd24a", "#3BF53D", "#FEEBC4", "#ff6b5e"];
    const burst = (box, n = 110, near = 260, far = 620, fall = 460) => {
      for (let k = 0; k < n; k++) {
        const p = document.createElement("s");
        p.style.cssText = `background:${CONFETTI[k % CONFETTI.length]};width:${10 + (k % 4) * 5}px;height:${16 + (k % 3) * 6}px`;
        box.append(p);
        const ang = Math.random() * Math.PI * 2, dist = near + Math.random() * far;
        const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.7 - near * 0.5;
        p.animate([
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx * 1.08}px, ${dy + fall}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
        ], { duration: 1400 + Math.random() * 1400, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }).finished.then(() => p.remove()).catch(() => {});
      }
    };
    const play = (el) => {
      const card = el.querySelector(".stampcard"), inner = el.querySelector(".sc-in"), items = [...el.querySelectorAll(".rc-slot")], state = el.querySelector(".rc-state"), box = el.querySelector(".sc-confetti"), wrap = el.querySelector(".wrap");
      const at = (ms, fn) => setTimeout(() => { if (el.isConnected) fn(); }, ms);
      const shake = (cls) => { wrap.classList.remove("shake", "shake-big"); void wrap.offsetWidth; wrap.classList.add(cls); };
      items.forEach((s, i) => at(2300 + i * 820, () => {
        s.classList.add("is-on");
        inner.classList.remove("bump"); void inner.offsetWidth; inner.classList.add("bump");
        burst(s.querySelector(".rc-ring"), 16, 60, 120, 90);
        shake("shake");
      }));
      at(2300 + items.length * 820 + 200, () => {
        card.classList.add("is-done");
        state.textContent = "達成！ 景品と交換できます";
        const flash = document.createElement("i");
        flash.className = "sc-flash";
        el.append(flash);
        setTimeout(() => flash.remove(), 900);
        shake("shake-big");
        burst(box, 170, 300, 700, 520);
        setTimeout(() => { if (el.isConnected) burst(box, 130, 260, 760, 560); }, 450);
        setTimeout(() => { if (el.isConnected) burst(box, 130, 260, 760, 560); }, 1000);
        setTimeout(() => { if (el.isConnected) burst(box, 90, 220, 700, 560); }, 1900);
      });
    };
    return { dur: 17000, cls: "share stamp", after: play, html: `
      <div class="wrap">
        <div>
          <h1>${chars("スタンプを" + "\n" + "集めよう！")}</h1>
          <div class="how">
            <div class="rise" style="--i:6"><i>1</i><span>校内の QR を読むと、<wbr>スタンプが押される</span></div>
            <div class="rise" style="--i:7"><i>2</i><span>はじめの1個は、<wbr>玄関のインフォメーションで</span></div>
            <div class="rise" style="--i:8"><i>3</i><span>${goal}個そろえたら、<wbr>${esc(RALLY.claimPlace)}へ</span></div>
          </div>
          <div class="goqr rise" style="--i:9"><img src="${qr(url, 200)}" alt=""><span class="cap">スマホで<br>スタンプカードを開く</span></div>
        </div>
        <div class="stampcard pop" style="--i:4">
          <span class="sc-rays" aria-hidden="true"></span><span class="sc-confetti" aria-hidden="true"></span><span class="sc-clear" aria-hidden="true">達成！</span>
          <span class="sc-in"><span class="rcs-face">
            <span class="rc-head"><img class="rc-logo" src="assets/img/logo-s.webp" alt=""><span class="rc-name"><b>スタンプラリー</b><small>第${esc(FESTIVAL.edition)}回 函館高専祭「縁」</small></span></span>
            <ol class="rc-slots">${slots}</ol>
            <span class="rc-foot"><b class="rc-state">${goal}個そろえて、景品ゲット！</b></span>
          </span></span>
        </div>
      </div>` };
  },
};

const CLOSING_MIN = 5;
function closedState(t) {
  const days = FESTIVAL.days.map((d) => ({ close: Date.parse(d.close) }));
  const i = days.findIndex((d) => t >= d.close && t < d.close + CLOSING_MIN * 60000);
  return i < 0 ? null : { final: i === days.length - 1 };
}
const slideClosing = {
  async build() {
    const c = closedState(now());
    return { dur: 60000, cls: "closing", qrUrl: siteUrl("./"), html: `
      <span class="en pop" style="--i:0"><img src="assets/img/logo-s.webp" alt="縁"></span>
      <h1 class="rise" style="--i:2">${c?.final === false ? "本日の" : ""}一般公開は終了しました</h1>
      <p class="rise" style="--i:4">ご来場ありがとうございました</p>` };
  },
};

const fwEvent = () => EVENTS.find((e) => e.title === "花火");
function fireworksNow(t = now()) { const e = fwEvent(); return !!e && t >= Date.parse(e.start) && t < Date.parse(e.end); }
const slideFireworks = {
  async build() {
    return { dur: 90000, cls: "fwslide", qrUrl: siteUrl("map.html#ground"), qrLabel: "花火の場所を見る", qrKind: "place", html: `<h1 class="fwt">${chars("花火！")}</h1>` };
  },
};
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

const SLIDES = { stage: slideStage, closing: slideClosing, fireworks: slideFireworks, posts: slidePosts, popular: slidePopular, shop: slideShop, crowd: slideCrowd, share: slideShare, stamp: slideStamp };
function plan() {
  if (devCfg?.only && Date.now() < (devCfg.only_until ?? 0) && SLIDES[devCfg.only]) return [devCfg.only];
  if (closedState(now())) return ["closing"];
  if (fireworksNow()) return ["fireworks"];
  const base = ["stage", "posts", "shop", "crowd", "popular", "stamp", "shop", "shop", "share"];
  if (hurryItem(now())) base.splice(4, 0, "stage");
  const allow = Array.isArray(devCfg?.slides) && devCfg.slides.length ? base.filter((k) => devCfg.slides.includes(k)) : base;
  return allow.length ? allow : base;
}
const pageStart = Date.now();
const DYN_DESTS = ["gym2", "hq", "zacros", "ground"];
const DIRS = [["right", 0], ["downright", 45], ["down", 90], ["downleft", 135], ["left", 180], ["upleft", 225], ["up", 270], ["upright", 315]];
const SAY = { up: "まっすぐ", upright: "右前へ", right: "右へ", downright: "右うしろへ", down: "うしろへ", downleft: "左うしろへ", left: "左へ", upleft: "左前へ" };
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
function nearestSpotId(p) {
  let best = "h-gate", bd = Infinity;
  for (const s of MAP.spots) {
    if (!s.at) continue;
    const d = Math.hypot(s.at[0] - p.x, s.at[1] - p.y);
    if (d < bd) { bd = d; best = s.id; }
  }
  return best;
}
async function dynSpot(place, heading, name) {
  const rs = await pointRoutes(place, DYN_DESTS).catch(() => []);
  if (!rs.length) return null;
  const routes = rs.map((r) => {
    const rel = (((r.ang - heading + 270) % 360) + 360) % 360;
    const dir = DIRS.reduce((b, d) => (angDiff(rel, d[1]) < angDiff(rel, b[1]) ? d : b))[0];
    return { to: r.to, dir, say: SAY[dir], min: r.minutes };
  }).slice(0, 6);
  return { name: name || "この場所", here: nearestSpotId(place), routes };
}
let spotSeq = 0;
function applyDevice(c) {
  const before = JSON.stringify([devCfg?.slides, devCfg?.only, devCfg?.only_until]);
  devCfg = c;
  offerSetup(!!c);
  facing = [0, 90, 180, 270].includes(Number(c?.facing)) ? Number(c.facing) : 0;
  if (!params.get("at")) {
    const seq = ++spotSeq;
    if (c?.place && typeof c.place.x === "number" && typeof c.place.y === "number") {
      dynSpot(c.place, Number.isFinite(Number(c.heading)) ? Number(c.heading) : 270, c.name).then((s) => { if (seq === spotSeq && s) spot = s; });
    } else spot = null;
  }
  fit();
  paintSgNotice();
  const ra = c?.reload_at?.toMillis?.() ?? 0;
  if (ra > pageStart) {
    let done = "";
    try { done = sessionStorage.getItem("kosen63-sg-reload") ?? ""; } catch {  }
    if (done !== String(ra)) {
      try { sessionStorage.setItem("kosen63-sg-reload", String(ra)); } catch {  }
      location.reload();
      return;
    }
  }
  if (before !== JSON.stringify([devCfg?.slides, devCfg?.only, devCfg?.only_until])) order = [];
}
watchDevice(applyDevice);
wireSetupTriggers();
if (needSetup()) openSetup();

let order = [], idx = -1, timer = null, busy = false, dir = 1;
const slide = $("#slide"), wipe = $("#wipe");

async function cover() {
  wipe.querySelectorAll("i.b2").forEach((b) => b.getAnimations().forEach((x) => x.cancel()));
  const bars = [...wipe.querySelectorAll("i:not(.b2)")], seal = wipe.querySelector("b");
  const inn = bars.map((b, k) => b.animate([{ transform: "translateX(-120%) skewX(-14deg)" }, { transform: "translateX(0) skewX(-14deg)" }], { duration: 520, delay: k * 70, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" }));
  seal.animate([{ opacity: 0, transform: "scale(2.2) rotate(-14deg)" }, { opacity: 1, transform: "scale(1) rotate(-6deg)", offset: .55 }, { opacity: 1, transform: "scale(1) rotate(-6deg)" }], { duration: 360, delay: 330, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "forwards" });
  const COL = ["#d9669b", "#2f8fe0", "#a061c9", "#ffd24a", "#3BF53D", "#FEEBC4", "#ff6b5e"];
  wipe.querySelectorAll("s").forEach((d, k, all) => {
    const ang = (k / all.length) * Math.PI * 2 + 0.3, far = 360 + (k % 3) * 120;
    d.style.setProperty("--c", COL[k % COL.length]); d.style.setProperty("--s", `${22 + (k % 4) * 8}px`);
    d.animate([{ opacity: 1, transform: "translate(0, 0) scale(.3) rotate(0)" }, { opacity: 1, transform: `translate(${Math.cos(ang) * far}px, ${Math.sin(ang) * far}px) scale(1) rotate(${k * 70}deg)`, offset: .7 }, { opacity: 0, transform: `translate(${Math.cos(ang) * far * 1.15}px, ${Math.sin(ang) * far * 1.15 + 60}px) scale(.8) rotate(${k * 90}deg)` }], { duration: 1000, delay: 480, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" });
  });
  await Promise.all(inn.map((a) => a.finished.catch(() => {})));
  return () => {
    const top = [...wipe.querySelectorAll("i.b2")];
    const pass = top.map((b, k) => b.animate([{ transform: "translateX(-120%) skewX(-14deg)" }, { transform: "translateX(120%) skewX(-14deg)" }], { duration: 1100, delay: k * 70, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" }));
    setTimeout(() => seal.getAnimations().forEach((x) => x.cancel()), 400);
    setTimeout(() => bars.forEach((b) => b.getAnimations().forEach((x) => x.cancel())), 3 * 70 + 560);
    return Promise.all(pass.map((a) => a.finished.catch(() => {})));
  };
}
const BG = { intro: ["#3f9f99", "#9BD7D0"], posts: ["#2f8fe0", "#9BD7D0"], popular: ["#d9669b", "#F2A96A"], shop: ["#ee7b30", "#efc696"], crowd: ["#3f9f99", "#F1D08A"],
  stage: ["#ee7b30", "#B5655A"], share: ["#a061c9", "#2f8fe0"], fireworks: ["#0b1030", "#3a1d5c"], closing: ["#3f9f99", "#9BD7D0"] };
function fitNow(el) {
  const limit = () => slide.getBoundingClientRect().bottom - 10;
  const nxs = [...el.querySelectorAll(".nx")];
  while (nxs.length > 1 && nxs[nxs.length - 1].getBoundingClientRect().bottom > limit()) nxs.pop().remove();
  const p = el.querySelector(".now > p.cp");
  if (!p) return;
  const card = p.parentElement, bar = card.querySelector(".barw");
  const pad = parseFloat(getComputedStyle(card).paddingBottom) || 0;
  const avail = limit() - p.getBoundingClientRect().top - pad - (bar ? bar.offsetHeight + 16 : 0);
  if (avail < 56) { p.style.display = "none"; return; }
  p.style.height = `${Math.min(p.scrollHeight, avail)}px`;
  const dist = p.scrollHeight - p.clientHeight;
  if (dist > 4) {
    p.classList.add("scroll");
    p.style.setProperty("--dist", `${dist}px`);
    p.style.setProperty("--dur", `${Math.max(8, dist / 22 + 5)}s`);
  }
}
const FIT = ".plate b, .way li .nm, .nx b, .cv h3, .cv .lv, .shop h2";
function fitText(root) {
  root.querySelectorAll(FIT).forEach((n) => {
    n.style.whiteSpace = "nowrap"; n.style.minWidth = "0";
    const smalls = [...n.querySelectorAll("small")].map((s) => [s, parseFloat(getComputedStyle(s).fontSize)]);
    const base = parseFloat(getComputedStyle(n).fontSize);
    let r = 1;
    while (n.scrollWidth > n.clientWidth + 1 && r > 0.45) {
      r *= 0.94;
      n.style.fontSize = `${base * r}px`;
      smalls.forEach(([s, f]) => { s.style.fontSize = `${f * r}px`; });
    }
  });
}
const BOXES = ".plate, .mapbox, .now, .nx, .pc, .cv, .ls, .way li, .scan, .qrbox, .bubble, .how div";
function extent(root) {
  let top = Infinity, bottom = -Infinity;
  root.querySelectorAll("*").forEach((n) => {
    if (!n.matches(BOXES) && n.children.length && !n.matches("img, svg, canvas")) return;
    const cs = getComputedStyle(n);
    if (cs.position === "absolute" || cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") return;
    if (n.closest(".ghost, .eq, .rain, .float, .sc-confetti, .sc-rays")) return;
    const b = n.getBoundingClientRect();
    if (b.height < 6 || b.width < 6 || (!n.matches(BOXES) && !(n.textContent || "").trim() && !n.matches("img, svg, canvas"))) return;
    top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom);
  });
  return { top, bottom };
}
const stageK = () => { const st = document.getElementById("stage"); return st.getBoundingClientRect().width / st.offsetWidth || 1; };
function centerSlide(el) {
  if (el.querySelector(".pan-win")) return;
  const r0 = el.getBoundingClientRect(), { top, bottom } = extent(el);
  if (!isFinite(top)) return;
  const shift = (((r0.bottom - bottom) - (top - r0.top)) / 2) / stageK();
  if (shift > 8) el.style.translate = `0 ${Math.round(shift)}px`;
}
function wrapPan(el, cls) {
  if (/(^| )(posts|popular|share|stamp|closing|fwslide)( |$)/.test(cls)) return;
  if (extent(el).bottom - el.getBoundingClientRect().bottom < 40 * stageK()) return;
  const body = [...el.children].filter((c) => !c.matches(".tag, .ttl, h1"));
  if (!body.length) return;
  const win = document.createElement("div"), inn = document.createElement("div");
  win.className = "pan-win"; inn.className = "pan-in";
  body[0].before(win);
  win.append(inn);
  body.forEach((c) => inn.append(c));
}
function startPan(el, dur) {
  setTimeout(() => {
    const win = el.querySelector(".pan-win"), inn = el.querySelector(".pan-in");
    if (!win || !el.isConnected) return;
    const dist = (extent(inn).bottom - win.getBoundingClientRect().bottom) / stageK();
    if (dist < 40) { win.classList.add("no-fade"); return; }
    const run = Math.max(3500, dur - 7000);
    inn.animate([{ translate: "0 0" }, { translate: `0 ${-Math.ceil(dist + 8)}px` }], { duration: run, delay: 500, easing: "ease-in-out", fill: "forwards" });
    win.animate([{ "--ft": "0px", "--fb": "44px" }, { "--ft": "44px", "--fb": "44px", offset: 0.08 }, { "--ft": "44px", "--fb": "44px", offset: 0.9 }, { "--ft": "44px", "--fb": "0px" }], { duration: run + 500, delay: 500, fill: "forwards" });
  }, 2800);
}
async function show(i, first = false) {
  if (busy) return;
  busy = true; clearTimeout(timer);
  try {
    if (!order.length || i >= order.length) { order = params.get("only") ? [params.get("only")] : plan(); i = 0; }
    if (i < 0) i = order.length - 1;
    let built = null, tries = 0;
    while (!built && tries++ < order.length) {
      built = await SLIDES[order[i]].build().catch((e) => { console.warn(e); return null; });
      if (!built) i = (i + dir + order.length) % order.length;
    }
    if (!built) { built = await slideShare.build(); order = ["share"]; i = 0; }
    const key = order[i];
    built = pickDemo(key, built);
    let uncover = null;
    if (!first) { document.body.classList.add("wipe-on"); uncover = await cover(); }
    slide.innerHTML = `<section class="sl ${built.cls}">${built.html}</section>`;
    document.body.classList.toggle("no-sgqr", /(^| )(share|stamp)( |$)/.test(built.cls));
    setSgQr(built.qrUrl, built.qrLabel, built.qrKind);
    const [c1, c2] = BG[key] ?? BG.intro;
    stage.style.setProperty("--bg1", c1); stage.style.setProperty("--bg2", c2); stage.style.setProperty("--a", c1);
    const el = slide.firstElementChild;
    await Promise.race([document.fonts.ready, sleep(1800)]);
    numify(el);
    fitNow(el);
    fitText(el);
    wrapPan(el, built.cls);
    centerSlide(el);
    const bp = $("#bgphoto");
    if (!bp) {  } else if (built.bgPhoto) { bp.style.backgroundImage = `url("${built.bgPhoto}")`; bp.classList.add("on"); } else bp.classList.remove("on");
    idx = i;
    if (uncover) { const p = uncover(); await sleep(120); el.classList.add("go"); built.after?.(el); startPan(el, built.dur); await p; } else { el.classList.add("go"); built.after?.(el); startPan(el, built.dur); }
    if (!params.get("only")) timer = setTimeout(() => { dir = 1; go(idx + 1); }, built.dur);
    else timer = setTimeout(() => { dir = 1; go(idx); }, built.dur);
  } finally { document.body.classList.remove("wipe-on"); qrIn(); busy = false; }
}
function go(i) { const el = slide.firstElementChild; if (el) el.classList.add("out"); return show(i); }
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "ArrowRight") { dir = 1; go(idx + 1); }
  else if (e.key === "ArrowLeft") { dir = -1; go(idx - 1); }
  else if (e.key === "f") document.documentElement.requestFullscreen?.().catch(() => {});
});
setInterval(paintHurry, 15000);

(async () => {
  await Promise.race([firstPosts, sleep(7000)]); await sleep(1200);
  paintHurry();
  show(0, true);
})();

globalThis.kosenHooks = { signage: { step: (d) => { dir = d; go(idx + d); } } };
