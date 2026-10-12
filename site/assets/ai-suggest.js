import { SHOPS, VENUES, STAGE, EVENTS, LIST_EVENTS, DEPT_EXHIBITS, GENRES } from "./config.js";
import { BUILDINGS, ROOM_NAMES } from "./campus.js";
import { esc } from "./ai-core.js";

const BASE = `
いまやってるステージは？
次のステージは？
今日のみどころは？
今日の最後のステージは？
明日のステージは？
ステージの出演者を教えて
ステージのタイムテーブルは？
いまから1時間のプランを作って
いまから30分で回れる所は？
2時間で回るプランを作って
子どもと楽しめるところは？
友達と回るおすすめは？
ひとりで楽しめる所は？
デートにおすすめの場所は？
初めて来たけど、どこから行けばいい？
いちばん人気のお店は？
いま空いてる模擬店は？
待ち時間が短いお店は？
いま売り切れのお店は？
おすすめの食べ物は？
甘いものが食べたい
がっつり食べたい
辛いものが食べたい
飲み物が飲みたい
おやつにいいものは？
食べ歩きできるものは？
座って食べられる場所は？
学食は開いてる？
ごはんが食べたい
お腹がすいた
のどがかわいた
トイレはどこ？
いちばん近いトイレは？
多目的トイレはどこ？
車いすで入れるトイレは？
おむつ替えができる場所は？
女子トイレはどこ？
男子トイレはどこ？
休める場所はある？
座って休みたい
体調が悪い
けがをした
気分が悪い
迷子になった
友達とはぐれた
子どもとはぐれた
落とし物をした
落とし物を見つけた
忘れ物をした
本部はどこ？
本部に連絡したい
保健室はどこ？
救護所はある？
AEDはどこ？
火事のときはどうすればいい？
避難場所はどこ？
入口はどこ？
玄関はどこ？
出口はどこ？
体育館への行き方
グラウンドへの行き方
学食への行き方
図書館への行き方
今日は何時まで？
開場は何時？
閉場は何時？
明日は何時から？
いつまでやってる？
一般公開は何時まで？
終わったら校内に残れる？
駐車場はある？
車で行ってもいい？
バスで行くには？
市電で行くには？
どうやって来ればいい？
住所を教えて
最寄りの駅は？
入場料はかかる？
予約は必要？
チケットは必要？
スタンプラリーって何？
スタンプラリーの景品は？
スタンプはどこで押せる？
スタンプはいくつ集める？
景品はどこで交換できる？
模擬店総選挙って何？
総選挙の投票方法は？
総選挙の投票はいつまで？
総選挙の結果発表はいつ？
大抽選会はいつ？
大抽選会の参加方法は？
花火は見られる？
花火は何時から？
花火の場所は？
グラウンドに入ってもいい？
写真を撮ってもいい？
撮影禁止の場所は？
Enistagramって何？
Enistagramに投稿するには？
SNSにあげてもいい？
モッシュやダイブはしていい？
ステージに上がってもいい？
お酒は持ちこめる？
たばこは吸える？
喫煙所はある？
スモーク演出って何？
ごみはどこに捨てる？
ごみの分別を教えて
燃えるごみは何？
学科展示って何？
学科展示はどこ？
5つの学科を教えて
工場見学はできる？
体験できる展示は？
子どもが体験できる展示は？
校内装飾って何？
装飾はどこで見られる？
隠し縁って何？
ひみつの場所を教えて
ひみつを見つけるヒントは？
ティッシュとうちわはどこで買える？
うちわはどこで売ってる？
記念グッズはある？
この学校ってどんな学校？
高専って何？
函館高専に入るには？
学校の説明を聞きたい
ここの学科について知りたい
学生会って何？
高専祭って何？
今年のテーマは？
縁ってどういう意味？
天気はどう？
いまの天気は？
雨が降ったらどうなる？
傘はいる？
寒い？
何を着ていけばいい？
持ち物は？
英語で案内してほしい
Where is the restroom?
What time does it close?
Where can I eat?
荷物を預けられる？
ベビーカーで回れる？
階段を使わないで行ける？
エレベーターはどこ？
段差はある？
ペットは連れていける？
赤ちゃんと行っても大丈夫？
おじいちゃんおばあちゃんと回れる？
充電できる場所は？
Wi-Fiはある？
現金は必要？
キャッシュレスは使える？
ATMはある？
自販機はどこ？
売店はどこ？
コンビニは近くにある？
近くのスーパーは？
展示を見て回りたい
ライブを見たい
音楽が聞きたい
ダンスが見たい
バンドの出演はいつ？
ダンスの出演はいつ？
ライブ配信はある？
YouTubeで見られる？
スタッフに声をかけたい
スタッフの見分け方は？
困ったときは？
問い合わせ先は？
学校の電話番号は？
本部への連絡のしかた
`.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const short = (s, n = 24) => (s.length > n ? `${s.slice(0, n)}…` : s);
const GENERIC = /^(講義室|教員室|倉庫|準備室|器具庫|書庫|機械室|事務室|空室|WC|多目的WC|[A-Z]\d{3}|.*更衣室|.*(研究室|実験室|卒研室).*\d?)$/;

const POOL = (() => {
  const set = new Set(BASE);
  const add = (t) => set.add(t);
  for (const v of VENUES) {
    const n = clean(v.alias ?? v.name);
    for (const t of ["への行き方", "は、いま何やってる？", "は、いま混んでる？", "の近くのトイレは？", "はどこ？", "の近くにお店はある？", "で今日やることは？", "は何階？"]) add(`${n}${t}`);
    if (v.alias) add(`${clean(v.name)}はどこ？`);
  }
  for (const s of SHOPS) {
    const n = clean(s.name);
    if (!n) continue;
    for (const t of ["は、いま混んでる？", "はどこ？", "の待ち時間は？", "は何が売ってる？", "はまだやってる？", "のおすすめは？", "に行きたい", "は売り切れてない？", "の団体を教えて", "の場所を教えて", "を食べたい"]) add(`${n}${t}`);
    if (s.group) add(`${clean(s.group)}のお店はどこ？`);
  }
  for (const a of STAGE.acts) {
    const n = short(clean(a.name));
    for (const t of ["は何時から？", "は何時まで？", "はどこでやる？", "ってどんなステージ？", "の次は誰？", "を見に行きたい", "の紹介を教えて"]) add(`${n}${t}`);
  }
  for (const e of [...EVENTS, ...LIST_EVENTS]) {
    const n = short(clean(e.title));
    for (const t of ["は何時から？", "はどこでやる？", "ってどんな企画？", "に行きたい", "は誰でも参加できる？"]) add(`${n}${t}`);
  }
  for (const d of DEPT_EXHIBITS) {
    for (const t of ["の展示は何がある？", "の展示はどこ？", "の展示は体験できる？", "の展示のおすすめは？", "の展示に行きたい"]) add(`${d.dept}${t}`);
    for (const it of d.items ?? []) {
      const n = short(clean(it).replace(/[！？!?]/g, ""), 20);
      add(`${n}はどこでやってる？`);
      add(`${n}ってなに？`);
    }
  }
  for (const b of BUILDINGS) {
    if (!/^[A-Z]$/.test(b.id)) continue;
    for (const t of ["棟はどこ？", "棟のトイレは？", "棟には何がある？", "棟の入口は？", "棟にエレベーターはある？", "棟に行きたい", "棟の近くのお店は？"]) add(`${b.id}${t}`);
  }
  for (const g of GENRES) {
    const n = clean(g.id);
    for (const t of ["のお店はどこ？", "のお店で空いてる所は？", "のおすすめは？", "が食べたい"]) add(`${n}${t}`);
  }
  for (const n of new Set(Object.values(ROOM_NAMES))) {
    if (!n || GENERIC.test(n) || /WC/.test(n)) continue;
    add(`${short(n, 22)}はどこ？`);
  }
  for (let h = 9; h <= 18; h++) {
    add(`${h}時のステージは？`);
    add(`${h}時からやってる企画は？`);
    add(`${h}時に行ける所は？`);
  }
  for (const d of ["10月24日", "10月25日", "1日目", "2日目", "土曜日", "日曜日"]) {
    for (const t of ["のステージは？", "の予定は？", "の見どころは？", "のお店は？", "は何時から？"]) add(`${d}${t}`);
  }
  return [...set];
})();
const norm = (s) => s.toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/\s+/g, "");

export function suggestFor(text, max = 4) {
  const q = norm(text);
  if (!q) return [];
  const hits = [];
  for (const c of POOL) {
    const i = norm(c).indexOf(q);
    if (i >= 0) hits.push([i, c.length, c]);
  }
  return hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, max).map((h) => h[2]);
}

export function attachSuggest({ input, mount, onPick }) {
  const hide = () => { mount.hidden = true; mount.innerHTML = ""; };
  const refresh = () => {
    const list = suggestFor(input.value);
    if (!list.length) { hide(); return; }
    mount.innerHTML = list.map((q) => `<button type="button" data-sug="${esc(q)}">${esc(q)}</button>`).join("");
    mount.hidden = false;
  };
  mount.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-sug]")) e.preventDefault(); });
  mount.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sug]");
    if (!b) return;
    hide();
    onPick(b.dataset.sug);
  });
  input.addEventListener("input", refresh);
  return { hide, refresh };
}
