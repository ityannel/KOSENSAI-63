// みどころのチケット（Figma）。トップページの「みどころ」（main.js）と、みどころのページ（mido-page.js）の両方で使う。
// 時間の決まった企画：ステージは出演する団体ごと、ほかは企画ごと。
// トップの3枚（TICKETS）は学内のみのものを出さない。みどころのページ（タイムテーブルの代わり）は全部（ALL_TICKETS）で、学内のみは札で知らせる
import { EVENTS, STAGE, VENUES } from "./config.js";
import { changed } from "./schedule.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
export const venueName = (id) => {
  const v = VENUES.find((x) => x.id === id);
  return v ? (v.alias ?? v.name) : (id ?? "");
};
const fmt = (iso, o) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", ...o }).format(new Date(iso));

// 種類がまだ届いていない出演は、チケットの色が全部同じにならないように、順に色をかえる（種類が届いたら、そちらの色）
const HUES = ["band", "acoustic", "comedy", "dance"];
const ACTS = STAGE.acts.map((a, i) => ({ ...a, title: a.name, venue: STAGE.venue, stageAct: true, hue: HUES[i % HUES.length] }));
export const ALL_TICKETS = [...EVENTS.filter((e) => !(ACTS.length && e.stage)), ...ACTS]
  .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
export const TICKETS = ALL_TICKETS.filter((e) => !e.internal);

export const isOn = (e, t) => Date.parse(e.start) <= t && t < Date.parse(e.end);
export const isPast = (e, t) => Date.parse(e.end) <= t;
// いまやっているもの → これから始まるもの（終わったものは入れない）
export const upcomingTickets = (t) => [...TICKETS.filter((e) => isOn(e, t)), ...TICKETS.filter((e) => Date.parse(e.start) > t)];
export const dayOf = (e) => fmt(e.start, { day: "numeric" });

// チケットの色（紙の色）：種類ごと。バンド・弾き語りなどの音楽・ダンス・お笑い・展示や発表などの企画
const CATS = { band: ["ロック", "バンド", "パンク", "合同バンド"], acoustic: ["吹奏楽", "アカペラ", "弾き語り"], dance: ["ダンス"], comedy: ["漫才", "コント"] };
export const catOf = (e) => Object.keys(CATS).find((c) => CATS[c].includes(e.kind)) ?? e.hue ?? "event";

const TILTS = [-2.8, 1.5, -1.2];
export function ticketHtml(e, i, t) {
  const on = isOn(e, t);
  const wd = fmt(e.start, { weekday: "short" }).toUpperCase();
  const tags = [e.internal && "学内のみ", e.kind, !e.stageAct && e.mood].filter(Boolean); // 出演団体は、一言を紹介文の位置に出す（タグには入れない）
  const line = e.stageAct ? e.mood : e.copy; // 出演団体のチケットは一言。詳しい紹介文は、押したときの詳しいシートで出す
  return `
    <a data-tk="${ALL_TICKETS.indexOf(e)}" class="tk is-${catOf(e)}${on ? " is-now" : ""}${isPast(e, t) ? " is-past" : ""}${e.photo ? " has-photo" : ""}" href="map.html#${esc(e.venue)}" style="--tilt:${TILTS[i % TILTS.length]}deg">
      <div class="tk-shape"><div class="tk-body"><i class="tk-hole" aria-hidden="true"></i>
        <p class="tk-stub is-${wd.toLowerCase()}"><span class="tk-wd">${wd}</span><b class="tk-day">${dayOf(e)}</b><span class="tk-time">${changed(e) ? `<span class="t-chg"><b class="t-new">${hhmm(e.start)}<i aria-hidden="true"></i>${hhmm(e.end)}</b><s class="t-old">${hhmm(e.o_start)}〜${hhmm(e.o_end)}</s></span>` : `${hhmm(e.start)}<i aria-hidden="true"></i>${hhmm(e.end)}`}</span></p>
        <div class="tk-main">
          ${tags.length ? `<p class="tk-tags">${tags.map((x) => `<span>${esc(x)}</span>`).join("")}</p>` : ""}
          <h3 class="tk-name${[...e.title].length > 8 ? " is-long" : ""}">${esc(e.title)}</h3>
          ${line ? `<p class="tk-copy">${esc(line).replace(/\n/g, "<br>")}</p>` : ""}
          <span class="tk-place">@${esc(venueName(e.venue))}</span>
        </div>
      </div></div>
      ${on ? '<span class="tk-badge is-now">NOW</span>' : isPast(e, t) ? '<span class="tk-badge is-end">終了</span>' : e.live ? '<span class="tk-badge is-live">LIVE</span>' : ""}
      ${e.photo ? `<img class="tk-photo" src="${esc(e.photo)}" alt="${esc(e.title)}の写真（押すと大きく表示）" loading="lazy" decoding="async">` : ""}
    </a>`;
}

// 一覧（みどころのページの切りかえ）：時間・名前・種類・場所を1行ずつ。左の色の帯はチケットの色と同じ
export function rowHtml(e, t) {
  const on = isOn(e, t);
  const tags = [e.internal && "学内のみ", e.kind, e.mood].filter(Boolean).join("・");
  return `
    <a class="tl-row is-${catOf(e)}${on ? " is-now" : ""}${isPast(e, t) ? " is-past" : ""}" href="map.html#${esc(e.venue)}">
      <time>${changed(e) ? `<span class="t-chg"><b class="t-new">${hhmm(e.start)}<small>〜${hhmm(e.end)}</small></b><s class="t-old">${hhmm(e.o_start)}〜${hhmm(e.o_end)}</s></span>` : `${hhmm(e.start)}<small>〜${hhmm(e.end)}</small>`}</time>
      <span class="tl-main"><b>${esc(e.title)}</b><small>${tags ? `${esc(tags)}　` : ""}@${esc(venueName(e.venue))}</small></span>
      ${on ? '<span class="tl-badge">NOW</span>' : ""}
    </a>`;
}
