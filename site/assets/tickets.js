import { EVENTS, LIST_EVENTS, STAGE, VENUES } from "./config.js";
import { changed } from "./schedule.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const hhmm = (iso) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
export const venueName = (id) => {
  const v = VENUES.find((x) => x.id === id);
  return v ? (v.alias ?? v.name) : (id ?? "");
};
const fmt = (iso, o) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", ...o }).format(new Date(iso));

const HUES = ["band", "acoustic", "comedy", "dance"];
const ACTS = STAGE.acts.map((a, i) => ({ ...a, title: a.name, venue: STAGE.venue, stageAct: true, hue: HUES[i % HUES.length] }));
export const ALL_TICKETS = [...EVENTS.filter((e) => !(ACTS.length && e.stage)), ...LIST_EVENTS, ...ACTS]
  .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
export const TICKETS = ALL_TICKETS.filter((e) => !e.internal && !e.listOnly);

export const isOn = (e, t) => Date.parse(e.start) <= t && t < Date.parse(e.end);
export const isPast = (e, t) => Date.parse(e.end) <= t;
export const upcomingTickets = (t) => [...TICKETS.filter((e) => isOn(e, t)), ...TICKETS.filter((e) => Date.parse(e.start) > t)];
export const dayOf = (e) => fmt(e.start, { day: "numeric" });

const CATS = { band: ["ロック", "バンド", "パンク", "合同バンド"], acoustic: ["吹奏楽", "アカペラ", "弾き語り"], dance: ["ダンス"], comedy: ["漫才", "コント"] };
export const catOf = (e) => Object.keys(CATS).find((c) => CATS[c].includes(e.kind)) ?? e.hue ?? "event";

const TILTS = [-2.8, 1.5, -1.2];
const PTILTS = [4, -3, 5, -5, 3, -2, 6, -4];
const photoTilt = (name) => PTILTS[[...String(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % PTILTS.length];
export const photosOf = (e) => (e.photo ? [e.photo, ...(e.more ?? [])] : []);
function photoStack(e) {
  const all = photosOf(e);
  if (!all.length) return "";
  const back = all.slice(1, 3).map((src, i) => `<img class="tk-photo is-back b${i + 1}" style="--ptilt:${photoTilt(e.title) + (i ? 12 : -12)}deg" src="${esc(src)}" alt="" loading="lazy" decoding="async" aria-hidden="true">`).reverse().join("");
  return `${back}<img class="tk-photo" data-photos="${esc(all.join("|"))}" style="--ptilt:${photoTilt(e.title)}deg" src="${esc(all[0])}" alt="${esc(e.title)}の写真（押すと大きく表示）" loading="lazy" decoding="async">`;
}
export function ticketHtml(e, i, t) {
  const on = isOn(e, t);
  const wd = fmt(e.start, { weekday: "short" }).toUpperCase();
  const tags = [e.internal && "学内のみ", e.kind, !e.stageAct && e.mood].filter(Boolean);
  const line = e.stageAct ? e.mood : e.copy;
  return `
    <a data-tk="${ALL_TICKETS.indexOf(e)}" class="tk is-${catOf(e)}${on ? " is-now" : ""}${isPast(e, t) ? " is-past" : ""}${e.photo ? " has-photo" : ""}${e.more?.length ? " is-stack" : ""}" href="map.html#${esc(e.venue)}" style="--tilt:${TILTS[i % TILTS.length]}deg">
      <div class="tk-shape"><div class="tk-body">${on ? `<span class="tk-eq" aria-hidden="true">${Array.from({ length: 22 }, (_, k) => `<i style="--k:${k};--h:${30 + ((k * 37) % 55)}%"></i>`).join("")}</span>` : ""}<i class="tk-hole" aria-hidden="true"></i>
        <p class="tk-stub is-${wd.toLowerCase()}"><span class="tk-wd">${wd}</span><b class="tk-day">${dayOf(e)}</b><span class="tk-time">${changed(e) ? `<span class="t-chg"><b class="t-new">${hhmm(e.start)}<i aria-hidden="true"></i>${hhmm(e.end)}</b><s class="t-old">${hhmm(e.o_start)}〜${hhmm(e.o_end)}</s></span>` : `${hhmm(e.start)}<i aria-hidden="true"></i>${hhmm(e.end)}`}</span></p>
        <div class="tk-main">
          ${tags.length ? `<p class="tk-tags">${tags.map((x) => `<span>${esc(x)}</span>`).join("")}</p>` : ""}
          <h3 class="tk-name${[...e.title].length > 8 ? " is-long" : ""}">${esc(e.title)}</h3>
          ${line ? `<p class="tk-copy">${esc(line).replace(/\n/g, "<br>")}</p>` : ""}
          <span class="tk-place">@${esc(venueName(e.venue))}</span>
        </div>
      </div></div>
      ${on ? '<span class="tk-badge is-now">NOW</span>' : isPast(e, t) ? '<span class="tk-badge is-end">終了</span>' : e.live ? '<span class="tk-badge is-live">LIVE</span>' : ""}
      ${photoStack(e)}
    </a>`;
}

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
