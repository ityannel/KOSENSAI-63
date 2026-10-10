import { FESTIVAL } from "./config.js";
import { subscribePosts, observePhotos, cachedPhoto } from "./posts.js";

const sec = document.getElementById("memory");
const grid = document.getElementById("memory-grid");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nowParam = new URLSearchParams(location.search).get("now");
const now = () => (nowParam ? Date.parse(nowParam.includes("+") ? nowParam : `${nowParam}+09:00`) : Date.now());
const CLOSE = Date.parse(FESTIVAL.days.at(-1).close);
const TILTS = [-2.4, 1.6, -1, 2.2, -1.8, 1.2];

function render(list) {
  const top = (list ?? []).filter((p) => p.visible && !p.reply_to);
  const byLikes = (a, b) => b.likes - a.likes || b.created_at - a.created_at;
  let picks = top.filter((p) => p.has_photo).sort(byLikes).slice(0, 6);
  const photos = picks.length > 0;
  if (!photos) picks = top.filter((p) => p.text.trim()).sort(byLikes).slice(0, 3);
  if (!picks.length) { sec.hidden = true; return; }
  grid.className = `mm-grid${photos ? "" : " is-text"}`;
  grid.innerHTML = picks.map((p, i) => `
    <li style="--tilt:${TILTS[i % TILTS.length]}deg"><a class="mm-card" href="map.html?tab=feed" aria-label="Enistagram で見る">
      ${photos ? `<img data-photo="${esc(p.id)}" alt="投稿の写真"${cachedPhoto(p.id) ? ` src="${cachedPhoto(p.id)}"` : ""}>` : ""}
      ${p.text.trim() ? `<p>${esc(p.text.trim().slice(0, photos ? 40 : 90))}</p>` : ""}
      <small>${esc(p.author)}${p.likes ? `　♡ ${p.likes}` : ""}</small>
    </a></li>`).join("");
  observePhotos(grid, (img) => img.remove());
  sec.hidden = false;
}

if (sec && grid) {
  let started = false;
  const check = () => {
    if (started || now() <= CLOSE) return;
    started = true;
    subscribePosts((list) => { if (list) render(list); });
  };
  check();
  setInterval(check, 30000);
}
