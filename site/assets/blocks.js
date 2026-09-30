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

// 本部の設定と、いつもの並びを合わせる（本部の設定にない欄は、うしろに足して出す）
function orderOf(blocks) {
  const list = Array.isArray(blocks) ? blocks.filter((b) => els[b?.id]) : [];
  const seen = new Set(list.map((b) => b.id));
  return [...list.map((b) => ({ id: b.id, show: b.show !== false })), ...TOP_BLOCKS.filter(([id]) => els[id] && !seen.has(id)).map(([id]) => ({ id, show: true }))];
}

let order = orderOf(null);
function apply(blocks) {
  order = orderOf(blocks);
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
function pick(cfg) {
  const which = cfg?.mode === "before" || cfg?.mode === "during" ? cfg.mode : phase();
  return cfg?.presets?.[which] ?? TOP_PRESETS[which];
}
let cfg = null;
if (test) apply(test.split(",").map((t) => ({ id: t.replace(/^-/, ""), show: !t.startsWith("-") })));
else try { apply(JSON.parse(localStorage.getItem(KEY) ?? "null") ?? pick(null)); } catch { apply(pick(null)); }
if (!test) {
  subscribeSiteConfig((d) => {
    cfg = d ?? null;
    const blocks = pick(cfg);
    apply(blocks);
    try { localStorage.setItem(KEY, JSON.stringify(blocks)); } catch { /* 保存できないブラウザ */ }
  });
  setInterval(() => apply(pick(cfg)), 60000); // 開催の時刻をまたいだら切りかえる
}
