// map.html のためのスクリプト。トップページと同じデータ（企画・混雑・スタンプ・お知らせ）を地図に重ねる。
import "./site-text.js"; // 本部が変えた書体（ほかより先に読む）
import { onRallyChange } from "./rally-data.js";
import { FESTIVAL, EVENTS, STAGE } from "./config.js";
import { subscribeCrowd, subscribeLive, subscribeShops, countVisit } from "./live.js";
import { stampIds } from "./rally.js";
import { initMap, renderMap, setNotice, refreshRally } from "./map.js";
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
// 地図はすぐ出す（スタンプラリーの場所は、前に読んだもの＝このスマホに覚えたものを先に使い、Firestore から届いたら描き直す）
onRallyChange(refreshRally);
await initMap({ getState: () => ({ phase: phase(), now: nowMs(), running: phase() === "during" ? running() : [], crowd, stamps: stampIds(), agoText, shops, posts, postsErr }) });
subscribeCrowd((data) => { crowd = data; renderMap(); });
subscribeLive((data) => { live = data; renderMap(); }); // お知らせは、地図の画面には出さない
subscribeShops((list) => { shops = list; renderMap(); }); // 模擬店の待ち時間・売り切れ
// Enistagram（ポスト・レビュー・返信）は、Enistagram のタブを開いたときか、場所を押してシートが出たときに初めて読む
// （地図を見るだけの人の分、Firestore の読みこみを減らす）。一度読みはじめたら、あとはずっと届く
let postsOn = false;
function wantPosts() {
  if (postsOn) return;
  postsOn = true;
  watch.disconnect();
  subscribePosts((list, err) => { if (list) posts = list; postsErr = err ?? null; renderMap(); });
}
const needPosts = () => document.body.classList.contains("is-feed") || !document.getElementById("m-sheet")?.hidden;
const watch = new MutationObserver(() => { if (needPosts()) wantPosts(); });
watch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
const sheetEl = document.getElementById("m-sheet");
if (sheetEl) watch.observe(sheetEl, { attributes: true, attributeFilter: ["hidden"] });
if (needPosts()) wantPosts();
setInterval(renderMap, 30000);
setTimeout(countVisit, 4000); // 閲覧者数（地図から入った人も、1日1回だけ数える）
