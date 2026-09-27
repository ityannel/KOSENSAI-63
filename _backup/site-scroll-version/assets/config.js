// =====================================================
//  第63回 函館高専祭 サイト設定
//  文章・日程・企画の中身はここを書き換えるだけで反映されます。
//  「【仮】」と付いているものは未確定のダミーです。
// =====================================================

export const FESTIVAL = {
  edition: 63,
  theme: "縁",
  themeReading: "えにし",
  // 各日の公開時間（日本時間）。ポスターの表記に合わせている
  days: [
    { label: "10月24日(土)", open: "2026-10-24T12:00:00+09:00", close: "2026-10-24T17:00:00+09:00" },
    { label: "10月25日(日)", open: "2026-10-25T10:00:00+09:00", close: "2026-10-25T17:00:00+09:00" },
  ],
  instagram: "https://www.instagram.com/kosen_gakuseikai/",
  instagramId: "@KOSEN_GAKUSEIKAI",
  // メインビジュアル（ポスター）。元データが手に入ったら差し替える
  poster: "assets/img/poster.jpg",
};

// メニュー。PCではポスターの電線に短冊として吊るされる（縦書きになるので短い言葉で）
export const NAV = [
  { label: "地図", href: "#map" },
  { label: "混雑", href: "#crowd" },
  { label: "スタンプ", href: "#rally" },
  { label: "企画", href: "#guide" },
  { label: "注目", href: "#pickup" },
  { label: "来場案内", href: "#info" },
  { label: "協賛", href: "#sponsors" },
];

// 学生主事メッセージ【仮】
export const MESSAGE = {
  name: "平沢 学生主事",
  photo: null, // 例: "assets/img/hirasawa.jpg"
  body: [
    "【仮】ここに平沢学生主事からのメッセージが入ります。",
    "第63回函館高専祭のテーマは「縁（えにし）」。学生、地域の皆さま、そして協賛企業の皆さまとのつながりによって、今年も高専祭を開催することができます。",
  ],
};

// 高専祭の概要【仮】
export const ABOUT = [
  "函館高専祭は、学生が企画・運営する年に一度のお祭りです。",
  "模擬店、学科展示、ステージパフォーマンスなど、2日間にわたって多彩な企画をお届けします。",
];

// 会場（協定を結んでいる教室）
// alias を書くと「alias（name）」の形で表示されます
export const VENUES = [
  { id: "zacros", name: "第1講義室", alias: "ZACROSホール" },
  { id: "factory", name: "実習工場" },
  { id: "gym1", name: "第一体育館" },
  { id: "gym2", name: "第二体育館" },
  { id: "cafeteria", name: "学生食堂" },
  { id: "library", name: "図書館" },
  { id: "entrance", name: "玄関ホール" },
];

// 混雑状況を出す会場（本部が staff/crowd.html から切り替える）
export const CROWD = {
  venues: ["gym1", "entrance", "zacros"], // 「体育館」は第一体育館として扱っている
  levels: [
    { label: "空いています", color: "#6CBAB5" },
    { label: "ふつう", color: "#F1D08A" },
    { label: "混雑しています", color: "#F2A96A" },
    { label: "入場制限中", color: "#E0655A" },
  ],
  staleMinutes: 30, // これ以上更新がないと「情報が古い」と出す
};

// 案内の分岐（各ページはまだ無いので href は "#" のまま）
export const GUIDES = [
  { title: "構内装飾", desc: "校舎を彩るテーマ装飾", href: "#", icon: "装" },
  { title: "ステージパフォーマンス", desc: "タイムテーブルと出演者", href: "#", icon: "舞" },
  { title: "花火", desc: "学内の方限定のご案内", href: "#", icon: "火", internal: true },
  { title: "学科展示", desc: "5学科の研究・作品展示", href: "#", icon: "展" },
  { title: "模擬店", desc: "全模擬店の一覧とメニュー", href: "#", icon: "食" },
  { title: "抽選会", desc: "景品と生配信のお知らせ", href: "#", icon: "抽" },
];

// タイムテーブル（開催中、トップに「今やっているイベント」として自動表示）【仮】
export const EVENTS = [
  { title: "開会式", venue: "gym1", start: "2026-10-24T12:00:00+09:00", end: "2026-10-24T12:30:00+09:00" },
  { title: "ステージパフォーマンス 第1部", venue: "gym1", start: "2026-10-24T13:00:00+09:00", end: "2026-10-24T14:30:00+09:00" },
  { title: "学科展示ツアー", venue: "zacros", start: "2026-10-24T15:00:00+09:00", end: "2026-10-24T16:00:00+09:00" },
  { title: "ステージパフォーマンス 第2部", venue: "gym1", start: "2026-10-25T10:30:00+09:00", end: "2026-10-25T12:00:00+09:00" },
  { title: "抽選会", venue: "gym1", start: "2026-10-25T15:00:00+09:00", end: "2026-10-25T16:00:00+09:00", live: true },
  { title: "閉会式", venue: "gym1", start: "2026-10-25T16:30:00+09:00", end: "2026-10-25T17:00:00+09:00" },
];

// PICK UP【仮】
export const PICKUP_SHOPS = [
  { name: "【仮】クレープ", group: "3-J", venue: "cafeteria", note: "毎年行列の定番" },
  { name: "【仮】焼きそば", group: "2-M", venue: "cafeteria", note: "鉄板で豪快に" },
  { name: "【仮】チュロス", group: "4-E", venue: "gym2", note: "揚げたてサクサク" },
];
export const PICKUP_EVENTS = [
  { name: "【仮】ステージパフォーマンス", venue: "gym1", when: "10/24・10/25", note: "バンド・ダンス・有志企画" },
  { name: "【仮】抽選会", venue: "gym1", when: "10/25 15:00〜", note: "当日はこのページで生配信" },
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
  list: [], // 例: [{ name: "株式会社〇〇", url: "https://..." }]
};

// スタンプラリー【仮】条件は未確定
// 合言葉はそのまま置くとページのソースから読めてしまうので、
// tools/rally-admin.html で作った「暗号化した値」だけをここに貼る。
export const RALLY = {
  goal: 3, // 何個で達成か
  prize: "【仮】本部で景品と交換できます",
  claimPlace: "玄関ホールの本部",
  shops: [
    { id: "crepe", name: "【仮】クレープ（3-J）", codes: {
      "2026-10-24": "332642592dd3b234e3a8dda0ffae31c23d1c8c25c29a19d89b65dd0e2411f3e9",
      "2026-10-25": "3f9e81b55d2f2d18ec392128ed273dc7fc18914524e8e8e1af907cd61753d2f5" } },
    { id: "yakisoba", name: "【仮】焼きそば（2-M）", codes: {
      "2026-10-24": "d748643cfc913dc76fd28256e1a79e82b1e0b54c373be08a899e36f2bca1b9e6",
      "2026-10-25": "61e66e1cc06bd32b24e5012c4aa19c5b398d9a4f2524477e32ecd831a5faa65d" } },
    { id: "churros", name: "【仮】チュロス（4-E）", codes: {
      "2026-10-24": "792ee8a1387099a196b2a0c17cef18316d165700af265cc9b86173a708da224f",
      "2026-10-25": "cc0a5e60cc77ae292ac1b1773fccf572d52d7c00d36d56b7619151515822f914" } },
    { id: "takoyaki", name: "【仮】たこ焼き（1-1）", codes: {
      "2026-10-24": "5c0ca34c43be0200dbdb05a6b648b99363318c0b0ba42394ac90ded25cc791b5",
      "2026-10-25": "a5e1b8594837812188af45b0beda8956171e8ad4be8cc4705a1c2081f4b4128f" } },
    { id: "drink", name: "【仮】ドリンク（5-C）", codes: {
      "2026-10-24": "7c4608e2700e022aae8a8ecd433dcb60aa2ef962331d0be1bd3661b900f41e43",
      "2026-10-25": "7e29043aa5e100110ed44e2681649b308c1fced037a499ecf69169f658bf80a1" } },
  ],
  // 引き換えのときにスタッフが入れる番号（これも暗号化した値）
  staffPinHash: "724aef65382516dab0c90b1d87e0f382b64cd61a626e9c611be52ab256457e01",
};
