import { FIREBASE_VERSION, firebaseConfig, connectEmulators } from "../assets/live.js";
import { CROWD, VENUES, FESTIVAL, RALLY, VISIT, SHOPS, HOMEROOMS, MAP, TOP_BLOCKS, TOP_PRESETS, STAMP_PLACES, ELECTION, scheduleItems } from "../assets/config.js";
import { REPORT_HIDE, handleOf, shrink } from "../assets/posts.js";
import { noticeOf, paintNotice, FONTS as NT_FONTS, SIZES as NT_SIZES, COLORS as NT_COLORS, ICONS as NT_ICONS, WHERES as NT_WHERES, DEFAULT_WHERE as NT_DEFAULT_WHERE } from "../assets/notice.js";
import { renderStats, wireStats, dayKey as statDay, WIN as STAT_WIN } from "./stats.js";

const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const [appMod, auth, fs] = await Promise.all([
  import(`${base}/firebase-app.js`),
  import(`${base}/firebase-auth.js`),
  import(`${base}/firebase-firestore.js`),
]);
const app = appMod.getApps().find((a) => a.name === "[DEFAULT]") ?? appMod.initializeApp(firebaseConfig);
const a = auth.getAuth(app);
const db = fs.getFirestore(app);
connectEmulators({ fs, db, auth, a });

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const venueName = (id) => { const v = VENUES.find((x) => x.id === id); return v ? (v.alias ? `${v.alias}（${v.name}）` : v.name) : id; };
const time = (ms) => (ms ? new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const hhmm = (ms) => new Date(ms).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
const toMs = (v) => v?.toMillis?.() ?? null;

const SOUND_KEY = "kosen63-staff-sound";
let audioCtx = null;
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
function audio() {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function note(freq, at, dur, type, vol) {
  const ctx = audio();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  const t0 = ctx.currentTime + at;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function chime(kind) {
  if (!soundOn()) return;
  try {
    if (kind === "post") { note(988, 0, 0.35, "sine", 0.2); note(1319, 0.16, 0.5, "sine", 0.2); }
    else { note(392, 0, 0.3, "triangle", 0.22); note(494, 0.13, 0.3, "triangle", 0.22); note(587, 0.26, 0.45, "triangle", 0.22); }
  } catch {  }
}
const unlockAudio = () => { try { audio(); } catch {  } };
addEventListener("pointerdown", unlockAudio, { once: true });
addEventListener("keydown", unlockAudio, { once: true });
function renderSoundToggle() {
  const on = soundOn(), b = $("#sound-toggle");
  b.setAttribute("aria-pressed", String(on));
  b.textContent = `通知音：${on ? "オン" : "オフ"}`;
}
$("#sound-toggle").addEventListener("click", () => {
  try { localStorage.setItem(SOUND_KEY, soundOn() ? "off" : "on"); } catch {  }
  renderSoundToggle();
  chime("post");
});
renderSoundToggle();

let toastTimer = null;
function toast(text, error = false) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.toggle("is-error", error);
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
}
async function write(label, fn) {
  try {
    await fn();
    toast(label);
    return true;
  } catch (err) {
    console.warn(err);
    toast(err.code === "permission-denied" ? "書けませんでした（本部の名簿にないか、形がちがいます）" : `書けませんでした（${err.code ?? err.message}）`, true);
    return false;
  }
}
const stamp = () => ({ updated_at: fs.serverTimestamp(), updated_by: a.currentUser.email });

const VIEWS = ["overview", "stats", "broadcast", "crowd", "posts", "shops", "schedule", "print", "settings"];
function route() {
  const name = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  for (const v of VIEWS) $(`#view-${v}`).hidden = v !== name;
  $$("[data-nav]").forEach((l) => (l.dataset.nav === name ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current")));
  const view = $(`#view-${name}`);
  $("#page-title").textContent = view.dataset.title;
  $("#page-eyebrow").textContent = view.dataset.eyebrow;
  document.title = `${view.dataset.title}｜本部コンソール`;
  scrollTo({ top: 0 });
  if (name === "stats") openStats();
}
addEventListener("hashchange", route);

const hourSubs = new Set();
let statsListening = false, statsWired = false;
function watchHours(day) {
  if (hourSubs.has(day)) return;
  hourSubs.add(day);
  listen(fs.query(fs.collection(db, "visit_hours"), fs.where(fs.documentId(), ">=", `${day}-`), fs.where(fs.documentId(), "<=", `${day}-~`)), (snap) => {
    const h = {};
    snap.forEach((d) => { const k = d.id.slice(11, 13); h[k] = (h[k] ?? 0) + (d.data().n ?? 0); });
    state.hours[day] = h;
    drawStats();
  });
}
function openStats() {
  if (!a.currentUser) return;
  if (!statsWired) {
    statsWired = true;
    wireStats($("#stats"));
    $("#stats").addEventListener("change", (e) => {
      if (e.target.id !== "stats-day") return;
      state.statsDay = e.target.value; e.target.blur();
      watchHours(state.statsDay); drawStats();
    });
    $("#stats-live-off").addEventListener("change", (e) => saveLive(e.target.checked ? "「いまのようす」の集計を止めました" : "「いまのようす」の集計を再開しました", { presence_off: e.target.checked }));
    setInterval(drawStats, 20000);
  }
  if (!statsListening) {
    statsListening = true;
    listen(fs.query(fs.collection(db, "presence"), fs.where(fs.documentId(), ">=", String(Math.floor(Date.now() / STAT_WIN) - 30))), (snap) => {
      snap.forEach((d) => { state.presence[d.id] = d.data().n ?? 0; });
      drawStats();
    });
  }
  drawStats();
}
function drawStats() {
  if (!statsListening || $("#view-stats").hidden) return;
  const today = statDay(Date.now());
  watchHours(today);
  renderStats($("#stats"), { visits: state.visits, devices: state.devices, hours: state.hours, presence: state.presence, day: state.statsDay ?? today, now: Date.now() });
}

setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }); }, 1000);

const state = { schedule: {}, myLikes: new Set(), visits: {}, devices: {}, hours: {}, presence: {}, statsDay: null, live: {}, crowd: {}, chatter: {}, posts: [], shops: [], codes: [], rally: null, rallyKeys: {}, siteConfig: null, rallyControl: null };
const unsubs = [];
function listen(q, fn) {
  unsubs.push(fs.onSnapshot(q, fn, (err) => console.warn("[staff] 読めませんでした:", err.code)));
}
function startListening() {
  statsListening = false; hourSubs.clear();
  listen(fs.collection(db, "visit_counts"), (snap) => {
    state.visits = {};
    snap.forEach((d) => { const day = d.id.slice(0, 10); state.visits[day] = (state.visits[day] ?? 0) + (d.data().n ?? 0); });
    renderOverview(); drawStats();
  });
  listen(fs.collection(db, "secret_counts"), (snap) => {
    state.secret = {};
    snap.forEach((d) => { const k = d.id.replace(/-\d$/, ""); state.secret[k] = (state.secret[k] ?? 0) + (d.data().n ?? 0); });
    renderOverview();
  });
  listen(fs.collection(db, "visit_devices"), (snap) => {
    state.devices = {};
    snap.forEach((d) => { const [y, m, dd, dev] = d.id.split("-"); const day = `${y}-${m}-${dd}`; (state.devices[day] ??= { phone: 0, tablet: 0, pc: 0 })[dev] += d.data().n ?? 0; });
    renderOverview(); drawStats();
  });
  listen(fs.doc(db, "site_live", "current"), (snap) => { state.live = snap.data() ?? {}; renderBroadcast(); renderOverview(); $("#prize-out").checked = !!state.live.prize_out; $("#stats-live-off").checked = !!state.live.presence_off; $("#photo-review").checked = !!state.live.photo_review; $("#cache-state").textContent = state.live.cache_reset_at ? `${time(toMs(state.live.cache_reset_at))} に指示` : ""; });
  listen(fs.doc(db, "site_schedule", "current"), (snap) => { state.schedule = snap.exists() ? (snap.data().changes ?? {}) : {}; renderSchedule(); });
  listen(fs.collection(db, "crowd"), (snap) => {
    state.crowd = {};
    snap.forEach((d) => { const v = d.data(); state.crowd[d.id] = { level: v.level, updated_at: toMs(v.updated_at) }; });
    renderCrowd(); renderOverview();
  });
  listen(fs.doc(db, "chatter", "current"), (snap) => { state.chatter = snap.data() ?? {}; renderChatter(); renderOverview(); });
  listen(fs.query(fs.collection(db, "post_likes"), fs.where("uid", "==", a.currentUser.uid)), (snap) => {
    state.myLikes = new Set();
    snap.forEach((d) => state.myLikes.add(d.data().post));
    renderPosts();
  });
  let postsReady = false;
  listen(fs.query(fs.collection(db, "posts"), fs.orderBy("created_at", "desc"), fs.limit(300)), (snap) => {
    if (postsReady && !snap.metadata.hasPendingWrites && snap.docChanges().some((c) => c.type === "added" && !c.doc.data().official)) chime("post");
    postsReady = true;
    state.posts = [];
    snap.forEach((d) => {
      const v = d.data();
      state.posts.push({ id: d.id, ...v, reports: Number(v.reports ?? 0), created_at: toMs(v.created_at),
        photo_status: v.has_photo ? (v.photo_status ?? "pending") : "none" });
    });
    renderPosts(); renderOverview();
  });
  let shopsReady = false;
  const shopSig = new Map();
  listen(fs.collection(db, "shops"), (snap) => {
    let changed = false;
    snap.docChanges().forEach((c) => {
      const v = c.doc.data(), sig = `${v.status ?? ""}|${v.message ?? ""}`;
      if (shopsReady && c.type !== "removed" && shopSig.get(c.doc.id) !== sig && !snap.metadata.hasPendingWrites) changed = true;
      shopSig.set(c.doc.id, sig);
    });
    if (changed) chime("shop");
    shopsReady = true;
    state.shops = [];
    snap.forEach((d) => state.shops.push({ id: d.id, ...d.data() }));
    renderShops(); renderRally(); renderOverview();
  });
  listen(fs.doc(db, "rally", "current"), (snap) => { state.rally = snap.data() ?? null; renderShops(); renderRally(); });
  listen(fs.collection(db, "rally_keys"), (snap) => {
    state.rallyKeys = {};
    snap.forEach((d) => { state.rallyKeys[d.id] = d.data(); });
    renderRally();
  });
  listen(fs.collection(db, "shop_codes"), (snap) => {
    state.codes = [];
    snap.forEach((d) => state.codes.push({ code: d.id, ...d.data() }));
    renderShops();
  });
  listen(fs.doc(db, "site_config", "current"), (snap) => { state.siteConfig = snap.data() ?? null; if (!blocksDirty) { draft = null; renderBlocks(); renderMode(); } });
  listen(fs.doc(db, "rally_control", "current"), (snap) => { state.rallyControl = snap.data() ?? null; });
}

function renderOverview() {
  const pending = state.posts.filter((p) => p.photo_status === "pending" && !p.hidden).length;
  const reported = state.posts.filter((p) => p.reports > 0 && !p.hidden).length;
  const soldout = allShops().filter((s) => s.status === "soldout").length;
  const limited = CROWD.venues.filter((v) => state.crowd[v]?.level === 3).length;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  const visitsToday = state.visits[today] ?? 0;
  const visitsAll = Object.values(state.visits).reduce((a, b) => a + b, 0);
  const dev = { phone: 0, tablet: 0, pc: 0 };
  for (const d of Object.values(state.devices ?? {})) for (const k of Object.keys(dev)) dev[k] += d[k] ?? 0;
  const devAll = dev.phone + dev.tablet + dev.pc;
  const devPct = (n) => Math.round((n / devAll) * 100);
  const deviceShare = devAll ? `${devPct(dev.phone)}% / ${devPct(dev.pc)}%` : "—";
  const deviceSub = `スマホ ${dev.phone}・PC ${dev.pc}・タブレット ${dev.tablet}（計 ${devAll} 台）`;
  const kpi = (label, value, sub, color, href) => `<a class="kpi" href="${href}" style="--k:${color}"><small>${label}</small><b>${value}</b><span>${sub}</span></a>`;
  const SECRET_NAMES = { window: "窓の猫", cover: "黄色いカバー", dhouse: "Dの家", antenna: "アンテナ", sun: "夕焼け" };
  const sc = state.secret ?? {};
  const secretSub = Object.entries(SECRET_NAMES).map(([k, n]) => `${n} ${sc[k] ?? 0}`).join("・");
  $("#kpis").innerHTML = [
    kpi("きょうの閲覧者", visitsToday, "台（1日1回まで）", "var(--teal)", "#overview"),
    kpi("これまでの閲覧者", visitsAll, "のべ", "var(--sun)", "#overview"),
    kpi("スマホ／PC の割合", deviceShare, deviceSub, "var(--teal)", "#overview"),
    kpi("隠し縁 ぜんぶ見つけた人", sc.all ?? 0, secretSub, "var(--rose)", "#overview"),
    kpi("写真の確認待ち", pending, pending ? "確認してください" : "ありません", pending ? "var(--sun)" : "var(--teal)", "#posts"),
    kpi("報告された投稿", reported, `${REPORT_HIDE}件で自動で隠れる`, reported ? "var(--rose)" : "var(--teal)", "#posts"),
    kpi("入場制限中の会場", limited, `${CROWD.venues.length}会場のうち`, limited ? "var(--rose)" : "var(--teal)", "#crowd"),
    kpi("完売の模擬店", soldout, `${allShops().length}店のうち`, "var(--amber)", "#shops"),
  ].join("");
  const badge = $("#nav-posts-badge");
  badge.hidden = !pending;
  badge.textContent = pending;

  const l = state.live;
  const notice = l.notice ? `<span class="pill ${l.notice_level === "urgent" ? "is-urgent" : "is-on"}">${l.notice_level === "urgent" ? "緊急" : "表示中"}</span> ${esc(l.notice)}` : '<span class="muted">なし</span>';
  const stream = l.stream_url ? `<span class="pill ${l.stream_active ? "is-live" : ""}">${l.stream_active ? "配信中" : "待機"}</span> ${esc(l.stream_title || l.stream_url)}` : '<span class="muted">URL なし</span>';
  const phase = { before: "開催前（手動）", during: "開催中（手動）", after: "終了後（手動）" }[l.phase_override] ?? "自動（時刻で）";
  const chat = ["p1", "p2", "p3", "p4", "p5"].filter((k) => state.chatter[k]).length;
  const row = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  $("#status-list").innerHTML = [
    row("閲覧者（日ごと）", Object.keys(state.visits).length ? Object.entries(state.visits).sort().map(([d, n]) => `${esc(d.slice(5).replace("-", "/"))} ${n}`).join("　") : '<span class="muted">まだ数えていません</span>'),
    row("お知らせ", notice),
    row("生配信", stream),
    row("表示", esc(phase)),
    row("5人の実況", chat ? `${chat}人がしゃべっている` : '<span class="muted">いつものセリフ</span>'),
  ].join("");
}

function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.pathname.startsWith("/live/") || u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
    else id = u.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?mute=1` : null;
  } catch {
    return null;
  }
}
const NT_TPL = {
  info: { level: "info", style: { icon: "mega" } },
  event: { level: "info", style: { icon: "star", bg: "#D9669B", fg: "#FFFFFF", font: "round" } },
  rain: { level: "info", style: { icon: "rain", bg: "#2F6FB8", fg: "#FFFFFF" } },
  caution: { level: "info", style: { icon: "warn", bg: "#FFD24A", fg: "#4A3B36", font: "bold" } },
  urgent: { level: "urgent", style: { icon: "warn" } },
};
const NT_COLOR_KEYS = Object.keys(NT_COLORS);
let ntBuilt = false;
function buildNoticeForm() {
  if (ntBuilt) return;
  ntBuilt = true;
  $("#nt-font").innerHTML = `<option value="">ふつう</option>${Object.entries(NT_FONTS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}`;
  $("#nt-size").innerHTML = Object.entries(NT_SIZES).map(([k, [l]]) => `<label><input type="radio" name="nt-size" value="${k === "m" ? "" : k}"${k === "m" ? " checked" : ""}><span>${l}</span></label>`).join("");
  $("#nt-colors").innerHTML = NT_COLOR_KEYS.map((k, i) => { const [l, bg, fg] = NT_COLORS[k]; return `<label class="nt-sw"><input type="radio" name="nt-color" value="${k}"${i === 0 ? " checked" : ""}><span style="${bg ? `background:${bg};color:${fg}` : ""}">${esc(l)}</span></label>`; }).join("");
  $("#nt-icons").innerHTML = [["", ["なし", ""]], ...Object.entries(NT_ICONS)].map(([k, [l, d]], i) => `<label class="nt-ic" title="${esc(l)}"><input type="radio" name="nt-icon" value="${k}"${i === 0 ? " checked" : ""}><span>${d ? `<svg viewBox="0 0 24 24" aria-label="${esc(l)}"><path d="${d}"/></svg>` : "なし"}</span></label>`).join("");
  $("#nt-wheres").innerHTML = NT_WHERES.map(([k, l]) => `<label><input type="checkbox" name="nt-where" value="${k}"${NT_DEFAULT_WHERE.includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("");
}
const jstMs = (v) => (v ? Date.parse(`${v}:00+09:00`) : 0);
const jstStr = (ms) => (ms ? new Date(ms + 9 * 3600000).toISOString().slice(0, 16) : "");
function readNoticeStyle() {
  const st = {};
  const font = $("#nt-font").value; if (font) st.font = font;
  const size = $('[name="nt-size"]:checked')?.value; if (size) st.size = size;
  if ($("#nt-custom").checked) { st.bg = $("#nt-bg").value.toUpperCase(); st.fg = $("#nt-fg").value.toUpperCase(); }
  else { const c = NT_COLORS[$('[name="nt-color"]:checked')?.value]; if (c?.[1]) { st.bg = c[1]; st.fg = c[2]; } }
  const icon = $('[name="nt-icon"]:checked')?.value || ""; if (icon) st.icon = icon;
  const url = $("#nt-link-url").value.trim();
  if (url) { st.link_url = url; const lb = $("#nt-link-label").value.trim(); if (lb) st.link_label = lb; }
  const from = jstMs($("#nt-from").value), until = jstMs($("#nt-until").value);
  if (from) st.from = from; if (until) st.until = until;
  const where = $$('[name="nt-where"]:checked').map((c) => c.value);
  if (where.length && where.slice().sort().join() !== NT_DEFAULT_WHERE.slice().sort().join()) st.where = where;
  return Object.keys(st).length ? st : null;
}
function fillNoticeStyle(st = {}) {
  buildNoticeForm();
  $("#nt-font").value = NT_FONTS[st.font] ? st.font : "";
  const sz = $(`[name="nt-size"][value="${NT_SIZES[st.size] && st.size !== "m" ? st.size : ""}"]`); if (sz) sz.checked = true;
  const key = NT_COLOR_KEYS.find((k) => NT_COLORS[k][1] && NT_COLORS[k][1].toUpperCase() === String(st.bg ?? "").toUpperCase() && NT_COLORS[k][2].toUpperCase() === String(st.fg ?? "").toUpperCase());
  const custom = !!(st.bg || st.fg) && !key;
  $("#nt-custom").checked = custom;
  if (st.bg) $("#nt-bg").value = st.bg; if (st.fg) $("#nt-fg").value = st.fg;
  const ck = $(`[name="nt-color"][value="${key ?? "default"}"]`); if (ck) ck.checked = true;
  const ik = $$('[name="nt-icon"]').find((r) => r.value === (NT_ICONS[st.icon] ? st.icon : "")); if (ik) ik.checked = true;
  $("#nt-link-label").value = st.link_label ?? ""; $("#nt-link-url").value = st.link_url ?? "";
  $("#nt-from").value = jstStr(st.from); $("#nt-until").value = jstStr(st.until);
  const wh = Array.isArray(st.where) && st.where.length ? st.where : NT_DEFAULT_WHERE;
  $$('[name="nt-where"]').forEach((c) => { c.checked = wh.includes(c.value); });
}
const ntLevel = () => ($('[name="nt-type"]:checked')?.value === "urgent" ? "urgent" : "info");
function applyTemplate(key) {
  const t = NT_TPL[key]; if (!t) return;
  const r = $(`[name="nt-type"][value="${key}"]`); if (r) r.checked = true;
  fillNoticeStyle(t.style);
  previewNotice();
}

let broadcastFilled = false;
function renderBroadcast() {
  const l = state.live;
  const ns = $("#notice-state");
  ns.className = `pill ${l.notice ? (l.notice_level === "urgent" ? "is-urgent" : "is-on") : ""}`;
  ns.textContent = l.notice ? (l.notice_level === "urgent" ? "緊急を表示中" : "表示中") : "なし";
  const ss = $("#stream-state");
  ss.className = `pill ${l.stream_active && l.stream_url ? "is-live" : ""}`;
  ss.textContent = l.stream_active && l.stream_url ? "配信中" : "止まっている";
  if (!broadcastFilled) {
    broadcastFilled = true;
    $("#notice-text").value = l.notice ?? "";
    buildNoticeForm();
    $(`[name="nt-type"][value="${l.notice_level === "urgent" ? "urgent" : "info"}"]`).checked = true;
    fillNoticeStyle(l.notice_style ?? {});
    $("#stream-url").value = l.stream_url ?? "";
    $("#stream-title").value = l.stream_title ?? "";
    $("#stream-active").checked = !!l.stream_active;
    $(`[name="phase"][value="${l.phase_override ?? ""}"]`).checked = true;
    previewNotice();
    previewStream();
  }
}
function previewNotice() {
  buildNoticeForm();
  const text = $("#notice-text").value.trim();
  const p = $("#notice-preview");
  const live = { notice: text, notice_level: ntLevel(), notice_style: readNoticeStyle() ?? undefined };
  const n = noticeOf(live, "top");
  const view = n ?? noticeOf({ ...live, notice_style: { ...(live.notice_style ?? {}), where: ["top"], from: 0, until: 0 } }, "top");
  p.hidden = !view;
  paintNotice(p, view);
}
let previewedStream = null;
function previewStream() {
  const url = toEmbedUrl($("#stream-url").value.trim());
  if (url === previewedStream) return;
  previewedStream = url;
  const box = $("#stream-preview");
  box.hidden = !url;
  box.innerHTML = url ? `<iframe src="${esc(url)}" title="配信のプレビュー" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>` : "";
}
$("#notice-text").addEventListener("input", previewNotice);
buildNoticeForm();
$("#notice-form").addEventListener("input", previewNotice);
$("#notice-form").addEventListener("change", previewNotice);
$$('[name="nt-type"]').forEach((r) => r.addEventListener("change", () => applyTemplate(r.value)));
$("#stream-url").addEventListener("input", previewStream);

const saveLive = (label, fields) => write(label, () => fs.setDoc(fs.doc(db, "site_live", "current"), { ...fields, ...stamp() }, { merge: true }));
$("#notice-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#notice-text").value.trim();
  const level = ntLevel();
  if (!text) return toast("文を入れてください", true);
  if (level === "urgent" && !confirm("緊急のお知らせとして、全員の画面に赤い帯で出します。よろしいですか？")) return;
  const url = $("#nt-link-url").value.trim();
  if (url && !/^https:\/\/[^\s"'<>]+$/.test(url)) return toast("リンク先は https:// から始まる URL にしてください", true);
  const from = jstMs($("#nt-from").value), until = jstMs($("#nt-until").value);
  if (from && until && until <= from) return toast("「ここまで」は、「ここから」より後にしてください", true);
  const st = readNoticeStyle();
  const label = level === "urgent" ? "緊急のお知らせを出しました" : "お知らせを出しました";
  const ok = await saveLive(label, { notice: text, notice_level: level, notice_style: st ?? fs.deleteField() });
  if (!ok && st) await saveLive("見た目は保存できませんでした。文だけ出しました", { notice: text, notice_level: level });
});
$("#notice-clear").addEventListener("click", () => {
  $("#notice-text").value = "";
  previewNotice();
  fillNoticeStyle({});
  const r0 = $('[name="nt-type"][value="info"]'); if (r0) r0.checked = true;
  saveLive("お知らせを消しました", { notice: "", notice_level: "info", notice_style: fs.deleteField() });
});
$("#stream-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const url = $("#stream-url").value.trim();
  if (url && !toEmbedUrl(url)) return toast("YouTube の URL として読めません", true);
  saveLive($("#stream-active").checked ? "配信をトップに出しました" : "配信の設定を保存しました", {
    stream_url: url, stream_title: $("#stream-title").value.trim(), stream_active: $("#stream-active").checked && !!url,
  });
});
$("#stream-stop").addEventListener("click", () => {
  $("#stream-active").checked = false;
  saveLive("配信を止めました", { stream_active: false });
});
$("#phase-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const phase = $('[name="phase"]:checked').value;
  saveLive("表示を保存しました", { phase_override: phase || null });
});

const SCHED_KIND = { a: "ステージ", e: "企画" };
const schedName = ({ kind, item }) => (kind === "a" ? item.name : item.title);
const schedCur = (it) => state.schedule[it.item.sid] ?? { start: it.item.o_start, end: it.item.o_end };
const hmOf = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
const isoAt = (orig, hhmmText) => `${orig.slice(0, 10)}T${hhmmText}:00+09:00`;
const saveSchedule = (changes, label) => write(label, () => fs.setDoc(fs.doc(db, "site_schedule", "current"), { changes, ...stamp() }));
const isDeleted = (it) => !!state.schedule[it.item.sid]?.deleted;
function renderSchedule() {
  const items = scheduleItems().sort((x, y) => Date.parse(x.item.o_start) - Date.parse(y.item.o_start));
  const days = [...new Set(items.map((x) => x.item.o_start.slice(0, 10)))];
  const sel = $("#sh-day"), keep = sel.value;
  sel.innerHTML = days.map((d) => `<option value="${d}">${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日</option>`).join("");
  if (keep) sel.value = keep;
  if ($("#sched-list").contains(document.activeElement) && document.activeElement.matches("input")) return;
  $("#sched-list").innerHTML = days.map((d) => `
    <h3 class="sched-day">${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日</h3>
    ${items.filter((x) => x.item.o_start.startsWith(d)).map((it) => {
      const c = schedCur(it), del = isDeleted(it), added = !!it.item.added;
      const chg = !added && (c.start !== it.item.o_start || c.end !== it.item.o_end);
      const sid = esc(it.item.sid);
      const sub = added ? `${esc(it.item.kind || "")}${it.kind === "e" ? `　${esc(venueName(it.item.venue))}` : ""}　追加した予定` : `もとの時間 ${hmOf(it.item.o_start)}〜${hmOf(it.item.o_end)}${chg ? `　→　<b style="display:inline">${hmOf(c.start)}〜${hmOf(c.end)}</b>` : ""}`;
      return `<div class="sched-row${chg ? " is-chg" : ""}${del ? " is-del" : ""}${added ? " is-added" : ""}">
        <span class="kind">${SCHED_KIND[it.kind]}</span>
        <div><b>${esc(schedName(it))}${del ? " （削除済み）" : ""}</b><small>${sub}</small></div>
        <div class="times"><input type="time" value="${hmOf(c.start)}" data-sid="${sid}" data-end="0" aria-label="始まり"${del ? " disabled" : ""}> 〜 <input type="time" value="${hmOf(c.end)}" data-sid="${sid}" data-end="1" aria-label="終わり"${del ? " disabled" : ""}></div>
        <div class="acts">
          ${del ? `<button class="btn btn-ghost btn-sm" type="button" data-sched-reset="${sid}">もとにもどす</button>` : `
          ${added ? `<button class="btn btn-ghost btn-sm" type="button" data-sched-edit="${sid}">編集</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-sched-reset="${sid}"${chg ? "" : " disabled"}>もとにもどす</button>`}
          <button class="btn btn-ghost btn-sm btn-danger" type="button" data-sched-del="${sid}">削除</button>`}
        </div>
      </div>`;
    }).join("")}`).join("");
}
$("#sched-list").addEventListener("change", (e) => {
  const inp = e.target.closest("input[data-sid]");
  if (!inp) return;
  const it = scheduleItems().find((x) => x.item.sid === inp.dataset.sid);
  const row = inp.closest(".sched-row"), [a1, a2] = row.querySelectorAll("input[type=time]");
  if (!a1.value || !a2.value) return toast("時間を入れてください", true);
  if (a2.value <= a1.value) return toast("終わりは、始まりより後にしてください", true);
  const start = isoAt(it.item.o_start, a1.value), end = isoAt(it.item.o_end, a2.value);
  const changes = { ...state.schedule };
  if (it.item.added) changes[it.item.sid] = { ...changes[it.item.sid], start, end };
  else if (start === it.item.o_start && end === it.item.o_end) delete changes[it.item.sid]; else changes[it.item.sid] = { start, end };
  saveSchedule(changes, `${schedName(it)}の時間を ${a1.value}〜${a2.value} にしました`);
});
$("#sched-list").addEventListener("click", (e) => {
  const reset = e.target.closest("[data-sched-reset]"), del = e.target.closest("[data-sched-del]"), edit = e.target.closest("[data-sched-edit]");
  if (reset) {
    const changes = { ...state.schedule };
    delete changes[reset.dataset.schedReset];
    return saveSchedule(changes, "もとにもどしました");
  }
  if (del) {
    const it = scheduleItems().find((x) => x.item.sid === del.dataset.schedDel);
    if (!it) return;
    if (!confirm(`「${schedName(it)}」を削除しますか？${it.item.added ? "（追加した予定は、完全に消えます）" : "（もとからある予定は、あとで「もとにもどす」で戻せます）"}`)) return;
    const changes = { ...state.schedule };
    if (it.item.added) delete changes[it.item.sid];
    else changes[it.item.sid] = { ...(changes[it.item.sid] ?? { start: it.item.o_start, end: it.item.o_end }), deleted: true };
    return saveSchedule(changes, `${schedName(it)}を削除しました`);
  }
  if (edit) {
    const it = scheduleItems().find((x) => x.item.sid === edit.dataset.schedEdit), c = state.schedule[edit.dataset.schedEdit];
    if (!it || !c) return;
    $("#sa-kind").value = c.k; syncAddForm();
    $("#sa-day").value = c.start.slice(0, 10); $("#sa-start").value = hmOf(c.start); $("#sa-end").value = hmOf(c.end);
    $("#sa-title").value = c.title ?? ""; $("#sa-tag").value = c.tag ?? ""; $("#sa-text").value = c.text ?? "";
    if (c.k === "e") $("#sa-venue").value = c.venue;
    addEditing = edit.dataset.schedEdit;
    $("#sa-head").textContent = "予定を編集する"; $("#sa-submit").textContent = "保存する"; $("#sa-cancel").hidden = false;
    $("#sched-add").scrollIntoView({ behavior: "smooth", block: "center" });
  }
});
let addEditing = null;
function syncAddForm() {
  $("#sa-venue-wrap").hidden = $("#sa-kind").value === "a";
  const days = FESTIVAL.days.map((d) => d.open.slice(0, 10)), sel = $("#sa-day"), keep = sel.value;
  sel.innerHTML = days.map((d) => `<option value="${d}">${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日</option>`).join("");
  if (keep) sel.value = keep;
  const v = $("#sa-venue");
  if (!v.options.length) v.innerHTML = VENUES.map((x) => `<option value="${esc(x.id)}">${esc(venueName(x.id))}</option>`).join("");
}
function resetAddForm() {
  addEditing = null;
  $("#sched-add").reset(); syncAddForm();
  $("#sa-head").textContent = "予定を追加する"; $("#sa-submit").textContent = "追加する"; $("#sa-cancel").hidden = true;
}
$("#sa-kind").addEventListener("change", syncAddForm);
$("#sa-cancel").addEventListener("click", resetAddForm);
$("#sched-add").addEventListener("submit", (e) => {
  e.preventDefault();
  const day = $("#sa-day").value, s = $("#sa-start").value, en = $("#sa-end").value, title = $("#sa-title").value.trim();
  if (!title) return toast("名前を入れてください", true);
  if (!s || !en) return toast("時間を入れてください", true);
  if (en <= s) return toast("終わりは、始まりより後にしてください", true);
  const k = $("#sa-kind").value;
  const entry = { add: 1, k, title, tag: $("#sa-tag").value.trim(), text: $("#sa-text").value.trim(), start: `${day}T${s}:00+09:00`, end: `${day}T${en}:00+09:00` };
  if (k === "e") entry.venue = $("#sa-venue").value;
  const added = Object.keys(state.schedule).filter((x) => x.startsWith("+")).length;
  if (!addEditing && added >= 60) return toast("追加できる予定は60件までです", true);
  const id = addEditing ?? `+${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const label = addEditing ? `${title}を保存しました` : `${title}を追加しました`;
  saveSchedule({ ...state.schedule, [id]: entry }, label);
  resetAddForm();
});
syncAddForm();
$("#sched-reset").addEventListener("click", () => {
  const keep = Object.fromEntries(Object.entries(state.schedule).filter(([k]) => k.startsWith("+")));
  if (Object.keys(keep).length === Object.keys(state.schedule).length) return toast("変えたものはありません");
  if (!confirm("もとからある予定の、変えた時間と削除を、すべてもとにもどしますか？（追加した予定は残ります）")) return;
  saveSchedule(keep, "すべてもとにもどしました");
});
$("#sched-shift").addEventListener("submit", (e) => {
  e.preventDefault();
  const day = $("#sh-day").value, from = $("#sh-from").value, min = Number($("#sh-min").value);
  if (!from || !Number.isFinite(min) || !min) return toast("時刻とずらす分を入れてください", true);
  const targets = scheduleItems().filter((x) => x.item.o_start.startsWith(day) && !isDeleted(x) && hmOf(schedCur(x).start) >= from);
  if (!targets.length) return toast("その時刻より後の出演・企画がありません", true);
  if (!confirm(`${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日の ${from} 以降 ${targets.length}件を、${min > 0 ? `${min}分 遅らせ` : `${-min}分 早め`}ますか？`)) return;
  const changes = { ...state.schedule };
  for (const x of targets) {
    const c = schedCur(x);
    const shift = (iso) => new Date(Date.parse(iso) + min * 60000).toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).replace(" ", "T") + "+09:00";
    const ns = { start: shift(c.start), end: shift(c.end) };
    if (x.item.added) changes[x.item.sid] = { ...changes[x.item.sid], ...ns };
    else if (ns.start === x.item.o_start && ns.end === x.item.o_end) delete changes[x.item.sid]; else changes[x.item.sid] = ns;
  }
  saveSchedule(changes, `${targets.length}件の時間を${min > 0 ? `${min}分 遅らせ` : `${-min}分 早め`}ました`);
});

function renderCrowd() {
  const stale = CROWD.staleMinutes * 60000;
  $("#venues").innerHTML = CROWD.venues.map((id) => {
    const c = state.crowd[id];
    const old = c?.updated_at && Date.now() - c.updated_at > stale;
    return `
      <article class="card venue">
        <h3>${esc(venueName(id))}</h3>
        <p class="now${old ? " is-stale" : ""}">いま：<b>${esc(CROWD.levels[c?.level]?.label ?? "未設定")}</b>${c?.updated_at ? `（${hhmm(c.updated_at)} 更新${old ? "・古い" : ""}）` : ""}</p>
        <div class="levels">${CROWD.levels.map((lv, i) => `
          <button type="button" data-venue="${esc(id)}" data-level="${i}" style="--c:${esc(lv.color)}" aria-pressed="${c?.level === i}">${esc(lv.label)}</button>`).join("")}
        </div>
        <button type="button" class="clear" data-venue="${esc(id)}" data-level="none"${c ? "" : " disabled"}>設定しない（出さない）</button>
      </article>`;
  }).join("");
}
const clearCrowd = (id) => fs.deleteDoc(fs.doc(db, "crowd", id));
$("#crowd-bulk").addEventListener("click", (e) => {
  const b = e.target.closest("[data-bulk]");
  if (!b) return;
  const none = b.dataset.bulk === "none", level = Number(b.dataset.bulk);
  const what = none ? "すべての会場を「設定しない」に" : `すべての会場を「${CROWD.levels[level].label}」に`;
  if (!confirm(`${what}しますか？（${CROWD.venues.length}会場）`)) return;
  write(`${what}しました`, async () => {
    const batch = fs.writeBatch(db);
    for (const id of CROWD.venues) {
      if (none) batch.delete(fs.doc(db, "crowd", id));
      else batch.set(fs.doc(db, "crowd", id), { level, updated_at: fs.serverTimestamp() });
    }
    await batch.commit();
  });
});
$("#venues").addEventListener("click", (e) => {
  const b = e.target.closest("[data-venue]");
  if (!b) return;
  if (b.dataset.level === "none") return void write(`${venueName(b.dataset.venue)}を「設定しない」にしました`, () => clearCrowd(b.dataset.venue));
  const level = Number(b.dataset.level);
  write(`${venueName(b.dataset.venue)}を「${CROWD.levels[level].label}」にしました`,
    () => fs.setDoc(fs.doc(db, "crowd", b.dataset.venue), { level, updated_at: fs.serverTimestamp() }));
});
const PEOPLE = ["p1", "p2", "p3", "p4", "p5"];
let chatterFilled = false;
function renderChatter() {
  if (chatterFilled) return;
  chatterFilled = true;
  PEOPLE.forEach((p) => { $(`#c-${p}`).value = state.chatter[p] ?? ""; });
}
const saveChatter = (values, label) => write(label, () => fs.setDoc(fs.doc(db, "chatter", "current"), { ...values, updated_at: fs.serverTimestamp() }));
$("#chatter-form").addEventListener("submit", (e) => {
  e.preventDefault();
  saveChatter(Object.fromEntries(PEOPLE.map((p) => [p, $(`#c-${p}`).value.trim()])), "実況を公開しました");
});
$("#chatter-clear").addEventListener("click", () => {
  PEOPLE.forEach((p) => { $(`#c-${p}`).value = ""; });
  saveChatter(Object.fromEntries(PEOPLE.map((p) => [p, ""])), "いつものセリフに戻しました");
});

let postFilter = "all";
const photos = new Map();
const aiResults = new Map();
const AI_API = ["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.endsWith("pages.dev") ? "" : "https://hakodate-kosensai.pages.dev";
const isOff = (p) => p.hidden || p.reports >= REPORT_HIDE;
const IC = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/></svg>',
  reply: '<svg viewBox="0 0 24 24"><path d="M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>',
};
const authorOf = (p) => (p.official ? "enishi" : handleOf(p.uid));
const avatarHtml = (p, sm = false) => (p.official
  ? `<span class="tl-av is-official${sm ? " sm" : ""}"><img src="../assets/img/logo-s.webp" alt=""></span>`
  : `<span class="tl-av${sm ? " sm" : ""}"><i>${esc(authorOf(p).slice(0, 1).toUpperCase())}</i></span>`);
const nameHtml = (p) => `<b class="tl-name">${esc(authorOf(p))}${p.official ? `<i class="tl-verified" role="img" aria-label="公式アカウント">${IC.check}</i>` : ""}</b>`;
const placeLabel = (id) => (!id ? "場所なし" : String(id).startsWith("pt-") ? "地図で選んだ場所" : venueName(id));
const PHOTO_FLAG = { pending: '<span class="tag tag-warn flag">確認待ち</span>', rejected: '<span class="tag tag-danger flag">出さない</span>' };
function postActions(p, { reply = false } = {}) {
  const liked = state.myLikes.has(p.id), off = isOff(p);
  const photoBtns = p.has_photo
    ? (p.photo_status !== "approved" ? `<button type="button" data-act="approve" data-id="${esc(p.id)}">写真を公開</button>` : "")
      + (p.photo_status !== "rejected" ? `<button type="button" data-act="reject" data-id="${esc(p.id)}">写真を出さない</button>` : "")
    : "";
  return `<div class="tl-acts">
      <button type="button" class="tl-act${liked ? " is-on" : ""}" data-act="like" data-id="${esc(p.id)}" aria-pressed="${liked}" aria-label="公式でいいね（もう一度押すと取り消し）">${IC.heart}${p.likes ? `<span>${Number(p.likes)}</span>` : ""}</button>
      ${reply ? "" : `<button type="button" class="tl-act" data-act="replyopen" data-id="${esc(p.id)}" aria-label="公式で返信">${IC.reply}</button>`}
      <details class="tl-menu"><summary aria-label="操作">${IC.more}</summary>
        <div class="tl-menu-list">${p.text || p.has_photo ? `<button type="button" data-act="aicheck" data-id="${esc(p.id)}">AIで確認する（候補を知らせるだけ）</button>` : ""}${photoBtns}
          <button type="button" data-act="${off ? "show" : "hide"}" data-id="${esc(p.id)}">${off ? "表示にもどす" : "非表示にする"}</button>
          <button type="button" class="is-danger" data-act="delete" data-id="${esc(p.id)}">削除</button>
        </div></details>
    </div>`;
}
const statusTags = (p) => `${p.reports ? `<span class="tag tag-warn">報告 ${p.reports}</span>` : ""}${isOff(p) ? '<span class="tag tag-danger">非表示</span>' : ""}`;
function aiResultHtml(id) {
  const r = aiResults.get(id);
  if (!r) return "";
  if (r.loading) return '<p class="ai-check is-wait">AIが確認しています…</p>';
  if (r.error) return `<p class="ai-check is-err">AIで確認できませんでした（${esc(r.error)}）</p>`;
  const lv = ["問題なさそう", "軽い注意", "要確認", "要確認（強め）"][r.severity] ?? "要確認";
  return `<div class="ai-check ${r.verdict === "review" ? "is-review" : "is-ok"}"><b>AIの確認：${r.verdict === "review" ? `要確認（${lv}）` : "問題なさそう"}</b>${r.summary ? `<p>${esc(r.summary)}</p>` : ""}${r.reasons?.length ? `<ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<small>AIの候補です。公開するかどうかは、人が決めてください。</small></div>`;
}
async function aiCheck(id) {
  const post = state.posts.find((p) => p.id === id);
  if (!post) return;
  aiResults.set(id, { loading: true });
  renderPosts();
  try {
    let photo = "";
    if (post.has_photo) {
      photo = photos.get(id) ?? (await fs.getDoc(fs.doc(db, "post_photos", id))).data()?.data ?? "";
      if (photo) photos.set(id, photo);
    }
    const token = await a.currentUser.getIdToken();
    const res = await fetch(`${AI_API}/api/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: post.text ?? "", photo, place: post.place ?? "" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error({ 403: "スタッフとして確認できません", 429: "回数の上限です", 503: "AIの設定がまだです" }[res.status] ?? "つながりません");
    aiResults.set(id, body);
  } catch (e) {
    aiResults.set(id, { error: e.message });
  }
  renderPosts();
}
function renderPosts() {
  if (document.activeElement?.closest?.(".post-reply")) return;
  const reportedIds = new Set(state.posts.filter((p) => p.reports > 0 && !p.hidden).map((p) => p.id));
  $("#count-all-posts").textContent = state.posts.length;
  $("#count-reported").textContent = reportedIds.size;
  const ids = new Set(state.posts.map((p) => p.id));
  const kids = new Map();
  state.posts.filter((p) => p.reply_to && ids.has(p.reply_to)).forEach((p) => kids.set(p.reply_to, [...(kids.get(p.reply_to) ?? []), p]));
  let threads = state.posts.filter((p) => !p.reply_to || !ids.has(p.reply_to)).sort((x, y) => y.created_at - x.created_at);
  if (postFilter === "reported") threads = threads.filter((p) => reportedIds.has(p.id) || (kids.get(p.id) ?? []).some((c) => reportedIds.has(c.id)));
  $("#post-list").innerHTML = threads.length ? threads.map((p) => {
    const comments = (kids.get(p.id) ?? []).sort((x, y) => x.created_at - y.created_at);
    const photo = p.has_photo ? `<div class="tl-photo"><img data-photo="${esc(p.id)}" alt="投稿の写真"${photos.get(p.id) ? ` src="${photos.get(p.id)}"` : ""}>${PHOTO_FLAG[p.photo_status] ?? ""}</div>` : "";
    const kind = p.kind === "review" && !p.reply_to ? `<span class="tl-stars">${"★".repeat(p.stars ?? 0)} ${esc(p.shop ?? "")}</span>` : "";
    return `
      <article class="tl-thread${isOff(p) ? " is-off" : ""}">
        <header class="tl-head">${avatarHtml(p)}<div class="tl-who">${nameHtml(p)}<small>${IC.pin}${esc(placeLabel(p.place))}</small></div>${statusTags(p)}</header>
        ${photo}
        <div class="tl-body">
          ${postActions(p)}
          ${kind}
          ${p.text ? `<p class="tl-text">${esc(p.text)}</p>` : ""}
          ${aiResultHtml(p.id)}
          <small class="tl-time">${time(p.created_at)}</small>
        </div>
        ${comments.length ? `<ul class="tl-comments">${comments.map((c) => `
          <li class="tl-comment${isOff(c) ? " is-off" : ""}">${avatarHtml(c, true)}
            <div class="tl-cbody"><p><b class="tl-name">${esc(authorOf(c))}${c.official ? `<i class="tl-verified" role="img" aria-label="公式アカウント">${IC.check}</i>` : ""}</b> ${esc(c.text)}</p>
              <small class="tl-time">${time(c.created_at)}${c.reports ? ` ・<span class="tag tag-warn">報告 ${c.reports}</span>` : ""}${isOff(c) ? ' <span class="tag tag-danger">非表示</span>' : ""}</small></div>
            ${postActions(c, { reply: true })}</li>`).join("")}</ul>` : ""}
        <form class="post-reply" data-id="${esc(p.id)}" hidden>
          <div class="tl-replybar">${avatarHtml({ official: true }, true)}<textarea rows="1" maxlength="140" placeholder="公式（enishi）として返信…" aria-label="公式の返信"></textarea><button class="btn btn-primary btn-sm" type="submit">送る</button></div>
        </form>
      </article>`;
  }).join("") : `<p class="empty">${{ reported: "報告された投稿はありません", all: "投稿はまだありません" }[postFilter]}</p>`;
  $$("#post-list img[data-photo]:not([src])").forEach(async (img) => {
    try {
      const snap = await fs.getDoc(fs.doc(db, "post_photos", img.dataset.photo));
      const src = snap.exists() ? snap.data().data : null;
      photos.set(img.dataset.photo, src);
      if (src) img.src = src; else img.remove();
    } catch { img.remove(); }
  });
}
$("#post-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  postFilter = b.dataset.f;
  $$("#post-tabs [data-f]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  renderPosts();
});
$("#post-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  b.closest("details")?.removeAttribute("open");
  const ref = fs.doc(db, "posts", b.dataset.id);
  const post = state.posts.find((p) => p.id === b.dataset.id);
  if (b.dataset.act === "aicheck") return void aiCheck(b.dataset.id);
  const acts = {
    like: async () => {
      const uid = a.currentUser.uid;
      const likeRef = fs.doc(db, "post_likes", `${b.dataset.id}_${uid}`);
      const on = !(await fs.getDoc(likeRef).then((s) => s.exists()).catch(() => false));
      write(on ? "公式でいいねしました" : "いいねを取り消しました", () => {
        const batch = fs.writeBatch(db);
        if (on) batch.set(likeRef, { post: b.dataset.id, uid, at: fs.serverTimestamp() }); else batch.delete(likeRef);
        batch.update(ref, { likes: fs.increment(on ? 1 : -1) });
        return batch.commit();
      });
    },
    replyopen: () => { const f = b.closest(".tl-thread").querySelector(".post-reply"); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("textarea").focus(); },
    approve: () => write("写真を公開しました", () => fs.updateDoc(ref, { photo_status: "approved" })),
    reject: () => write("写真を出さないことにしました", () => fs.updateDoc(ref, { photo_status: "rejected" })),
    hide: () => write("非表示にしました", () => fs.updateDoc(ref, { hidden: true })),
    show: () => write("表示にもどしました", () => fs.updateDoc(ref, { hidden: false, reports: 0 })),
    delete: () => {
      const kids = state.posts.filter((x) => x.reply_to === b.dataset.id);
      if (!confirm(kids.length ? `この投稿と、コメント${kids.length}件を削除しますか？（もとにもどせません）` : "この投稿を削除しますか？（もとにもどせません）")) return;
      const batch = fs.writeBatch(db);
      [post, ...kids].filter(Boolean).forEach((x) => {
        batch.delete(fs.doc(db, "posts", x.id));
        if (x.has_photo) batch.delete(fs.doc(db, "post_photos", x.id));
      });
      write("削除しました", () => batch.commit());
    },
  };
  acts[b.dataset.act]?.();
});
$("#post-list").addEventListener("submit", async (e) => {
  const f = e.target.closest(".post-reply");
  if (!f) return;
  e.preventDefault();
  const text = f.querySelector("textarea").value.trim();
  if (!text) return toast("返信の文を入れてください", true);
  const parent = state.posts.find((p) => p.id === f.dataset.id);
  const ok = await write("公式として返信しました", () => fs.addDoc(fs.collection(db, "posts"), {
    kind: "post", place: parent?.place ?? "", shop: null, stars: null, text, has_photo: false, photo_status: "none", uid: a.currentUser.uid,
    created_at: fs.serverTimestamp(), reports: 0, hidden: false, reply_to: f.dataset.id, official: true,
  }));
  if (ok) { f.querySelector("textarea").value = ""; f.hidden = true; }
});
function clearOfficialFile() {
  $("#official-file").value = "";
  $("#official-thumb").hidden = true;
  $("#official-thumb-img").removeAttribute("src");
}
$("#official-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return clearOfficialFile();
  $("#official-thumb-img").src = URL.createObjectURL(f);
  $("#official-thumb").hidden = false;
});
$("#official-thumb-clear").addEventListener("click", clearOfficialFile);
$("#official-text").addEventListener("input", (e) => { $("#official-count").textContent = `${e.target.value.length} / 400`; });
$("#official-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#official-text").value.trim();
  const file = $("#official-file").files[0];
  if (!text && !file) return toast("文か画像を入れてください", true);
  let photo = null;
  if (file) {
    try { photo = await shrink(file); } catch (err) { return toast(err.message || "画像を読めませんでした", true); }
  }
  const ref = fs.doc(fs.collection(db, "posts"));
  const ok = await write("本部として投稿しました", () => {
    const batch = fs.writeBatch(db);
    batch.set(ref, {
      kind: "post", place: "", shop: null, stars: null, text, has_photo: !!photo, photo_status: photo ? "approved" : "none", uid: a.currentUser.uid,
      created_at: fs.serverTimestamp(), reports: 0, hidden: false, reply_to: null, official: true,
    });
    if (photo) batch.set(fs.doc(db, "post_photos", ref.id), { data: photo, uid: a.currentUser.uid });
    return batch.commit();
  });
  if (ok) { $("#official-text").value = ""; $("#official-count").textContent = "0 / 400"; clearOfficialFile(); }
});

const SHOP_STATUS = [
  ["normal", "すぐ買える", "#45D483"], ["10min", "10分待ち", "#F5C451"], ["20min", "20分以上", "#F2A96A"], ["soldout", "完売", "#FF6B7A"],
  ["closed", "休業中", "#8B93C9"],
  ["none", "設定しない", "#9AA0A6"],
];
function shopStatusFields(v) {
  return v === "none" ? { status: fs.deleteField(), updated_at: fs.deleteField() } : { status: v, updated_at: fs.serverTimestamp() };
}
function setShopStatus(shop, v) {
  const label = SHOP_STATUS.find(([k]) => k === v)[1];
  if (v === "none" && !shop.exists) return toast(`${shop.name}は、もともと設定されていません`);
  return write(`${shop.name}を「${label}」にしました`, () => shopDocWrite(shop, shopStatusFields(v)));
}
async function bulkShopStatus(v) {
  const q = kana($("#cshops-q").value);
  const shops = (q ? allShops().filter((s) => shopHay(s).includes(q)) : allShops()).filter((s) => v !== "none" || (s.exists && s.status));
  if (!shops.length) return toast("変えるお店がありません");
  const label = SHOP_STATUS.find(([k]) => k === v)[1];
  if (!confirm(`${q ? "探しているお店" : "すべてのお店"} ${shops.length}店を「${label}」にしますか？`)) return;
  write(`${shops.length}店を「${label}」にしました`, async () => {
    for (let i = 0; i < shops.length; i += 400) {
      const batch = fs.writeBatch(db);
      for (const shop of shops.slice(i, i + 400)) {
        const ref = fs.doc(db, "shops", shop.id), fields = shopStatusFields(v);
        if (!shop.exists) batch.set(ref, { name: shop.name, map: shop.map, ...fields });
        else batch.update(ref, { ...fields, ...("pass" in shop ? { pass: fs.deleteField() } : {}) });
      }
      await batch.commit();
    }
  });
}
const shopUrl = (code, shop) => new URL(`../shop.html?shop=${encodeURIComponent(shop)}&code=${encodeURIComponent(code)}`, location.href).href;
const openCodes = new Set();
const shopSlug = (v) => String(v).toLowerCase().replace(/[^a-z0-9_-]/g, "");
const placeName = (id) => MAP.places.find((p) => p.id === id)?.name ?? id;
const CATALOG = SHOPS.map((sh) => {
  const room = sh.room ?? HOMEROOMS[sh.cls] ?? null;
  const where = sh.place ? placeName(sh.place) : [sh.bldg && `${sh.bldg}棟${sh.floor ? sh.floor.replace("F", "階") : ""}`, room].filter(Boolean).join("・");
  return { id: shopSlug(sh.cls ?? sh.room ?? sh.place), kind: "shop", name: sh.name, group: sh.group, map: sh.cls ?? sh.room ?? sh.name,
    ...(room ? { room } : {}), ...(sh.place ? { place: sh.place } : {}), where, catalog: true };
});
const SPOTS = STAMP_PLACES.map((p) => ({ id: p.id, kind: p.kind ?? "venue", name: p.name, group: p.group ?? "", place: p.place, where: p.where ?? "" }));
CATALOG.unshift(...SPOTS.map((x) => ({ ...x, map: x.id, catalog: true })));
const KIND_TAG = { info: '<i class="tag tag-info">インフォ</i>', venue: '<i class="tag tag-ex">スタンプ</i>' };
function allSpots() {
  const docs = new Map(state.shops.map((d) => [d.id, d]));
  const list = CATALOG.map((c) => ({ ...c, ...(docs.get(c.id) ?? {}), name: c.name, map: c.map, exists: docs.has(c.id) }));
  const extra = state.shops.filter((d) => !CATALOG.some((c) => c.id === d.id))
    .map((d) => ({ ...d, kind: "shop", where: d.map ?? "", exists: true }))
    .sort((x, y) => String(x.name).localeCompare(String(y.name), "ja"));
  return [...list, ...extra];
}
const allShops = () => allSpots().filter((s) => s.kind === "shop");
const findShop = (id) => allSpots().find((s) => s.id === id);
function shopDocWrite(shop, fields) {
  const ref = fs.doc(db, "shops", shop.id);
  if (!shop.exists) return fs.setDoc(ref, { name: shop.name, map: shop.map, ...fields });
  return fs.updateDoc(ref, { ...fields, ...("pass" in shop ? { pass: fs.deleteField() } : {}) });
}
let shopFilter = "todo";
const openMore = new Set();
const handedAt = (s) => toMs(s.handed_at);
const kana = (t) => String(t ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const shopHay = (s) => kana([s.name, s.group, s.id, s.map, s.where, s.room].filter(Boolean).join(" "));
function visibleShops() {
  const q = kana($("#shop-q").value);
  const shops = allSpots();
  if (q) return shops.filter((s) => shopHay(s).includes(q));
  if (shopFilter === "todo") return shops.filter((s) => !handedAt(s));
  if (shopFilter === "done") return shops.filter((s) => handedAt(s)).sort((x, y) => handedAt(y) - handedAt(x));
  return shops;
}
let cshopsHold = false;
function renderCrowdShops() {
  if ($("#cshops").contains(document.activeElement) && document.activeElement.matches("input")) { cshopsHold = true; return; }
  cshopsHold = false;
  const shops = allShops();
  const busy = shops.filter((s) => s.status && s.status !== "normal").length;
  $("#cshops-bulk").innerHTML = `<b>いま出ているお店を一斉に：</b>${SHOP_STATUS.map(([v, label, c]) => `<button type="button" data-bulk-shop="${v}" style="--c:${c}"${v === "none" ? ' class="clear"' : ""}>${label}</button>`).join("")}`;
  $("#cshops-sum").textContent = `　待ちあり・完売 ${busy}店 / ${shops.length}店`;
  const q = kana($("#cshops-q").value);
  const list = q ? shops.filter((s) => shopHay(s).includes(q)) : shops;
  $("#cshops").innerHTML = list.length ? list.map((s) => `
    <div class="cshop">
      <div class="cshop-name"><b>${esc(s.name)}</b><small>${[s.group, s.where, s.updated_at ? `${hhmm(toMs(s.updated_at))} 更新` : "まだ出していない"].filter(Boolean).map(esc).join("・")}</small></div>
      <div class="shop-status">${SHOP_STATUS.map(([v, label, c]) => `<button type="button" data-shop="${esc(s.id)}" data-status="${v}" style="--c:${c}" aria-pressed="${v === "none" ? !s.status : s.status === v}">${label}</button>`).join("")}</div>
      <form class="cshop-msg" data-msg-shop="${esc(s.id)}">
        <input maxlength="40" value="${esc(s.message ?? "")}" placeholder="お店のひとこと（トップの縁日・地図に出る。40字まで）" aria-label="${esc(s.name)}のひとこと">
        <button class="btn btn-ghost btn-sm" type="submit">のせる</button>
      </form>
    </div>`).join("") : '<p class="muted small">見つかりません</p>';
}
$("#cshops-q").addEventListener("input", renderCrowdShops);
$("#cshops-bulk").addEventListener("click", (e) => { const b = e.target.closest("[data-bulk-shop]"); if (b) bulkShopStatus(b.dataset.bulkShop); });
$("#cshops").addEventListener("focusout", () => setTimeout(() => { if (cshopsHold) renderCrowdShops(); }, 0));
$("#cshops").addEventListener("submit", (e) => {
  const f = e.target.closest("[data-msg-shop]");
  if (!f) return;
  e.preventDefault();
  const shop = findShop(f.dataset.msgShop);
  const text = f.querySelector("input").value.trim().slice(0, 40);
  f.querySelector("input").blur();
  write(text ? `${shop.name}のひとことをのせました` : `${shop.name}のひとことを消しました`, () => shopDocWrite(shop, { message: text, message_at: fs.serverTimestamp() }));
});
$("#cshops").addEventListener("click", (e) => {
  const st = e.target.closest("[data-status]");
  if (!st) return;
  setShopStatus(findShop(st.dataset.shop), st.dataset.status);
});
function renderShops() {
  renderCrowdShops();
  const shops = allSpots();
  const done = shops.filter((s) => handedAt(s)).length;
  $("#count-todo").textContent = shops.length - done;
  $("#count-done").textContent = done;
  $("#count-all").textContent = shops.length;
  const prog = $("#desk-progress");
  prog.textContent = `受付済み ${done} / ${shops.length}`;
  prog.classList.toggle("is-on", done === shops.length && shops.length > 0);
  const shopsOnly = shops.filter((s) => s.kind === "shop");
  $("#pr-target-todo").textContent = `${shopsOnly.filter((s) => !handedAt(s)).length}店`;
  $("#pr-target-all").textContent = `${shopsOnly.length}店`;
  const q = $("#shop-q").value.trim();
  const list = visibleShops();
  $("#shop-hint").textContent = q ? `すべてのお店から「${q}」を探しています（${list.length}件）` : "";
  const wait = (v) => SHOP_STATUS.find(([k]) => k === v)?.[1];
  $("#shop-list").innerHTML = list.length ? list.map((s) => {
    const codes = state.codes.filter((c) => c.shop === s.id);
    const h = handedAt(s);
    return `
      <article class="shop${h ? " is-done" : ""}">
        <div class="shop-name"><h3>${esc(s.name)}${KIND_TAG[s.kind] ?? ""}</h3><small>${[s.group, s.where].filter(Boolean).map(esc).join("・")}</small></div>
        <div class="shop-desk">
          ${h ? `<span class="tag tag-ok">✓ ${hhmm(h)} に渡した</span>
            <button class="btn btn-ghost btn-sm" type="button" data-print-one="${esc(s.id)}">もう一度印刷</button>
            <button class="btn btn-ghost btn-sm" type="button" data-undo="${esc(s.id)}">取り消す</button>`
          : `<button class="btn btn-primary" type="button" data-print-one="${esc(s.id)}">印刷する</button>`}
        </div>
        ${s.kind !== "shop" ? "" : `<details class="shop-more" data-more="${esc(s.id)}"${openMore.has(s.id) ? " open" : ""}>
          <summary>当日の操作<span>待ち時間：${esc(wait(s.status) ?? "まだ出していない")}${s.updated_at ? `（${hhmm(toMs(s.updated_at))}）` : ""}・コード ${codes.length}</span></summary>
          <div class="shop-status">${SHOP_STATUS.map(([v, label, c]) => `<button type="button" data-shop="${esc(s.id)}" data-status="${v}" style="--c:${c}" aria-pressed="${v === "none" ? !s.status : s.status === v}">${label}</button>`).join("")}</div>
          <div class="shop-codes">
            ${codes.map((c) => `<span class="code-chip">${esc(c.code)}<button class="btn btn-ghost btn-sm" data-qr="${esc(c.code)}">${openCodes.has(c.code) ? "QR を閉じる" : "QR"}</button><button class="btn btn-danger btn-sm" data-revoke="${esc(c.code)}">取り消す</button></span>
              ${openCodes.has(c.code) ? `<div class="qr-box" data-qr-box="${esc(c.code)}" data-qr-shop="${esc(s.id)}"><div class="qr"></div><small>${esc(shopUrl(c.code, s.id))}</small></div>` : ""}`).join("")}
            <button class="btn btn-ghost btn-sm" data-issue="${esc(s.id)}">＋ 新しいコード</button>
            ${s.catalog ? "" : `<button class="btn btn-danger btn-sm" data-remove="${esc(s.id)}" style="margin-left:auto">お店を消す</button>`}
          </div>
        </details>`}
      </article>`;
  }).join("") : `<p class="empty">${q ? `「${esc(q)}」に合うお店はありません。` : shopFilter === "todo" ? "全部のお店に渡しました 🎉" : "まだありません。"}</p>`;
  $$("[data-qr-box]").forEach((box) => {
    const el = $(".qr", box);
    if (window.QRCode) new window.QRCode(el, { text: shopUrl(box.dataset.qrBox, box.dataset.qrShop), width: 180, height: 180 });
    else el.textContent = "QR を作れませんでした（下の URL を送ってください）";
  });
}
$("#shop-q").addEventListener("input", renderShops);
$("#shop-filter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  shopFilter = b.dataset.f;
  $$("#shop-filter [data-f]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  $("#shop-q").value = "";
  renderShops();
});
$("#shop-list").addEventListener("toggle", (e) => {
  const d = e.target.closest?.("[data-more]");
  if (d) d.open ? openMore.add(d.dataset.more) : openMore.delete(d.dataset.more);
}, true);
function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.getRandomValues(new Uint8Array(16))].map((n) => alphabet[n % alphabet.length]).join("");
}
$("#shop-list").addEventListener("click", async (e) => {
  const st = e.target.closest("[data-status]");
  const issue = e.target.closest("[data-issue]");
  const qr = e.target.closest("[data-qr]");
  const revoke = e.target.closest("[data-revoke]");
  const remove = e.target.closest("[data-remove]");
  const printOne = e.target.closest("[data-print-one]");
  const undo = e.target.closest("[data-undo]");
  if (printOne) {
    const shop = findShop(printOne.dataset.printOne);
    if (handedAt(shop) && !confirm(`「${shop.name}」には ${hhmm(handedAt(shop))} に渡しています。もう一度印刷しますか？`)) return;
    printForDesk(shop);
  }
  if (undo) {
    const shop = findShop(undo.dataset.undo);
    if (!confirm(`「${shop.name}」の受付を取り消して、「まだ」に戻しますか？`)) return;
    write(`${shop.name}を「まだ」に戻しました`, () => fs.updateDoc(fs.doc(db, "shops", shop.id), { handed_at: fs.deleteField() }));
  }
  if (st) {
    setShopStatus(findShop(st.dataset.shop), st.dataset.status);
  }
  if (issue) {
    const code = newCode();
    const shop = findShop(issue.dataset.issue);
    if (await write("コードを作りました", async () => {
      if (!shop.exists) await shopDocWrite(shop, {});
      await fs.setDoc(fs.doc(db, "shop_codes", code), { shop: shop.id, created_at: fs.serverTimestamp() });
    })) {
      openCodes.add(code);
      renderShops();
    }
  }
  if (qr) {
    openCodes.has(qr.dataset.qr) ? openCodes.delete(qr.dataset.qr) : openCodes.add(qr.dataset.qr);
    renderShops();
  }
  if (revoke) {
    if (!confirm("このコードを取り消しますか？ このコードで入ったお店の人も、待ち時間を変えられなくなります。")) return;
    const code = revoke.dataset.revoke;
    write("コードを取り消しました", async () => {
      const members = await fs.getDocs(fs.query(fs.collection(db, "shop_members"), fs.where("code", "==", code)));
      const batch = fs.writeBatch(db);
      members.forEach((m) => batch.delete(m.ref));
      batch.delete(fs.doc(db, "shop_codes", code));
      await batch.commit();
    });
  }
  if (remove) {
    const shop = findShop(remove.dataset.remove);
    if (!confirm(`「${shop.name}」を消しますか？（サイトの一覧からも消えます）`)) return;
    write("お店を消しました", async () => {
      const batch = fs.writeBatch(db);
      state.codes.filter((c) => c.shop === shop.id).forEach((c) => batch.delete(fs.doc(db, "shop_codes", c.code)));
      batch.delete(fs.doc(db, "shops", shop.id));
      await batch.commit();
    });
  }
});
const FEST = "fest";
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const randomKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rallyShopIds = () => (state.rally?.shops ?? []).map((s) => s.id);
const isRallyShop = (id) => rallyShopIds().includes(id);
const keysOf = (id) => state.rallyKeys[id]?.keys ?? {};

const rallySpots = () => allSpots().filter((x) => STAMP_PLACES.some((p) => p.id === x.id));
function rallyMissing() {
  const cur = new Map((state.rally?.shops ?? []).map((s) => [s.id, s]));
  const spots = rallySpots();
  const extra = [...cur.keys()].filter((id) => !spots.some((s) => s.id === id));
  return [...spots.filter((s) => !cur.has(s.id) || !keysOf(s.id)[FEST]), ...extra.map((id) => ({ id }))];
}
async function ensureRally() {
  if (!rallyMissing().length) return false;
  const batch = fs.writeBatch(db);
  const shops = [];
  for (const shop of rallySpots()) {
    const keys = { ...keysOf(shop.id) };
    if (!keys[FEST]) {
      keys[FEST] = randomKey();
      batch.set(fs.doc(db, "rally_keys", shop.id), { keys });
      state.rallyKeys[shop.id] = { keys };
    }
    const codes = { [FEST]: await sha256(`kosen63:${shop.id}:${FEST}:${keys[FEST]}`) };
    const room = shop.catalog ? shop.room : shop.map;
    shops.push({ id: shop.id, name: shop.name, ...(room ? { room } : {}), ...(shop.place ? { place: shop.place } : {}), codes });
  }
  const current = { shops, staffPin: state.rally?.staffPin ?? null };
  batch.set(fs.doc(db, "rally", "current"), { ...current, ...stamp() });
  await batch.commit();
  state.rally = current;
  return true;
}
function renderRally() {
  const total = rallySpots().length;
  const missing = rallyMissing().length;
  const st = $("#rally-state");
  st.className = `pill ${!missing ? "is-on" : ""}`;
  st.textContent = `QR ${total - missing}/${total}`;
  $("#rally-all").disabled = !missing;
  $("#rally-all").textContent = missing ? `${missing}か所の QR を整える` : "全部のお店の QR を用意済み";
}
$("#rally-all").addEventListener("click", () => write("全部の場所のスタンプの QR を用意しました", ensureRally));
$("#prize-out").addEventListener("change", (e) => {
  const on = e.target.checked;
  if (!confirm(on ? "「景品はすべてなくなりました」と、スタンプカードのページにおわびを出しますか？" : "景品の受け付けを再開しますか？（おわびを消します）")) { e.target.checked = !on; return; }
  saveLive(on ? "景品の終了を出しました" : "景品の受け付けを再開しました", { prize_out: on });
});
$("#photo-review").addEventListener("change", (e) => {
  saveLive(e.target.checked ? "写真を、確認してから出すようにしました" : "写真を、そのまま公開にしました", { photo_review: e.target.checked });
});
$("#cache-reset").addEventListener("click", () => {
  if (!confirm("全員のキャッシュを削除しますか？（いま開いている人の画面は、読みこみなおされます）")) return;
  saveLive("全員のキャッシュ削除を指示しました", { cache_reset_at: fs.serverTimestamp() });
});
const rallyGoal = () => { return Math.min(RALLY.goal, rallySpots().length || RALLY.goal); };

const siteUrl = (path = "") => new URL(`../${path}`, location.href).href;
function qrDataUrl(text, size = 480) {
  if (!window.QRCode) throw new Error("QR を作る部品を読みこめませんでした");
  const box = document.createElement("div");
  new window.QRCode(box, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
  return box.querySelector("canvas").toDataURL("image/png");
}
function stampQrDataUrl(text, size = 480) {
  if (!window.QRCode) throw new Error("QR を作る部品を読みこめませんでした");
  const box = document.createElement("div");
  new window.QRCode(box, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.H });
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.drawImage(box.querySelector("canvas"), 0, 0);
  const m = size / 2;
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(m, m, size * 0.15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#000";
  g.lineWidth = size * 0.02;
  g.beginPath(); g.arc(m, m, size * 0.122, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#000";
  g.font = `900 ${Math.round(size * 0.15)}px "Zen Kaku Gothic New", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("縁", m, m + size * 0.008);
  return c.toDataURL("image/png");
}
const printKind = () => $('[name="pr-kind"]:checked').value;
function syncPrintControls() {
  const kind = printKind();
  $("#pr-target-box").hidden = kind !== "shopstaff";
  $("#pr-staff-box").hidden = true;
  $("#pr-size-box").hidden = true;
}
$$('[name="pr-kind"]').forEach((r) => r.addEventListener("change", syncPrintControls));

const LOGO = "../assets/img/logo.webp";
const head = (sub) => `<header class="ps-head"><img src="${LOGO}" alt=""><div><b>第${FESTIVAL.edition}回 函館高専祭「${esc(FESTIVAL.theme)}」</b><small>${esc(sub)}</small></div></header>`;
const qrTile = (url, title, note = "") => `<figure class="ps-qr"><img src="${qrDataUrl(url)}" alt=""><figcaption><b>${esc(title)}</b>${note ? `<small>${esc(note)}</small>` : ""}</figcaption></figure>`;
const stampCard = (shop) => `
  <div class="ps-stamp">
    <p class="ps-stamp-top">スタンプラリー</p>
    <img src="${stampQrDataUrl(siteUrl(`rally.html?s=${encodeURIComponent(shop.id)}&c=${encodeURIComponent(keysOf(shop.id)[FEST])}`))}" alt="">
    <p class="ps-stamp-name">${esc(shop.name)}</p>
    <p class="ps-stamp-day">${esc(FESTIVAL.days.map((d) => d.label).join("・"))} 両日使える QR</p>
    <p class="ps-stamp-hint">スマホのカメラで読むと、スタンプが押されます</p>
  </div>`;

async function ensureShopCode(shopId) {
  const existing = state.codes.find((c) => c.shop === shopId);
  if (existing) return existing.code;
  const shop = findShop(shopId);
  if (shop && !shop.exists) await shopDocWrite(shop, {});
  const code = newCode();
  await fs.setDoc(fs.doc(db, "shop_codes", code), { shop: shopId, created_at: fs.serverTimestamp() });
  return code;
}

async function buildShopSet(places, _withStaff = false, format = printFormat()) {
  return places.map((s) => (format === "wall" ? buildWall(s) : buildTents([s]))).join("");
}
async function buildStaffPapers(shops) {
  const pages = [];
  for (const s of shops) {
    const code = await ensureShopCode(s.id);
    const url = shopUrl(code, s.id);
    pages.push(`
        <section class="sheet ps-staff">
          ${head("お店の人用（店頭には貼らない）")}
          <h2 class="ps-name">${esc(s.name)}</h2>
          <p class="ps-warn">この紙は店頭に貼らないでください！お店の人だけで使います！</p>
          <div class="ps-staff-body">
            <img class="ps-staff-qr" src="${qrDataUrl(url)}" alt="">
            <ol class="ps-steps">
              <li>お店の人のスマホのカメラで、QR を読む</li>
              <li>開いたページで「すぐ買える」「10分くらい待つ」「20分以上待つ」「完売」を選ぶ</li>
              <li>押すとすぐに、公式サイトと校内マップに反映されます！</li>
            </ol>
          </div>
          <p class="ps-url">${esc(url)}</p>
          <p class="ps-foot">困ったら本部（${esc(RALLY.claimPlace)}）へ</p>
        </section>`);
  }
  return pages.join("");
}
const tcy = (t) => esc(t).replace(/QR|\d{1,2}/g, (m) => `<span class="tcy">${m}</span>`);
const kanjiNum = (n) => {
  const d = "〇一二三四五六七八九";
  if (n < 10) return d[n];
  const tens = Math.floor(n / 10), ones = n % 10;
  return `${tens > 1 ? d[tens] : ""}十${ones ? d[ones] : ""}`;
};
function rallyBody(s) {
  if (s.kind === "shop") {
    return `
          <div class="pt-v pt-rally-text">
            <h3>高専祭の<br>サイトも、<br>どうぞ。</h3>
            <p class="pt-rally-lead">待ち時間や、<br><b>校内マップ</b>も<br>見られます。</p>
          </div>
          <figure class="pt-rally-qr"><img src="${qrDataUrl(siteUrl(""))}" alt=""><figcaption>↑読み込んで、サイトを見る</figcaption></figure>`;
  }
  const rally = isRallyShop(s.id) && keysOf(s.id)[FEST];
  const qr = rally
    ? stampQrDataUrl(siteUrl(`rally.html?s=${encodeURIComponent(s.id)}&c=${encodeURIComponent(keysOf(s.id)[FEST])}`))
    : qrDataUrl(siteUrl("rally.html"));
  return `
          <div class="pt-v pt-rally-text">
            <h3>スタンプラリー、<br>はじめました。</h3>
            ${s.kind === "info"
              ? `<p class="pt-rally-lead">まずはここで<b>一個目</b>！<br>スタンプ${kanjiNum(rallyGoal())}個で、景品と交換！</p>`
              : rally ? `<p class="pt-rally-lead">スタンプ<b>${kanjiNum(rallyGoal())}個</b>で、景品と交換！</p>` : `<p class="pt-rally-lead">校内の数か所で、<br>実施中！</p>`}
          </div>
          <figure class="pt-rally-qr"><img src="${qr}" alt=""><figcaption>${rally ? "↑読み込んでスタンプを押す" : "↑読み込んでスタンプカードを見る"}</figcaption></figure>`;
}
const SITE_LINK = { shop: ["#ennichi", "で待ち時間をチェック"], exhibit: ["map.html?list=exhibit", "で学科展示を見る"], info: ["map.html", "で校内マップを見る"], venue: ["map.html", "で校内マップを見る"] };
function linksHtml(s) {
  const [path, text] = SITE_LINK[s.kind] ?? SITE_LINK.shop;
  return `
          <div class="pl-links">
            <figure class="pl-link"><img class="pl-qr" src="${qrDataUrl(siteUrl("map.html?tab=feed"))}" alt=""><figcaption><img class="pt-enista" src="../assets/img/enistagram.webp" alt="Enistagram"><span>に投稿</span></figcaption></figure>
            <figure class="pl-link"><img class="pl-qr" src="${qrDataUrl(siteUrl(path))}" alt=""><figcaption><b>公式サイト</b><span>${text}</span></figcaption></figure>
          </div>`;
}
function buildWall(s) {
  return `
      <section class="sheet pw">
        <div class="pw-name">
          <img class="pw-logo" src="${LOGO}" alt="">
          <div><h2 class="pw-shop">${esc(s.name)}</h2>${s.group ? `<p class="pw-group">${esc(s.group)}</p>` : ""}</div>
        </div>
        <div class="pw-rally">${rallyBody(s)}</div>
        <div class="pw-links">${linksHtml(s)}</div>
        <p class="pw-foot">第${FESTIVAL.edition}回 函館高専祭「${esc(FESTIVAL.theme)}」</p>
      </section>`;
}
function buildTents(shops) {
  return shops.map((s) => {
    return `
      <section class="sheet pt">
        <div class="pt-panel"><div class="pt-face pt-name">
          <img class="pt-logo" src="${LOGO}" alt="">
          <div class="pt-v pt-name-v">
            <h2 class="pt-shop">${esc(s.name)}</h2>
            ${s.group ? `<p class="pt-group">${esc(s.group)}</p>` : ""}
          </div>
        </div></div>
        <div class="pt-panel pt-rally"><div class="pt-face">
${rallyBody(s)}
        </div></div>
        <div class="pt-panel"><div class="pt-face pt-links">
          <div class="pt-v pt-links-name"><h2 class="pt-shop">${esc(s.name)}</h2>${s.group ? `<p class="pt-group">${esc(s.group)}</p>` : ""}</div>
          ${linksHtml(s)}
        </div></div>
        <div class="pt-glue">の り し ろ</div>
      </section>`;
  }).join("");
}
function buildStamps(shops) {
  const cards = shops.map((s) => stampCard(s));
  const pages = [];
  for (let i = 0; i < cards.length; i += 6) pages.push(`<section class="sheet ps-grid">${cards.slice(i, i + 6).join("")}</section>`);
  return pages.join("");
}
function buildFlyer(size) {
  const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  const flyer = `
    <div class="pf">
      <header class="pf-head"><img src="${LOGO}" alt=""><div><p class="pf-edition">第${FESTIVAL.edition}回 函館高専祭</p><h2>「${esc(FESTIVAL.theme)}」<small>${esc(FESTIVAL.themeReading ?? "")}</small></h2></div></header>
      <ul class="pf-days">${FESTIVAL.days.map((d) => `<li><b>${esc(d.label)}</b><span>${hhmm(d.open)}〜${hhmm(d.close)}</span></li>`).join("")}</ul>
      <p class="pf-place">函館工業高等専門学校</p>
      <div class="pf-qrs">
        ${qrTile(siteUrl(""), "公式サイト", "いまやっていること・混雑")}
        ${qrTile(siteUrl("map.html"), "校内マップ", "トイレ・お店・企画の場所")}
        ${qrTile(siteUrl("map.html?tab=feed"), "Enistagram", "写真と感想を投稿")}
        ${qrTile(siteUrl("rally.html"), "スタンプカード", "模擬店のQRで集めよう")}
      </div>
      <ul class="pf-notes">${VISIT_NOTES().map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      <p class="pf-foot">${esc(FESTIVAL.instagramId ?? "")}</p>
    </div>`;
  return size === "a5" ? `<section class="sheet pf-a5">${flyer}${flyer}</section>` : `<section class="sheet pf-a4">${flyer}</section>`;
}
const VISIT_NOTES = () => {
  const cards = VISIT;
  const close = new Date(FESTIVAL.days[0].close).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  return cards.slice(0, 6).map((c) => String(c.title).replace("{close}", close).replace("{voteEnd}", "締め切り"));
};

const FORMAT_KEY = "kosen63-print-format";
const FORMAT_LABEL = { tent: "三角POP", wall: "貼り紙" };
function printFormat() {
  const v = $('[name="pr-format"]:checked')?.value;
  if (v) return v;
  try { return localStorage.getItem(FORMAT_KEY) === "wall" ? "wall" : "tent"; } catch { return "tent"; }
}
$$('[name="pr-format"]').forEach((r) => { r.checked = r.value === printFormat(); });
let current = null;
let deskShop = null;
async function showPrint() {
  const c = current;
  deskShop = c.shop ?? null;
  $("#pr-kind-label").textContent = c.kindLabel;
  $("#pr-title").textContent = c.title;
  $("#pr-format-box").hidden = !c.set;
  $("#print-area").innerHTML = await c.build();
  loadPrintFont($("#print-area").textContent);
  const n = $$("#print-area .sheet").length;
  const staff = $$("#print-area .ps-staff").length;
  $("#pr-note").textContent = [c.sub, c.set ? `${FORMAT_LABEL[printFormat()]}${staff ? "・お店の人用の紙" : ""}` : "", `${n}枚`].filter(Boolean).join("　");
  $("#pr-given").hidden = true;
  $("#pr-print").className = "btn btn-primary";
  $("#print-overlay").hidden = false;
  document.body.classList.add("is-printing");
  $("#pr-print").focus();
}
$$('[name="pr-format"]').forEach((r) => r.addEventListener("change", async () => {
  try { localStorage.setItem(FORMAT_KEY, r.value); } catch {  }
  if (current && !$("#print-overlay").hidden) await showPrint();
}));
function closePrint() {
  $("#print-overlay").hidden = true;
  document.body.classList.remove("is-printing");
  $("#print-area").innerHTML = "";
  current = null;
  deskShop = null;
}
$("#pr-close").addEventListener("click", closePrint);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#print-overlay").hidden) closePrint(); });
const KIND_NAME = { shop: "模擬店", exhibit: "学科展示", info: "インフォメーション" };
async function printForDesk(shop) {
  toast(`${shop.name}の紙を作っています…`);
  try {
    const stamp = STAMP_PLACES.some((p) => p.id === shop.id);
    if (stamp) await ensureRally();
    current = { kindLabel: `受付：${KIND_NAME[shop.kind] ?? "模擬店"}`, title: shop.name, sub: [shop.group, shop.where].filter(Boolean).join("・"),
      build: stamp ? () => buildShopSet([shop]) : () => buildStaffPapers([shop]), shop, set: stamp };
    await showPrint();
  } catch (err) {
    console.warn(err);
    toast(`作れませんでした（${err.message}）`, true);
  }
}
$("#pr-print").addEventListener("click", async () => {
  await document.fonts?.ready;
  window.print();
  if (deskShop) {
    $("#pr-given").hidden = false;
    $("#pr-print").className = "btn btn-ghost";
    $("#pr-note").textContent = "刷れたら、渡して「渡した」を押してください。";
    $("#pr-given").focus();
  }
});
$("#pr-given").addEventListener("click", async () => {
  const shop = deskShop;
  if (!shop) return;
  if (await write(`${shop.name}に渡しました`, () => shopDocWrite(shop, { handed_at: fs.serverTimestamp() }))) {
    closePrint();
    $("#shop-q").value = "";
    renderShops();
    $("#shop-q").focus();
  }
});
$("#pr-make").addEventListener("click", async () => {
  const kind = printKind();
  const target = $('[name="pr-target"]:checked').value;
  const list = kind === "stamp" ? rallySpots() : allShops().filter((x) => target === "all" || !handedAt(x));
  if (!list.length) return toast("刷る場所がありません", true);
  $("#pr-make").disabled = true;
  try {
    if (kind === "stamp") await ensureRally();
    current = {
      kindLabel: kind === "stamp" ? "まとめて：スタンプラリーの紙" : "まとめて：お店の人に渡す紙（待ち時間の変更）",
      title: kind === "stamp" ? `スタンプの場所（${list.length}か所）` : `${target === "all" ? "すべてのお店" : "まだ渡していないお店"}（${list.length}店）`,
      sub: "まとめて刷っても「受付済み」にはなりません",
      build: kind === "stamp" ? () => buildShopSet(list) : () => buildStaffPapers(list),
      set: kind === "stamp",
    };
    await showPrint();
  } catch (err) {
    console.warn(err);
    toast(`作れませんでした（${err.message}）`, true);
  } finally {
    $("#pr-make").disabled = false;
  }
});
function loadPrintFont(text) {
  const chars = [...new Set(text.replace(/\s+/g, ""))].join("");
  let link = document.getElementById("print-font");
  if (!link) { link = document.createElement("link"); link.id = "print-font"; link.rel = "stylesheet"; document.head.append(link); }
  link.href = `https://fonts.googleapis.com/css2?family=WDXL+Lubrifont+JP+N&display=swap&text=${encodeURIComponent(chars)}`;
}

addEventListener("beforeunload", (e) => { if (blocksDirty) e.preventDefault(); });

const BLOCK_INFO = Object.fromEntries(TOP_BLOCKS.map(([id, name, note]) => [id, { name, note }]));
let blocksDirty = false;
let draft = null;
const editing = () => $('[name="blocks-edit"]:checked').value;
function presetsFromConfig() {
  const c = state.siteConfig;
  return { before: c?.presets?.before ?? TOP_PRESETS.before, during: c?.presets?.during ?? TOP_PRESETS.during };
}
function blocksFromConfig() {
  draft ??= presetsFromConfig();
  const list = (draft[editing()] ?? []).filter((b) => BLOCK_INFO[b?.id]).map((b) => ({ id: b.id, show: b.show !== false }));
  const has = (id) => list.some((b) => b.id === id);
  (TOP_PRESETS[editing()] ?? []).filter((b) => BLOCK_INFO[b.id]).forEach(({ id, show }, i, arr) => {
    if (has(id)) return;
    const prev = arr.slice(0, i).reverse().find((b) => has(b.id));
    list.splice(prev ? list.findIndex((b) => b.id === prev.id) + 1 : 0, 0, { id, show });
  });
  return [...list, ...TOP_BLOCKS.filter(([id]) => !has(id)).map(([id]) => ({ id, show: true }))];
}
function renderBlocks(list = blocksFromConfig()) {
  $("#blocks-list").innerHTML = list.map(({ id, show }) => `
    <li class="block-row${show ? "" : " is-off"}" data-block-id="${esc(id)}">
      <button class="block-grip" type="button" aria-label="${esc(BLOCK_INFO[id].name)}を動かす（↑↓）" title="ドラッグして並べかえ">⠿</button>
      <span class="block-no"></span>
      <span class="block-name"><b>${esc(BLOCK_INFO[id].name)}</b><small>${esc(BLOCK_INFO[id].note)}</small></span>
      <label class="switch block-show"><input type="checkbox" data-block-show${show ? " checked" : ""}><span class="switch-ui" aria-hidden="true"></span><span class="visually-hidden">出す</span></label>
    </li>`).join("");
  numberBlocks();
  const off = list.filter((b) => !b.show).map((b) => BLOCK_INFO[b.id].name);
  $("#blocks-state").textContent = blocksDirty ? "保存していない変更があります" : off.length ? `出していない：${off.join("・")}` : "すべて出している";
}
function numberBlocks() {
  let n = 0;
  $$(".block-row").forEach((row) => {
    const on = $("[data-block-show]", row).checked;
    row.classList.toggle("is-off", !on);
    $(".block-no", row).textContent = on ? String(++n) : "−";
    row.classList.toggle("is-top", on && n === 1);
  });
}
const readRows = () => $$(".block-row").map((row) => ({ id: row.dataset.blockId, show: $("[data-block-show]", row).checked }));
function touched() {
  blocksDirty = true;
  draft[editing()] = readRows();
  numberBlocks();
  $("#blocks-state").textContent = "保存していない変更があります";
}
$("#blocks-list").addEventListener("pointerdown", (e) => {
  const grip = e.target.closest(".block-grip");
  if (!grip || e.button > 0) return;
  e.preventDefault();
  const row = grip.closest(".block-row"), list = $("#blocks-list");
  grip.setPointerCapture(e.pointerId);
  row.classList.add("is-dragging");
  const move = (ev) => {
    const others = $$(".block-row", list).filter((r) => r !== row);
    const after = others.find((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
    if (after) { if (row.nextElementSibling !== after) list.insertBefore(row, after); } else if (list.lastElementChild !== row) list.append(row);
    numberBlocks();
  };
  const up = () => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", up);
    grip.removeEventListener("pointercancel", up);
    row.classList.remove("is-dragging");
    touched();
  };
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", up);
  grip.addEventListener("pointercancel", up);
});
$("#blocks-list").addEventListener("keydown", (e) => {
  const grip = e.target.closest(".block-grip");
  if (!grip || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  const row = grip.closest(".block-row");
  if (e.key === "ArrowUp" && row.previousElementSibling) row.previousElementSibling.before(row);
  if (e.key === "ArrowDown" && row.nextElementSibling) row.nextElementSibling.after(row);
  grip.focus();
  touched();
});
$("#blocks-list").addEventListener("change", (e) => { if (e.target.matches("[data-block-show]")) touched(); });
$("#blocks-default").addEventListener("click", () => { renderBlocks(TOP_PRESETS[editing()].map((b) => ({ ...b }))); touched(); });
$$('[name="blocks-edit"]').forEach((r) => r.addEventListener("change", () => renderBlocks()));
$$('[name="blocks-mode"]').forEach((r) => r.addEventListener("change", () => { blocksDirty = true; draft ??= presetsFromConfig(); $("#blocks-state").textContent = "保存していない変更があります"; }));
function renderMode() {
  const m = state.siteConfig?.mode ?? "auto";
  const r = $(`[name="blocks-mode"][value="${m}"]`);
  if (r) r.checked = true;
}
$("#blocks-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  draft ??= presetsFromConfig();
  draft[editing()] = readRows();
  const presets = { before: draft.before, during: draft.during };
  const mode = $('[name="blocks-mode"]:checked').value;
  if (Object.values(presets).some((l) => !l.some((b) => b.show)) && !confirm("欄が全部オフのプリセットがあります。そのときトップページは上の絵だけになります。よろしいですか？")) return;
  if (await write("トップページの並び（開催前・期間中）を公開しました", () => fs.setDoc(fs.doc(db, "site_config", "current"), { presets, mode, ...stamp() }))) {
    blocksDirty = false;
    draft = null;
    $("#blocks-state").textContent = "公開しました";
  }
});

const ADMIN_PW = { salt: "7c38294656e6170c05a3fea3fa66d5c6", iterations: 310000, hash: "a39c719c9ef8c1d38484993ae43f617e14da38a3374ae3f3a454a13ab12d3842" };
async function pwHash(pw) {
  const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hex(ADMIN_PW.salt), iterations: ADMIN_PW.iterations }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function askPassword(title, lead) {
  const dlg = $("#pw-dialog"), input = $("#pw-input"), msg = $("#pw-msg");
  $("#pw-title").textContent = title;
  $("#pw-lead").textContent = lead;
  input.value = "";
  msg.textContent = "";
  dlg.showModal();
  input.focus();
  return new Promise((resolve) => {
    const done = (ok) => { cleanup(); if (dlg.open) dlg.close(); resolve(ok); };
    const onSubmit = async (e) => {
      e.preventDefault();
      if (!crypto?.subtle) { msg.textContent = "https で開いてください"; return; }
      $("#pw-ok").disabled = true;
      msg.textContent = "たしかめています…";
      const ok = (await pwHash(input.value)) === ADMIN_PW.hash;
      $("#pw-ok").disabled = false;
      if (ok) done(true); else { msg.textContent = "パスワードがちがいます"; input.select(); }
    };
    const onCancel = () => done(false);
    const onClose = () => done(false);
    function cleanup() {
      $("#pw-form").removeEventListener("submit", onSubmit);
      $("#pw-cancel").removeEventListener("click", onCancel);
      dlg.removeEventListener("cancel", onClose);
    }
    $("#pw-form").addEventListener("submit", onSubmit);
    $("#pw-cancel").addEventListener("click", onCancel);
    dlg.addEventListener("cancel", onClose);
  });
}

const rallyShopName = (id) => (state.rally?.shops ?? RALLY.shops).find((s) => s.id === id)?.name ?? id;
async function showRallyAll() {
  const box = $("#rally-all-box");
  box.hidden = false;
  box.innerHTML = '<p class="muted">読みこんでいます…</p>';
  try {
    const snap = await fs.getDocs(fs.collection(db, "rally_logs"));
    const goal = RALLY.goal;
    const logs = [];
    snap.forEach((d) => { const v = d.data(); logs.push({ stamps: v.stamps ?? {}, claimed: v.claimed_at ?? null, at: toMs(v.updated_at) }); });
    const people = logs.filter((l) => Object.keys(l.stamps).length > 0);
    const done = people.filter((l) => Object.keys(l.stamps).length >= goal);
    const claimed = logs.filter((l) => l.claimed);
    const dist = Array.from({ length: goal }, (_, i) => people.filter((l) => Math.min(goal, Object.keys(l.stamps).length) === i + 1).length);
    const perShop = {};
    people.forEach((l) => Object.keys(l.stamps).forEach((id) => { perShop[id] = (perShop[id] ?? 0) + 1; }));
    const last = Math.max(0, ...logs.map((l) => l.at ?? 0));
    const resetAt = toMs(state.rallyControl?.reset_at);
    box.innerHTML = `
      <div class="kpis rally-kpis">
        <div class="kpi"><small>参加した人</small><b>${people.length}</b><span>人（1つ以上押した）</span></div>
        <div class="kpi"><small>達成（${goal}個）</small><b>${done.length}</b><span>人</span></div>
        <div class="kpi"><small>引き換えた</small><b>${claimed.length}</b><span>人</span></div>
      </div>
      <h3 class="rally-h">押した数ごとの人数</h3>
      <table class="rally-table"><tbody>${dist.map((n, i) => `<tr><th>${i + 1}個${i + 1 === goal ? "（達成）" : ""}</th><td><i class="bar" style="--p:${people.length ? n / people.length : 0}"></i></td><td class="num">${n}人</td></tr>`).join("")}</tbody></table>
      <h3 class="rally-h">お店・場所ごとのスタンプの数</h3>
      ${Object.keys(perShop).length ? `<table class="rally-table"><tbody>${Object.entries(perShop).sort((x, y) => y[1] - x[1]).map(([id, n]) => `<tr><th>${esc(rallyShopName(id))}</th><td><i class="bar" style="--p:${n / people.length}"></i></td><td class="num">${n}回</td></tr>`).join("")}</tbody></table>` : '<p class="muted">まだだれも押していません</p>'}
      <p class="muted rally-foot">${last ? `いちばん新しい記録：${time(last)}` : ""}${resetAt ? `　最後のリセット：${time(resetAt)}` : ""}　（${time(Date.now())} に読みこみ）</p>`;
  } catch (err) {
    console.warn(err);
    box.innerHTML = `<p class="muted">読めませんでした（${esc(err.code ?? err.message)}）</p>`;
  }
}
$("#rally-all-show").addEventListener("click", async () => {
  if (!(await askPassword("全員の状況を見る", "スタンプラリーの全員の状況を見るには、パスワードを入れてください。"))) return;
  showRallyAll();
});

$("#rally-all-reset").addEventListener("click", async () => {
  if (!(await askPassword("全員の履歴をリセット", "全員のスタンプと引き換えの記録を消します。元に戻せません。パスワードを入れてください。"))) return;
  if (!confirm("本当に、全員のスタンプラリーの履歴をリセットしますか？\n来場者のスマホに入っているスタンプも、次に開いたときに消えます。元に戻せません。")) return;
  const ok = await write("全員のスタンプラリーの履歴をリセットしました", async () => {
    await fs.setDoc(fs.doc(db, "rally_control", "current"), { reset_at: fs.serverTimestamp(), ...stamp() });
    const snap = await fs.getDocs(fs.collection(db, "rally_logs"));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = fs.writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  });
  if (ok && !$("#rally-all-box").hidden) showRallyAll();
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-msg").textContent = "";
  try {
    await auth.signInWithEmailAndPassword(a, $("#email").value, $("#password").value);
  } catch {
    $("#login-msg").textContent = "ログインできませんでした。メールアドレスとパスワードを確認してください。";
  }
});
const logout = () => auth.signOut(a);
$("#logout").addEventListener("click", logout);
$("#logout-top").addEventListener("click", logout);

auth.onAuthStateChanged(a, async (user) => {
  unsubs.splice(0).forEach((u) => u());
  const staffUser = user && !user.isAnonymous ? user : null;
  if (staffUser) {
    try {
      const me = await fs.getDoc(fs.doc(db, "staff", staffUser.email));
      if (!me.exists()) throw new Error("not staff");
    } catch {
      $("#login-msg").textContent = `${staffUser.email} は本部の名簿にありません。Firebase コンソールの Firestore の staff に、このメールアドレスを名前にしたドキュメントを足してください。`;
      await auth.signOut(a);
      return;
    }
  }
  $("#gate").hidden = !!staffUser;
  $("#shell").hidden = !staffUser;
  if (!staffUser) return;
  $("#who").textContent = staffUser.email;
  broadcastFilled = false;
  chatterFilled = false;
  route();
  renderOverview();
  startListening();
  if (location.hash === "#stats") openStats();
});

$(".brand small").textContent = `第${FESTIVAL.edition}回 函館高専祭「${FESTIVAL.theme}」`;
