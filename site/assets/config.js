
export const FESTIVAL = {
  edition: 63,
  theme: "縁",
  themeReading: "えにし",
  days: [
    { label: "10月24日(土)", open: "2026-10-24T12:00:00+09:00", close: "2026-10-24T16:00:00+09:00" },
    { label: "10月25日(日)", open: "2026-10-25T10:00:00+09:00", close: "2026-10-25T16:00:00+09:00" },
  ],
  instagram: "https://www.instagram.com/kosen_gakuseikai/",
  instagramId: "@KOSEN_GAKUSEIKAI",
};

export const NAV = [
  { label: "地図", href: "map.html" },
  { label: "混雑", href: "#crowd" },
  { label: "スタンプ", href: "#rally" },
  { label: "企画", href: "#guide" },
  { label: "みどころ", href: "#pickup" },
  { label: "来場案内", href: "#info" },
  { label: "協賛", href: "#sponsors" },
];

export const TOP_BLOCKS = [
  ["memory", "思い出", "高専祭が終わったあとだけ出る（Enistagram のいいね順）"],
  ["message", "学生主事より", "学生主事のことば（写真つき）"],
  ["stamp", "スタンプカード", "スタンプラリーの入口"],
  ["crowd", "いまの混雑", "本部が混雑を入れたときだけ出る"],
  ["pickup", "みどころ", "いま・次の企画のチケット"],
  ["ennichi", "縁日", "模擬店のチラシ"],
  ["exhibit", "学科展示", "5学科の展示（スクロールで順に開く）"],
  ["info", "ご来場の皆さまへ", "注意の札"],
  ["sponsors", "協賛", "協賛企業のロゴ"],
];
const P = (ids) => ids.map((t) => ({ id: t.replace(/^-/, ""), show: !t.startsWith("-") }));
export const DEPT_EXHIBITS = [
  { dept: "機械", color: "#D9892B", place: "ex-kikai", where: "生産システム総合演習室（A・Bゾーン）・実習工場",
    items: ["いったいどうなる！？ マシュマロ気圧実験", "うちわに次ぐ高専祭記念！ オリジナルキーホルダー", "機械と言えばここ？ 工場見学", "自分で作って的を撃て！ 輪ゴム銃製作"] },
  { dept: "電気電子", color: "#C9A11E", place: "ex-denki", where: "生産システム総合演習室（C・D・Eゾーン）",
    items: ["僕たち小さな発電所 ～作れ！回せ！光れ！～", "先輩たちから電気電子の基本を学ぼう！", "はんだ付けをして電子オルゴール、LED付き手回し発電機を作ろう！"] },
  { dept: "情報", color: "#3F8DB8", place: "ex-info", where: "第一会議室",
    items: ["学生が制作したシューティングゲーム", "暗号を解くタイムレース！", "プログラミングRPGで謎を解く", "二人協力型パズルゲーム", "情報分野からのクイズを出題"] },
  { dept: "物質環境", color: "#5E9C45", place: "ex-mat", where: "基礎物質工学実験室",
    items: ["体験してみよう！ これであなたも物質環境生！？", "つくってみよう！ とんぼ玉、偏光万華鏡", "みてみよう！ テルミット反応、液体窒素の不思議"] },
  { dept: "社会基盤", color: "#D8637A", place: "ex-civ1", where: "コンクリート実験室・正面ロータリー（雨の日は、C棟1階の橋梁実験室）",
    items: ["応用創造デザイン展示 ～みんなで街づくりについて考えてみよう！～", "上水道の仕組みについて ～みんなが毎日つかっている水道のしくみを知ろう！～", "木製橋実物展示 ～木材を三角形で組み立てた丈夫な橋を歩いてみよう！～", "なんでも相談室 ～函館高専ってどんな学校？ 在学生が色んな疑問に分かりやすくお答えします！～"] },
];

export const TOP_PRESETS = {
  before: P(["-memory", "message", "pickup", "ennichi", "exhibit", "info", "stamp", "-crowd", "sponsors"]),
  during: P(["memory", "stamp", "crowd", "pickup", "ennichi", "exhibit", "info", "message", "sponsors"]),
};

export const MESSAGE = {
  name: "平沢 学生主事",
  photo: "assets/img/hirasawa.webp",
  body: [
    "近年の日本の15歳人口は約100万人。",
    "このうち高専入学者数は約1万人。",
    "我らは僅か1%の価値ある精鋭。",
    "その50分の1が縁あってこの函館に集った。",
    "一人では困難な局面を、",
    "縁で導かれた皆のエネルギーで突破すべし。",
  ],
};

export const ABOUT = [
  "函館高専祭は、学生が企画・運営する年に一度のお祭りです。",
  "模擬店、学科展示、ステージパフォーマンスなど、2日間にわたって多彩な企画をお届けします。",
];

export const VENUES = [
  { id: "zacros", name: "第1講義室", alias: "ZACROS hall" },
  { id: "factory", name: "実習工場" },
  { id: "gym1", name: "第一体育館", alias: "東京水道アリーナ" },
  { id: "gym2", name: "第二体育館", alias: "太平洋セメントアリーナ" },
  { id: "cafeteria", name: "学食", alias: "二十一食堂" },
  { id: "library", name: "図書館", alias: "TSKEライブラリー" },
  { id: "entrance", name: "玄関ホール" },
  { id: "ground", name: "総合グラウンド" },
];

const CIVIL = "社会基盤工学科の展示：応用創造デザイン展示・上水道のしくみ・木製橋の実物展示・なんでも相談室（函館高専ってどんな学校？ 在学生が答えます）";

export const MAP = {
  places: [
    { id: "gym2", room: "M120", kind: "venue", name: "太平洋セメントアリーナ", sub: "第二体育館", desc: "ステージパフォーマンス・模擬店総選挙の結果発表・大抽選会" },
    { id: "gym1", room: "M111", kind: "venue", name: "東京水道アリーナ", sub: "第一体育館" },
    { id: "zacros", room: "L107", kind: "venue", name: "ZACROS hall", sub: "第1講義室" },
    { id: "factory", room: ["D102", "D101", "D103", "D104", "D105"], kind: "exhibit", dept: "機械", name: "実習工場見学", sub: "機械の学科展示", desc: "機械と言えばここ？ 工場見学・うちわに次ぐ高専祭記念！ オリジナルキーホルダー" },
    { id: "ex-kikai", room: "C101", area: [482, 104, 72, 44], kind: "exhibit", dept: "機械", name: "気圧実験と輪ゴム銃", sub: "機械の学科展示", desc: "いったいどうなる！？ マシュマロ気圧実験・自分で作って的を撃て！ 輪ゴム銃製作（A・Bゾーン）" },
    { id: "ex-denki", area: [554, 104, 34.5, 44], extra: [[527, 148, 61.5, 58]], floor: "1F", kind: "exhibit", dept: "電気電子", name: "僕たち小さな発電所", sub: "電気電子の学科展示", desc: "僕たち小さな発電所 ～作れ！回せ！光れ！～　先輩たちから電気電子の基本を学ぼう！ はんだ付けをして電子オルゴール、LED付き手回し発電機を作ろう！（C・D・Eゾーン）" },
    { id: "ex-info", room: "B101", kind: "exhibit", dept: "情報", name: "ゲームと謎解きの展示", sub: "情報の学科展示", desc: "学生が制作したシューティングゲーム・暗号を解くタイムレース！・プログラミングRPGで謎を解く・二人協力型パズルゲーム・情報分野からのクイズ" },
    { id: "ex-mat", room: "E108", kind: "exhibit", dept: "物質環境", name: "とんぼ玉と化学の実験", sub: "物質環境の学科展示", desc: "体験してみよう！ つくってみよう！とんぼ玉・偏光万華鏡／みてみよう！テルミット反応・液体窒素の不思議" },
    { id: "ex-civ1", room: "C113", kind: "exhibit", dept: "社会基盤", name: "コンクリートの実験", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ2", room: "C114", kind: "exhibit", dept: "社会基盤", name: "水の流れの実験", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ3", room: "C111", kind: "exhibit", dept: "社会基盤", name: "橋のしくみ", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ4", room: "C116", kind: "exhibit", dept: "社会基盤", name: "まちづくり", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ5", room: ["C117", "C118"], kind: "exhibit", dept: "社会基盤", name: "地盤のふしぎ", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-truss", floor: "1F", area: [162, 405, 149, 167], poly: [[172, 413], [196, 407], [231, 405], [258, 410], [284, 423], [303, 444], [311, 466], [308, 495], [297, 517], [281, 535], [263, 552], [250, 563], [228, 572], [210, 570], [199, 556], [184, 538], [174, 520], [165, 498], [162, 471], [164, 440]], kind: "exhibit", dept: "社会基盤", name: "木製応急トラス橋", sub: "正面玄関前（社会基盤の学科展示）", desc: "木製橋の実物展示。木材を三角形で組み立てた丈夫な橋を歩いてみよう！（社会基盤の学科展示）" },
    { id: "cafeteria", room: "G101", extra: [[180, 152, 24, 23], [204, 152, 11.5, 29]], kind: "venue", name: "二十一食堂", sub: "学食" },
    { id: "courtyard", floor: "1F", area: [432, 151, 92, 163], kind: "venue", name: "中庭", sub: "B棟とC棟のあいだ" },
    { id: "courtyard-shop", floor: "1F", area: [436, 289, 32, 24], kind: "shops", name: "中庭の屋台", sub: "中庭" },
    { id: "library", room: "F101", extra: [[158.5, 274, 48, 52]], kind: "venue", name: "TSKEライブラリー", sub: "図書館" },
    { id: "entrance", floor: "1F", area: [395.75, 422.6, 35.75, 31.4], extra: [[382, 434, 20, 20]], labelRect: [395.75, 422.6, 35.75, 13.4], kind: "venue", name: "玄関ホール", sub: "H棟 学生玄関" },
    { id: "lounge", floor: "1F", area: [382, 454, 20, 21], kind: "room", name: "ラウンジ", sub: "H棟 学生玄関の奥" },
    { id: "hq", floor: "1F", area: [402, 436, 22, 14], kind: "hq", name: "本部", sub: "救護・落とし物・景品交換" },
  ],
  spots: [
    { id: "gate", floor: "1F", at: [360, 1112], name: "正門" },
    { id: "h-gate", floor: "1F", at: [389, 445], name: "学生玄関" },
    { id: "b-corner", floor: "1F", at: [398.4, 323.75], name: "B棟1階 廊下の角" },
    { id: "c-corner", floor: "1F", at: [557.5, 323.75], name: "C棟1階 廊下の角" },
    { id: "k-gate", floor: "1F", at: [659, 588], name: "K棟 玄関" },
    { id: "gym-n", floor: "1F", at: [872, 352], name: "体育館 北玄関" },
    { id: "gym-s", floor: "1F", at: [865, 549], name: "東京水道アリーナ 玄関" },
    { id: "l-south", floor: "1F", at: [407, 570], name: "L棟 南口" },
    { id: "a-south", floor: "1F", at: [316.9, 362.5], name: "A棟 南口" },
    { id: "e-east", floor: "1F", at: [738, 345], name: "E棟 東口" },
    { id: "court-gate", floor: "1F", at: [484.7, 317], name: "中庭の入口" },
    { id: "lib-exit", floor: "1F", at: [175, 342.5], name: "TSKEライブラリー 出口" },
    { id: "g-east", floor: "1F", at: [215.5, 174], name: "二十一食堂 東口" },
  ],
};

export const CROWD = {
  venues: ["gym2", "entrance", "zacros"],
  short: { gym2: "体育館", entrance: "玄関", zacros: "講義室" },
  levels: [
    { label: "空いています", color: "#6CBAB5" },
    { label: "ふつう", color: "#F1D08A" },
    { label: "混雑しています", color: "#F2A96A" },
    { label: "入場制限中", color: "#E0655A" },
  ],
  staleMinutes: 30,
};

export const GUIDES = [
  { title: "構内装飾", desc: "校舎を彩るテーマ装飾", href: "#guide", icon: "装" },
  { title: "ステージパフォーマンス", desc: "タイムテーブルと出演者", href: "#schedule", icon: "舞" },
  { title: "花火", desc: "学内の方限定のご案内", href: "#guide", icon: "火", internal: true },
  { title: "学科展示", desc: "5学科の研究・作品展示", href: "map.html?list=exhibit", icon: "展" },
  { title: "模擬店", desc: "全模擬店の一覧と場所", href: "map.html?list=food", icon: "食" },
  { title: "抽選会", desc: "学内の方限定。景品と生配信のお知らせ", href: "#schedule", icon: "抽", internal: true },
];

export const EVENTS = [
  { title: "ステージパフォーマンス", venue: "gym2", start: "2026-10-24T12:40:00+09:00", end: "2026-10-24T15:50:00+09:00", stage: true },
  { title: "ステージパフォーマンス", venue: "gym2", start: "2026-10-25T10:40:00+09:00", end: "2026-10-25T14:50:00+09:00", stage: true },
  { title: "模擬店総選挙 結果発表", logo: "assets/img/logo-souse.webp", venue: "gym2", start: "2026-10-25T15:40:00+09:00", end: "2026-10-25T15:50:00+09:00", live: true, kind: "発表", copy: "校内随一の模擬店が、今ここに決まる…\n輝く栄光を手にするのは、いったいどこのお店だ！？\nYouTube でも生配信。" },
  { title: "大抽選会", logo: "assets/img/logo-chusen.webp", venue: "gym2", start: "2026-10-25T16:00:00+09:00", end: "2026-10-25T17:00:00+09:00", live: true, internal: true },
  { title: "花火", venue: "ground", start: "2026-10-25T18:00:00+09:00", end: "2026-10-25T18:30:00+09:00", internal: true, kind: "フィナーレ", copy: "高専祭のしめくくり。\n飛行機の都合で遅れることもあります。" },
];

export const LIST_EVENTS = [
  { title: "ティッシュ＆うちわ販売", venue: "専攻科棟1階", start: "2026-10-24T10:00:00+09:00", end: "2026-10-24T11:30:00+09:00", internal: true, kind: "販売", copy: "あなたの購入したティッシュが、\n豪華賞品に大変身しちゃうかも？" },
  { title: "ティッシュ＆うちわ販売", venue: "専攻科棟1階", start: "2026-10-25T08:30:00+09:00", end: "2026-10-25T09:45:00+09:00", internal: true, kind: "販売", copy: "あなたの購入したティッシュが、\n豪華賞品に大変身しちゃうかも？" },
  { title: "校内装飾", venue: "校内全域", start: "2026-10-24T12:00:00+09:00", end: "2026-10-24T16:00:00+09:00", kind: "展示", listOnly: true, copy: "1・2年生が彩る、\nにぎやかな花道へようこそ♪" },
  { title: "校内装飾", venue: "校内全域", start: "2026-10-25T10:00:00+09:00", end: "2026-10-25T16:00:00+09:00", kind: "展示", listOnly: true, copy: "1・2年生が彩る、\nにぎやかな花道へようこそ♪" },
];

const act = (day, start, end, name, kind, mood, copy, photo = null, more = [], insta = "") =>
  ({ name, kind, mood, copy, photo, more, insta, start: `2026-10-${day}T${start}:00+09:00`, end: `2026-10-${day}T${end}:00+09:00` });
export const STAGE = {
  venue: "gym2",
  tentative: false,
  acts: [
    act("24", "12:40", "13:10", "Endless bond", "バンド", "高専祭初ライブなのでぜひ見に来てほしいです！！！", "セットリスト\n本能\nおやすみ泣き声、さよなら歌姫\n丸の内サディスティック\n雪月花\n憂、燦々", "assets/img/stage/endless-bond.webp", [], "endless_bond__4"),
    act("24", "13:20", "13:45", "cresc.", "バンド", "", "5年生ですが今年でバンド2年目です。高専生活最後のステージ、全力で頑張るのでよろしくお願いします！！", null, [], "cresc_nit"),
    act("24", "13:55", "14:25", "MOSAiC", "バンド", "気合い十分ヤル気十分", "ASIAN KUNG-FU GENERATIONコピー", "assets/img/stage/mosaic.webp"),
    act("24", "14:35", "14:55", "+10せんち！", "バンド", "おまえら全員5Cこい", "", "assets/img/stage/plus10.webp"),
    act("24", "15:15", "15:30", "Neo abyss", "ダンス", "とりあえずダンスします！！", "皆さんこんにちは！3人組ダンスチームのNeoAbyssと申します！一昨年、昨年に引き続き今年も高専祭の舞台でダンスパフォーマンスをさせていただきます！皆さんが聞いたがあるかもしれない曲に合わせてパフォーマンスします！気になった人は是非足を運んでくださるととても嬉しいです！会場で待ってます！", "assets/img/stage/neo-abyss.webp", [], "neo__abyss"),
    act("24", "15:35", "15:50", "LunaTi☪︎³", "ダンス", "盛り上がれる曲たくさんなので見に来てね〜‼︎💕", "💗せっとりすと💗\nツインテールは20歳まで♡\nくりてぃかる♡ぷりちー \nころころガール\nキスハグ侵略者！\nらぶきゅん♡うぉんてっど\nアイドルライフエクストラパック", "assets/img/stage/luna-ti.webp", ["assets/img/stage/luna-ti-poster.webp"], "luna.tic_idol"),
    act("25", "10:40", "11:10", "イイカンジ", "", "", "こんにちは！ イイカンジです！ ステージパフォーマンス3年目の出演ということで、今回も超イイカンジに盛り上げて行きます！！ 是非見に来てください！", "assets/img/stage/iikanji.webp", [], "iika.nz"),
    act("25", "11:20", "11:50", "Criminals", "", "", ""),
    act("25", "12:00", "12:30", "ゴーストノート", "バンド", "オリジナル曲、あり", "🫵✨🫵✨これ🫵✨🫵✨が❗❗ブチ😡😡💢💢💣💣💥💥上がり☝️😁⤴️⤴️🕺✨🕺✨ゴースト👻💖👻💖たち🤪🤪のライブ🎤🎤🎸🎸🎶🎶だよ ❗❗😅😅💦💦🙏✨🙏✨", "assets/img/stage/ghost-note.webp", [], "gh0st_note4"),
    act("25", "12:40", "13:10", "疫病Jr.", "", "", ""),
    act("25", "13:30", "13:45", "Untitled", "ダンス", "解釈を光に、ステージへ。", "ヲタク文化への偏見を少しでも減らすために活動しています。\n去年同様、アニソン・ボカロを中心にヲタ芸をしていきます。\nヲタ芸以外の照明、演出等もご注目ください！！", "assets/img/stage/untitled.webp", [], "untitled_lightdance"),
    act("25", "13:50", "14:50", "ダンス愛好会", "ダンス", "一緒に盛り上がる準備は出来ていますか？今年も最高のステージをお届けします！", "", "assets/img/stage/dance.webp", [], "nit_dance_"),
  ],
};

export const HOMEROOMS_CONFIRMED = true;
export const HOMEROOMS = {
  "1-1": "L101", "1-2": "L102", "1-3": "L103", "1-4": "L201", "1-5": "L202",
  "2SM": "L301", "2C": "L302", "2SE": "L303", "2SJ": "L403", "2Z": "B104",
  "3SM": "H107", "3SJ": "B203", "3C": "L203", "3SE": "C212", "3Z": "B303",
  "4SM": "B304", "4SE": "C215", "4SJ": "H202", "4C": "B103", "4Z": "B204",
  "5SM": "C211", "5SE": "C216", "5SJ": "L402", "5C": "C203", "5Z": "C204",
};
export const DECOS = {
  themes: { 1: "海", 2: "自分たちの学科・コース" },
  vote: null,
  spots: [
    { cls: "1-1", floor: "2F", at: [413, 434] },
    { cls: "1-2", floor: "1F", at: [404, 462] },
    { cls: "1-3", floor: "1F", at: [582, 333] },
    { cls: "1-4", floor: "1F", at: [650, 334.5] },
    { cls: "1-5", floor: "2F", at: [405, 492] },
    { cls: "2C", floor: "1F", at: [400, 375] },
    { cls: "2Z", floor: "1F", at: [488, 322] },
    { cls: "2SJ", floor: "2F", at: [397, 322] },
    { cls: "2SE", floor: "2F", at: [478, 323] },
    { cls: "2SM", floor: "2F", at: [558, 332] },
  ],
};

export const ELECTION = {
  form: null,
  prefill: null,
  opens: "2026-10-24T12:00:00+09:00",
  closes: "2026-10-25T15:00:00+09:00",
};

export const GENRES = [
  { id: "しょっぱい系", color: "#a8612a" },
  { id: "甘い系", color: "#c9407a" },
  { id: "がっつり系", color: "#c0392b" },
  { id: "ピリ辛系", color: "#d9480f" },
  { id: "おやつ系", color: "#8a6bd1" },
  { id: "いやし系", color: "#2f8f8a" },
  { id: "ドリンク", color: "#2f6fc4" },
];
export const SHOPS = [
  { cls: "1-1", bldg: "L", floor: "1F", group: "5SJ", name: "5SJ お好み焼き", note: "すんごい美味しいです。\n来てね", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { cls: "1-2", bldg: "L", floor: "1F", group: "5SM", name: "麺屋 つちよし", note: "迷ったら油そば。\n腹が減ったら油そば\n高専祭を楽しむなら、油そば。", food: true, genre: ["がっつり系", "しょっぱい系"] },
  { cls: "1-3", bldg: "L", floor: "1F", group: "5SE", name: "電だこ", note: "たこ焼きとベビーカステラ\n売ってます！\nぜひ来てください🐙", food: true, genre: ["しょっぱい系", "おやつ系"] },
  { cls: "1-4", bldg: "L", floor: "2F", group: "5Z", name: "株式会社 チャーシュー組", note: "最大曲げモーメント！！\n肉の重みで橋がしなる、\n高強度チャーシュー丼！", food: true, genre: ["がっつり系"] },
  { cls: "1-5", bldg: "L", floor: "2F", group: "ソフトテニス部", name: "メロメロワッフル", note: "焼きたてふわふわ！\nトッピングも選べる絶品ワッフルを\n販売します。", food: true, genre: ["甘い系"] },
  { cls: "2SM", bldg: "L", floor: "3F", group: "硬式野球部", name: "野球部のやきそば", note: "学生といったらやきそば！\n野球部一同が丹精込めて作ります！\nぜひきてみてください", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { cls: "2SE", bldg: "L", floor: "3F", group: "女子バスケットボール部", name: "まきまきクレープ＆\nしましまパンケーキ", note: "今年も仮想をしてクレープや\nミニパンケーキを販売しています！\n店内では紹介動画も\n流しているので\nぜひ見に来てください！", food: true, genre: ["甘い系"] },
  { cls: "2C", bldg: "L", floor: "3F", group: "男子バスケットボール部", name: "Sip&Chill", note: "おしゃれな雰囲気の中かっこいい\n男子学生がとても美味しい\nドリンクを作っています", food: true, genre: ["ドリンク", "いやし系"] },
  { cls: "2Z", bldg: "B", floor: "1F", group: "モルック愛好会", name: "amazing SPA\nアメスパ☆", note: "イタリアンレストラン\nやってます♪", food: true, genre: ["がっつり系"] },
  { cls: "3SM", bldg: "H", floor: "1F", group: "5C", name: "めぇ～どちゅろす", note: "いらっしゃいませ🍀\nふわふわのひつじさんと\nメイドさんがあなたをお迎えします🎶\nかわいさときらめきが詰まった\n空間で、ちょっと特別な\nカフェタイムをお楽しみください✨", food: true, genre: ["甘い系", "いやし系"] },
  { cls: "3SE", bldg: "C", floor: "2F", group: "珈琲・お茶研究会", name: "喫茶 悦純", note: "お茶、コーヒー、お菓子を\n販売しています！\n他のお店で買った食べ物を持ち込んで\n食べることもできます！\nぜひ来てください！", food: true, genre: ["いやし系", "ドリンク", "おやつ系"] },
  { cls: "3SJ", bldg: "B", floor: "2F", group: "陸上競技部", name: "陸部のおにぎり", note: "食べると足が速くなる！？\n陸上部が丹精込めて作った\n焼きおにぎりです！", food: true, genre: ["しょっぱい系"] },
  { cls: "3C", bldg: "L", floor: "2F", group: "LSQ", name: "Nôteau - tian", note: "本格ポップコーン！！\n業務用マシン（6 万円）の美味しさを\nご堪能あれ！！\n電子部品アクセサリー！！\nロボコン(廃炉)参加生が\n心を込めて作りました！", food: true, genre: ["おやつ系"] },
  { cls: "3Z", bldg: "B", floor: "3F", group: "硬式テニス部", name: "テニス部学園", note: "赤点学習班", food: true, genre: ["甘い系", "ドリンク"] },
  { cls: "4SM", bldg: "B", floor: "3F", group: "創作部同好会", name: "函館高専から脱出せよ-", note: "謎解きに参加するだけで\nお菓子1 個ゲット！\n謎解きクリアでもう1 個ゲット！", food: false },
  { cls: "4SE", bldg: "C", floor: "2F", group: "プロコン研究会", name: "プロコン模擬店", note: "部員たちで作ったゲームで\n展示しています！", food: false },
  { cls: "4SJ", bldg: "H", floor: "2F", group: "ハンドボール部", name: "ハンドボール部\n特製ハニートースト", note: "ハニートースト売ってます！", food: true, genre: ["甘い系"] },
  { cls: "4C", bldg: "B", floor: "1F", group: "女子バレーボール部", name: "チェキ", note: "こんにちは！\n本日は、高専のゲーセン理想で気取って、頑張って営業します💽", food: false },
  { cls: "4Z", bldg: "B", floor: "2F", group: "卓球部", name: "熱いわんちゃん", note: "フランクフルトとホットドッグを販売しています！\nおいしいのでぜひ食べに来てください！", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { cls: "5SM", bldg: "C", floor: "2F", group: "アントレプレナー同好会", name: "クッキングミオ♡", note: "溢れる肉汁と爽やかなヨーグルトの香り。\n食べたら貴方もミオ・ザ・ワールドの仲間...\nさぁ ボナペティ...", food: true, genre: ["がっつり系"] },
  { cls: "5SE", bldg: "C", floor: "2F", group: "e-Sports 愛好会", name: "e-CURRY", note: "e-sports のe(良い)カレー\n食べませんか？", food: true, genre: ["がっつり系", "ピリ辛系"] },
  { cls: "5SJ", bldg: "L", floor: "4F", group: "軽音部", name: "Sound Lab 4F", note: "軽音部の模擬店ライブです！！\nたくさんのバンドで様々な\nサウンドを作ります！\nぜひ見に来てください！", food: false },
  { cls: "5C", bldg: "C", floor: "2F", group: "男子バレーボール部", name: "黄金バレー部の\n丑の刻参り", note: "函館高専初のお化け屋敷が始まります。\n17 年ぶりの全国を決めた男子バレー部が\n全国レベルの怖さをお届けします。", food: false },
  { cls: "5Z", bldg: "C", floor: "2F", group: "魚を釣って食べる会", name: "Restaurant.F.G.L", note: "食べて、見て、楽しめる！\n魚料理にこだわりのうどん、\nさらに手作りの革細工まで、\n個性あふれる商品を\n取り揃えています！\n高専祭の思い出に、\nResutaurant.F.G.L に\n寄っていってください", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { room: "E101", group: "ロボット研究会", name: "ロボット研究会", note: "ロボットを操縦してみない？\nロボ研のリアルな活動風景の\n展示＆賞品がもらえる\n操縦体験ゲーム開催！\n操縦テクニックを磨いて\n景品を手に入れよう！\nみんなの挑戦待ってます！", food: false },
  { room: "B106", group: "函館自動車学校", name: "運転シミュレーター", note: "自動運転シミュレーターなど", food: false },
  { place: "courtyard-shop", group: "ラグビー部", name: "やきとり処清", note: "ラグビー魂で焼く、熱いやきとり！！\nやきとり弁当（精肉）、\nやきとり単品（精肉、鳥皮）を提供します！\n味は塩とタレをご用意しております！", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { place: "cafeteria", group: "同窓会", name: "ホームカミングデー", note: "アルバム・写真の展示\n同窓会の活動紹介、同窓生との交流", food: false },
];
const SENTENCE_END = /(?:[。！？!?♪☆💽🍀🎶✨]|\.\.\.)$/u;
export const tidyNote = (t) => String(t ?? "").split(/\r?\n/).reduce((out, ln, i) => (i === 0 ? ln : out + (SENTENCE_END.test(out) ? "\n" : "") + ln), "");
for (const s of SHOPS) if (s.note) s.note = tidyNote(s.note);


export const PICKUP_SHOPS = [];
export const PICKUP_EVENTS = [
  { name: "ステージパフォーマンス", venue: "gym2", when: "10/24 12:40〜・10/25 10:40〜", note: "バンド・ダンス・有志企画" },
  { name: "模擬店総選挙 結果発表", venue: "gym2", when: "10/25 15:40〜", note: "YouTube で生配信" },
];

export const VISIT = [
  { icon: "clock", title: "公開は{close}まで", detail: "一般公開は両日とも{close}まで。終わったら、校内には残れません。" },
  { icon: "car", title: "車でのご来場はご遠慮ください", detail: "駐車場が限られています。市電やバスなどの公共交通機関でお越しください。函館大学や近隣のコンビニ・スーパーには停めないで！" },
  { icon: "fire", title: "グラウンドは立ち入り禁止", detail: "10.25 13:00から、グラウンドで花火の準備をします。ロープの内側に入らないで！" },
  { icon: "camera", title: "どんどん撮って投稿しよう", detail: "Enistagram に投稿してね！人や企業ブースを撮るときは、ひとこと聞いてから。撮影禁止の展示は撮らないで。" },
  { icon: "mic", title: "モッシュ・ダイブ禁止", detail: "ステージに上がるのも禁止です。お酒・たばこは持ちこめません。水性フォグ液のスモーク演出があります。気管支に問題のある方は、ご注意ください。" },
  { icon: "vote", title: "総選挙はだれでも投票", detail: "お店の扉のQRから、Forms でそのお店に投票できます。1人1票。{voteEnd}まで。" },
  { icon: "exit", title: "火事のときはグラウンドへ", detail: "スタッフの誘導に従って、あわてずに避難してください。" },
  { icon: "nosmoke", title: "校内は全面禁煙", detail: "校舎の中も外も、敷地の中はすべて禁煙です。" },
];

export const NOTICES = [
  "校内は全面禁煙です。",
  "駐車場が限られています。車でのご来場はご遠慮ください。",
  "体調が悪くなったら、近くのスタッフか本部へ。",
];

export const GARBAGE = [
  { kind: "燃えるごみ", examples: "紙皿・割り箸・ティッシュ", color: "#E5484D" },
  { kind: "プラスチック", examples: "容器・フォーク・袋", color: "#3E8ED0" },
  { kind: "缶・びん・ペットボトル", examples: "キャップは外してプラへ", color: "#2E9F5B" },
];

export const LEGAL = { takedownForm: "" };

export const SPONSORS = {
  count: 0,
  list: [
    { name: "NORTHWAVE（架空）", logo: "assets/img/sponsors/dummy-northwave.svg" },
    { name: "はこだて電機（架空）", logo: "assets/img/sponsors/dummy-hakodate-denki.svg" },
    { name: "北海みらい建設（架空）", logo: "assets/img/sponsors/dummy-hokkai-kensetsu.svg" },
    { name: "aurora systems（架空）", logo: "assets/img/sponsors/dummy-aurora.svg" },
    { name: "函館ベイ食品（架空）", logo: "assets/img/sponsors/dummy-bay-foods.svg" },
    { name: "いさりび通信（架空）", logo: "assets/img/sponsors/dummy-isaribi.svg" },
    { name: "TSUGARU MOTORS（架空）", logo: "assets/img/sponsors/dummy-tsugaru-motors.svg" },
    { name: "五稜精機（架空）", logo: "assets/img/sponsors/dummy-goryo-seiki.svg" },
  ],
};

export const RALLY = {
  goal: 5,
  prize: "本部でお菓子と交換できます（なくなりしだい終了）",
  claimPlace: "玄関ホールの本部",
  shops: [
    { id: "test-1", name: "テスト店1", codes: { "*": "b348ac37e62946d848d19ca289406ff374168afa487e90045c0bf8531498b7f0" } },
    { id: "test-2", name: "テスト店2", codes: { "*": "f037f1536dd5e456cd4d0f2065bf47b940ea40c1b4052c5d4f8b9edcaade922d" } },
    { id: "test-3", name: "テスト店3", codes: { "*": "ad49e30973257190008bb5b85fd59a7d45b1030883c91a15e176706058578dac" } },
  ],
  staffPin: { salt: "a7c46213a4132f45007045a91991d333", iterations: 300000, hash: "6388520adc2af640425da9bcce853924c4887f02f4f41c8cb21c0f756da28073" },
};

export const STAMP_PLACES = [
  { id: "gym-n", kind: "venue", name: "体育館入り口", group: "体育館", place: "gym-n" },
  { id: "hq", kind: "info", name: "インフォメーション", group: "本部", place: "hq", where: "玄関ホール" },
  { id: "library", kind: "venue", name: "TSKEライブラリー", group: "図書館", place: "library" },
  { id: "gate", kind: "venue", name: "正門", group: "入口", place: "gate" },
  { id: "zacros", kind: "venue", name: "ZACROS hall前", group: "第1講義室", place: "zacros" },
  { id: "noto-lab", kind: "venue", name: "能登研究室前", group: "研究室" },
];
export const SIGNAGE = {
  spots: {
    lecture1: { name: "第1講義室の前", here: "L107", tentative: true, routes: [
      { to: "gym2", dir: "right", say: "廊下を出て、まっすぐ", min: 4 },
      { to: "hq", dir: "up", say: "玄関ホールへ", min: 2 },
      { to: "shops", dir: "upleft", say: "L棟の各階へ", min: 1 },
      { to: "exhibit", dir: "up", say: "C棟・D棟へ", min: 3 },
      { to: "cafeteria", dir: "left", say: "二十一食堂へ", min: 4 },
      { to: "ground", dir: "right", say: "外へ出て、グラウンドへ", min: 6 },
    ] },
    soumu: { name: "総務課の横の廊下の角", here: "h-gate", tentative: true, routes: [
      { to: "gym2", dir: "right", say: "廊下をまっすぐ", min: 3 },
      { to: "hq", dir: "down", say: "玄関ホールへ", min: 1 },
      { to: "courtyard", dir: "up", say: "中庭へ", min: 2 },
      { to: "exhibit", dir: "upright", say: "各学科の展示へ", min: 2 },
      { to: "library", dir: "left", say: "TSKEライブラリーへ", min: 3 },
      { to: "ground", dir: "right", say: "外へ出て、グラウンドへ", min: 6 },
    ] },
    info: { name: "インフォメーションの前", here: "h-gate", tentative: true, routes: [
      { to: "gym2", dir: "right", say: "外の通路を、まっすぐ", min: 4 },
      { to: "zacros", dir: "down", say: "第1講義室へ", min: 3 },
      { to: "shops", dir: "up", say: "模擬店のある棟へ", min: 2 },
      { to: "courtyard", dir: "upright", say: "中庭へ", min: 2 },
      { to: "library", dir: "left", say: "TSKEライブラリーへ", min: 4 },
      { to: "ground", dir: "right", say: "外の通路を、グラウンドへ", min: 6 },
    ] },
  },
  dests: {
    gym2: { name: "ステージ", sub: "太平洋セメントアリーナ（第二体育館）", mark: "mic" },
    zacros: { name: "ZACROS hall", sub: "第1講義室", mark: "building" },
    hq: { name: "インフォメーション・本部", sub: "玄関ホール", mark: "info" },
    shops: { name: "模擬店", sub: "各クラスの教室", mark: "store" },
    exhibit: { name: "学科展示", sub: "5学科の研究・作品", mark: "flask" },
    cafeteria: { name: "二十一食堂", sub: "学食", mark: "bowl" },
    courtyard: { name: "中庭", sub: "B棟とC棟のあいだ", mark: "leaf" },
    library: { name: "TSKEライブラリー", sub: "図書館", mark: "book" },
    ground: { name: "総合グラウンド", sub: "花火（学内の方限定）", mark: "firework" },
  },
};

export const shopIdOf = (sh) => String(sh.cls ?? sh.room ?? sh.place ?? sh.name).toLowerCase().replace(/[^a-z0-9_-]/g, "");

export const FX = {
  weather: { lat: 41.82, lon: 140.75, refreshMinutes: 15 },
  fireworks: { start: "2026-10-25T18:00:00+09:00", minutes: 30 },
};

export const SECRETS = {
  reward: "ポスターの壁紙をどうぞ。見つけてくれてありがとう！",
  wallpaper: "assets/img/wallpaper.jpg",
};

export const SCHEDULE_KEY = "kosen63-schedule";
const ORIG_ACTS = [...STAGE.acts], ORIG_EVENTS = [...EVENTS];
const origItems = () => [["a", ORIG_ACTS], ["e", ORIG_EVENTS]].flatMap(([k, list]) => list.map((x) => [k, x]));
{
  const seen = new Map();
  for (const [k, x] of origItems()) {
    const base = `${k}${String(x.start).replace(/\D/g, "").slice(0, 12)}`, n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    x.sid = n ? `${base}_${n}` : base;
    x.o_start = x.start; x.o_end = x.end;
  }
}
let ADDED = [];
export const scheduleItems = () => [...origItems().map(([kind, item]) => ({ kind, item })), ...ADDED];
const okIso = (s) => typeof s === "string" && Number.isFinite(Date.parse(s));
const clip = (s, n) => String(s ?? "").slice(0, n);
export function applySchedule(changes) {
  const added = [];
  for (const [key, c] of Object.entries(changes ?? {})) {
    if (!key.startsWith("+") || !c || typeof c !== "object" || !okIso(c.start) || !okIso(c.end) || Date.parse(c.end) <= Date.parse(c.start) || !clip(c.title, 1)) continue;
    const base = { sid: key, start: c.start, end: c.end, o_start: c.start, o_end: c.end, added: true };
    if (c.k === "a") added.push({ kind: "a", item: { ...base, name: clip(c.title, 40), kind: clip(c.tag, 12), mood: clip(c.text, 200), copy: "", photo: null, more: [], insta: "" } });
    else added.push({ kind: "e", item: { ...base, title: clip(c.title, 40), venue: VENUES.some((v) => v.id === c.venue) ? c.venue : STAGE.venue, kind: clip(c.tag, 12), copy: clip(c.text, 200) } });
  }
  ADDED = added;
  for (const [, x] of origItems()) {
    const c = changes?.[x.sid];
    x.start = c?.start ?? x.o_start; x.end = c?.end ?? x.o_end; x.deleted = !!c?.deleted;
  }
  const byStart = (a, b) => Date.parse(a.start) - Date.parse(b.start);
  const addedActs = added.filter((x) => x.kind === "a").map((x) => x.item), addedEvents = added.filter((x) => x.kind === "e").map((x) => x.item);
  const acts = [...ORIG_ACTS.filter((x) => !x.deleted), ...addedActs], events = [...ORIG_EVENTS.filter((x) => !x.deleted), ...addedEvents];
  if (addedActs.length) acts.sort(byStart);
  if (addedEvents.length) events.sort(byStart);
  STAGE.acts.splice(0, STAGE.acts.length, ...acts);
  EVENTS.splice(0, EVENTS.length, ...events);
}
try { applySchedule(JSON.parse(localStorage.getItem(SCHEDULE_KEY) ?? "{}")); } catch {  }
