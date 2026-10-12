import { SHOPS, VENUES } from "./config.js";
import { esc } from "./ai-core.js";

const BASE = [
  "いまやってるステージは？", "次のステージは？", "今日のみどころは？", "今日の最後のステージは？",
  "トイレはどこ？", "多目的トイレはどこ？", "おすすめの食べ物は？", "いま空いてる模擬店は？",
  "いまから1時間のプランを作って", "体育館への行き方", "本部はどこ？", "AEDはどこ？",
  "迷子になった", "落とし物をした", "雨のときはどうなる？", "駐車場はある？",
];

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const POOL = (() => {
  const set = new Set(BASE);
  for (const v of VENUES) {
    set.add(`${clean(v.alias ?? v.name)}への行き方`);
    set.add(`${clean(v.alias ?? v.name)}は、いま何やってる？`);
  }
  for (const s of SHOPS) {
    const n = clean(s.name);
    if (!n) continue;
    set.add(`${n}は、いま混んでる？`);
    set.add(`${n}はどこ？`);
  }
  return [...set];
})();

const norm = (s) => s.toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/\s+/g, "");

export function suggestFor(text, max = 4) {
  const q = norm(text);
  if (!q) return [];
  const hits = [];
  for (const c of POOL) {
    const i = norm(c).indexOf(q);
    if (i >= 0) hits.push([i, c.length, c]);
  }
  return hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, max).map((h) => h[2]);
}

export function attachSuggest({ input, mount, onPick }) {
  const hide = () => { mount.hidden = true; mount.innerHTML = ""; };
  const refresh = () => {
    const list = suggestFor(input.value);
    if (!list.length) { hide(); return; }
    mount.innerHTML = list.map((q) => `<button type="button" data-sug="${esc(q)}">${esc(q)}</button>`).join("");
    mount.hidden = false;
  };
  mount.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-sug]")) e.preventDefault(); });
  mount.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sug]");
    if (!b) return;
    hide();
    onPick(b.dataset.sug);
  });
  input.addEventListener("input", refresh);
  return { hide, refresh };
}
