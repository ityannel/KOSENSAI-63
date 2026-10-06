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
const TILTS = [-3, 2.5, -2, 3.5, -2.5];
const DYS = ["0px", "calc(4 * var(--u))", "calc(-2 * var(--u))", "0px", "0px"]; // 2行目の2つは、同じ高さにそろえる
const DXS = ["0px", "0px", "calc(10 * var(--u))", "0px", "0px"]; // 情報だけ、少し右へ。2行目は、上の3つの真ん中に置く
const bgOf = (d) => `color-mix(in srgb, ${d.color} 16%, #FFF8E8)`; // 吹き出しの地：学科の色をうすめた色
let current = -1; // いま開いている学科（なければ -1）
let busy = 0;     // 別のボタンを押されたら、前の動きを打ち切るための番号
const MS = calm ? 0 : 1;

const panelHtml = (d) => `<p class="dept-who"><span>${esc(d.dept)}</span>の展示</p><ul class="dept-items">${d.items.map((t) => `<li>${item(t)}</li>`).join("")}</ul>
  <a class="dept-where" href="map.html#${esc(d.place)}"><b aria-hidden="true">@</b><span>${esc(d.where)}</span></a>`;
const colors = (panel, d) => { panel.style.setProperty("--dc", d.color); panel.style.setProperty("--bg", bgOf(d)); };

function render() {
  list.innerHTML = `<ul class="dept-pills">${DEPT_EXHIBITS.map((d, i) => `<li><button type="button" class="dept-pill" data-i="${i}" style="--dc:${esc(d.color)}; --tilt:${TILTS[i % TILTS.length]}deg; --dy:${DYS[i % DYS.length]}; --dx:${DXS[i % DXS.length]}" aria-expanded="false" aria-controls="dept-panel">${esc(d.dept)}</button></li>`).join("")}</ul>
    <div class="dept-panel" id="dept-panel" role="region" aria-live="polite"><div class="dept-clip"><div class="dept-inner"></div></div></div>`;
  if (current >= 0) { // 作りなおしたときは、動かさずに、開いたまま
    const panel = document.getElementById("dept-panel"), d = DEPT_EXHIBITS[current];
    panel.querySelector(".dept-inner").innerHTML = panelHtml(d); colors(panel, d); placeNub(current);
    panel.classList.add("is-open"); panel.querySelector(".dept-clip").style.height = "auto";
    list.querySelectorAll(".dept-pill")[current]?.setAttribute("aria-expanded", "true");
  }
}
// 吹き出しのしっぽが、押したボタンの真下を指す
function placeNub(i) {
  const panel = document.getElementById("dept-panel"), p = list.querySelectorAll(".dept-pill")[i];
  if (!p) return;
  const a = p.getBoundingClientRect(), b = panel.getBoundingClientRect();
  panel.style.setProperty("--nub", `${a.left + a.width / 2 - b.left - panel.clientLeft}px`);
}
// 動いている途中の値を読んで、そこから次の動きを始める（とちゅうで押されても、ぬるっとつながる）
const fresh = (el) => { const o = getComputedStyle(el).opacity; el.getAnimations().forEach((a) => a.cancel()); return Number(o); };
const ease = "cubic-bezier(0.3, 0.9, 0.3, 1)";
async function show(i) {
  const panel = document.getElementById("dept-panel"), clip = panel.querySelector(".dept-clip"), inner = panel.querySelector(".dept-inner");
  const was = current, id = ++busy;
  current = i;
  list.querySelectorAll(".dept-pill").forEach((p, k) => p.setAttribute("aria-expanded", String(k === i)));
  const h0 = clip.offsetHeight, o0 = fresh(inner); fresh(clip);
  if (i < 0) { // 閉じる：高さを0へ
    clip.style.height = "0px"; panel.classList.remove("is-open");
    clip.animate([{ height: `${h0}px` }, { height: "0px" }], { duration: 420 * MS, easing: ease });
    return;
  }
  const d = DEPT_EXHIBITS[i];
  colors(panel, d); placeNub(i); // 色としっぽは、CSS の transition でなめらかに動く
  if (was < 0) { // 開く：0 から、中身の高さへ
    inner.innerHTML = panelHtml(d); panel.classList.add("is-open");
    const h1 = inner.offsetHeight; clip.style.height = "auto";
    clip.animate([{ height: "0px" }, { height: `${h1}px` }], { duration: 480 * MS, easing: ease });
    inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380 * MS, delay: 80 * MS, easing: "ease-out", fill: "backwards" });
    return;
  }
  // 学科をかえる：いまの中身をすっと消して → 入れかえて → 高さを動かしながら、新しい中身をふわっと出す
  if (o0 > 0.05) {
    const out = inner.animate([{ opacity: o0 }, { opacity: 0 }], { duration: 130 * MS, easing: "ease-in", fill: "forwards" });
    await sleep(130 * MS); // 動きの完了を待たず、時間で待つ（動きが止まる画面でも、中身が消えたままにならない）
    if (id !== busy) return;
    out.cancel();
  }
  inner.innerHTML = panelHtml(d);
  const h1 = inner.offsetHeight; clip.style.height = "auto";
  clip.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 440 * MS, easing: ease });
  inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 340 * MS, easing: "ease-out", fill: "backwards" });
}
list?.addEventListener("click", (e) => {
  if (e.target.closest(".dept-where")) return; // 場所のリンクは、そのまま地図へ
  const b = e.target.closest(".dept-pill");
  if (b) show(Number(b.dataset.i) === current ? -1 : Number(b.dataset.i));
  else if (e.target.closest(".dept-panel") && current >= 0) show(-1); // 吹き出しを押しても、閉じる
});
window.addEventListener("resize", () => current >= 0 && placeNub(current));
if (list) { render(); onSiteTextChange(render); }
