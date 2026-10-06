// トップページの「学科展示」：学科名の丸いボタンだけを並べ、押すと、その学科の展示が板に出る（一度に1学科。もう一度押すと閉じる）。
// 開く・学科をかえる・閉じるは、板の高さ・色・三角の位置・中身の入れかわりを、なめらかにつないで動かす。
// 文は config.js の DEPT_EXHIBITS（要項の「学科展示について」）。場所を押すと、地図でその場所が開く
import { onSiteTextChange } from "./site-text.js"; // 本部が変えた文・書体（ほかより先に読む）
import { DEPT_EXHIBITS } from "./config.js";

const list = document.getElementById("dept-list");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 「～…～」の補足は、小さく別の行に
const item = (t) => { const m = String(t).match(/^(.*?)\s*(～.*～)$/); return m ? `<b>${esc(m[1])}</b><small>${esc(m[2])}</small>` : `<b>${esc(t)}</b>`; };
// 学科名のボタンは、少しずつ違う方向にかたむけて、高さもずらす（きれいに並べない）
const TILTS = [-4, 3, -2.5, 4, -3.5];
const DYS = ["0px", "calc(6 * var(--u))", "calc(-3 * var(--u))", "calc(4 * var(--u))", "calc(-5 * var(--u))"];
let current = -1; // いま開いている学科（なければ -1）
let busy = 0;     // 動かしている最中は、前の動きを打ち切るための番号

const panelHtml = (d) => `<p class="dept-who"><span>${esc(d.dept)}</span>の展示</p><ul class="dept-items">${d.items.map((t) => `<li>${item(t)}</li>`).join("")}</ul>
  <a class="dept-where" href="map.html#${esc(d.place)}"><i aria-hidden="true">場所</i><span>${esc(d.where)}</span><em aria-hidden="true">→</em></a>`;

function render() {
  list.innerHTML = `<ul class="dept-pills">${DEPT_EXHIBITS.map((d, i) => `<li><button type="button" class="dept-pill" data-i="${i}" style="--dc:${esc(d.color)}; --tilt:${TILTS[i % TILTS.length]}deg; --dy:${DYS[i % DYS.length]}" aria-expanded="false" aria-controls="dept-panel">${esc(d.dept)}</button></li>`).join("")}</ul>
    <div class="dept-panel" id="dept-panel" role="region" aria-live="polite"><div class="dept-clip"><div class="dept-inner"></div></div></div>`;
  const panel = document.getElementById("dept-panel"), inner = panel.querySelector(".dept-inner");
  if (current >= 0) { // 作りなおしたときは、動かさずに、開いたまま
    const d = DEPT_EXHIBITS[current];
    inner.innerHTML = panelHtml(d); panel.style.setProperty("--dc", d.color); panel.style.setProperty("--bg", d.bg ?? "#FFF8E8"); placeNub(current); panel.classList.add("is-open"); panel.querySelector(".dept-clip").style.height = "auto";
    list.querySelectorAll(".dept-pill")[current]?.setAttribute("aria-expanded", "true");
  }
}
function placeNub(i) {
  const panel = document.getElementById("dept-panel"), p = list.querySelectorAll(".dept-pill")[i];
  if (p) panel.style.setProperty("--nub", `${p.offsetLeft + p.offsetWidth / 2 - panel.offsetLeft}px`); // 三角が、押したボタンの真下を指す
}
// 高さを、いまの高さ → 中身の高さへ、なめらかに（終わったら auto にもどす）
async function growTo(clip, inner, from) {
  clip.style.height = `${from}px`;
  void clip.offsetWidth;
  clip.style.height = `${inner.offsetHeight}px`;
  await sleep(calm ? 0 : 480);
  clip.style.height = "auto";
}
async function show(i) {
  const panel = document.getElementById("dept-panel"), clip = panel.querySelector(".dept-clip"), inner = panel.querySelector(".dept-inner");
  const pills = [...list.querySelectorAll(".dept-pill")];
  const was = current, id = ++busy;
  current = i;
  pills.forEach((p, k) => p.setAttribute("aria-expanded", String(k === i)));
  if (i < 0) { // 閉じる：高さを0へ
    clip.style.height = `${clip.offsetHeight}px`; void clip.offsetWidth;
    panel.classList.remove("is-open"); clip.style.height = "0px";
    return;
  }
  const d = DEPT_EXHIBITS[i];
  panel.style.setProperty("--dc", d.color); panel.style.setProperty("--bg", d.bg ?? "#FFF8E8"); placeNub(i); // 色と三角は、CSS の transition でなめらかに動く
  if (was < 0) { // 開く：0 から、中身の高さへ
    inner.innerHTML = panelHtml(d);
    clip.style.height = "0px"; panel.classList.add("is-open");
    await growTo(clip, inner, 0);
    return;
  }
  // 学科をかえる：中身を消して → 入れかえて → 新しい高さへ → 中身を出す
  const h0 = clip.offsetHeight;
  clip.style.height = `${h0}px`;
  inner.classList.add("is-out");
  await sleep(calm ? 0 : 170);
  if (id !== busy) return;
  inner.innerHTML = panelHtml(d);
  await growTo(clip, inner, h0);
  if (id !== busy) return;
  inner.classList.remove("is-out");
}
list?.addEventListener("click", (e) => {
  const b = e.target.closest(".dept-pill");
  if (b) show(Number(b.dataset.i) === current ? -1 : Number(b.dataset.i));
});
if (list) { render(); onSiteTextChange(render); }
