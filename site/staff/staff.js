// 本部コンソール（staff/index.html）
// お知らせ・緊急のお知らせ・生配信・表示の切りかえ・混雑・5人の実況・投稿（写真の確認・報告・本部の投稿）・模擬店・文章と書体を、ここ1つで変える。
// だれが使えるかは firestore.rules（staff コレクションにメールアドレスがある人だけ）で決まる。
import { FIREBASE_VERSION, firebaseConfig, connectEmulators } from "../assets/live.js";
import { CROWD, VENUES, FESTIVAL, RALLY, VISIT, SHOPS, HOMEROOMS, MAP, TOP_BLOCKS, TOP_PRESETS } from "../assets/config.js";
import { FIELDS, FONTS, DEFAULTS, fontChoice } from "../assets/site-text.js";
import { REPORT_HIDE, handleOf, shrink } from "../assets/posts.js";

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
const VIEWS = ["overview", "broadcast", "crowd", "posts", "shops", "vote", "texts", "settings"];
if (location.hash === "#print") history.replaceState(null, "", "#shops"); // 印刷は「模擬店・印刷」にまとめた
function route() {
  const name = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  for (const v of VIEWS) $(`#view-${v}`).hidden = v !== name;
  $$("[data-nav]").forEach((l) => (l.dataset.nav === name ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current")));
  const view = $(`#view-${name}`);
  $("#page-title").textContent = view.dataset.title;
  $("#page-eyebrow").textContent = view.dataset.eyebrow;
  document.title = `${view.dataset.title}｜本部コンソール`;
  scrollTo({ top: 0 });
  if (name === "vote") showVotes();
}
addEventListener("hashchange", route);

// 時計（日本時間）
setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }); }, 1000);

// ---------- データ ----------
const state = { live: {}, crowd: {}, chatter: {}, posts: [], shops: [], codes: [], siteText: null, rally: null, rallyKeys: {}, siteConfig: null, rallyControl: null };
const unsubs = [];
function listen(q, fn) {
  unsubs.push(fs.onSnapshot(q, fn, (err) => console.warn("[staff] 読めませんでした:", err.code)));
}
function startListening() {
  listen(fs.doc(db, "site_live", "current"), (snap) => { state.live = snap.data() ?? {}; renderBroadcast(); renderOverview(); $("#prize-out").checked = !!state.live.prize_out; });
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
  listen(fs.doc(db, "site_text", "current"), (snap) => { state.siteText = snap.data() ?? null; renderTexts(); renderOverview(); });
  listen(fs.doc(db, "site_config", "current"), (snap) => { state.siteConfig = snap.data() ?? null; if (!blocksDirty) { draft = null; renderBlocks(); renderMode(); } }); // 並べかえている途中は描き直さない
  listen(fs.doc(db, "rally_control", "current"), (snap) => { state.rallyControl = snap.data() ?? null; });
}

// ---------- ダッシュボード ----------
function renderOverview() {
  const pending = state.posts.filter((p) => p.photo_status === "pending" && !p.hidden).length;
  const reported = state.posts.filter((p) => p.reports > 0 && !p.hidden).length;
  const soldout = allShops().filter((s) => s.status === "soldout").length;
  const limited = CROWD.venues.filter((v) => state.crowd[v]?.level === 3).length;
  const kpi = (label, value, sub, color, href) => `<a class="kpi" href="${href}" style="--k:${color}"><small>${label}</small><b>${value}</b><span>${sub}</span></a>`;
  $("#kpis").innerHTML = [
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
  const fonts = Object.entries(state.siteText?.fonts ?? {}).map(([role, id]) => fontChoice(role, id).name);
  const texts = Object.keys(state.siteText?.texts ?? {}).length;
  const row = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  $("#status-list").innerHTML = [
    row("お知らせ", notice),
    row("生配信", stream),
    row("表示", esc(phase)),
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
// 画像（任意）：選ぶと、下に小さく見える。「はずす」で取りやめ
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

// ---------- 模擬店 ----------
const SHOP_STATUS = [
  ["normal", "すぐ買える", "#45D483"], ["10min", "10分待ち", "#F5C451"], ["20min", "20分以上", "#F2A96A"], ["soldout", "完売", "#FF6B7A"],
  ["closed", "休業中", "#8B93C9"], // 混みぐあいとは別（休けい中など）
];
const shopUrl = (code, shop) => new URL(`../shop.html?shop=${encodeURIComponent(shop)}&code=${encodeURIComponent(code)}`, location.href).href;
const openCodes = new Set();
// 地図に載っているお店（config.js の SHOPS）はすべて最初から並べる。shops/{id} の文書は、待ち時間を変えたりコードを渡したりしたときに作る。
// map には地図がお店を見分ける値（クラス・部屋番号・名前）を入れる（map.js の shopDocFor が見る）
const shopSlug = (v) => String(v).toLowerCase().replace(/[^a-z0-9_-]/g, "");
const placeName = (id) => MAP.places.find((p) => p.id === id)?.name ?? id;
const CATALOG = SHOPS.map((sh) => {
  const room = sh.room ?? HOMEROOMS[sh.cls] ?? null;
  const where = sh.place ? placeName(sh.place) : [sh.bldg && `${sh.bldg}棟${sh.floor ? sh.floor.replace("F", "階") : ""}`, room].filter(Boolean).join("・");
  return { id: shopSlug(sh.cls ?? sh.room ?? sh.place), kind: "shop", name: sh.name, group: sh.group, map: sh.cls ?? sh.room ?? sh.name,
    ...(room ? { room } : {}), ...(sh.place ? { place: sh.place } : {}), where, catalog: true };
});
// スタンプラリーの場所は、模擬店のほかに、インフォメーション（本部。はじめの1個をここで、使い方を教えながら押してもらう）と学科展示。
// 社会基盤の5つの展示は、それだけで何個も集まらないように1か所にまとめる（QR は C113 に置く想定）
const SPOTS = [{ id: "hq", kind: "info", name: "インフォメーション", group: "本部", place: "hq", where: "玄関ホール" }];
// 会場：太平洋セメントアリーナ（ステージ・大抽選会）と ZACROS hall（企業説明会・企業セミナー）も、スタンプの場所にする
for (const id of ["gym2", "zacros"]) {
  const p = MAP.places.find((x) => x.id === id);
  if (p) SPOTS.push({ id: p.id, kind: "venue", name: p.name, group: p.sub, place: p.id, where: [p.room].flat()[0] ?? "" });
}
for (const p of MAP.places.filter((x) => x.kind === "exhibit")) {
  if (p.dept === "社会基盤") {
    if (!SPOTS.some((x) => x.id === "ex-civ")) SPOTS.push({ id: "ex-civ", kind: "exhibit", name: "社会基盤の展示", group: "社会基盤工学科の学科展示", place: p.id, where: "C111〜C118（5つの展示）" });
    continue;
  }
  const rooms = [p.room ?? []].flat();
  SPOTS.push({ id: p.id, kind: "exhibit", name: p.name, group: p.sub, place: p.id, where: rooms.length > 1 ? `${rooms[0]} ほか` : rooms[0] ?? "" });
}
CATALOG.unshift(...SPOTS.map((x) => ({ ...x, map: x.id, catalog: true })));
const KIND_TAG = { info: '<i class="tag tag-info">インフォ</i>', exhibit: '<i class="tag tag-ex">学科展示</i>', venue: '<i class="tag tag-ex">会場</i>' };
// スタンプの場所すべて（受付・スタンプラリー・印刷）
function allSpots() {
  const docs = new Map(state.shops.map((d) => [d.id, d]));
  const list = CATALOG.map((c) => ({ ...c, ...(docs.get(c.id) ?? {}), name: c.name, map: c.map, exists: docs.has(c.id) }));
  const extra = state.shops.filter((d) => !CATALOG.some((c) => c.id === d.id))
    .map((d) => ({ ...d, kind: "shop", where: d.map ?? "", exists: true }))
    .sort((x, y) => String(x.name).localeCompare(String(y.name), "ja"));
  return [...list, ...extra];
}
const allShops = () => allSpots().filter((s) => s.kind === "shop"); // 模擬店だけ（待ち時間・完売の数）
const findShop = (id) => allSpots().find((s) => s.id === id);
// お店の文書がまだなければ作る（shop.html はこれがないと使えない）
function shopDocWrite(shop, fields) {
  const ref = fs.doc(db, "shops", shop.id);
  if (!shop.exists) return fs.setDoc(ref, { name: shop.name, map: shop.map, ...fields });
  return fs.updateDoc(ref, { ...fields, ...("pass" in shop ? { pass: fs.deleteField() } : {}) });
}
// 受付：探す・絞りこむ（「まだ」「受付済み」「すべて」）。探しているあいだは、すべてのお店から探す
let shopFilter = "todo";
const openMore = new Set(); // 「当日の操作」を開いているお店
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
// 混雑・実況：模擬店ごとの待ち時間（「すぐ買える」「10分」「20分以上」「完売」）
let cshopsHold = false; // ひとことを書いている間は、一覧を作り直さない（書きかけが消えないように）
function renderCrowdShops() {
  if ($("#cshops").contains(document.activeElement) && document.activeElement.matches("input")) { cshopsHold = true; return; }
  cshopsHold = false;
  const shops = allShops();
  const busy = shops.filter((s) => s.status && s.status !== "normal").length;
  $("#cshops-sum").textContent = `　待ちあり・完売 ${busy}店 / ${shops.length}店`;
  const q = kana($("#cshops-q").value);
  const list = q ? shops.filter((s) => shopHay(s).includes(q)) : shops;
  $("#cshops").innerHTML = list.length ? list.map((s) => `
    <div class="cshop">
      <div class="cshop-name"><b>${esc(s.name)}</b><small>${[s.group, s.where, s.updated_at ? `${hhmm(toMs(s.updated_at))} 更新` : "まだ出していない"].filter(Boolean).map(esc).join("・")}</small></div>
      <div class="shop-status">${SHOP_STATUS.map(([v, label, c]) => `<button type="button" data-shop="${esc(s.id)}" data-status="${v}" style="--c:${c}" aria-pressed="${s.status === v}">${label}</button>`).join("")}</div>
      <form class="cshop-msg" data-msg-shop="${esc(s.id)}">
        <input maxlength="40" value="${esc(s.message ?? "")}" placeholder="お店のひとこと（トップの縁日・地図に出る。40字まで）" aria-label="${esc(s.name)}のひとこと">
        <button class="btn btn-ghost btn-sm" type="submit">のせる</button>
      </form>
    </div>`).join("") : '<p class="muted small">見つかりません</p>';
}
$("#cshops-q").addEventListener("input", renderCrowdShops);
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
  const shop = findShop(st.dataset.shop);
  const label = SHOP_STATUS.find(([v]) => v === st.dataset.status)[1];
  write(`${shop.name}を「${label}」にしました`, () => shopDocWrite(shop, { status: st.dataset.status, updated_at: fs.serverTimestamp() }));
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
  $("#pr-target-todo").textContent = `${shops.length - done}か所`;
  $("#pr-target-all").textContent = `${shops.length}か所`;
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
          <div class="shop-status">${SHOP_STATUS.map(([v, label, c]) => `<button type="button" data-shop="${esc(s.id)}" data-status="${v}" style="--c:${c}" aria-pressed="${s.status === v}">${label}</button>`).join("")}</div>
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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // まぎらわしい 0 O 1 I は使わない
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
    const shop = findShop(st.dataset.shop);
    const label = SHOP_STATUS.find(([v]) => v === st.dataset.status)[1];
    write(`${shop.name}を「${label}」にしました`, () => shopDocWrite(shop, { status: st.dataset.status, updated_at: fs.serverTimestamp() }));
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
// ---------- スタンプラリー（QR の鍵とスタッフ番号） ----------
// 鍵そのものは rally_keys/{お店の id}（本部だけ）に、サイトが確かめるための暗号化した値は rally/current（だれでも読める）に置く。
// 暗号化のしかたは tools/make-rally-qr.py と同じ（sha256("kosen63:お店:日付:鍵")、スタッフ番号は PBKDF2-SHA256 30万回）
// QR は2日とも同じもの（鍵の名前は "fest"＝開催日ならどの日でも使える）
const FEST = "fest";
const PIN_ITERATIONS = 300000;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (text) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const randomKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rallyShopIds = () => (state.rally?.shops ?? []).map((s) => s.id);
const isRallyShop = (id) => rallyShopIds().includes(id);
const keysOf = (id) => state.rallyKeys[id]?.keys ?? {};

// スタンプラリーの対象は、模擬店・インフォメーション・学科展示・会場（太平洋セメントアリーナ、ZACROS hall）のすべて。
// 模擬店には vote: true を付ける（スタンプを押した模擬店に、模擬店総選挙で1票入れられる。rally.js）。
// 足りない鍵を作り、rally/current を対象の場所にそろえる（足りなければ何もしない）
const rallySpots = () => allSpots();
function rallyMissing() {
  const cur = new Map((state.rally?.shops ?? []).map((s) => [s.id, s]));
  const spots = rallySpots();
  const extra = [...cur.keys()].filter((id) => !spots.some((s) => s.id === id)); // 対象でなくなった場所
  return [...spots.filter((s) => !cur.has(s.id) || !keysOf(s.id)[FEST] || !!cur.get(s.id).vote !== (s.kind === "shop")), ...extra.map((id) => ({ id }))];
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
      state.rallyKeys[shop.id] = { keys }; // 読みなおしを待たずに、すぐ印刷に使えるように
    }
    const codes = { [FEST]: await sha256(`kosen63:${shop.id}:${FEST}:${keys[FEST]}`) };
    const room = shop.catalog ? shop.room : shop.map;
    shops.push({ id: shop.id, name: shop.name, ...(room ? { room } : {}), ...(shop.place ? { place: shop.place } : {}), ...(shop.kind === "shop" ? { vote: true } : {}), codes });
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
  const pin = !!state.rally?.staffPin;
  const st = $("#rally-state");
  st.className = `pill ${!missing && pin ? "is-on" : ""}`;
  st.textContent = `QR ${total - missing}/${total}・番号${pin ? "あり" : "なし"}`;
  $("#rally-pin-make").textContent = pin ? "引き換えの番号を作り直す" : "引き換えの番号を作る";
  $("#rally-all").disabled = !missing;
  $("#rally-all").textContent = missing ? `${missing}か所の QR を整える` : "全部のお店の QR を用意済み";
}
$("#rally-all").addEventListener("click", () => write("全部の場所のスタンプの QR を用意しました", ensureRally));
// 景品がなくなった：スタンプカードのページにおわびを出す（site_live/current の prize_out）
$("#prize-out").addEventListener("change", (e) => {
  const on = e.target.checked;
  if (!confirm(on ? "「景品はすべてなくなりました」と、スタンプカードのページにおわびを出しますか？" : "景品の受け付けを再開しますか？（おわびを消します）")) { e.target.checked = !on; return; }
  saveLive(on ? "景品の終了を出しました" : "景品の受け付けを再開しました", { prize_out: on });
});
// 何個で達成か（「文章と書体」で変えていればそちら）。印刷する紙もこの数にそろえる
const rallyGoal = () => { const v = Math.round(Number(state.siteText?.texts?.rally_goal)); return v >= 1 ? v : RALLY.goal; };
$("#rally-pin-make").addEventListener("click", async () => {
  if (state.rally?.staffPin && !confirm("番号を作り直すと、前の番号では引き換えられなくなります。よろしいですか？")) return;
  const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, "0");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const hash = hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PIN_ITERATIONS }, key, 256));
  const ok = await write("引き換えの番号を作りました", async () => {
    const batch = fs.writeBatch(db);
    batch.set(fs.doc(db, "rally_keys", "_pin"), { pin, at: fs.serverTimestamp() });
    batch.set(fs.doc(db, "rally", "current"), { shops: state.rally?.shops ?? [], staffPin: { salt: hex(salt), iterations: PIN_ITERATIONS, hash }, ...stamp() });
    await batch.commit();
  });
  if (ok) showPin(pin);
});
function showPin(pin) {
  const v = $("#rally-pin-view");
  v.hidden = false;
  v.innerHTML = `引き換えの番号：<b>${esc(pin)}</b><small>本部のスタッフだけに伝える</small>`;
}
$("#rally-pin-show").addEventListener("click", () => {
  const pin = state.rallyKeys._pin?.pin;
  if (!pin) return toast("まだ番号がありません。「引き換えの番号を作る」を押してください", true);
  showPin(pin);
});

// ---------- 印刷（QR・チラシ） ----------
const siteUrl = (path = "") => new URL(`../${path}`, location.href).href;
function qrDataUrl(text, size = 480) {
  if (!window.QRCode) throw new Error("QR を作る部品を読みこめませんでした");
  const box = document.createElement("div");
  new window.QRCode(box, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
  return box.querySelector("canvas").toDataURL("image/png");
}
// スタンプの QR：まん中に「縁」のはんこ。はんこで隠れても読めるように、誤り訂正を一番強く（H：3割まで欠けても読める）する。
// はんこは幅の3割弱（面積では1割未満）にとどめる
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
  $("#pr-target-box").hidden = kind === "flyer";
  $("#pr-staff-box").hidden = kind !== "shopset";
  $("#pr-size-box").hidden = kind !== "flyer";
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
  if (shop && !shop.exists) await shopDocWrite(shop, {}); // 待ち時間の更新時刻（updated_at）は、ここでは付けない
  const code = newCode();
  await fs.setDoc(fs.doc(db, "shop_codes", code), { shop: shopId, created_at: fs.serverTimestamp() });
  return code;
}

// 店頭の紙（三角POP か 貼り紙）と、模擬店ならお店の人用の紙
async function buildShopSet(shops, withStaff, format = printFormat()) {
  const pages = [];
  for (const s of shops) {
    pages.push(format === "wall" ? buildWall(s) : buildTents([s]));
    if (withStaff && s.kind === "shop") {
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
  }
  return pages.join("");
}
// 三角POP（A4 を3つに折って、下ののりしろで貼り、縦に立てる卓上の札）。3面ともまわりから見えるように、中身は90度まわして縦長に置く
// 1段目＝お店の名前、2段目＝スタンプラリーのおさそい、3段目＝名前（小さく）とサイトの QR（小さく、下に）
// 縦書きの中の「QR」や数字は、横に寝かせずに1文字ぶんに立てる（縦中横）
const tcy = (t) => esc(t).replace(/QR|\d{1,2}/g, (m) => `<span class="tcy">${m}</span>`);
// 縦書きの数は漢数字で（3 → 三、12 → 十二）
const kanjiNum = (n) => {
  const d = "〇一二三四五六七八九";
  if (n < 10) return d[n];
  const tens = Math.floor(n / 10), ones = n % 10;
  return `${tens > 1 ? d[tens] : ""}十${ones ? d[ones] : ""}`;
};
// スタンプラリーのおさそい（三角POPの3段目と、模擬店セットのきりとり）。文は縦書き、下に QR
function rallyBody(s) {
  const rally = isRallyShop(s.id) && keysOf(s.id)[FEST];
  const qr = rally
    ? stampQrDataUrl(siteUrl(`rally.html?s=${encodeURIComponent(s.id)}&c=${encodeURIComponent(keysOf(s.id)[FEST])}`))
    : qrDataUrl(siteUrl("rally.html"));
  return `
          <div class="pt-v pt-rally-text">
            <h3>スタンプラリー、<br>はじめました。</h3>
            ${s.kind === "info"
              ? `<p class="pt-rally-lead">まずはここで<b>一個目</b>！<br>スタンプ${kanjiNum(rallyGoal())}個で、景品と交換！</p>`
              : `<p class="pt-rally-lead">スタンプ<b>${kanjiNum(rallyGoal())}個</b>で、景品と交換！</p>`}
          </div>
          <figure class="pt-rally-qr"><img src="${qr}" alt=""><figcaption>${rally ? "↑読み込んでスタンプを押す" : "↑読み込んでスタンプカードを見る"}</figcaption></figure>`;
}
// サイトの QR（小さく横に2つ）：Enistagram と、公式サイト（模擬店は待ち時間、学科展示は展示の一覧、インフォは校内マップ）
const SITE_LINK = { shop: ["#ennichi", "で待ち時間をチェック"], exhibit: ["map.html?list=exhibit", "で学科展示を見る"], info: ["map.html", "で校内マップを見る"] };
function linksHtml(s) {
  const [path, text] = SITE_LINK[s.kind] ?? SITE_LINK.shop;
  return `
          <div class="pl-links">
            <figure class="pl-link"><img class="pl-qr" src="${qrDataUrl(siteUrl("map.html?tab=feed"))}" alt=""><figcaption><img class="pt-enista" src="../assets/img/enistagram.webp" alt="Enistagram"><span>に投稿</span></figcaption></figure>
            <figure class="pl-link"><img class="pl-qr" src="${qrDataUrl(siteUrl(path))}" alt=""><figcaption><b>公式サイト</b><span>${text}</span></figcaption></figure>
          </div>`;
}
// 貼り紙（壁に貼る A4 たて）：三角POP と同じ中身を、上から「名前」「スタンプラリー」「サイトの QR（小さく、下に）」の順に
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
// 来場案内の札の「ひとこと」（本部が変えていればそちら）。{close} は公開の終わりの時刻に
const VISIT_NOTES = () => {
  const cards = state.siteText?.texts?.visit ?? VISIT;
  const close = new Date(FESTIVAL.days[0].close).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  return cards.slice(0, 6).map((c) => String(c.title).replace("{close}", close).replace("{voteEnd}", "締め切り"));
};

// 印刷の確かめ（上に重ねる画面）。受付の1か所のときは、刷ったあと「渡した」を押す。
// 店頭の紙の形（三角POP・貼り紙）はここで選ぶ。選んだ形は、このパソコンで覚えておく
const FORMAT_KEY = "kosen63-print-format";
const FORMAT_LABEL = { tent: "三角POP", wall: "貼り紙" };
function printFormat() {
  const v = $('[name="pr-format"]:checked')?.value;
  if (v) return v;
  try { return localStorage.getItem(FORMAT_KEY) === "wall" ? "wall" : "tent"; } catch { return "tent"; }
}
$$('[name="pr-format"]').forEach((r) => { r.checked = r.value === printFormat(); });
let current = null; // { kindLabel, title, sub, build, shop, set }
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
  try { localStorage.setItem(FORMAT_KEY, r.value); } catch { /* 覚えられないブラウザ */ }
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
// 受付の「印刷する」：スタンプの QR を用意してから、その場所の紙（店頭の紙＋模擬店ならお店の人用）を作る
async function printForDesk(shop) {
  toast(`${shop.name}の紙を作っています…`);
  try {
    await ensureRally();
    current = { kindLabel: `受付：${KIND_NAME[shop.kind] ?? "模擬店"}`, title: shop.name, sub: [shop.group, shop.where].filter(Boolean).join("・"),
      build: () => buildShopSet([shop], true), shop, set: true };
    await showPrint();
  } catch (err) {
    console.warn(err);
    toast(`作れませんでした（${err.message}）`, true);
  }
}
$("#pr-print").addEventListener("click", async () => {
  await document.fonts?.ready;
  window.print();
  if (deskShop) { // 刷ったら、次は「渡した」
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
    $("#shop-q").value = ""; // 次をすぐ探せるように
    renderShops();
    $("#shop-q").focus();
  }
});
// まとめて印刷（受付済みにはしない）
$("#pr-make").addEventListener("click", async () => {
  const kind = printKind();
  const target = $('[name="pr-target"]:checked').value;
  const shops = allSpots().filter((s) => target === "all" || !handedAt(s));
  if (kind !== "flyer" && !shops.length) return toast("刷る場所がありません", true);
  const staff = $("#pr-staff").checked;
  $("#pr-make").disabled = true;
  try {
    if (kind !== "flyer") await ensureRally();
    const size = $('[name="pr-size"]:checked').value;
    current = {
      kindLabel: { shopset: "まとめて：店頭の紙", stamps: "まとめて：スタンプの QR（予備）", flyer: "来場者向けの案内チラシ" }[kind],
      title: kind === "flyer" ? "案内チラシ" : `${target === "all" ? "すべての場所" : "まだ渡していない場所"}（${shops.length}か所）`,
      sub: kind === "flyer" ? "" : "まとめて刷っても「受付済み」にはなりません",
      build: kind === "shopset" ? () => buildShopSet(shops, staff) : kind === "stamps" ? async () => buildStamps(shops) : async () => buildFlyer(size),
      set: kind === "shopset",
    };
    await showPrint();
  } catch (err) {
    toast(`作れませんでした（${err.message}）`, true);
  } finally {
    $("#pr-make").disabled = false;
  }
});
// 見出しの字（WDXL Lubrifont）は、刷る紙に出る字だけを読みこむ
function loadPrintFont(text) {
  const chars = [...new Set(text.replace(/\s+/g, ""))].join("");
  let link = document.getElementById("print-font");
  if (!link) { link = document.createElement("link"); link.id = "print-font"; link.rel = "stylesheet"; document.head.append(link); }
  link.href = `https://fonts.googleapis.com/css2?family=WDXL+Lubrifont+JP+N&display=swap&text=${encodeURIComponent(chars)}`;
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
addEventListener("beforeunload", (e) => { if (textsDirty || blocksDirty) e.preventDefault(); });

// ---------- サイトの設定：トップページの並び ----------
// site_config/current = { blocks: [{ id, show }] }。来場者のトップページは assets/blocks.js がこの順に並べる
// ⠿ をつかんで上下にドラッグ（マウスでも指でも）。キーボードでは ⠿ を選んで ↑↓
const BLOCK_INFO = Object.fromEntries(TOP_BLOCKS.map(([id, name, note]) => [id, { name, note }]));
let blocksDirty = false;
// 開催前・期間中の2つのプリセット。直しているあいだは draft に入れておき、「保存して公開」で両方まとめて書く
let draft = null;
const editing = () => $('[name="blocks-edit"]:checked').value;
function presetsFromConfig() {
  const c = state.siteConfig;
  return { before: c?.presets?.before ?? TOP_PRESETS.before, during: c?.presets?.during ?? TOP_PRESETS.during };
}
function blocksFromConfig() {
  draft ??= presetsFromConfig();
  const saved = (draft[editing()] ?? []).filter((b) => BLOCK_INFO[b?.id]);
  const seen = new Set(saved.map((b) => b.id));
  return [...saved.map((b) => ({ id: b.id, show: b.show !== false })), ...TOP_BLOCKS.filter(([id]) => !seen.has(id)).map(([id]) => ({ id, show: true }))];
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
// 番号と「いちばん上（角が丸くなる）」の印
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
// ドラッグ：⠿ を押したまま動かすと、指のいる行の前後に入れかわる
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
// キーボード：⠿ を選んで ↑↓
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

// ---------- サイトの設定：スタンプラリー（全員） ----------
// パスワードはページに置かず、PBKDF2（SHA-256・31万回）で混ぜた値だけを置く。押すたびにたずねる
const ADMIN_PW = { salt: "7c38294656e6170c05a3fea3fa66d5c6", iterations: 310000, hash: "a39c719c9ef8c1d38484993ae43f617e14da38a3374ae3f3a454a13ab12d3842" };
async function pwHash(pw) {
  const hex = (h) => new Uint8Array(h.match(/../g).map((b) => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hex(ADMIN_PW.salt), iterations: ADMIN_PW.iterations }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// パスワードをたずねる。合っていれば true、やめたら false
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

// 模擬店総選挙：votes を全部読んで、お店ごとに数える（読むのは本部だけ）。リセットはパスワードが必要
async function showVotes() {
  const box = $("#vote-all");
  if (!box.innerHTML) box.innerHTML = '<p class="muted">読みこんでいます…</p>';
  try {
    const snap = await fs.getDocs(fs.collection(db, "votes"));
    const per = {};
    let last = 0;
    snap.forEach((d) => { const v = d.data(); per[v.shop] = (per[v.shop] ?? 0) + 1; last = Math.max(last, toMs(v.updated_at) ?? 0); });
    const total = snap.size;
    $("#vote-state").textContent = `${total}票`;
    const name = (id) => allSpots().find((s) => s.id === id)?.name ?? id;
    const rows = Object.entries(per).sort((a, b) => b[1] - a[1]);
    const top = rows[0]?.[1] ?? 0;
    box.innerHTML = `
      <div class="kpis rally-kpis">
        <div class="kpi"><small>投票した人</small><b>${total}</b><span>人（1人1票）</span></div>
        <div class="kpi"><small>票が入ったお店</small><b>${rows.length}</b><span>店</span></div>
      </div>
      <h3 class="rally-h">順位</h3>
      ${rows.length ? `<table class="rally-table"><tbody>${rows.map(([id, n], i) => `<tr><th>${i + 1}位　${esc(name(id))}</th><td><i class="bar" style="--p:${top ? n / top : 0}"></i></td><td class="num">${n}票</td></tr>`).join("")}</tbody></table>` : '<p class="muted">まだ投票はありません</p>'}
      <p class="muted rally-foot">${last ? `いちばん新しい投票：${time(last)}　` : ""}${time(Date.now())} に数えた</p>`;
  } catch (err) {
    console.warn(err);
    box.innerHTML = `<p class="muted">読めませんでした（${esc(err.code ?? err.message)}）</p>`;
  }
}
$("#vote-all-show").addEventListener("click", showVotes);
setInterval(() => { if (!$("#view-vote").hidden && !document.hidden) showVotes(); }, 60000); // 開いている間は、1分ごとに数えなおす
$("#vote-all-reset").addEventListener("click", async () => {
  if (!(await askPassword("投票をリセット", "模擬店総選挙の票を、全部消します。元に戻せません。パスワードを入れてください。"))) return;
  if (!confirm("本当に、模擬店総選挙の票を全部消しますか？（元に戻せません）")) return;
  const ok = await write("模擬店総選挙の票を消しました", async () => {
    const snap = await fs.getDocs(fs.collection(db, "votes"));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = fs.writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  });
  if (ok) showVotes();
});

// 全員の状況：rally_logs を全部読んで数える（読むのは本部だけ。firestore.rules）
const rallyShopName = (id) => (state.rally?.shops ?? RALLY.shops).find((s) => s.id === id)?.name ?? id;
async function showRallyAll() {
  const box = $("#rally-all");
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

// 全員の履歴をリセット：reset_at を今にして（各スマホが、それより前のスタンプを消す）、本部の記録（rally_logs）も全部消す
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
  if (ok && !$("#rally-all").hidden) showRallyAll();
});

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
