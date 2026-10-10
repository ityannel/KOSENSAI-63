import { FESTIVAL } from "./config.js";

const params = new URLSearchParams(location.search);
const nowParam = params.get("now");
const now = nowParam ? new Date(nowParam.includes("+") ? nowParam : nowParam + "+09:00") : new Date();
const ymd = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);
const dayNo = (s) => Math.round(Date.parse(s + "T00:00:00Z") / 86400000);
const first = FESTIVAL.days[0], last = FESTIVAL.days.at(-1);
const today = ymd(now), left = dayNo(ymd(new Date(first.open))) - dayNo(today);
const hm = (iso) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

const HINTS = {
  10: ["高専祭まで、あと10日！", "テーマは「縁」。まずは、地図と出し物をのぞいてみよう"],
  9: ["あと9日！", "ステージの出演団体が、みどころで見られるよ"],
  8: ["あと8日！", "模擬店のお品書きを、縁日でチェック"],
  7: ["あと1週間！", "学科展示は5学科。どれから回るか、決めておこう"],
  6: ["あと6日！", "スタンプカードを、いまのうちに用意しよう"],
  5: ["あと5日！", "模擬店総選挙は、お店の扉のQRから投票できるよ"],
  4: ["あと4日！", "ご来場の皆さまへ：車でのご来場はご遠慮ください"],
  3: ["あと3日！", "ホーム画面に追加すると、当日すぐ開けるよ"],
  2: ["あと2日！", "地図で、行きたい場所に印をつけておこう"],
  1: ["いよいよ明日！", `開場は ${hm(first.open)}。お待ちしています`],
};

function message() {
  if (left >= 1 && left <= 10) return HINTS[left];
  if (left === 0 && now < new Date(first.close)) return ["今日は高専祭！", `${hm(first.open)}〜${hm(first.close)}　ステージは12:40から、第二体育館で`];
  if (today === ymd(new Date(last.open)) && now < new Date(last.close)) return ["高専祭、2日目！", `${hm(last.open)}〜${hm(last.close)}　花火は18:00から（学内の方限定）`];
  return null;
}

const m = message();
const KEY = "kosen63-daytoast";
let seen = null;
try { seen = localStorage.getItem(KEY); } catch {  }
if (m && (nowParam || seen !== today)) {
  try { localStorage.setItem(KEY, today); } catch {  }
  const icon = m[0].includes("まで") || /あと/.test(m[0]) ? "clock" : "flag";
  const n = { title: m[0], text: m[1], urgent: false, icon, font: "", size: "", bg: "", fg: "", link: null, daily: true };
  n.key = JSON.stringify(n);
  setTimeout(() => dispatchEvent(new CustomEvent("daily-notice", { detail: n })), 1800);
}
