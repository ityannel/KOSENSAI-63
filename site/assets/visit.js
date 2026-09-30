// トップページの「ご来場の皆さまへ」：駅の案内板のように、絵とひとことの札を並べる。押すと、札がくるっと裏返って、裏にくわしい説明（もう一度押すと表へ）。
// 文は config.js の VISIT。公開時間・総選挙の締め切りは FESTIVAL・ELECTION から入れる
import { VISIT, FESTIVAL, ELECTION } from "./config.js";

const grid = document.getElementById("visit-grid");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (iso, o) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", ...o }).format(new Date(iso));
const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
const md = (iso) => `${fmt(iso, { month: "numeric" })}.${fmt(iso, { day: "numeric" })}`;
const fill = (s) => s
  .replace("{hours}", FESTIVAL.days.map((d) => `${md(d.open)} ${fmt(d.open, { weekday: "short" }).toUpperCase()} ${hhmm(d.open)}〜${hhmm(d.close)}`).join("／"))
  .replace("{close}", hhmm(FESTIVAL.days[0].close))
  .replace("{voteEnd}", `${md(ELECTION.closes)} ${hhmm(ELECTION.closes)}`);

// 絵（線だけのピクトグラム）。押すと動く部分に a-〇〇 の名前（CSS で動かす）
const P = {
  clock: '<circle cx="12" cy="12" r="8.5"/><g class="a-spin"><path d="M12 7.5V12l3 2"/></g>',
  car: '<g class="a-lines"><path d="M1.2 9.5h2.3M.5 12.5h2.3"/></g><g class="a-drive"><path d="M4 15.5V12l1.8-4.2A2 2 0 0 1 7.6 6.5h8.8a2 2 0 0 1 1.8 1.3L20 12v3.5M4 15.5h16M4 15.5v2M20 15.5v2M4 12h16"/><circle cx="7.5" cy="15.5" r="1.2"/><circle cx="16.5" cy="15.5" r="1.2"/></g>',
  fire: '<g class="a-burst"><path d="M12 12v9M12 12l-5.5-5.5M12 12l5.5-5.5M12 12H4M12 12h8M12 12V3.5M12 12l-4 6M12 12l4 6"/></g><circle cx="12" cy="12" r="1.6"/>',
  camera: '<g class="a-jolt"><rect x="3.5" y="7" width="17" height="12" rx="2.5"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 7l1.3-2.2h4.4L15.5 7"/></g><circle class="a-flash" cx="12" cy="12" r="11"/>',
  mic: '<g class="a-shake"><rect x="9" y="3.5" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6"/></g><g class="a-waves"><path d="M3 8a7 7 0 0 0 0 6M21 8a7 7 0 0 1 0 6"/></g>',
  vote: '<g class="a-drop"><path d="M8.5 13.5V6.5l6-2 1.5 9"/></g><path d="M4 13.5h16v6.5H4zM9 16.8h6"/>',
  exit: '<path d="M14 4.5h5.5v15H14"/><g class="a-go"><path d="M4.5 12H14M10.5 8.5L14 12l-3.5 3.5"/></g>',
  nosmoke: '<g class="a-no"><circle cx="12" cy="12" r="8.5"/><path d="M6 12h9M17 12h1"/><path d="M6 6l12 12"/></g>',
};
// 押したときに、絵のまわりに飛び出す文字（まんがの音のように）。「×」は禁煙の大きなバツ
const FX = {
  clock: ["チクタク"], car: ["ブーン"], fire: ["ドーン！"], camera: ["パシャ！", "パシャ！"],
  mic: ["ワー！", "ワー！", "キャー！"], vote: ["ストン"], exit: ["ダッ！"], nosmoke: ["×"],
};
const fx = (k) => (FX[k] ?? []).map((t, i) => `<i class="vi-fx${t === "×" ? " is-batsu" : ""}" style="--n:${i}" aria-hidden="true">${esc(t)}</i>`).join("");
// WDXL の数字は小さく見えるので、ひとことの中の数字だけ大きく（32 に対して 40 くらい）
const bigNum = (s) => esc(s).replace(/[0-9][0-9.:]*/g, (m) => `<span class="vi-num">${m}</span>`);
// 説明の中の「Enistagram」はロゴの絵にする
const logo = (s) => esc(s).replace(/Enistagram\s*/g, '<img class="vi-logo" src="assets/img/enista-puffy.webp" width="666" height="117" alt="Enistagram">');
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[k] ?? P.clock}</svg>`;
const TILTS = [-1.5, 1.2, 1, -1.3];
// 札ごとに色をかえる（うすい紙の色と、絵の丸の濃い色）。チケットの色とそろえたパステル
const COLORS = [
  ["#FFE3B8", "#D9892B"], // 時計：オレンジ
  ["#D5E9F2", "#3F8DB8"], // 車：水色
  ["#F9D6DA", "#D8637A"], // 花火：ピンク
  ["#EADFF3", "#8A68B8"], // カメラ：ふじ色
  ["#FFF1A8", "#C9A11E"], // マイク：レモン
  ["#DDEFCF", "#5E9C45"], // 投票：わかば
  ["#FFD3C4", "#D9603F"], // 出口：さんご
  ["#D3EFE6", "#3E9A86"], // 禁煙：ミント
];

if (grid) {
  grid.innerHTML = VISIT.map((v, i) => `
    <li style="--tilt:${TILTS[i % TILTS.length]}deg; --paper:${COLORS[i % COLORS.length][0]}; --mark:${COLORS[i % COLORS.length][1]}"><button type="button" class="vi-card" data-vi="${i}" aria-pressed="false">
      <span class="vi-face vi-front"><span class="vi-ic">${icon(v.icon)}</span>${fx(v.icon)}<b class="vi-title">${bigNum(fill(v.title))}</b></span>
      <span class="vi-face vi-back"><b class="vi-back-title">${bigNum(fill(v.title))}</b><span class="vi-text">${logo(fill(v.detail))}</span></span>
    </button></li>`).join("");
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vi]");
    if (!b) return;
    // 表のとき：アイコンの中の絵が動いてから、くるっと裏返る。裏のとき：すぐ表へ
    if (b.getAttribute("aria-pressed") === "true") { b.setAttribute("aria-pressed", "false"); return; }
    if (b.classList.contains("is-play")) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) { b.setAttribute("aria-pressed", "true"); return; }
    b.classList.add("is-play");
    setTimeout(() => { b.setAttribute("aria-pressed", "true"); }, 750);
    setTimeout(() => { b.classList.remove("is-play"); }, 1500);
  });
}
