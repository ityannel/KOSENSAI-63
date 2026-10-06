// アプリとして使う（PWA）：ホーム画面に追加するカードと、下のタブ。トップページで読み込む
// - Android・PC の Chrome / Edge：「追加」でそのまま入れられる（beforeinstallprompt）
// - iPhone / iPad の Safari：入れ方（共有 → ホーム画面に追加）を出す
// - もうアプリとして開いているとき・「×」で閉じたあとは出さない
const card = document.getElementById("install");
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let deferred = null;
const HOWTO = {
  ios: "画面の下（iPad は上）の <b>共有ボタン</b> →「<b>ホーム画面に追加</b>」",
  other: "ブラウザのメニュー（︙）→「<b>ホーム画面に追加</b>」または「<b>アプリをインストール</b>」",
};
// いつも出す（アプリとして開いているときだけ出さない）。Chrome で、そのまま入れられるときは「追加」で入る
function mode(m) {
  if (!card) return;
  card.dataset.mode = m;
  const how = card.querySelector(".install-howto");
  if (how && HOWTO[m]) how.innerHTML = HOWTO[m];
}
if (card) {
  const phone = matchMedia("(pointer: coarse)").matches; // PC（マウス）のときは出さない
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

// 下のタブ：いま見ている「サイト」をもう一度押したら、いちばん上へ
document.querySelector('.site-tabs a[aria-current="page"]')?.addEventListener("click", (e) => {
  e.preventDefault();
  scrollTo({ top: 0 });
});

// URL の #crowd などで来たとき：中身（JS で入れる）が出そろってから、そのセクションへ
function jumpToHash() {
  const el = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (el?.matches(".sec, .mido, .visit, .ennichi, .spon, .k-top, .k-msg")) el.scrollIntoView({ block: "start", behavior: "instant" });
}
if (document.readyState === "complete") setTimeout(jumpToHash, 300); else addEventListener("load", () => setTimeout(jumpToHash, 300));

// 少しでも下へスクロールしたら、「SCROLL」の案内を消す
let scrolled = null;
const onScroll = () => { const v = scrollY > 30; if (v !== scrolled) { scrolled = v; document.body.classList.toggle("scrolled", v); } };
addEventListener("scroll", onScroll, { passive: true });
onScroll();
