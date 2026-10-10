const card = document.getElementById("install");
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let deferred = null;
const HOWTO = {
  ios: "画面の下（iPad は上）の <b>共有ボタン</b> →「<b>ホーム画面に追加</b>」",
  other: "ブラウザのメニュー（︙）→「<b>ホーム画面に追加</b>」または「<b>アプリをインストール</b>」",
};
function mode(m) {
  if (!card) return;
  card.dataset.mode = m;
  const how = card.querySelector(".install-howto");
  if (how && HOWTO[m]) how.innerHTML = HOWTO[m];
}
if (card) {
  const phone = matchMedia("(pointer: coarse)").matches;
  if (standalone || !phone) document.getElementById("install-sec")?.setAttribute("hidden", "");
  else mode(ios ? "ios" : "other");
}
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; mode("prompt"); });
addEventListener("appinstalled", () => document.getElementById("install-sec")?.setAttribute("hidden", ""));

card?.addEventListener("click", async (e) => {
  if (!e.target.closest(".install-btn")) return;
  if (card.dataset.mode !== "prompt" || !deferred) { card.classList.toggle("is-howto"); return; }
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  if (outcome === "accepted") document.getElementById("install-sec")?.setAttribute("hidden", "");
});

document.querySelector('.site-tabs a[aria-current="page"]')?.addEventListener("click", (e) => {
  e.preventDefault();
  scrollTo({ top: 0 });
});

function jumpToHash() {
  const el = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (el?.matches(".sec, .mido, .visit, .ennichi, .spon, .k-top, .k-msg")) el.scrollIntoView({ block: "start", behavior: "instant" });
}
if (document.readyState === "complete") setTimeout(jumpToHash, 300); else addEventListener("load", () => setTimeout(jumpToHash, 300));

let scrolled = null;
const onScroll = () => { const v = scrollY > 30; if (v !== scrolled) { scrolled = v; document.body.classList.toggle("scrolled", v); } };
addEventListener("scroll", onScroll, { passive: true });
onScroll();
