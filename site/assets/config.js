// =====================================================
//  第63回 函館高専祭 サイト設定
//  文章・日程・企画の中身はここを書き換えるだけで反映されます。
//  「【仮】」と付いているものは未確定のダミーです。
// =====================================================

export const FESTIVAL = {
  edition: 63,
  theme: "縁",
  themeReading: "えにし",
  // 各日の公開時間（日本時間）。要項のとおり両日とも 16:00 まで（ポスターの 17:00 ではない）
  days: [
    { label: "10月24日(土)", open: "2026-10-24T12:00:00+09:00", close: "2026-10-24T16:00:00+09:00" },
    { label: "10月25日(日)", open: "2026-10-25T10:00:00+09:00", close: "2026-10-25T16:00:00+09:00" },
  ],
  instagram: "https://www.instagram.com/kosen_gakuseikai/",
  instagramId: "@KOSEN_GAKUSEIKAI",
};

// メニュー。PCではポスターの電線に短冊として吊るされる（縦書きになるので短い言葉で）
export const NAV = [
  { label: "地図", href: "map.html" },
  { label: "混雑", href: "#crowd" },
  { label: "スタンプ", href: "#rally" },
  { label: "企画", href: "#guide" },
  { label: "みどころ", href: "#pickup" },
  { label: "来場案内", href: "#info" },
  { label: "協賛", href: "#sponsors" },
];

// 学生主事メッセージ（トップページの絵の下のカード）。body は1行ずつ（Figma のとおりに改行する）
// トップページの欄（絵の下に並ぶもの）。この順がいつもの並び。本部コンソールの「サイトの設定」で並べかえ・出す／出さないを変えられる
// [名前, 本部コンソールに出す名前, 説明]。名前は index.html の data-block と同じ
export const TOP_BLOCKS = [
  ["message", "学生主事より", "学生主事のことば（写真つき）"],
  ["stamp", "スタンプカード", "スタンプラリーの入口"],
  ["crowd", "いまの混雑", "本部が混雑を入れたときだけ出る"],
  ["pickup", "みどころ", "いま・次の企画のチケット"],
  ["ennichi", "縁日", "模擬店のチラシ"],
  ["info", "ご来場の皆さまへ", "注意の札"],
  ["sponsors", "協賛", "協賛企業のロゴ"],
];
// 並びのプリセット（本部コンソールで保存したものがなければ、これ）。開催前は学生主事よりが先、期間中はスタンプカード・混雑が先
const P = (ids) => ids.map((t) => ({ id: t.replace(/^-/, ""), show: !t.startsWith("-") }));
export const TOP_PRESETS = {
  before: P(["message", "pickup", "ennichi", "info", "stamp", "-crowd", "sponsors"]),
  during: P(["stamp", "crowd", "pickup", "ennichi", "info", "message", "sponsors"]),
};

export const MESSAGE = {
  name: "平沢 学生主事",
  photo: "assets/img/hirasawa.webp", // 背景を切り抜いた写真（カードの右下）
  body: [
    "近年の日本の15歳人口は約100万人。",
    "このうち高専入学者数は約1万人。",
    "我らは僅か1%の価値ある精鋭。",
    "その50分の1が縁あってこの函館に集った。",
    "一人では困難な局面を、",
    "縁で導かれた皆のエネルギーで突破すべし。",
  ],
};

// 高専祭の概要【仮】
export const ABOUT = [
  "函館高専祭は、学生が企画・運営する年に一度のお祭りです。",
  "模擬店、学科展示、ステージパフォーマンスなど、2日間にわたって多彩な企画をお届けします。",
];

// 会場（協定を結んでいる教室）
// alias を書くと「alias（name）」の形で表示されます。alias はネーミングライツの愛称（学校の「ネーミングライツ・広告パートナー」のページのとおり）
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

// 校内マップ：お祭りの場所（建物・部屋・道の図は campus.js、部屋番号は「学生生活の手引き」の平面図のもの）
// room: その部屋を会場として色を変えて名前を出す（extra: 部屋番号の無い部分を足す）。area: [左, 上, 幅, 高さ] は部屋ではない広い場所（floor も書く）
// kind: venue 会場 / exhibit 展示 / hq 本部
// 企画（EVENTS）・注目の模擬店（PICKUP_*）は venue、スタンプのお店は shops で場所につながる。
// 社会基盤工学科の展示（5か所とも同じ説明）
const CIVIL = "体験して発見！未来をつくる社会基盤のチカラ！　5つの展示のうち3つのスタンプを集めると景品がもらえます";

export const MAP = {
  // tentative: true の場所は、まだ仮なので地図に「【仮】」と出す。room は1つか、部屋番号の配列
  places: [
    { id: "gym2", room: "M120", kind: "venue", name: "太平洋セメントアリーナ", sub: "第二体育館", desc: "ステージパフォーマンス・模擬店総選挙の結果発表・大抽選会" },
    { id: "gym1", room: "M111", kind: "venue", name: "東京水道アリーナ", sub: "第一体育館" },
    { id: "zacros", room: "L107", kind: "venue", name: "ZACROS hall", sub: "第1講義室", desc: "協賛企業の企業セミナー・製品展示（10/24・25 12:00〜16:00）" },
    { id: "factory", room: ["D102", "D101", "D103", "D104", "D105"], kind: "exhibit", dept: "機械", name: "実習工場見学", sub: "機械の学科展示", desc: "実習工場ミニ見学・実習工場で作った手作りキーホルダーの販売" },
    { id: "ex-c101", room: "C101", extra: [[527, 148, 61.5, 58]], kind: "exhibit", dept: "機械・電気", name: "ラジオ工作と電気の体験", sub: "機械・電気の学科展示", desc: "自分だけのラジオを作ろう（はんだ付け体験）・電気電子の体験展示・おいしい気圧変化実験・輪ゴム銃射的" },
    { id: "ex-info", room: "B101", kind: "exhibit", dept: "情報", name: "ゲームとアプリの展示", sub: "情報の学科展示", desc: "Microbit・C言語チャットアプリ・ゲーム・見てわかるアルゴリズム・ハイスコアを競え！ など" },
    { id: "ex-mat", room: "E108", kind: "exhibit", dept: "物質環境", name: "結晶と化学の実験", sub: "物質環境の学科展示", desc: "体験！物質環境工学科　ビスマス結晶・トンボ玉づくり、象の歯磨き粉・テルミット反応・巨大シャボン玉" },
    { id: "ex-civ1", room: "C113", kind: "exhibit", dept: "社会基盤", name: "コンクリートの実験", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ2", room: "C114", kind: "exhibit", dept: "社会基盤", name: "水の流れの実験", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ3", room: "C111", kind: "exhibit", dept: "社会基盤", name: "橋のしくみ", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ4", room: "C116", kind: "exhibit", dept: "社会基盤", name: "まちづくり", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "ex-civ5", room: ["C117", "C118"], kind: "exhibit", dept: "社会基盤", name: "地盤のふしぎ", sub: "社会基盤の学科展示", desc: CIVIL },
    { id: "cafeteria", room: "G101", extra: [[180, 152, 24, 23], [204, 152, 11.5, 29]], kind: "venue", name: "二十一食堂", sub: "学食" },
    { id: "courtyard", floor: "1F", area: [432, 151, 92, 163], kind: "venue", name: "中庭", sub: "B棟とC棟のあいだ" },
    // 中庭の屋台（入口の近く・左寄り。教室くらいの大きさ）
    { id: "courtyard-shop", floor: "1F", area: [436, 289, 32, 24], kind: "shops", name: "中庭の屋台", sub: "中庭" },
    { id: "library", room: "F101", extra: [[158.5, 274, 48, 52]], kind: "venue", name: "TSKEライブラリー", sub: "図書館" },
    { id: "entrance", floor: "1F", area: [395.75, 422.6, 35.75, 31.4], extra: [[382, 434, 20, 20]], labelRect: [395.75, 422.6, 35.75, 13.4], kind: "venue", name: "玄関ホール", sub: "H棟 学生玄関" },
    { id: "lounge", floor: "1F", area: [382, 454, 20, 21], kind: "room", name: "ラウンジ", sub: "H棟 学生玄関の奥" },
    { id: "hq", floor: "1F", area: [402, 436, 22, 14], kind: "hq", name: "本部", sub: "救護・落とし物・景品交換" },
  ],
  // 「いまここ」QR を貼る場所（入口・廊下の角）。QR は map.html?here=ID（部屋番号 map.html?here=L107 でもよい）
  // at は campus.js と同じ座標
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

// 混雑状況を出す会場（本部が staff/crowd.html から切り替える）
export const CROWD = {
  venues: ["gym2", "entrance", "zacros"], // 「体育館」はステージのある第二体育館（太平洋セメントアリーナ）
  short: { gym2: "体育館", entrance: "玄関", zacros: "講義室" }, // 電柱の看板に出す短い名前
  levels: [
    { label: "空いています", color: "#6CBAB5" },
    { label: "ふつう", color: "#F1D08A" },
    { label: "混雑しています", color: "#F2A96A" },
    { label: "入場制限中", color: "#E0655A" },
  ],
  staleMinutes: 30, // これ以上更新がないと「情報が古い」と出す
};

// 案内の分岐（詳しいページがまだ無いものは、ひとまずこのパネルのまま）
export const GUIDES = [
  { title: "構内装飾", desc: "校舎を彩るテーマ装飾", href: "#guide", icon: "装" },
  { title: "ステージパフォーマンス", desc: "タイムテーブルと出演者", href: "#schedule", icon: "舞" },
  { title: "花火", desc: "学内の方限定のご案内", href: "#guide", icon: "火", internal: true },
  { title: "学科展示", desc: "5学科の研究・作品展示", href: "map.html?list=exhibit", icon: "展" },
  { title: "模擬店", desc: "全模擬店の一覧と場所", href: "map.html?list=food", icon: "食" },
  { title: "抽選会", desc: "学内の方限定。景品と生配信のお知らせ", href: "#schedule", icon: "抽", internal: true },
];

// タイムテーブル（開催中、トップに「今やっているイベント」として自動表示）。internal: true は学内の方限定（「学内のみ」と出る）
// 「R8高専祭要項 ver1」より。要項の中で時刻が食い違っているもの（総選挙の結果発表・大抽選会）は p.4・p.13 の時刻にしている
export const EVENTS = [
  { title: "ステージパフォーマンス", venue: "gym2", start: "2026-10-24T12:15:00+09:00", end: "2026-10-24T16:00:00+09:00", stage: true },
  { title: "企業セミナー・製品展示", venue: "zacros", start: "2026-10-24T12:00:00+09:00", end: "2026-10-24T16:00:00+09:00", kind: "展示", copy: "協賛企業のセミナーと製品展示。\nものづくりの最前線をのぞこう。" },
  { title: "ステージパフォーマンス", venue: "gym2", start: "2026-10-25T10:30:00+09:00", end: "2026-10-25T15:00:00+09:00", stage: true },
  { title: "企業セミナー・製品展示", venue: "zacros", start: "2026-10-25T12:00:00+09:00", end: "2026-10-25T16:00:00+09:00", kind: "展示", copy: "協賛企業のセミナーと製品展示。\nものづくりの最前線をのぞこう。" },
  { title: "模擬店総選挙 結果発表", venue: "gym2", start: "2026-10-25T16:00:00+09:00", end: "2026-10-25T16:15:00+09:00", live: true, kind: "発表", copy: "いちばん人気の模擬店はどこ？\nYouTube でも生配信。" },
  { title: "大抽選会", venue: "gym2", start: "2026-10-25T16:30:00+09:00", end: "2026-10-25T17:30:00+09:00", live: true, internal: true },
  // 花火は学内の方限定（一般公開は16:00まで）。要項 p.4・p.8。飛行機の関係で遅れることがある
  { title: "花火", venue: "ground", start: "2026-10-25T18:00:00+09:00", end: "2026-10-25T18:30:00+09:00", internal: true, kind: "フィナーレ", copy: "高専祭のしめくくり。\n飛行機の都合で遅れることもあります。" },
];

// ステージの出演者（stage: true の時間の中）。act("日", "始まり", "終わり", "名前", "種類", "ひとこと", "説明", "写真")
// 開催中の「NOW／NEXT」、トップページの「みどころ」のチケット、タイムテーブル、地図の検索に出る。
// 説明の中の「\n」は、チケットでの改行。写真はなくてもよい（例："assets/img/stage/xxx.webp"）
// 【仮】出演者はまだ決まっていないので、デザインと表示を確かめるための架空の団体と時間。決まったら全部入れかえる（tentative も false に）
const act = (day, start, end, name, kind, mood, copy, photo = null) =>
  ({ name, kind, mood, copy, photo, start: `2026-10-${day}T${start}:00+09:00`, end: `2026-10-${day}T${end}:00+09:00` });
export const STAGE = {
  venue: "gym2",
  tentative: true,
  acts: [
    act("24", "12:15", "12:35", "ブラスエンジン", "吹奏楽", "華やか", "開幕の一曲は、\n全力のファンファーレで。"),
    act("24", "12:40", "13:00", "放課後オーバークロック", "ロック", "アツい", "定格を超えて鳴らします。\n耳の放熱にご注意を！"),
    act("24", "13:05", "13:25", "Team 縁", "ダンス", "キレキレ", "縁でつながった12人で、\nステージをつなぎます。"),
    act("24", "13:30", "13:50", "コンパイルエラーズ", "パンク", "香ばしい", "エラーだらけでも止まらない。\nビルド失敗、上等！"),
    act("24", "13:55", "14:15", "ボルトとナット", "漫才", "ゆるい", "締めても締めても、\n話がゆるむ二人です。"),
    act("24", "14:20", "14:40", "ハモリ回路", "アカペラ", "やさしい", "声だけでつくる、5人の並列回路。"),
    act("24", "14:45", "15:05", "函館ベースライン", "バンド", "しぶい", "低音で、坂の街をゆらします。"),
    act("24", "15:10", "15:30", "HAKODATE MOVE", "ダンス", "まぶしい", "港町から、全力でおどります！"),
    act("24", "15:35", "15:55", "五稜郭サウンドシステム", "ロック", "エモい", "1日目のトリ。\n星形の爆音をお届けします。"),
    act("25", "10:30", "10:50", "アサイチ定電圧", "ロック", "香ばしい", "電気の力で今日も元気！\nアサイチの、定電圧！", "assets/img/stage/asaichi.webp"), // 写真は Figma の見本【仮】
    act("25", "10:55", "11:15", "アサニ弱電圧", "弾き語り", "悲しい", "電気の力で今日も元気なり！\nアサニの、弱電圧…"),
    act("25", "11:20", "11:40", "イカ踊り隊", "ダンス", "にぎやか", "函館名物、あの踊りを令和風に。"),
    act("25", "11:45", "12:05", "ハンダ付けロックス", "ロック", "こげくさい", "ジュッと熱い、\nつなぎっぱなしの30分。"),
    act("25", "12:10", "12:30", "夜の電線", "弾き語り", "しっとり", "電線の上の空を歌います。"),
    act("25", "12:35", "12:55", "デバッグ・ボーイズ", "バンド", "さわやか", "バグは直さず、\nノリで乗り切ります。"),
    act("25", "13:00", "13:20", "ねじ巻きコント", "コント", "くせになる", "巻けば巻くほど、\n話がこじれます。"),
    act("25", "13:25", "13:45", "ステップ・ファンクション", "ダンス", "カクカク", "0か1かの、キレのあるステップ。"),
    act("25", "13:50", "14:10", "ラストオーダーズ", "バンド", "甘ずっぱい", "閉店まぎわの一曲を、\nあなたに。"),
    act("25", "14:15", "14:35", "ハウリングス", "ロック", "うるさい", "マイクもアンプも、\nぜんぶ鳴かせます。"),
    act("25", "14:40", "15:00", "フィナーレ合同バンド", "合同バンド", "大団円", "出演者みんなで、最後の一曲。"),
  ],
};

// 模擬店（「R8高専祭要項 ver1」p.21〜24 の模擬店一覧）
// cls はお店を出すクラスの教室（1-1 など）。その教室の部屋番号は HOMEROOMS。HOMEROOMS に無いクラスは、
// 地図では「L棟1階の模擬店」のように、棟と階までを案内する。room は部屋番号がわかっているもの、place は MAP.places の場所
// 各クラスの教室の部屋番号（「令和8年度教室配置図【学生用】3/23確定版」より）
export const HOMEROOMS_CONFIRMED = true;
export const HOMEROOMS = {
  "1-1": "L101", "1-2": "L102", "1-3": "L103", "1-4": "L201", "1-5": "L202",
  "2SM": "L301", "2C": "L302", "2SE": "L303", "2SJ": "L403", "2Z": "B104",
  "3SM": "H107", "3SJ": "B203", "3C": "L203", "3SE": "C212", "3Z": "B303",
  "4SM": "B304", "4SE": "C215", "4SJ": "H202", "4C": "B103", "4Z": "B204",
  "5SM": "C211", "5SE": "C216", "5SJ": "L402", "5C": "C203", "5Z": "C204",
};
// 校内装飾プロジェクトの撮影スポット（要項 p.15）。1年「海」・2年「自分たちの学科・コース」。コンテスト形式で、投票は現地の QR（forms）から。
// 場所は文化局の区域図から、だいたいの位置【仮】。floor と at（地図の座標）。作品名（title）・投票フォーム（vote）は決まったら入れる
export const DECOS = {
  themes: { 1: "海", 2: "自分たちの学科・コース" },
  vote: null, // 例：{ 1: "https://forms.gle/...", 2: "https://forms.gle/..." }
  spots: [
    { cls: "1-1", floor: "2F", at: [413, 434] },  // H棟2階 ホール
    { cls: "1-2", floor: "1F", at: [404, 462] },  // H棟1階 学生玄関のそば
    { cls: "1-3", floor: "1F", at: [582, 333] },  // C棟1階 渡り廊下の入口
    { cls: "1-4", floor: "1F", at: [650, 334.5] }, // C棟とE棟のあいだの渡り廊下
    { cls: "1-5", floor: "2F", at: [405, 492] },  // H棟2階 L棟へ行く所
    { cls: "2C", floor: "1F", at: [400, 375] },   // H棟1階 B棟へ行く廊下
    { cls: "2Z", floor: "1F", at: [488, 322] },   // B棟1階 保健室の前の廊下
    { cls: "2SJ", floor: "2F", at: [397, 322] },  // B棟2階 キャリアセンターの横
    { cls: "2SE", floor: "2F", at: [478, 323] },  // B棟2階 物理実験室の前の廊下
    { cls: "2SM", floor: "2F", at: [558, 332] },  // C棟2階 渡り廊下の入口
  ],
};

// 模擬店総選挙（投票は実行委員会の Microsoft Forms）。form に URL を入れると、お店のシートに「模擬店総選挙に投票」が出る（opens〜closes のあいだだけ）
// prefill：Forms の「…」→「事前入力された URL を取得」で作った URL の、お店の名前の所を {shop} にしたもの。あると、お店を選んだ状態でフォームが開く
//   （選択肢の文字は SHOPS の name と同じにする）。なければ null のままで、form がそのまま開く
export const ELECTION = {
  form: null,     // 例："https://forms.office.com/r/XXXXXXXX"
  prefill: null,  // 例："https://forms.office.com/Pages/ResponsePage.aspx?id=XXXX&rXXXXXXXX={shop}"
  opens: "2026-10-24T12:00:00+09:00",  // 1日目の公開から
  closes: "2026-10-25T15:00:00+09:00", // 締め切り（要項 p.13：10/25 15:00。結果発表は 16:00）
};

// 食べもののジャンル（genre）。一覧で絞りこめる・「甘い」などで探せる。【仮】お店の紹介文から決めたので、ちがっていたら直す
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
  { cls: "1-1", bldg: "L", floor: "1F", group: "5SJ", name: "5SJ お好み焼き", note: "すんごい美味しいです。来てね", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { cls: "1-2", bldg: "L", floor: "1F", group: "5SM", name: "麺屋 つちよし", note: "迷ったら油そば。腹が減ったら油そば。高専祭を楽しむなら、油そば。", food: true, genre: ["がっつり系", "しょっぱい系"] },
  { cls: "1-3", bldg: "L", floor: "1F", group: "5SE", name: "5SE たこ焼き", note: "たこ焼き売ります。主食、おかず、おやつとしておすすめです！", food: true, genre: ["しょっぱい系"] },
  { cls: "1-4", bldg: "L", floor: "2F", group: "5Z", name: "油そば工務店", note: "最大曲げモーメント！！ 肉の重みで橋がしなる、高強度チャーシュー丼！", food: true, genre: ["がっつり系"] },
  { cls: "1-5", bldg: "L", floor: "2F", group: "ソフトテニス部", name: "メロメロワッフル", note: "焼きたてふわふわ！ トッピングも選べる絶品ワッフル", food: true, genre: ["甘い系"] },
  { cls: "2SM", bldg: "L", floor: "3F", group: "硬式野球部", name: "野球部のやきそば", note: "学生といったらやきそば！ 野球部一同が丹精込めて作ります！", food: true, genre: ["しょっぱい系", "がっつり系"] },
  { cls: "2SE", bldg: "L", floor: "3F", group: "女子バスケットボール部", name: "まきまきクレープ＆しましまパンケーキ", note: "今年も仮装をしてクレープやミニパンケーキを販売しています！", food: true, genre: ["甘い系"] },
  { cls: "2C", bldg: "L", floor: "3F", group: "男子バスケットボール部", name: "Sip&Chill", note: "おしゃれな雰囲気の中、かっこいい男子学生がとても美味しいドリンクを作っています", food: true, genre: ["ドリンク", "いやし系"] },
  { cls: "2Z", bldg: "B", floor: "1F", group: "モルック愛好会", name: "amazing SPA アメスパ☆", note: "イタリアンレストランやってます♪", food: true, genre: ["がっつり系"] },
  { cls: "3SM", bldg: "H", floor: "1F", group: "5C", name: "め～どちゅろす", note: "ふわふわのひつじさんとメイドさんがお迎えします。ちょっと特別なカフェタイムを", food: true, genre: ["甘い系", "いやし系"] },
  { cls: "3SE", bldg: "C", floor: "2F", group: "珈琲・お茶研究会", name: "喫茶 悦純", note: "お茶・コーヒー・お菓子。他のお店で買った食べ物を持ち込んで食べることもできます！", food: true, genre: ["いやし系", "ドリンク"] },
  { cls: "3SJ", bldg: "B", floor: "2F", group: "陸上競技部", name: "陸部のおにぎり", note: "", food: true, genre: ["しょっぱい系"] },
  { cls: "3C", bldg: "L", floor: "2F", group: "LSQ", name: "Nôteau - tian", note: "業務用マシンの本格ポップコーン！ ロボコン参加生が作った電子部品アクセサリーも", food: true, genre: ["おやつ系"] },
  { cls: "3Z", bldg: "B", floor: "3F", group: "硬式テニス部", name: "テニス部学園", note: "赤点学習班", food: false },
  { cls: "4SM", bldg: "B", floor: "3F", group: "創作部同好会", name: "函館高専から脱出せよ", note: "謎解きに参加するだけでお菓子1個ゲット！ クリアでもう1個！", food: false },
  { cls: "4SE", bldg: "C", floor: "2F", group: "プロコン研究会", name: "プロコン模擬店", note: "部員たちで作ったゲームを展示しています！", food: false },
  { cls: "4SJ", bldg: "H", floor: "2F", group: "ハンドボール部", name: "ハンドボール部 特製ハニートースト", note: "ハニートースト売ってます！", food: true, genre: ["甘い系"] },
  { cls: "4C", bldg: "B", floor: "1F", group: "女子バレーボール部", name: "チェキ", note: "高専のゲーセン理想で気取って、頑張って営業します", food: false },
  { cls: "4Z", bldg: "B", floor: "2F", group: "卓球部", name: "熱いわんちゃん", note: "フランクフルトとホットドッグを販売しています！", food: true, genre: ["しょっぱい系"] },
  { cls: "5SM", bldg: "C", floor: "2F", group: "アントレプレナー同好会", name: "クッキングミオ♡", note: "溢れる肉汁と爽やかなヨーグルトの香り。さぁ ボナペティ…", food: true, genre: ["がっつり系"] },
  { cls: "5SE", bldg: "C", floor: "2F", group: "e-Sports 愛好会", name: "e-CURRY", note: "e-sports の e(良い)カレー食べませんか？", food: true, genre: ["がっつり系", "ピリ辛系"] },
  { cls: "5SJ", bldg: "L", floor: "4F", group: "軽音部", name: "Sound Lab 4F", note: "軽音部の模擬店ライブ！ たくさんのバンドで様々なサウンドを", food: false },
  { cls: "5C", bldg: "C", floor: "2F", group: "男子バレーボール部", name: "黄金バレー部の丑の刻参り", note: "函館高専初のお化け屋敷が始まります。全国レベルの怖さをお届けします", food: false },
  { cls: "5Z", bldg: "C", floor: "2F", group: "魚を釣って食べる会", name: "Restaurant.F.G.L", note: "魚料理にこだわりのうどん、手作りの革細工まで", food: true, genre: ["がっつり系"] },
  { room: "E101", group: "ロボット研究会", name: "ロボット研究会", note: "ロボットを操縦してみない？ 賞品がもらえる操縦体験ゲーム開催！", food: false },
  { room: "B106", group: "函館自動車学校", name: "運転シミュレーター", note: "自動運転シミュレーターなど", food: false },
  { place: "courtyard-shop", group: "ラグビー部", name: "やきとり処清", note: "ラグビー魂で焼く、熱いやきとり！！ 味は塩とタレ", food: true, genre: ["しょっぱい系"] },
  { place: "cafeteria", group: "同窓会", name: "ホームカミングデー", note: "アルバム・写真の展示、同窓会の活動紹介、同窓生との交流", food: false },
];

// みどころ：注目の模擬店・イベント（地図のお店のシートに出る）
// 例：{ name: "〇〇", group: "〇〇部", venue: "cafeteria", note: "ひとこと" }
export const PICKUP_SHOPS = [];
export const PICKUP_EVENTS = [
  { name: "ステージパフォーマンス", venue: "gym2", when: "10/24 12:15〜・10/25 10:30〜", note: "バンド・ダンス・有志企画" },
  { name: "模擬店総選挙 結果発表", venue: "gym2", when: "10/25 16:00〜", note: "YouTube で生配信" }, // 大抽選会は学内の方限定なので、ここには載せない
];

// ご来場の皆さまへ（トップページの札。絵とひとこと。押すとくわしい説明）。ひとことは「校内は全面禁煙」「火事のときはグラウンドへ」くらい、説明は2〜3行くらいの長さに。「R8高専祭要項 ver1」p.10・13・17〜19 より
// {hours} は公開時間、{close} は公開の終わりの時刻、{voteEnd} は総選挙の締め切り（下の FESTIVAL・ELECTION から自動で入る）
export const VISIT = [
  { icon: "clock", title: "公開は{close}まで", detail: "一般公開は両日とも{close}まで。終わったら、校内には残れません。" },
  { icon: "car", title: "車は止められません", detail: "市電やバスなどの公共交通機関でお越しください。サツドラや函館大学には止めないで！" },
  { icon: "fire", title: "グラウンドは立ち入り禁止", detail: "10.25 13:00から、グラウンドで花火の準備をします。ロープの内側に入らないで！" },
  { icon: "camera", title: "どんどん撮って投稿しよう", detail: "Enistagram に投稿してね！人や企業ブースを撮るときは、ひとこと聞いてから。撮影禁止の展示は撮らないで。" },
  { icon: "mic", title: "モッシュ・ダイブ禁止", detail: "ステージに上がるのも禁止です。お酒・たばこは持ちこめません。スモーク演出あり。" },
  { icon: "vote", title: "総選挙はだれでも投票", detail: "お店の扉のQRから、1人1票。{voteEnd}まで。結果発表は10.25 16:00から。" },
  { icon: "exit", title: "火事のときはグラウンドへ", detail: "スタッフの誘導に従って、あわてずに避難してください。" },
  { icon: "nosmoke", title: "校内は全面禁煙", detail: "校舎の中も外も、敷地の中はすべて禁煙です。" },
];

// 来場者への案内（短く）
export const NOTICES = [
  "校内は全面禁煙です。",
  "駐車場はありません。公共交通機関でお越しください。【仮】",
  "体調が悪くなったら、近くのスタッフか本部へ。",
];

// ごみの捨て方【仮】
export const GARBAGE = [
  { kind: "燃えるごみ", examples: "紙皿・割り箸・ティッシュ", color: "#E5484D" },
  { kind: "プラスチック", examples: "容器・フォーク・袋", color: "#3E8ED0" },
  { kind: "缶・びん・ペットボトル", examples: "キャップは外してプラへ", color: "#2E9F5B" },
];

// 協賛
export const SPONSORS = {
  count: 0, // 【仮】確定したら社数を入れる
  // トップページのいちばん下に、白い札で並べる。logo（画像）があればロゴ、なければ会社名。url があれば押すとその会社のページ
  // 例: { name: "株式会社〇〇", logo: "assets/img/sponsors/xxx.webp", url: "https://..." }
  // 【仮】いまは見た目をたしかめるための架空の会社（ロゴも作りもの）。本物の協賛企業が決まったら、全部入れかえる
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

// スタンプラリー【仮】条件は未確定
// スタンプはお店に貼った QR を読むだけで押せる（合言葉を入力する欄はない）。
// QR の中身は推測できない長いランダムな文字列で、ここにはその「暗号化した値」だけを置く。
// shops と staffPin は python tools/make-rally-qr.py で作って貼る（印刷用の QR のページも一緒にできる）。
export const RALLY = {
  goal: 5, // 何個で達成か（インフォメーションの1個を含む）
  prize: "本部でお菓子と交換できます（なくなりしだい終了）",
  claimPlace: "玄関ホールの本部",
  // 対象のお店。空のあいだはスタンプを押せない。
  // place（会場の id）か room（部屋番号）を書くと、校内マップにそのお店の場所が出る。
  // 例：{ id: "takoyaki", name: "たこ焼き", room: "L103", codes: { "2026-10-24": "…", "2026-10-25": "…" } }
  // @rally-generated-start（tools/make-rally-qr.py が書きかえる。手で直さない）
  shops: [
    { id: "test-1", name: "テスト店1", codes: { "*": "b348ac37e62946d848d19ca289406ff374168afa487e90045c0bf8531498b7f0" } },
    { id: "test-2", name: "テスト店2", codes: { "*": "f037f1536dd5e456cd4d0f2065bf47b940ea40c1b4052c5d4f8b9edcaade922d" } },
    { id: "test-3", name: "テスト店3", codes: { "*": "ad49e30973257190008bb5b85fd59a7d45b1030883c91a15e176706058578dac" } },
  ],
  // 引き換えのときにスタッフが入れる番号（PBKDF2 で何十万回も混ぜた値。番号そのものはここに載らない）
  staffPin: { salt: "a7c46213a4132f45007045a91991d333", iterations: 300000, hash: "6388520adc2af640425da9bcce853924c4887f02f4f41c8cb21c0f756da28073" },
  // @rally-generated-end
};

// ---------- 演出 ----------
export const FX = {
  // 本物の天気を取ってくる場所（函館高専のあたり）。Open-Meteo（無料・登録不要）を使う
  weather: { lat: 41.82, lon: 140.75, refreshMinutes: 15 },
  // 花火の時間（学内のみ。要項 p.4：10/25 18:00〜18:30）。この間、絵の空に花火が上がり続ける
  fireworks: { start: "2026-10-25T18:00:00+09:00", minutes: 30 },
  // 今この絵を見ている人の数だけ電線に灯りをともす。5分ごとにまとめて数える
  presence: { enabled: true, windowMinutes: 5, maxLanterns: 40 },
};

// 絵の中の隠しスポット。全部見つけるとごほうび（壁紙）【仮】言葉は差し替えてよい
export const SECRETS = {
  reward: "ポスターの壁紙をどうぞ。見つけてくれてありがとう！",
  wallpaper: "assets/img/wallpaper.jpg",
};
