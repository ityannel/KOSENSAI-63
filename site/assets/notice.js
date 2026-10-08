// 本部のお知らせの「見た目」を、1か所で決める（トップの帯・地図の帯・会場ディスプレイ（サイネージ）・本部コンソールのプレビューが、これを使う）。
// 本部がえらべるもの：文・種類（ふつう／緊急）・フォント・大きさ・色（背景と文字）・アイコン・リンク・表示する期間・表示する場所。
// Firestore の site_live/current の中身：
//   notice, notice_level            （これまでどおり）
//   notice_style: {
//     font:  "gothic" | "bold" | "pop" | "round" | "mincho" | "hand"   フォント（FONTS）
//     size:  "s" | "m" | "l" | "xl"                                     大きさ（SIZES）
//     bg, fg: "#RRGGBB"                                                 背景の色・文字の色
//     icon:  "mega" など（ICONS のなまえ）                               文の前に出す線の絵
//     link_label, link_url: "詳しくはこちら", "https://…"                 リンク（https だけ）
//     from, until: ミリ秒                                                 この間だけ出す（なければ、ずっと）
//     where: ["top", "map", "signage"]                                  出す場所（なければ top と signage）
//   }
// 色・フォントなどは、決まった値か、正しい色コードだけを通す（ほかの文字は、画面に出さない）。リンクは https:// で始まるものだけ。

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const HEX = /^#[0-9a-fA-F]{6}$/;
const HTTPS = /^https:\/\/[^\s"'<>]+$/;

// フォント：css は font-family。gf は、足りないときに Google Fonts から読む名前（表の中の文字だけ読む）
export const FONTS = {
  gothic: { label: "ふつう（ゴシック）", css: '"Zen Kaku Gothic New", "Noto Sans JP", sans-serif', weight: 700 },
  bold: { label: "太字ゴシック", css: '"Noto Sans JP", "Zen Kaku Gothic New", sans-serif', weight: 900 },
  pop: { label: "WDXL Lubrifont", css: '"WDXL Lubrifont JP N", "Zen Kaku Gothic New", sans-serif', weight: 400 },
  round: { label: "丸ゴシック", css: '"Zen Maru Gothic", "Zen Kaku Gothic New", sans-serif', weight: 700, gf: "Zen+Maru+Gothic:wght@700;900" },
  mincho: { label: "明朝", css: '"Shippori Mincho", "Noto Serif JP", serif', weight: 700, gf: "Shippori+Mincho:wght@700" },
  hand: { label: "手書き風", css: '"Yomogi", "Zen Kaku Gothic New", cursive', weight: 400, gf: "Yomogi" },
};
export const SIZES = { s: ["小", 0.85], m: ["ふつう", 1], l: ["大", 1.3], xl: ["特大", 1.7] };
// 色の見本：[名前, 背景, 文字]。「ふつう」は、いつもの色（種類が緊急なら赤）
export const COLORS = {
  default: ["ふつう", "", ""],
  brown: ["茶", "#634A2E", "#FEEBC4"],
  green: ["緑", "#2F8F6E", "#FFFFFF"],
  blue: ["青", "#2F6FB8", "#FFFFFF"],
  pink: ["ピンク", "#D9669B", "#FFFFFF"],
  yellow: ["黄", "#FFD24A", "#4A3B36"],
  dark: ["黒", "#302C29", "#FFFFFF"],
  red: ["赤", "#C8102E", "#FFFFFF"],
};
// アイコン：なまえ → [ラベル, 線の絵（24×24）]。絵文字は使わない
export const ICONS = {
  mega: ["お知らせ", "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"],
  warn: ["注意", "M12 3l10 18H2zM12 10v5M12 18h.01"],
  info: ["案内", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01"],
  star: ["おすすめ", "M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z"],
  rain: ["雨", "M3 12a9 9 0 0 1 18 0zM12 12v6a2 2 0 0 1-4 0"],
  heart: ["ハート", "M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"],
  clock: ["時間", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2"],
  mic: ["ステージ", "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4"],
  search: ["さがしもの", "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20"],
  flag: ["イベント", "M5 21V4M5 4h11l-2 4 2 4H5"],
  food: ["模擬店", "M4 10h16l-1.5 9h-13zM8 10V8a4 4 0 0 1 8 0v2"],
  spark: ["花火", "M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"],
};
export const WHERES = [["top", "トップページ"], ["map", "地図"], ["signage", "会場ディスプレイ"]];
export const DEFAULT_WHERE = ["top", "signage"];

// いま出すべきお知らせ（出さないときは null）。live は site_live/current、where は "top" | "map" | "signage"
export function noticeOf(live, where, now = Date.now()) {
  const text = String(live?.notice ?? "").trim();
  if (!text) return null;
  const st = live?.notice_style && typeof live.notice_style === "object" ? live.notice_style : {};
  const wh = Array.isArray(st.where) && st.where.length ? st.where : DEFAULT_WHERE;
  if (!wh.includes(where)) return null;
  const from = Number(st.from) || 0, until = Number(st.until) || 0;
  if ((from && now < from) || (until && now >= until)) return null;
  const url = typeof st.link_url === "string" && HTTPS.test(st.link_url) ? st.link_url : "";
  const n = {
    text, urgent: live?.notice_level === "urgent",
    icon: ICONS[st.icon] ? st.icon : "",
    font: FONTS[st.font] ? st.font : "", size: SIZES[st.size] && st.size !== "m" ? st.size : "",
    bg: HEX.test(st.bg ?? "") ? st.bg : "", fg: HEX.test(st.fg ?? "") ? st.fg : "",
    link: url ? { url, label: String(st.link_label || "詳しくはこちら").slice(0, 30) } : null,
  };
  n.key = JSON.stringify(n); // 同じ内容かどうかを見分ける（「閉じた」を覚えるのにも使う）
  return n;
}

// 文の中の https:// は、自動でリンクにする（escape したあとの文に、リンクをつける）
const autolink = (escaped) => escaped.replace(/https:\/\/[^\s<>&"']+/g, (u) => `<a class="nt-auto" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
export function noticeHtml(n) {
  return `${ICONS[n.icon] ? `<svg class="nt-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n.icon][1]}"/></svg>` : ""}<span class="nt-body">${n.title ? `<b class="nt-title">${esc(n.title)}</b> ` : ""}${autolink(esc(n.text))}${n.link ? ` <a class="nt-link" href="${esc(n.link.url)}" target="_blank" rel="noopener noreferrer">${esc(n.link.label)}<i aria-hidden="true"> →</i></a>` : ""}</span>`;
}

let cssDone = false;
function css() {
  if (cssDone) return;
  cssDone = true;
  const s = document.createElement("style");
  s.textContent = `
    .has-nt-bg { background: var(--nt-bg) !important; }
    .has-nt-fg { color: var(--nt-fg) !important; }
    .has-nt-bg.is-urgent::before { background: var(--nt-fg, #fff) !important; color: var(--nt-bg) !important; }
    [data-nt-font] { font-family: var(--nt-font) !important; font-weight: var(--nt-weight, 700) !important; }
    .nt-body { font-size: calc(var(--nt-scale, 1) * 1em); line-height: 1.45; }
    .nt-title { font-weight: 900; margin-right: .3em; }
    .nt-icon { width: 1.15em; height: 1.15em; margin-right: .45em; vertical-align: -.2em; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .nt-auto, .nt-link { color: inherit; text-decoration: underline; text-underline-offset: .15em; }
    .nt-link { display: inline-block; margin-left: .5em; padding: .05em .7em; border-radius: 999px; background: rgba(255, 255, 255, .24); text-decoration: none; white-space: nowrap; }
    .nt-link:hover, .nt-auto:hover { opacity: .85; }`;
  document.head.append(s);
}
const loaded = new Set();
function ensureFont(key) {
  const gf = FONTS[key]?.gf;
  if (!gf || loaded.has(gf)) return;
  loaded.add(gf);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${gf}&display=swap`;
  document.head.append(l);
}

// 要素に、お知らせの見た目を当てる。n が null なら、見た目を外す。inner は、文を入れる要素（なければ el の中身ぜんぶ）
export function paintNotice(el, n, inner = el) {
  css();
  const set = (k, v) => (v ? el.style.setProperty(k, v) : el.style.removeProperty(k));
  el.classList.toggle("has-nt-bg", !!n?.bg);
  el.classList.toggle("has-nt-fg", !!n?.fg);
  set("--nt-bg", n?.bg); set("--nt-fg", n?.fg);
  set("--nt-scale", n?.size ? String(SIZES[n.size][1]) : "");
  if (n?.font) { el.dataset.ntFont = n.font; set("--nt-font", FONTS[n.font].css); set("--nt-weight", String(FONTS[n.font].weight)); ensureFont(n.font); }
  else { delete el.dataset.ntFont; set("--nt-font", ""); set("--nt-weight", ""); }
  el.classList.toggle("is-urgent", !!n?.urgent);
  if (n) inner.innerHTML = noticeHtml(n); else inner.textContent = "";
}
