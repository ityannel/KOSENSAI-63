// トップページの「学科展示」：5学科の展示と場所のカード。スクロールして画面に入ったカードから、順に出てくる。
// 文は config.js の DEPT_EXHIBITS（要項の「学科展示について」）。場所を押すと、地図でその場所が開く
import { onSiteTextChange } from "./site-text.js"; // 本部が変えた文・書体（ほかより先に読む）
import { DEPT_EXHIBITS } from "./config.js";

const list = document.getElementById("dept-list");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TILTS = [-1.2, 1, -0.8, 1.3, -1];
// 「～…～」の補足は、小さく別の行に
const item = (t) => { const m = String(t).match(/^(.*?)\s*(～.*～)$/); return m ? `<b>${esc(m[1])}</b><small>${esc(m[2])}</small>` : `<b>${esc(t)}</b>`; };

function render() {
  list.innerHTML = DEPT_EXHIBITS.map((d, i) => `
    <li class="dept-card" style="--dc:${esc(d.color)}; --tilt:${TILTS[i % TILTS.length]}deg">
      <h3 class="dept-name"><button type="button" aria-expanded="false"><span>${esc(d.dept)}</span><i aria-hidden="true"></i></button></h3>
      <div class="dept-body"><div class="dept-body-in">
        <ul class="dept-items">${d.items.map((t) => `<li>${item(t)}</li>`).join("")}</ul>
        <a class="dept-where" href="map.html#${esc(d.place)}"><i aria-hidden="true">場所</i><span>${esc(d.where)}</span><em aria-hidden="true">→</em></a>
      </div></div>
    </li>`).join("");
  watchCards();
}
// カードは、はじめは学科名だけ。画面に入ると、上から順に、くるっと展開する（学科名を押しても、開け閉めできる）
const opened = new Set(); // 開いた学科（文や書体が変わって作りなおしても、開いたまま）
const setOpen = (card, on) => { const i = [...list.children].indexOf(card); on ? opened.add(i) : opened.delete(i); card.classList.toggle("is-in", on); card.querySelector("button").setAttribute("aria-expanded", String(on)); };
let io = null;
function watchCards() {
  const cards = [...list.querySelectorAll(".dept-card")];
  cards.forEach((c, i) => { if (opened.has(i)) { c.classList.add("is-in"); c.querySelector("button").setAttribute("aria-expanded", "true"); } });
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return cards.forEach((c) => setOpen(c, true));
  io?.disconnect();
  io = new IntersectionObserver((es) => {
    es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top).forEach((e, k) => {
      io.unobserve(e.target);
      setTimeout(() => setOpen(e.target, true), 250 + k * 350);
    });
  }, { threshold: 0.6 });
  cards.forEach((c, i) => { if (!opened.has(i)) io.observe(c); });
}
list?.addEventListener("click", (e) => { const b = e.target.closest(".dept-name button"); if (b) { const c = b.closest(".dept-card"); io?.unobserve(c); setOpen(c, !c.classList.contains("is-in")); } });
if (list) { render(); onSiteTextChange(render); }
