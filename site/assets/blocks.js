// トップページの欄（学生主事より・スタンプカード・いまの混雑・みどころ・縁日・ご来場の皆さまへ・協賛）の並びと、出す・出さない。
// 本部コンソールの「サイトの設定」で決めたもの（site_config/current の blocks = [{ id, show }]）。なければ config.js の TOP_BLOCKS の順で全部出す。
// 前に読んだ並びをこのスマホに覚えておき、開いたらすぐ並べる（あとから届いた設定で、すぐ並べかわる）。
// ・いちばん上に来た欄（見えているもの）は .is-first-block：上の絵に少し重なり、上の角だけ丸くなる（前の学生主事よりの形）
// ・いちばん下に来た欄は .is-last-block：下のタブに隠れないよう、下を空ける
import { TOP_BLOCKS, TOP_PRESETS, FESTIVAL } from "./config.js";
import { subscribeSiteConfig } from "./live.js";

const KEY = "kosen63-blocks";
const top = document.querySelector(".k-top");
const els = Object.fromEntries(TOP_BLOCKS.map(([id]) => [id, document.querySelector(`[data-block="${id}"]`)]).filter(([, el]) => el));

// 本部の設定と、いつもの並びを合わせる。
// 本部の設定にない欄（設定を保存したあとで増えた欄。たとえば学科展示）は、いつもの並び（config.js の TOP_PRESETS）での場所に入れる：
// いつもの並びで、その欄のすぐ前にある欄のうしろ。うしろに足すだけだと、協賛の下に出てしまう
function orderOf(blocks, base) {
  const list = (Array.isArray(blocks) ? blocks.filter((b) => els[b?.id]) : []).map((b) => ({ id: b.id, show: b.show !== false }));
  const has = (id) => list.some((b) => b.id === id);
  (base ?? []).filter((b) => els[b.id]).forEach(({ id, show }, i, arr) => {
    if (has(id)) return;
    const prev = arr.slice(0, i).reverse().find((b) => has(b.id));
    list.splice(prev ? list.findIndex((b) => b.id === prev.id) + 1 : 0, 0, { id, show });
  });
  return [...list, ...TOP_BLOCKS.filter(([id]) => els[id] && !has(id)).map(([id]) => ({ id, show: true }))];
}

let order = orderOf(null);
function apply(blocks, base) {
  order = orderOf(blocks, base);
  let anchor = top;
  for (const { id, show } of order) {
    const el = els[id];
    if (anchor.nextElementSibling !== el) anchor.after(el);
    anchor = el;
    el.toggleAttribute("data-off", !show);
  }
  // 前の読みものの箱（隠してある欄だけ）は、並べた欄のうしろへ
  const rest = document.querySelector(".sections");
  if (rest && anchor.nextElementSibling !== rest) anchor.after(rest);
  markEdges();
}

// いちばん上・いちばん下の、見えている欄に印（いまの混雑は、本部が入れるまで隠れているので、そのたびに見直す）
function markEdges() {
  const shown = order.map(({ id }) => els[id]).filter((el) => !el.hidden && !el.hasAttribute("data-off"));
  Object.values(els).forEach((el) => { el.classList.toggle("is-first-block", el === shown[0]); el.classList.toggle("is-last-block", el === shown.at(-1)); });
  // PC の右のメニュー（side.js）に、いまの並びを知らせる
  window.kosenBlocks = order.map(({ id, show }) => ({ id, show, visible: shown.includes(els[id]) }));
  document.dispatchEvent(new CustomEvent("blocks:order", { detail: window.kosenBlocks }));
}
new MutationObserver(markEdges).observe(document.querySelector("main") ?? document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });

// 上の欄が絵に重なる幅・角の丸さ（Figma の 402px 幅で 20）。絵の幅に合わせる
if (top) new ResizeObserver(([e]) => document.documentElement.style.setProperty("--edge", `${(e.contentRect.width * 20) / 402}px`)).observe(top);

// 手元（localhost）で見た目をたしかめるとき：?blocks=pickup,-message,ennichi（- は出さない）。本部の設定は読まない
const test = ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).get("blocks");
// どのプリセットを使うか：mode が "auto"（いつも）なら、最初の日の公開の前は「開催前」、それからは「期間中」
const nowParam = new URLSearchParams(location.search).get("now");
const now = () => (nowParam ? Date.parse(nowParam.includes("+") ? nowParam : nowParam + "+09:00") : Date.now());
const phase = () => (now() < Date.parse(FESTIVAL.days[0].open) ? "before" : "during");
const which = (cfg) => (cfg?.mode === "before" || cfg?.mode === "during" ? cfg.mode : phase());
const pick = (cfg) => cfg?.presets?.[which(cfg)] ?? TOP_PRESETS[which(cfg)];
const base = (cfg) => TOP_PRESETS[which(cfg)]; // いつもの並び（本部の設定にない欄の場所を決めるのに使う）
let cfg = null;
if (test) apply(test.split(",").map((t) => ({ id: t.replace(/^-/, ""), show: !t.startsWith("-") })));
else try { apply(JSON.parse(localStorage.getItem(KEY) ?? "null") ?? pick(null), base(null)); } catch { apply(pick(null), base(null)); }
if (!test) {
  subscribeSiteConfig((d) => {
    cfg = d ?? null;
    const blocks = pick(cfg);
    apply(blocks, base(cfg));
    try { localStorage.setItem(KEY, JSON.stringify(blocks)); } catch { /* 保存できないブラウザ */ }
  });
  setInterval(() => apply(pick(cfg), base(cfg)), 60000); // 開催の時刻をまたいだら切りかえる
}
