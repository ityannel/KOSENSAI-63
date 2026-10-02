// スケジュールの変更の表示と受けとり。サイト（トップ・地図・みどころ）と会場ディスプレイで共通。
// 変えた時間は、新しい時間を大きく上に、もとの時間を小さく取り消し線で下に出す（.t-chg）
import { applySchedule, SCHEDULE_KEY } from "./config.js";
import { subscribeSchedule } from "./live.js";

const FMT = new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
export const hm = (iso) => FMT.format(new Date(iso));
export const changed = (e) => !!e && !!e.o_start && (e.start !== e.o_start || e.end !== e.o_end);
// 開始の時間だけ（変わっていれば、新しい時間の下に、もとの時間）
export const tStart = (e) => (e.o_start && e.start !== e.o_start
  ? `<span class="t-chg"><b class="t-new">${hm(e.start)}</b><s class="t-old">${hm(e.o_start)}</s></span>` : hm(e.start));
// 終わりの時間だけ
export const tEnd = (e) => (e.o_end && e.end !== e.o_end
  ? `<span class="t-chg"><b class="t-new">${hm(e.end)}</b><s class="t-old">${hm(e.o_end)}</s></span>` : hm(e.end));
// 開始〜終了（変わっていれば、新しい〜の下に、もとの〜）
export const tRange = (e, sep = "〜") => (changed(e)
  ? `<span class="t-chg"><b class="t-new">${hm(e.start)}${sep}${hm(e.end)}</b><s class="t-old">${hm(e.o_start)}${sep}${hm(e.o_end)}</s></span>` : `${hm(e.start)}${sep}${hm(e.end)}`);
// 文字だけで書くとき（検索の候補など）
export const tPlain = (e) => (e.o_start && e.start !== e.o_start ? `${hm(e.start)}（変更前 ${hm(e.o_start)}）` : hm(e.start));

// 変更を受けとる。onChange を渡すと、変更があったときに呼ぶ（会場ディスプレイは、画面を作りなおさず、次に読むときから新しい時間）。
// 渡さないとき（サイトのページ）は、この端末の表示と違う変更が届いたら、保存して1回だけ読みこみなおす
export function watchSchedule(onChange) {
  let last = (() => { try { return localStorage.getItem(SCHEDULE_KEY) ?? "{}"; } catch { return "{}"; } })();
  subscribeSchedule((changes) => {
    const json = JSON.stringify(changes ?? {});
    if (json === last) return;
    last = json;
    try { localStorage.setItem(SCHEDULE_KEY, json); } catch { /* 保存できない */ }
    applySchedule(changes);
    if (onChange) return onChange(changes);
    const key = "kosen63-sched-reload";
    try { if (sessionStorage.getItem(key) === json) return; sessionStorage.setItem(key, json); } catch { /* なし */ }
    location.reload();
  });
}
