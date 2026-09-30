// 本部コンソール（staff/index.html）
// お知らせ・緊急のお知らせ・生配信・表示の切りかえ・混雑・5人の実況・投稿（写真の確認・報告・本部の投稿）・模擬店・文章と書体を、ここ1つで変える。
// だれが使えるかは firestore.rules（staff コレクションにメールアドレスがある人だけ）で決まる。
import { FIREBASE_VERSION, firebaseConfig, connectEmulators } from "../assets/live.js";
import { CROWD, VENUES, FESTIVAL } from "../assets/config.js";
import { FIELDS, FONTS, DEFAULTS, fontChoice } from "../assets/site-text.js";
import { REPORT_HIDE, handleOf } from "../assets/posts.js";
import { TIMES, SKIES, WEATHERS, PANELS, PAGES } from "../assets/test.js";

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

// ---------- 小窓 ----------
let toastTimer = null;
function toast(text, error = false) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.toggle("is-error", error);
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
}
// Firestore に書く。失敗したら理由を出す
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

// ---------- 画面の切りかえ（#overview など） ----------
const VIEWS = ["overview", "broadcast", "crowd", "posts", "shops", "preview", "texts"];
function route() {
  const name = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  for (const v of VIEWS) $(`#view-${v}`).hidden = v !== name;
  $$("[data-nav]").forEach((l) => (l.dataset.nav === name ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current")));
  const view = $(`#view-${name}`);
  $("#page-title").textContent = view.dataset.title;
  $("#page-eyebrow").textContent = view.dataset.eyebrow;
  document.title = `${view.dataset.title}｜本部コンソール`;
  scrollTo({ top: 0 });
  if (name === "preview") startPreview();
}
addEventListener("hashchange", route);

// 時計（日本時間）
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }); }, 1000);

// ---------- データ ----------
const state = { live: {}, crowd: {}, chatter: {}, posts: [], shops: [], codes: [], siteText: null };
const unsubs = [];
function listen(q, fn) {
  unsubs.push(fs.onSnapshot(q, fn, (err) => console.warn("[staff] 読めませんでした:", err.code)));
}
function startListening() {
  listen(fs.doc(db, "site_live", "current"), (snap) => { state.live = snap.data() ?? {}; renderBroadcast(); renderLiveEffects(); renderOverview(); });
  listen(fs.collection(db, "crowd"), (snap) => {
    state.crowd = {};
    snap.forEach((d) => { const v = d.data(); state.crowd[d.id] = { level: v.level, updated_at: toMs(v.updated_at) }; });
    renderCrowd(); renderOverview();
  });
  listen(fs.doc(db, "chatter", "current"), (snap) => { state.chatter = snap.data() ?? {}; renderChatter(); renderOverview(); });
  listen(fs.query(fs.collection(db, "posts"), fs.orderBy("created_at", "desc"), fs.limit(300)), (snap) => {
    state.posts = [];
    snap.forEach((d) => {
      const v = d.data();
      state.posts.push({ id: d.id, ...v, reports: Number(v.reports ?? 0), created_at: toMs(v.created_at),
        photo_status: v.has_photo ? (v.photo_status ?? "pending") : "none" });
    });
    renderPosts(); renderOverview();
  });
  listen(fs.collection(db, "shops"), (snap) => {
    state.shops = [];
    snap.forEach((d) => state.shops.push({ id: d.id, ...d.data() }));
    state.shops.sort((x, y) => String(x.name).localeCompare(String(y.name), "ja"));
    renderShops(); renderOverview();
  });
  listen(fs.collection(db, "shop_codes"), (snap) => {
    state.codes = [];
    snap.forEach((d) => state.codes.push({ code: d.id, ...d.data() }));
    renderShops();
  });
  listen(fs.doc(db, "site_text", "current"), (snap) => { state.siteText = snap.data() ?? null; renderTexts(); renderOverview(); });
}

// ---------- ダッシュボード ----------
function renderOverview() {
  const pending = state.posts.filter((p) => p.photo_status === "pending" && !p.hidden).length;
  const reported = state.posts.filter((p) => p.reports > 0 && !p.hidden).length;
  const soldout = state.shops.filter((s) => s.status === "soldout").length;
  const limited = CROWD.venues.filter((v) => state.crowd[v]?.level === 3).length;
  const kpi = (label, value, sub, color, href) => `<a class="kpi" href="${href}" style="--k:${color}"><small>${label}</small><b>${value}</b><span>${sub}</span></a>`;
  $("#kpis").innerHTML = [
    kpi("写真の確認待ち", pending, pending ? "確認してください" : "ありません", pending ? "var(--sun)" : "var(--teal)", "#posts"),
    kpi("報告された投稿", reported, `${REPORT_HIDE}件で自動で隠れる`, reported ? "var(--rose)" : "var(--teal)", "#posts"),
    kpi("入場制限中の会場", limited, `${CROWD.venues.length}会場のうち`, limited ? "var(--rose)" : "var(--teal)", "#crowd"),
    kpi("完売の模擬店", soldout, `${state.shops.length}店のうち`, "var(--amber)", "#shops"),
  ].join("");
  const badge = $("#nav-posts-badge");
  badge.hidden = !pending;
  badge.textContent = pending;
  $("#quick-photos").textContent = pending ? `確認待ち ${pending} 枚` : "確認待ちはありません";

  const l = state.live;
  const notice = l.notice ? `<span class="pill ${l.notice_level === "urgent" ? "is-urgent" : "is-on"}">${l.notice_level === "urgent" ? "緊急" : "表示中"}</span> ${esc(l.notice)}` : '<span class="muted">なし</span>';
  const stream = l.stream_url ? `<span class="pill ${l.stream_active ? "is-live" : ""}">${l.stream_active ? "配信中" : "待機"}</span> ${esc(l.stream_title || l.stream_url)}` : '<span class="muted">URL なし</span>';
  const phase = { before: "開催前（手動）", during: "開催中（手動）", after: "終了後（手動）" }[l.phase_override] ?? "自動（時刻で）";
  const chat = ["p1", "p2", "p3", "p4", "p5"].filter((k) => state.chatter[k]).length;
  const fonts = Object.entries(state.siteText?.fonts ?? {}).map(([role, id]) => fontChoice(role, id).name);
  const texts = Object.keys(state.siteText?.texts ?? {}).length;
  const row = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  $("#status-list").innerHTML = [
    row("お知らせ", notice),
    row("生配信", stream),
    row("表示", esc(phase)),
    row("空・天気", l.sky_override || l.weather_override
      ? `<span class="pill is-on">固定中</span> ${esc([SKIES.find(([, v]) => v === l.sky_override)?.[0], WEATHERS.find(([, v]) => v === l.weather_override)?.[0]].filter(Boolean).join("・"))}`
      : '<span class="muted">いつもどおり</span>'),
    row("5人の実況", chat ? `${chat}人がしゃべっている` : '<span class="muted">いつものセリフ</span>'),
    row("文章と書体", texts || fonts.length ? `文 ${texts}か所・字 ${fonts.length ? esc(fonts.join("／")) : "いつもの"}` : '<span class="muted">いつものまま</span>'),
  ].join("");
}

// ---------- お知らせ・配信 ----------
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
let broadcastFilled = false;
function renderBroadcast() {
  const l = state.live;
  const ns = $("#notice-state");
  ns.className = `pill ${l.notice ? (l.notice_level === "urgent" ? "is-urgent" : "is-on") : ""}`;
  ns.textContent = l.notice ? (l.notice_level === "urgent" ? "緊急を表示中" : "表示中") : "なし";
  const ss = $("#stream-state");
  ss.className = `pill ${l.stream_active && l.stream_url ? "is-live" : ""}`;
  ss.textContent = l.stream_active && l.stream_url ? "配信中" : "止まっている";
  // 入力欄は、最初に1回だけ今の値で埋める（書いている途中で消えないように）
  if (!broadcastFilled) {
    broadcastFilled = true;
    $("#notice-text").value = l.notice ?? "";
    $(`[name="notice-level"][value="${l.notice_level === "urgent" ? "urgent" : "info"}"]`).checked = true;
    $("#stream-url").value = l.stream_url ?? "";
    $("#stream-title").value = l.stream_title ?? "";
    $("#stream-active").checked = !!l.stream_active;
    $(`[name="phase"][value="${l.phase_override ?? ""}"]`).checked = true;
    $("#presence-off").checked = !!l.presence_off;
    previewNotice();
    previewStream();
  }
}
function previewNotice() {
  const text = $("#notice-text").value.trim();
  const p = $("#notice-preview");
  p.hidden = !text;
  p.textContent = text;
  p.classList.toggle("is-urgent", $('[name="notice-level"]:checked').value === "urgent");
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
$$('[name="notice-level"]').forEach((r) => r.addEventListener("change", previewNotice));
$("#stream-url").addEventListener("input", previewStream);

const saveLive = (label, fields) => write(label, () => fs.setDoc(fs.doc(db, "site_live", "current"), { ...fields, ...stamp() }, { merge: true }));
$("#notice-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#notice-text").value.trim();
  const level = $('[name="notice-level"]:checked').value;
  if (!text) return toast("文を入れてください", true);
  if (level === "urgent" && !confirm("緊急のお知らせとして、全員の画面に赤い帯で出します。よろしいですか？")) return;
  saveLive(level === "urgent" ? "緊急のお知らせを出しました" : "お知らせを出しました", { notice: text, notice_level: level });
});
$("#notice-clear").addEventListener("click", () => {
  $("#notice-text").value = "";
  previewNotice();
  saveLive("お知らせを消しました", { notice: "", notice_level: "info" });
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
  saveLive("表示を保存しました", { phase_override: phase || null, presence_off: $("#presence-off").checked });
});

// ---------- 混雑・実況 ----------
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
      </article>`;
  }).join("");
}
$("#venues").addEventListener("click", (e) => {
  const b = e.target.closest("[data-venue]");
  if (!b) return;
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

// ---------- 投稿 ----------
let postFilter = "pending";
const photos = new Map();
const isOff = (p) => p.hidden || p.reports >= REPORT_HIDE;
function renderPosts() {
  const lists = {
    pending: state.posts.filter((p) => p.photo_status === "pending" && !p.hidden),
    reported: state.posts.filter((p) => p.reports > 0 && !p.hidden),
    hidden: state.posts.filter(isOff),
    all: state.posts,
  };
  $("#count-pending").textContent = lists.pending.length;
  $("#count-reported").textContent = lists.reported.length;
  $("#count-hidden").textContent = lists.hidden.length;
  const list = lists[postFilter];
  const photoFlag = { pending: '<span class="tag tag-warn flag">確認待ち</span>', approved: '<span class="tag tag-ok flag">公開中</span>', rejected: '<span class="tag tag-danger flag">出さない</span>' };
  $("#post-list").innerHTML = list.length ? list.map((p) => {
    const who = p.official ? '<span class="tag tag-brand">公式</span>' : `<b>${esc(handleOf(p.uid))}</b>`;
    const kind = p.reply_to ? "返信" : p.kind === "review" ? `${"★".repeat(p.stars ?? 0)} ${esc(p.shop ?? "")}` : "ポスト";
    const photo = p.has_photo ? `<div class="post-photo"><img data-photo="${esc(p.id)}" alt="投稿の写真"${photos.get(p.id) ? ` src="${photos.get(p.id)}"` : ""}>${photoFlag[p.photo_status] ?? ""}</div>` : "";
    const photoBtns = p.has_photo
      ? (p.photo_status !== "approved" ? `<button class="btn btn-ok btn-sm" data-act="approve" data-id="${esc(p.id)}">写真を公開</button>` : "")
        + (p.photo_status !== "rejected" ? `<button class="btn btn-ghost btn-sm" data-act="reject" data-id="${esc(p.id)}">写真を出さない</button>` : "")
      : "";
    return `
      <article class="post${isOff(p) ? " is-off" : ""}">
        ${photo}
        <div class="post-body">
          <p class="post-meta">${who}<span>${kind}</span><span>📍${esc(venueName(p.place) || "場所なし")}</span><span>${time(p.created_at)}</span>
            ${p.likes ? `<span>♥ ${Number(p.likes)}</span>` : ""}${p.reports ? `<span class="tag tag-warn">報告 ${p.reports}</span>` : ""}${isOff(p) ? '<span class="tag tag-danger">非表示</span>' : ""}</p>
          ${p.text ? `<p class="post-text">${esc(p.text)}</p>` : ""}
        </div>
        <div class="post-actions">
          ${photoBtns}
          <button class="btn btn-ghost btn-sm" data-act="${isOff(p) ? "show" : "hide"}" data-id="${esc(p.id)}">${isOff(p) ? "表示にもどす" : "非表示"}</button>
          <button class="btn btn-danger btn-sm" data-act="delete" data-id="${esc(p.id)}">削除</button>
        </div>
      </article>`;
  }).join("") : `<p class="empty">${{ pending: "確認待ちの写真はありません", reported: "報告された投稿はありません", hidden: "非表示の投稿はありません", all: "投稿はまだありません" }[postFilter]}</p>`;
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
  const ref = fs.doc(db, "posts", b.dataset.id);
  const post = state.posts.find((p) => p.id === b.dataset.id);
  const acts = {
    approve: () => write("写真を公開しました", () => fs.updateDoc(ref, { photo_status: "approved" })),
    reject: () => write("写真を出さないことにしました", () => fs.updateDoc(ref, { photo_status: "rejected" })),
    hide: () => write("非表示にしました", () => fs.updateDoc(ref, { hidden: true })),
    // 表示にもどすときは、報告の数も0にもどす（自動で隠れないように）
    show: () => write("表示にもどしました", () => fs.updateDoc(ref, { hidden: false, reports: 0 })),
    delete: () => {
      if (!confirm("この投稿を削除しますか？（もとにもどせません）")) return;
      const batch = fs.writeBatch(db);
      batch.delete(ref);
      if (post?.has_photo) batch.delete(fs.doc(db, "post_photos", b.dataset.id));
      write("削除しました", () => batch.commit());
    },
  };
  acts[b.dataset.act]?.();
});
$("#official-text").addEventListener("input", (e) => { $("#official-count").textContent = `${e.target.value.length} / 400`; });
$("#official-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#official-text").value.trim();
  if (!text) return toast("文を入れてください", true);
  const ok = await write("本部として投稿しました", () => fs.addDoc(fs.collection(db, "posts"), {
    kind: "post", place: "", shop: null, stars: null, text, has_photo: false, photo_status: "none", uid: a.currentUser.uid,
    created_at: fs.serverTimestamp(), reports: 0, hidden: false, reply_to: null, official: true,
  }));
  if (ok) { $("#official-text").value = ""; $("#official-count").textContent = "0 / 400"; }
});

// ---------- 模擬店 ----------
const SHOP_STATUS = [
  ["normal", "すぐ買える", "#45D483"], ["10min", "10分待ち", "#F5C451"], ["20min", "20分以上", "#F2A96A"], ["soldout", "完売", "#FF6B7A"],
];
const shopUrl = (code, shop) => new URL(`../shop.html?shop=${encodeURIComponent(shop)}&code=${encodeURIComponent(code)}`, location.href).href;
const openCodes = new Set();
function renderShops() {
  $("#shop-list").innerHTML = state.shops.length ? state.shops.map((s) => {
    const codes = state.codes.filter((c) => c.shop === s.id);
    return `
      <article class="shop">
        <div><h3>${esc(s.name)}</h3><small>${esc(s.id)}${s.updated_at ? `・${hhmm(toMs(s.updated_at))} 更新` : ""}${"pass" in s ? "・古いパスワードあり（次に変えたとき消えます）" : ""}</small></div>
        <div class="shop-status">${SHOP_STATUS.map(([v, label, c]) => `<button type="button" data-shop="${esc(s.id)}" data-status="${v}" style="--c:${c}" aria-pressed="${s.status === v}">${label}</button>`).join("")}</div>
        <div class="shop-codes">
          ${codes.map((c) => `<span class="code-chip">${esc(c.code)}<button class="btn btn-ghost btn-sm" data-qr="${esc(c.code)}">${openCodes.has(c.code) ? "QR を閉じる" : "QR"}</button><button class="btn btn-danger btn-sm" data-revoke="${esc(c.code)}">取り消す</button></span>
            ${openCodes.has(c.code) ? `<div class="qr-box" data-qr-box="${esc(c.code)}" data-qr-shop="${esc(s.id)}"><div class="qr"></div><small>${esc(shopUrl(c.code, s.id))}</small></div>` : ""}`).join("")}
          <button class="btn btn-ghost btn-sm" data-issue="${esc(s.id)}">＋ お店の人にコードを渡す</button>
          <button class="btn btn-danger btn-sm" data-remove="${esc(s.id)}" style="margin-left:auto">お店を消す</button>
        </div>
      </article>`;
  }).join("") : '<p class="empty">お店はまだありません。上で足してください。</p>';
  $$("[data-qr-box]").forEach((box) => {
    const el = $(".qr", box);
    if (window.QRCode) new window.QRCode(el, { text: shopUrl(box.dataset.qrBox, box.dataset.qrShop), width: 180, height: 180 });
    else el.textContent = "QR を作れませんでした（下の URL を送ってください）";
  });
}
function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // まぎらわしい 0 O 1 I は使わない
  return [...crypto.getRandomValues(new Uint8Array(16))].map((n) => alphabet[n % alphabet.length]).join("");
}
$("#shop-list").addEventListener("click", async (e) => {
  const st = e.target.closest("[data-status]");
  const issue = e.target.closest("[data-issue]");
  const qr = e.target.closest("[data-qr]");
  const revoke = e.target.closest("[data-revoke]");
  const remove = e.target.closest("[data-remove]");
  if (st) {
    const shop = state.shops.find((s) => s.id === st.dataset.shop);
    const label = SHOP_STATUS.find(([v]) => v === st.dataset.status)[1];
    write(`${shop.name}を「${label}」にしました`, () => fs.updateDoc(fs.doc(db, "shops", shop.id), {
      status: st.dataset.status, updated_at: fs.serverTimestamp(), ...("pass" in shop ? { pass: fs.deleteField() } : {}),
    }));
  }
  if (issue) {
    const code = newCode();
    if (await write("コードを作りました", () => fs.setDoc(fs.doc(db, "shop_codes", code), { shop: issue.dataset.issue, created_at: fs.serverTimestamp() }))) {
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
    const shop = state.shops.find((s) => s.id === remove.dataset.remove);
    if (!confirm(`「${shop.name}」を消しますか？（サイトの一覧からも消えます）`)) return;
    write("お店を消しました", async () => {
      const batch = fs.writeBatch(db);
      state.codes.filter((c) => c.shop === shop.id).forEach((c) => batch.delete(fs.doc(db, "shop_codes", c.code)));
      batch.delete(fs.doc(db, "shops", shop.id));
      await batch.commit();
    });
  }
});
$("#shop-add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#shop-id").value.trim();
  const name = $("#shop-name").value.trim();
  if (state.shops.some((s) => s.id === id)) return toast("その ID はもう使われています", true);
  if (await write(`${name}を足しました`, () => fs.setDoc(fs.doc(db, "shops", id), { name, status: "normal", updated_at: fs.serverTimestamp() }))) {
    e.target.reset();
  }
});

// ---------- プレビュー・演出 ----------
// テスト用パネル（?test=1）と同じことを、本部コンソールの中の iframe で試す。
// 「全員の画面に出す」だけは本番の Firestore（site_live/current）に書き、来場者の画面が変わる
const optionHtml = (list, cur = "") => list.map(([label, value]) => `<option value="${esc(value)}"${value === cur ? " selected" : ""}>${esc(label)}</option>`).join("");
const DEVICES = { sp: { w: 390, h: 844 }, pc: { w: 1440, h: 900 } };
$("#pv-page").innerHTML = optionHtml([["トップページ", ""], ...PAGES.filter(([, v]) => v !== "staff/")]);
$("#pv-time").innerHTML = optionHtml(TIMES) + '<option value="__custom">好きな日時（下で選ぶ）</option>';
$("#pv-sky").innerHTML = optionHtml(SKIES);
$("#pv-weather").innerHTML = optionHtml(WEATHERS);
$("#pv-goto").innerHTML = optionHtml(PANELS);
$("#live-sky").innerHTML = optionHtml([["いつもどおり（時刻で）", ""], ...SKIES.slice(1)]);
$("#live-weather").innerHTML = optionHtml([["いつもどおり（本物の天気）", ""], ...WEATHERS.slice(1)]);
const ROLE_LABEL_SHORT = { display: "見出し・数字", text: "文", body: "ふつう" };
$("#pv-fonts").innerHTML = Object.entries(FONTS).map(([role, list]) => `
  <label class="field"><span>${ROLE_LABEL_SHORT[role]}</span><select data-pv-font="${role}">${list.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select></label>`).join("");

let pvNow = "";
let pvReady = false;
let pvStarted = false;
function previewUrl() {
  const u = new URL(`../${$("#pv-page").value}`, location.href);
  const set = (k, v) => { if (v) u.searchParams.set(k, v); };
  set("preview", "1");
  set("now", pvNow);
  set("sky", $("#pv-sky").value);
  set("weather", $("#pv-weather").value);
  if ($("#pv-weather").value) set("wind", $("#pv-wind").value);
  if ($("#pv-demo").checked) set("demo", "1");
  if ($("#pv-demo").checked && $("#pv-urgent").checked) set("urgent", "1");
  if (new URLSearchParams(location.search).has("emulator")) set("emulator", "1");
  return u.href;
}
function fitPreview() {
  const device = DEVICES[$('[name="pv-device"]:checked').value];
  const frame = $("#pv-frame");
  const iframe = $("#pv-iframe");
  frame.classList.toggle("is-sp", device === DEVICES.sp);
  const room = frame.parentElement.clientWidth - (device === DEVICES.sp ? 16 : 2);
  const maxH = Math.max(420, innerHeight - 140);
  const scale = Math.min(1, room / device.w, device === DEVICES.sp ? maxH / device.h : 1);
  iframe.style.width = `${device.w}px`;
  iframe.style.height = `${device.h}px`;
  iframe.style.transform = `scale(${scale})`;
  frame.style.width = `${device.w * scale + (device === DEVICES.sp ? 16 : 2)}px`;
  frame.style.height = `${device.h * scale + (device === DEVICES.sp ? 16 : 2)}px`;
}
function loadPreview() {
  const url = previewUrl();
  pvReady = false;
  updateBridgeState();
  $("#pv-url").textContent = url.replace(location.origin, "");
  $("#pv-open").href = url.replace("preview=1&", "test=1&").replace("?preview=1", "?test=1");
  $("#pv-iframe").src = url;
  fitPreview();
}
function startPreview() {
  if (pvStarted) { fitPreview(); return; }
  pvStarted = true;
  loadPreview();
}
function updateBridgeState() {
  $$("[data-pv], #pv-goto-btn").forEach((b) => { b.disabled = !pvReady; });
  $("#pv-bridge").textContent = pvReady ? "トップページで動かせます" : "トップページを開くと使えます";
}
function send(kind, value) {
  $("#pv-iframe").contentWindow?.postMessage({ kosenPreview: kind, value }, location.origin);
}
addEventListener("message", (e) => {
  if (e.origin !== location.origin || e.source !== $("#pv-iframe").contentWindow || !e.data?.kosenPreviewReady) return;
  pvReady = true;
  updateBridgeState();
  send("fonts", Object.fromEntries($$("[data-pv-font]").map((x) => [x.dataset.pvFont, x.value])));
});
addEventListener("resize", () => { if (pvStarted) fitPreview(); });
["#pv-page", "#pv-sky", "#pv-weather", "#pv-demo", "#pv-urgent"].forEach((id) => $(id).addEventListener("change", loadPreview));
$$('[name="pv-device"]').forEach((r) => r.addEventListener("change", loadPreview));
$("#pv-wind").addEventListener("input", (e) => { $("#pv-wind-v").textContent = e.target.value; });
$("#pv-wind").addEventListener("change", loadPreview);
$("#pv-time").addEventListener("change", (e) => {
  if (e.target.value === "__custom") return $("#pv-dt").focus();
  pvNow = e.target.value;
  $("#pv-dt").value = pvNow.slice(0, 16);
  loadPreview();
});
$("#pv-dt").addEventListener("change", (e) => {
  pvNow = e.target.value;
  $("#pv-time").value = TIMES.some(([, v]) => v === pvNow) ? pvNow : "__custom";
  loadPreview();
});
$$("[data-shift]").forEach((b) => b.addEventListener("click", () => {
  const base = pvNow ? new Date(`${pvNow}+09:00`) : new Date();
  const t = new Date(base.getTime() + Number(b.dataset.shift) * 60000);
  pvNow = new Date(t.getTime() + 9 * 3600000).toISOString().slice(0, 16); // 日本時間の YYYY-MM-DDTHH:MM
  $("#pv-dt").value = pvNow;
  $("#pv-time").value = TIMES.some(([, v]) => v === pvNow) ? pvNow : "__custom";
  loadPreview();
}));
$("#pv-fonts").addEventListener("change", () => send("fonts", Object.fromEntries($$("[data-pv-font]").map((x) => [x.dataset.pvFont, x.value]))));
$$("[data-pv]").forEach((b) => b.addEventListener("click", () => send(b.dataset.pv)));
$("#pv-goto-btn").addEventListener("click", () => send("goto", $("#pv-goto").value));
$("#pv-reload").addEventListener("click", loadPreview);
$("#pv-demo").addEventListener("change", (e) => { $("#pv-urgent").disabled = !e.target.checked; });
$("#pv-urgent").disabled = true;
updateBridgeState();

// 全員の画面に出す（本番）
$("#live-wind").addEventListener("input", (e) => { $("#live-wind-v").textContent = e.target.value; });
$("#live-fire").addEventListener("click", () => {
  if (!confirm("いまトップページを開いている人全員の画面に、花火を上げます。よろしいですか？")) return;
  saveLive("花火を上げました（1分以内に開いている人に出ます）", { fireworks_at: fs.serverTimestamp() });
});
$("#live-sky-save").addEventListener("click", () => {
  const weather = $("#live-weather").value;
  saveLive("空と天気を全員の画面で固定しました", {
    sky_override: $("#live-sky").value || null,
    weather_override: weather || null,
    wind_override: weather ? Number($("#live-wind").value) : null,
  });
});
$("#live-sky-clear").addEventListener("click", () => {
  $("#live-sky").value = "";
  $("#live-weather").value = "";
  saveLive("空と天気を、いつもどおりに戻しました", { sky_override: null, weather_override: null, wind_override: null });
});
function renderLiveEffects() {
  const l = state.live;
  if (document.activeElement?.closest?.(".card-live")) return; // 触っている途中は書きかえない
  $("#live-sky").value = l.sky_override ?? "";
  $("#live-weather").value = l.weather_override ?? "";
  $("#live-wind").value = l.wind_override ?? 4;
  $("#live-wind-v").textContent = $("#live-wind").value;
}

// ---------- 文章と書体 ----------
const ROLE_LABEL = { display: "見出し・数字の字", text: "文の字（札・説明）", body: "ふつうの字（そのほか）" };
const SAMPLE = { display: "第63回 函館高専祭 10.24 NOW", text: "対象の模擬店で、お店の QR を読むとスタンプが押されます。", body: "ご来場の皆さまへ。校内は全面禁煙です。" };
let textsDirty = false;
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
function loadFontPreview(role, choice) {
  const id = `staff-font-${role}-${choice.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(choice.name).replace(/%20/g, "+")}${choice.axes ? `:${choice.axes}` : ""}&display=swap`;
  document.head.append(link);
}
function valueOf(f) {
  const t = state.siteText?.texts ?? {};
  return f.key in t ? t[f.key] : DEFAULTS[f.key];
}
function fieldHtml(f) {
  const v = valueOf(f);
  const changed = !same(v, DEFAULTS[f.key]) ? " changed" : "";
  if (f.kind === "cards") {
    return `<div class="field${changed}" data-key="${f.key}"><span>${esc(f.label)}</span><div class="cards-edit">${v.map((c, i) => `
      <div class="card-edit"><b>${i + 1}枚目</b>
        <input data-card="${i}" data-part="title" value="${esc(c.title)}" aria-label="${i + 1}枚目の表のひとこと">
        <textarea data-card="${i}" data-part="detail" rows="3" aria-label="${i + 1}枚目の裏の説明">${esc(c.detail)}</textarea></div>`).join("")}</div>
      <small class="muted small">{close}＝公開の終わりの時刻、{voteEnd}＝総選挙の締め切り に自動で置きかわります</small></div>`;
  }
  if (f.kind === "lines") return `<label class="field${changed}" data-key="${f.key}"><span>${esc(f.label)}</span><textarea rows="${Math.max(3, v.length + 1)}">${esc(v.join("\n"))}</textarea></label>`;
  if (f.kind === "number") return `<label class="field${changed}" data-key="${f.key}"><span>${esc(f.label)}</span><input type="number" min="0" value="${esc(v)}"></label>`;
  return `<label class="field${changed}" data-key="${f.key}"><span>${esc(f.label)}</span><input value="${esc(v)}"></label>`;
}
function renderTexts() {
  if (textsDirty) return; // 書いている途中は描き直さない
  const fonts = state.siteText?.fonts ?? {};
  $("#font-grid").innerHTML = Object.entries(FONTS).map(([role, list]) => {
    const cur = fontChoice(role, fonts[role]);
    loadFontPreview(role, cur);
    return `<label class="field"><span>${ROLE_LABEL[role]}</span>
      <select data-font="${role}">${list.map((c) => `<option value="${c.id}"${c.id === cur.id ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
      <div class="font-sample is-${role}" data-sample="${role}" style="font-family:'${esc(cur.name)}', sans-serif">${esc(SAMPLE[role])}</div></label>`;
  }).join("");
  const groups = [...new Set(FIELDS.map((f) => f.group))];
  $("#text-fields").innerHTML = groups.map((g) => `
    <article class="card text-group"><h3>${esc(g)}</h3><div class="stack">${FIELDS.filter((f) => f.group === g).map(fieldHtml).join("")}</div></article>`).join("");
  $("#texts-state").textContent = state.siteText?.updated_at ? `最後の保存：${time(toMs(state.siteText.updated_at))}（${esc(state.siteText.updated_by ?? "")}）` : "いつもの文のまま";
}
function readTexts() {
  const texts = {};
  for (const f of FIELDS) {
    const el = $(`[data-key="${f.key}"]`);
    let v;
    if (f.kind === "cards") {
      v = DEFAULTS.visit.map((d, i) => ({ ...d, title: $(`[data-card="${i}"][data-part="title"]`, el).value.trim(), detail: $(`[data-card="${i}"][data-part="detail"]`, el).value.trim() }));
    } else if (f.kind === "lines") {
      v = $("textarea", el).value.split("\n").map((l) => l.trim()).filter(Boolean);
    } else if (f.kind === "number") {
      v = Number($("input", el).value);
    } else {
      v = $("input", el).value.trim();
    }
    if (!same(v, DEFAULTS[f.key])) texts[f.key] = v; // いつもと同じものは入れない（config.js を直したら、そちらが出る）
  }
  const fonts = {};
  $$("[data-font]").forEach((s) => { if (s.value !== FONTS[s.dataset.font][0].id) fonts[s.dataset.font] = s.value; });
  return { texts, fonts };
}
$("#texts-form").addEventListener("input", (e) => {
  textsDirty = true;
  $("#texts-state").textContent = "保存していない変更があります";
  const field = e.target.closest("[data-key]");
  if (field) {
    const f = FIELDS.find((x) => x.key === field.dataset.key);
    field.classList.toggle("changed", f.key in readTexts().texts);
  }
});
$("#texts-form").addEventListener("change", (e) => {
  const s = e.target.closest("[data-font]");
  if (!s) return;
  const choice = fontChoice(s.dataset.font, s.value);
  loadFontPreview(s.dataset.font, choice);
  $(`[data-sample="${s.dataset.font}"]`).style.fontFamily = `'${choice.name}', sans-serif`;
});
$("#texts-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { texts, fonts } = readTexts();
  if (await write("文章と書体を公開しました", () => fs.setDoc(fs.doc(db, "site_text", "current"), { texts, fonts, ...stamp() }))) {
    textsDirty = false;
  }
});
$("#texts-reset").addEventListener("click", async () => {
  if (!confirm("文章と書体を、すべていつもの（config.js のまま）に戻しますか？")) return;
  if (await write("いつもの文に戻しました", () => fs.setDoc(fs.doc(db, "site_text", "current"), { texts: {}, fonts: {}, ...stamp() }))) {
    textsDirty = false;
  }
});
addEventListener("beforeunload", (e) => { if (textsDirty) e.preventDefault(); });

// ---------- ログイン ----------
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
    // 本部の名簿にのっているか（のっていなければ、ログインできても何も書けない）
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
});

// コンソールのタイトルの下の小さい字
$(".brand small").textContent = `第${FESTIVAL.edition}回 函館高専祭「${FESTIVAL.theme}」`;
