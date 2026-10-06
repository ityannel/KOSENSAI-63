// 電波がなくても開けるようにする（Service Worker）。
// 当日は人が多くてスマホの電波が混むので、一度開いたページ・地図・検索・道案内は電波なしでも動くようにしておく。
// - このサイトのファイル（ページ・部品・画像）：しまってあるものをすぐ使い、裏でネットから新しくする。
//   タブの切りかえ（サイト⇔地図⇔Enistagram）で電波を待たないように。新しくしたものは次に開いたときに出る。
//   しまっていないときだけネットを待つ（電波がなければ、しまってあるページで開く）
//   公開するときは VERSION を上げる：新しい Service Worker が全部を取り直して入れかえるので、古いものと混ざらない
// - 文字（Google Fonts）・Firebase の部品・QR を読む部品：しまってあるものをすぐ使い、裏で新しくする
// - 混雑・お知らせ・みんなの声（Firestore）はしまわない（電波がないときは出ないだけ）
// - staff/（本部用）はしまわない
// 中身を大きく変えたときは VERSION を上げる（古いしまったものを消す）
const VERSION = "kosen63-v197";
const CORE = [
  "./", "index.html", "map.html", "mido.html", "rally.html", "vote.html", "favicon.svg", "manifest.webmanifest",
  "assets/style.css", "assets/map.css",
  "assets/main.js", "assets/map-page.js", "assets/map.js", "assets/route.js", "assets/campus.js", "assets/config.js",
  "assets/live.js", "assets/posts.js", "assets/avatar.js", "assets/schedule.js", "assets/exhibit.js", "assets/daytoast.js", "assets/home-feed.js", "assets/tickets.js", "assets/thread.js", "assets/shops-board.js", "assets/detail.js", "assets/visit.js", "assets/mido-page.js", "assets/rally-page.js", "assets/vote-page.js", "assets/qr-scan.js", "assets/blocks.js", "assets/app.js", "assets/theme.js", "assets/side.js", "assets/offline.js", "assets/rally.js", "assets/rally-data.js", "assets/ask.js", "assets/scene.js", "assets/fx.js", "assets/weather.js",
  "assets/map/rooms.json", "assets/img/logo.webp", "assets/img/logo-s.webp", "assets/img/icon-192.png",
];
const SIDE = [/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, /^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/cdn\.jsdelivr\.net\/npm\/(jsqr|lenis)@/];

self.addEventListener("install", (e) => {
  // 1つ取れなくても全体は止めない
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => fetch(new Request(u, { cache: "reload" })).then(async (res) => { if (res.ok) await c.put(u, await plain(res)); }).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.includes("/staff/") || url.pathname.endsWith("/sw.js")) return;
    // 会場のディスプレイ（signage）は、しまってある古い版を見せず、いつも新しい版（ネット）を使う
    e.respondWith((async () => {
      if (url.pathname.includes("signage")) return fetch(req);
      const c = e.clientId ? await self.clients.get(e.clientId) : null;
      return c && c.url.includes("signage") ? fetch(req) : fromCache(req, e);
    })());
  } else if (SIDE.some((re) => re.test(req.url))) {
    e.respondWith(cacheFirst(req, e));
  }
});

// 置き場所によっては map.html が /map に転送される（Cloudflare Pages）。転送された答えはページとして返せないので、中身だけ取り出してしまう
async function plain(res) {
  return res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
}
// ページをしまう名前：/ は /index.html、/map は /map.html（? のうしろは見ない）
function pageKey(pathname) {
  if (pathname.endsWith("/")) return pathname + "index.html";
  return /\.[a-z0-9]+$/i.test(pathname) ? pathname : pathname + ".html";
}

// しまってあるものをすぐ返し、裏で新しくする。ページ（map.html?tab=feed など）は ? のうしろを無視して1つにしまう
async function fromCache(req, e) {
  const cache = await caches.open(VERSION);
  const page = req.mode === "navigate";
  const key = page ? pageKey(new URL(req.url).pathname) : req;
  const hit = (await cache.match(key)) ?? (page ? await cache.match(req, { ignoreSearch: true }) : null);
  const net = fetch(req).then((res) => {
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  // しまっていない：ネットを待つ。電波がなければ、しまってあるトップページ（ページのとき）
  try { return await net; } catch (err) {
    const fallback = page && (await cache.match("index.html"));
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(req, e) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}
