import { applySchedule, SCHEDULE_KEY } from "./config.js";
import { subscribeSchedule } from "./live.js";

const FMT = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
export const hm = (iso) => FMT.format(new Date(iso));
export const changed = (e) => !!e && !!e.o_start && (e.start !== e.o_start || e.end !== e.o_end);
export const tStart = (e) => (e.o_start && e.start !== e.o_start
  ? `<span class="t-chg"><b class="t-new">${hm(e.start)}</b><s class="t-old">${hm(e.o_start)}</s></span>` : hm(e.start));
export const tEnd = (e) => (e.o_end && e.end !== e.o_end
  ? `<span class="t-chg"><b class="t-new">${hm(e.end)}</b><s class="t-old">${hm(e.o_end)}</s></span>` : hm(e.end));
export const tRange = (e, sep = "〜") => (changed(e)
  ? `<span class="t-chg"><b class="t-new">${hm(e.start)}${sep}${hm(e.end)}</b><s class="t-old">${hm(e.o_start)}${sep}${hm(e.o_end)}</s></span>` : `${hm(e.start)}${sep}${hm(e.end)}`);
export const tPlain = (e) => (e.o_start && e.start !== e.o_start ? `${hm(e.start)}（変更前 ${hm(e.o_start)}）` : hm(e.start));

export function watchSchedule(onChange) {
  let last = (() => { try { return localStorage.getItem(SCHEDULE_KEY) ?? "{}"; } catch { return "{}"; } })();
  subscribeSchedule((changes) => {
    const json = JSON.stringify(changes ?? {});
    if (json === last) return;
    last = json;
    try { localStorage.setItem(SCHEDULE_KEY, json); } catch {  }
    applySchedule(changes);
    if (onChange) return onChange(changes);
    const key = "kosen63-sched-reload";
    try { if (sessionStorage.getItem(key) === json) return; sessionStorage.setItem(key, json); } catch {  }
    location.reload();
  });
}
