// map.html のためのスクリプト。トップページと同じデータ（企画・混雑・スタンプ・お知らせ）を地図に重ねる。
import { FESTIVAL, EVENTS, STAGE } from "./config.js";
import { subscribeCrowd, subscribeLive, subscribeShops } from "./live.js";
import { stampIds } from "./rally.js";
import { initMap, renderMap, setNotice } from "./map.js";
import { subscribePosts } from "./posts.js";
import "./offline.js";

// ?now=2026-10-24T13:30 でその時刻として表示できる（トップページと同じ）
const params = new URLSearchParams(location.search);
const nowParam = params.get("now");
const offset = nowParam ? new Date(nowParam.includes("+") ? nowParam : nowParam + "+09:00") - Date.now() : 0;
const nowMs = () => Date.now() + offset;

const OPEN = Date.parse(FESTIVAL.days[0].open);
const CLOSE = Date.parse(FESTIVAL.days.at(-1).close);
const phase = () => (nowMs() < OPEN ? "before" : nowMs() > CLOSE ? "after" : "during");
// 本部が site_live/current の now_events を入れていれば、そちらを優先（トップページと同じ）
const within = (e, t) => Date.parse(e.start) <= t && t < Date.parse(e.end);
// ステージの時間の中は、いま出ている団体の名前にする（入れかわりの間は「ステージパフォーマンス」のまま）
const running = () => {
  if (live?.now_events?.length) return live.now_events;
  const t = nowMs();
  return EVENTS.filter((e) => within(e, t)).map((e) => {
    const a = e.stage && STAGE.acts.find((x) => within(x, t));
    return a ? { ...e, title: a.name, start: a.start, end: a.end } : e;
  });
};
const agoText = (ms) => {
  const min = Math.floor((nowMs() - ms) / 60000);
  return min < 1 ? "たった今" : min < 60 ? `${min}分前` : `${Math.floor(min / 60)}時間前`;
};

let crowd = null, live = null, shops = [], posts = null, postsErr = null; // posts は読みこむまで null
await initMap({ getState: () => ({ phase: phase(), now: nowMs(), running: phase() === "during" ? running() : [], crowd, stamps: stampIds(), agoText, shops, posts, postsErr }) });
subscribeCrowd((data) => { crowd = data; renderMap(); });
subscribeLive((data) => { live = data; setNotice(live?.notice); renderMap(); });
subscribeShops((list) => { shops = list; renderMap(); }); // 模擬店の待ち時間・売り切れ
subscribePosts((list, err) => { if (list) posts = list; postsErr = err ?? null; renderMap(); }); // Enistagram（ポスト・レビュー・返信）
setInterval(renderMap, 30000);
