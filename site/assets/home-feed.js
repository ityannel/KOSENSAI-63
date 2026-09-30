// トップページの下の「Enistagram の最新の投稿」。地図の Enistagram と同じ投稿（返信はのぞく）を新しい順に少しだけ出す。
// 押すと地図の Enistagram（map.html?tab=feed）が開く。Firebase は、この場所が見えそうになってから読む
import { VENUES } from "./config.js";
import { subscribePosts, loadPhoto, cachedPhoto } from "./posts.js";

const SHOW = 6; // 出す数
const list = document.getElementById("e-home-list");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}
const placeName = (p) => p.shop || VENUES.find((v) => v.id === p.place)?.name || "";

function card(p) {
  const where = placeName(p);
  const stars = p.kind === "review" && p.stars ? `<span class="eh-stars" aria-label="★${p.stars}">${"★".repeat(p.stars)}${"☆".repeat(5 - p.stars)}</span>` : "";
  const photo = p.has_photo ? `<div class="eh-photo"><img data-photo="${esc(p.id)}" alt="" ${cachedPhoto(p.id) ? `src="${cachedPhoto(p.id)}"` : ""}></div>` : "";
  return `<li><a class="eh-card${p.has_photo ? "" : " is-text"}" href="map.html?tab=feed">
    <div class="eh-top"><i class="eh-av" aria-hidden="true"></i><b>${esc(p.author)}${p.official ? '<i class="eh-official">公式</i>' : ""}</b><time>${ago(p.created_at)}</time></div>
    ${photo}
    ${stars || where ? `<p class="eh-where">${stars}${where ? `<span>${esc(where)}</span>` : ""}</p>` : ""}
    ${p.text ? `<p class="eh-text">${esc(p.text)}</p>` : ""}
    <p class="eh-likes" aria-label="いいね ${p.likes}">♡ ${p.likes}</p>
  </a></li>`;
}

let last = "";
function render(posts, err) {
  let html;
  if (!posts) html = `<li class="eh-empty">${err ? "いまは投稿を読み込めません。" : "読み込み中…"}</li>`;
  else {
    const top = posts.filter((p) => p.visible && !p.reply_to).slice(0, SHOW);
    html = top.length ? top.map(card).join("") : '<li class="eh-empty">まだ投稿はありません。会場で最初のポストをどうぞ！</li>';
  }
  if (html === last) return;
  list.innerHTML = last = html;
  for (const img of list.querySelectorAll("img[data-photo]:not([src])")) {
    loadPhoto(img.dataset.photo).then((d) => { if (d) img.src = d; }).catch(() => {});
  }
}

if (list) {
  render(null);
  const start = () => subscribePosts(render);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "600px 0px" });
    io.observe(list);
  } else start();
}
