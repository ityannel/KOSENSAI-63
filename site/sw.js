const VERSION = "kosen63-v363";
const CORE = [
  "./", "index.html", "map.html", "mido.html", "rally.html", "vote.html", "terms.html", "favicon.svg", "manifest.webmanifest",
  "assets/style.css", "assets/map.css", "assets/intro.js", "assets/map-wide.js", "assets/test-loader.js",
  "assets/main.js", "assets/map-page.js", "assets/map.js", "assets/route.js", "assets/campus.js", "assets/config.js",
  "assets/live.js", "assets/notice.js", "assets/idle-listen.js", "assets/posts.js", "assets/avatar.js", "assets/schedule.js", "assets/exhibit.js", "assets/daytoast.js", "assets/memory.js", "assets/home-feed.js", "assets/tickets.js", "assets/thread.js", "assets/shops-board.js", "assets/detail.js", "assets/visit.js", "assets/mido-page.js", "assets/rally-page.js", "assets/vote-page.js", "assets/qr-scan.js", "assets/blocks.js", "assets/app.js", "assets/theme.js", "assets/side.js", "assets/offline.js", "assets/rally.js", "assets/rally-data.js", "assets/ask.js", "assets/scene.js", "assets/fx.js", "assets/weather.js",
  "assets/map/rooms.json", "assets/img/logo.webp", "assets/img/logo-s.webp", "assets/img/icon-192.png",
];
const SIDE = [/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, /^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/cdn\.jsdelivr\.net\/npm\/(jsqr|lenis)@/];

self.addEventListener("install", (e) => {
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
    e.respondWith((async () => {
      if (url.pathname.includes("signage")) return fetch(req);
      const c = e.clientId ? await self.clients.get(e.clientId) : null;
      return c && c.url.includes("signage") ? fetch(req) : fromCache(req, e);
    })());
  } else if (SIDE.some((re) => re.test(req.url))) {
    e.respondWith(cacheFirst(req, e));
  }
});

async function plain(res) {
  return res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
}
function pageKey(pathname) {
  if (pathname.endsWith("/")) return pathname + "index.html";
  return /\.[a-z0-9]+$/i.test(pathname) ? pathname : pathname + ".html";
}

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
