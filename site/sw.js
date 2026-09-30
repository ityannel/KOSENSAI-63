// 電波がなくても開けるようにする（Service Worker）。
// 当日は人が多くてスマホの電波が混むので、一度開いたページ・地図・検索・道案内は電波なしでも動くようにしておく。
// - このサイトのファイル：まずネットから取り（4秒待っても来なければ）、しまってあるものを使う。取れたらしまい直す（いつも新しいものが出る）
// - 文字（Google Fonts）・Firebase の部品・QR を読む部品：しまってあるものをすぐ使い、裏で新しくする
// - 混雑・お知らせ・みんなの声（Firestore）はしまわない（電波がないときは出ないだけ）
// - staff/（本部用）はしまわない
// 中身を大きく変えたときは VERSION を上げる（古いしまったものを消す）
const VERSION = "kosen63-v85";
const CORE = [
  "./", "index.html", "map.html", "mido.html", "rally.html", "favicon.svg", "manifest.webmanifest",
  "assets/style.css", "assets/map.css",
  "assets/main.js", "assets/map-page.js", "assets/map.js", "assets/route.js", "assets/campus.js", "assets/config.js",
  "assets/live.js", "assets/posts.js", "assets/home-feed.js", "assets/tickets.js", "assets/thread.js", "assets/shops-board.js", "assets/detail.js", "assets/visit.js", "assets/mido-page.js", "assets/rally-page.js", "assets/qr-scan.js", "assets/app.js", "assets/site-text.js", "assets/theme.js", "assets/side.js", "assets/offline.js", "assets/rally.js", "assets/rally-data.js", "assets/ask.js", "assets/scene.js", "assets/fx.js", "assets/weather.js",
  "assets/map/rooms.json", "assets/img/logo.webp", "assets/img/icon-192.png",
];
const SIDE = [/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, /^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/cdn\.jsdelivr\.net\/npm\/jsqr@/];
const WAIT_MS = 4000;

self.addEventListener("install", (e) => {
  // 1つ取れなくても全体は止めない
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
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
    e.respondWith(networkFirst(req));
  } else if (SIDE.some((re) => re.test(req.url))) {
    e.respondWith(cacheFirst(req, e));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  net.catch(() => {}); // 先にしまったものを返したあとで失敗しても、エラーにしない
  const timeout = new Promise((ok) => setTimeout(ok, WAIT_MS, null));
  try {
    const res = await Promise.race([net, timeout]);
    if (res) return res;
  } catch { /* 電波がない */ }
  // ?here=ID や ?to=ID つきのページも、しまってあるページで開く
  const hit = (await cache.match(req)) ?? (await cache.match(req, { ignoreSearch: true }));
  if (hit) return hit;
  return net; // しまっていない：ネットを待つ（だめならブラウザのいつものエラー）
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
