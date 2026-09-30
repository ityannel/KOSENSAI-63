// 本部の管理画面（staff/）の「文章と書体」で変えた内容を、サイトに反映する。
//
// Firestore の site_text/current = { texts: { キー: 値 }, fonts: { display, text, body } }
//   texts … 下の FIELDS のキー。入っていないものは config.js のまま
//   fonts … 下の FONTS の id。入っていないものはいつもの字
// 前に読んだものはこのスマホに覚えておき、ページを開いた瞬間から使う（あとから届いた新しい内容で描き直す）。
import { MESSAGE, ABOUT, NOTICES, VISIT, RALLY, SPONSORS } from "./config.js";

// 変えられる文章。管理画面の入力欄もこの一覧から作る
//   kind: "line"（1行）/ "lines"（1行ずつ）/ "number" / "cards"（来場案内の札：title と detail）
export const FIELDS = [
  { key: "message_name", label: "学生主事の名前", kind: "line", group: "学生主事より", get: () => MESSAGE.name, set: (v) => { MESSAGE.name = v; } },
  { key: "message_body", label: "学生主事からのことば（1行ずつ）", kind: "lines", group: "学生主事より", get: () => MESSAGE.body, set: (v) => replace(MESSAGE.body, v) },
  { key: "about", label: "高専祭について（1段落ずつ）", kind: "lines", group: "高専祭について", get: () => ABOUT, set: (v) => replace(ABOUT, v) },
  { key: "visit", label: "ご来場の皆さまへ（札の表のひとこと・裏の説明）", kind: "cards", group: "ご来場の皆さまへ", get: () => VISIT, set: (v) => setCards(v) },
  { key: "notices", label: "短い注意（1行ずつ）", kind: "lines", group: "ご来場の皆さまへ", get: () => NOTICES, set: (v) => replace(NOTICES, v) },
  { key: "rally_prize", label: "スタンプラリーの景品", kind: "line", group: "スタンプラリー", get: () => RALLY.prize, set: (v) => { RALLY.prize = v; } },
  { key: "rally_claim_place", label: "景品を引き換える場所", kind: "line", group: "スタンプラリー", get: () => RALLY.claimPlace, set: (v) => { RALLY.claimPlace = v; } },
  { key: "rally_goal", label: "何個で達成か", kind: "number", group: "スタンプラリー", get: () => RALLY.goal, set: (v) => { RALLY.goal = Math.max(1, Math.round(Number(v)) || 1); } },
  { key: "sponsor_count", label: "協賛の社数（0 なら ● と出る）", kind: "number", group: "協賛", get: () => SPONSORS.count, set: (v) => { SPONSORS.count = Math.max(0, Math.round(Number(v)) || 0); } },
];

// 選べる字（Google Fonts）。axes は読みこむ太さ（その字にない太さを書くと読みこめないので、字ごとに決める）
export const FONTS = {
  display: [
    { id: "wdxl", name: "WDXL Lubrifont JP N", label: "WDXL Lubrifont（いつもの字）", axes: "" },
    { id: "dela", name: "Dela Gothic One", label: "Dela Gothic One（太いゴシック）", axes: "" },
    { id: "dot", name: "DotGothic16", label: "DotGothic16（ドット）", axes: "" },
    { id: "rocknroll", name: "RocknRoll One", label: "RocknRoll One（まるい太字）", axes: "" },
    { id: "mochiy", name: "Mochiy Pop One", label: "Mochiy Pop One（ポップ）", axes: "" },
    { id: "rampart", name: "Rampart One", label: "Rampart One（立体）", axes: "" },
    { id: "yusei", name: "Yusei Magic", label: "Yusei Magic（マジック書き）", axes: "" },
    { id: "kaisei", name: "Kaisei Decol", label: "Kaisei Decol（明朝）", axes: "wght@700" },
  ],
  text: [
    { id: "zenkaku", name: "Zen Kaku Gothic New", label: "Zen Kaku Gothic New（いつもの字）", axes: "wght@700;900" },
    { id: "zenmaru", name: "Zen Maru Gothic", label: "Zen Maru Gothic（まるゴシック）", axes: "wght@700;900" },
    { id: "mplusr", name: "M PLUS Rounded 1c", label: "M PLUS Rounded 1c（まるい）", axes: "wght@700;900" },
    { id: "bizud", name: "BIZ UDPGothic", label: "BIZ UDPゴシック（読みやすい）", axes: "wght@700" },
    { id: "kiwi", name: "Kiwi Maru", label: "Kiwi Maru（やわらかい）", axes: "wght@500" },
    { id: "klee", name: "Klee One", label: "Klee One（手書き風）", axes: "wght@600" },
    { id: "notosans", name: "Noto Sans JP", label: "Noto Sans JP（標準）", axes: "wght@700;900" },
  ],
  body: [
    { id: "notosans", name: "Noto Sans JP", label: "Noto Sans JP（いつもの字）", axes: "wght@400;700;900" },
    { id: "bizud", name: "BIZ UDPGothic", label: "BIZ UDPゴシック（読みやすい）", axes: "wght@400;700" },
    { id: "mplus1p", name: "M PLUS 1p", label: "M PLUS 1p", axes: "wght@400;700;900" },
    { id: "zenmaru", name: "Zen Maru Gothic", label: "Zen Maru Gothic（まるゴシック）", axes: "wght@400;700;900" },
  ],
};
// どの CSS の変数を変えるか（いつもの字のときは何もしない）
const FONT_VARS = {
  display: ["--hud-font", '"Noto Sans JP", sans-serif'],
  text: ["--text-font", "var(--font)"],
  body: ["--font", '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif'],
};

const KEY = "kosen63-site-text";
const params = new URLSearchParams(location.search);
const clone = (v) => JSON.parse(JSON.stringify(v));
// 何も上書きしていないときの値（上書きを消したら、これに戻す）
export const DEFAULTS = Object.fromEntries(FIELDS.map((f) => [f.key, clone(f.get())]));

function replace(list, values) {
  list.splice(0, list.length, ...values.map(String));
}
function setCards(values) {
  VISIT.forEach((card, i) => {
    const v = values[i] ?? {};
    card.title = String(v.title ?? DEFAULTS.visit[i].title);
    card.detail = String(v.detail ?? DEFAULTS.visit[i].detail);
  });
}

// 入れた値が形としておかしくないか（おかしければ使わない）
function valid(field, v) {
  if (field.kind === "line") return typeof v === "string" && v.trim() !== "";
  if (field.kind === "lines") return Array.isArray(v) && v.every((x) => typeof x === "string");
  if (field.kind === "number") return Number.isFinite(Number(v));
  if (field.kind === "cards") return Array.isArray(v) && v.every((x) => x && typeof x === "object");
  return false;
}

export function fontChoice(role, id) {
  return FONTS[role].find((f) => f.id === id) ?? FONTS[role][0];
}

function fontLink(id, href) {
  let link = document.getElementById(id);
  if (!href) { link?.remove(); return; }
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.append(link);
  }
  if (link.href !== href) link.href = href;
}
const gf = (font, text) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.name).replace(/%20/g, "+")}${font.axes ? `:${font.axes}` : ""}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;

// 字を変える。いつもの2つ（WDXL・Zen Kaku）は使う字だけを読みこんでいるので、
// 文章を変えたときは、足りない字だけをもう1本読みこむ
function applyFonts(fonts = {}, extraText = "") {
  const root = document.documentElement;
  for (const role of Object.keys(FONTS)) {
    const choice = fontChoice(role, fonts[role]);
    const [cssVar, fallback] = FONT_VARS[role];
    if (choice === FONTS[role][0]) {
      root.style.removeProperty(cssVar);
      fontLink(`font-${role}`, role === "body" ? null : extraText && gf(choice, extraText));
    } else {
      root.style.setProperty(cssVar, `"${choice.name}", ${fallback}`);
      fontLink(`font-${role}`, gf(choice));
    }
  }
}

let current = null;
export function currentSiteText() {
  return current;
}

// 内容を反映する（同じものなら何もしない）。変わったら true
export function applySiteText(data) {
  const next = JSON.stringify(data ?? null);
  if (next === JSON.stringify(current)) return false;
  current = data ? clone(data) : null;
  const texts = data?.texts ?? {};
  const used = [];
  for (const f of FIELDS) {
    const v = f.key in texts && valid(f, texts[f.key]) ? texts[f.key] : DEFAULTS[f.key];
    f.set(clone(v));
    if (f.key in texts) used.push(JSON.stringify(texts[f.key]));
  }
  if (typeof document !== "undefined") applyFonts(data?.fonts, [...new Set(used.join(""))].join(""));
  return true;
}

// ---------- ページを開いたとき：覚えている内容をすぐ使う ----------
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (saved && !params.has("demo")) applySiteText(saved);
} catch { /* 覚えていない・読めない */ }

// ---------- 本部が変えたら描き直す ----------
const listeners = new Set();
export function onSiteTextChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function update(data) {
  if (!applySiteText(data)) return;
  try { localStorage.setItem(KEY, JSON.stringify(data ?? null)); } catch { /* 保存できないブラウザ */ }
  listeners.forEach((fn) => fn());
}

// ?test=1 のパネルから、字を試しに変える（このページだけ。保存しない）
export function previewFonts(fonts) {
  applySiteText({ ...(current ?? {}), fonts });
  listeners.forEach((fn) => fn());
}

if (!params.has("demo") && typeof document !== "undefined") {
  import("./live.js").then(({ subscribeSiteText }) => subscribeSiteText(update)).catch(() => {});
}
