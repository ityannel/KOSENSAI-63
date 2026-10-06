// トップページの「学科展示」：学科名の丸いボタンだけを並べ、押すと、その学科の展示がいびつな角丸の板に出る（一度に1学科。もう一度押すと閉じる）。
// 文は config.js の DEPT_EXHIBITS（要項の「学科展示について」）。場所を押すと、地図でその場所が開く
import { onSiteTextChange } from "./site-text.js"; // 本部が変えた文・書体（ほかより先に読む）
import { DEPT_EXHIBITS } from "./config.js";

const list = document.getElementById("dept-list");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// 「～…～」の補足は、小さく別の行に
const item = (t) => { const m = String(t).match(/^(.*?)\s*(～.*～)$/); return m ? `<b>${esc(m[1])}</b><small>${esc(m[2])}</small>` : `<b>${esc(t)}</b>`; };
let current = -1; // いま開いている学科（なければ -1）

function panelHtml(d) {
  return `<ul class="dept-items">${d.items.map((t) => `<li>${item(t)}</li>`).join("")}</ul>
    <a class="dept-where" href="map.html#${esc(d.place)}"><i aria-hidden="true">場所</i><span>${esc(d.where)}</span><em aria-hidden="true">→</em></a>`;
}
function render() {
  list.innerHTML = `<ul class="dept-pills">${DEPT_EXHIBITS.map((d, i) => `<li><button type="button" class="dept-pill" data-i="${i}" style="--dc:${esc(d.color)}" aria-expanded="false" aria-controls="dept-panel">${esc(d.dept)}</button></li>`).join("")}</ul>
    <div class="dept-panel" id="dept-panel" role="region" aria-live="polite" hidden></div>`;
  show(current, false);
}
function show(i, animate = true) {
  const panel = document.getElementById("dept-panel");
  const pills = [...list.querySelectorAll(".dept-pill")];
  current = i;
  pills.forEach((p, k) => p.setAttribute("aria-expanded", String(k === i)));
  if (i < 0 || !DEPT_EXHIBITS[i]) { panel.hidden = true; return; }
  const p = pills[i];
  panel.style.setProperty("--dc", DEPT_EXHIBITS[i].color);
  panel.style.setProperty("--nub", `${p.offsetLeft + p.offsetWidth / 2 - panel.offsetLeft}px`); // 板の三角が、押したボタンの真下を指す
  panel.innerHTML = panelHtml(DEPT_EXHIBITS[i]);
  panel.hidden = false;
  if (animate) { panel.style.animation = "none"; void panel.offsetWidth; panel.style.animation = ""; }
}
list?.addEventListener("click", (e) => {
  const b = e.target.closest(".dept-pill");
  if (b) show(Number(b.dataset.i) === current ? -1 : Number(b.dataset.i));
});
if (list) { render(); onSiteTextChange(render); }
