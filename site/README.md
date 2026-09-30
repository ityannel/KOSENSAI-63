# 公式サイト（site/）

`https://www.hakodate-ct.ac.jp/gac_event/` に置く静的サイト。ビルド不要で、このフォルダの中身をそのままアップロードする。

ページはスクロールしない。画面にあるのは絵1枚と、その下の「5人への質問ボタン」（いま何してる？／混んでる？／スタンプ／地図／ごはん／その他）。
ボタンか絵の中の人を押すと、担当の人が吹き出しで答えて、絵の下に答えのカードが出る。カードの「くわしく」で各パネルが開く。
「縁」のロゴは「高専祭について」、道路の日付は「タイムテーブル」、電柱の看板は「混んでる？」。絵が大きく出せる画面では、電線の短冊もメニューになる。
パネルは URL の `#about` `#schedule` `#map` `#crowd` `#rally` `#guide` `#pickup` `#report` `#info` `#sponsors` で直接開ける。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | ページの骨組み |
| `assets/config.js` | **文章・日程・PICK UP・協賛など。普段はここだけ書き換える** |
| `assets/main.js` | 開催前・中・後の切り替え、カウントダウン、描画 |
| `assets/live.js` | 当日の更新内容・混雑状況を Firestore から受け取る |
| `assets/rally.js` | スタンプラリー（スタンプはスマホの中だけに保存） |
| `assets/scene.js` | 絵の中の触れる場所（5人・建物・隠しスポット）と吹き出し、パネルの開け閉め |
| `map.html` / `assets/map.js` / `assets/map-page.js` | 校内マップのページ |
| `assets/test.js` | テスト用パネル（`?test=1` のときだけ読み込む） |
| `assets/ask.js` | 5人に聞く：質問ごとに、誰が・何と答えて・カードに何を出すか（セリフや担当はここで変える） |
| `staff/crowd.html` | 本部用：会場の混雑状況と、5人の実況セリフを変える画面（リンクはどこにも貼らない） |
| `assets/fx.js` | 花火（開幕の瞬間・花火の時間）と、振ると揺れる短冊 |
| `assets/weather.js` | 函館の本物の天気（Open-Meteo）で雨・雪・霧・雷を降らせ、風で短冊の揺れを変える |
| `assets/style.css` | 見た目 |

### 絵（`assets/img/`）

元の絵（`pic-main.jpg` 文字なしの絵・`pic-disincl-sky.jpg` 空を抜いた絵・`Enishi-logo.jpg` ロゴ）から作ったもの。

| ファイル | 中身 |
|---|---|
| `sky-sunset.webp` | 空だけ・元の夕焼け（街に隠れるところは近くの空の色で埋めてある。少し動かしても街が二重にならない） |
| `sky-dawn` / `day` / `dusk` / `night` / `cloudy` / `rain` / `snow`（.webp） | 空のパターン。元の夕焼けの雲の形と筆のタッチのまま、色だけ塗り替えたもの。`python tools/make-skies.py` で作り直せる（色は中の PATTERNS で変える） |
| `scene.webp` | 街と5人（空を透明にしたもの）。空の上に重ねる |
| `logo.webp` | 「縁」のロゴ（背景を透明にしたもの） |
| `wallpaper.jpg` | 隠し縁のごほうびの壁紙（文字なしの絵そのまま） |
| `ogp.jpg` | LINE や X でリンクを貼ったときに出る画像（1200×630） |

絵の上の座標（触れる場所・電線・短冊・灯り）は、この絵（1215×1845）のピクセルで書いてある。

## 画面の見た目（Figma のデザイン）

- ふだんは「絵・縁・カウントダウン」だけ。画面に触れると、カウントダウンが消えて質問ボタンがせり上がる（15秒さわらないと戻る）
- 開催中は、上に「●開催中！」、下に NOW（緑）と NEXT（白）。企画の間は NEXT だけ、公開時間外は「本日の公開は終了しました」＋翌日の最初の企画、2日目の朝は「本日 10:00 開場」
- 長い企画名は電光掲示板のように横に流れる。生配信があるときは「縁」の場所に配信が出る
- カウントダウンと開催中の字は **WDXL Lubrifont JP N**。全部だと10MBあるので使う字だけを読み込んでいる。
  `config.js` の企画名・会場名を変えたら、次を動かして読み込む字を更新する：

```
python tools/update-font-subset.py
```

## 校内マップ（map.html）

トップとは別のページ。部屋を押すと中身（企画・お店・スタンプ）、混雑は部屋の色、今やっている企画に NOW、スタンプを押したお店にハンコ。
「探す」でトイレ・本部・ごみ箱・出入口・エレベーター・お店・企画の場所を光らせる。`map.html#gym1` でその部屋を選んだ状態で開く。

- **いまここ**：校内の入口や廊下に QR（`map.html?here=部屋ID`）を貼る。読むと地図にいまの場所が出る（2時間覚えている）。
  印刷用のページは次で作る（引数なしなら学校のサーバーの URL）：

```
python tools/make-here-qr.py
```

- 部屋の中身・種類・スタンプのお店は `config.js` の `MAP`。今は**仮の図**（四角を並べただけ）。
  校舎の図ができたら、Figma で部屋ごとにレイヤー名を `MAP.rooms` の id にして SVG で書き出し、`MAP.floors` の `svg` に指定する（読み込みの仕組みはこれから）

## 手元で確認

```
python tools/serve.py
```

http://localhost:5173/?test=1 を開くと、左上に**テスト用パネル**が出る（`?test=1` を付けたときだけ。来場者には出ない）。
時刻（開幕10秒前・開催中・企画の間・夜・2日目の朝・配信中・閉会式・終了後、好きな日時、±10分／1時間）、空、天気と風、
デモデータ、花火・最初の演出・メニューの出し入れ・短冊を揺らす、スタンプを1個／そろえる／消す、隠し縁のリセット、
どのパネルでも開く、がボタンでできる。上の「TEST」を押すとたたむ／ひらく。

パネルを使わなくても、URL に付けると時間や表示を試せる:

- `?now=2026-10-25T13:45` … その時刻として表示（開催中の見た目を確認）
- `?phase=during` / `?phase=after` … 表示を強制
- `?demo=1` … 食レポ・配信・お知らせのサンプルを表示
- `?weather=rain&wind=12` … 天気と風速（m/s）を固定（`clear` / `cloudy` / `fog` / `rain` / `snow` / `thunder`）
- `?fireworks=1` … 開幕の花火を今すぐ見る
- `?sky=night` … 空の時間帯を固定（`dawn` / `day` / `sunset` / `dusk` / `night`）。普段は函館の今の時刻で変わる。
  出す空の絵は「夜・日暮れは時間帯、それ以外は天気（雨・雪・くもり）を優先」で決まり、変わるときは3秒かけて重なる

## 当日の更新（サーバーを触らない）

Firebase コンソール → Firestore → `site_live` コレクション → `current` ドキュメントを書き換えると、開いている全員の画面にすぐ反映される。

| フィールド | 型 | 内容 |
|---|---|---|
| `notice` | string | トップ下部の帯に出すお知らせ |
| `stream_url` | string | YouTube の配信URL |
| `stream_active` | boolean | `true` の間トップに配信を出す（`config.js` で `live: true` のイベント中は自動で出る） |
| `now_events` | array | 「今やっていること」を手動で上書き（`{ title, venue, start, end }`） |
| `food_reports` | array | いちゃの食レポ（`{ shop, text, photo }`） |
| `photos` | array | 会場写真（`{ url, caption }`） |
| `phase_override` | string | `before` / `during` / `after` を強制 |

### セキュリティルール（要追加）

今のルールだと `site_live` も `crowd` も読めない（permission-denied）。既存のルールに以下を足す。

```
match /site_live/{docId} {
  allow read: if true;
  allow write: if false;   // コンソールからだけ書き換える
}
match /crowd/{venueId} {
  allow read: if true;
  // 本部用アカウントだけが level(0〜3) と updated_at を書ける
  allow write: if request.auth != null
    && request.auth.token.email == "本部用のメールアドレス"
    && request.resource.data.keys().hasOnly(["level", "updated_at"])
    && request.resource.data.level is int
    && request.resource.data.level >= 0 && request.resource.data.level <= 3;
}
```

### 追加のルール（灯り・5人の実況）

```
// 今この絵を見ている人の数。5分ごとの窓に +1 するだけ許す
match /presence/{win} {
  allow read: if true;
  allow create: if request.resource.data.keys().hasOnly(["n"]) && request.resource.data.n == 1
    && win.matches("^[0-9]+$")
    && int(win) >= request.time.toMillis() / 300000 - 1 && int(win) <= request.time.toMillis() / 300000 + 1;
  allow update: if request.resource.data.keys().hasOnly(["n"]) && request.resource.data.n == resource.data.n + 1;
}
// 5人の実況。本部用アカウントだけが書ける
match /chatter/{docId} {
  allow read: if true;
  allow write: if request.auth != null
    && request.auth.token.email == "本部用のメールアドレス"
    && request.resource.data.keys().hasOnly(["p1", "p2", "p3", "p4", "p5", "updated_at"]);
}
```

灯りは無料枠（1日 読み込み5万回・書き込み2万回）を使う。同時に見ている人が100人いても1日の書き込みは1万回程度だが、
上限を超えると混雑状況なども止まるので、危なくなったら Firestore の `site_live/current` に `presence_off: true` を足すと灯りだけ止まる。
`config.js` の `FX.presence.enabled` を `false` にすれば最初から使わない。

## 混雑状況（体育館・玄関ホール・第一講義室）

1. Firebase コンソール → Authentication → ログイン方法で「メール / パスワード」を有効にする
2. Authentication → ユーザーを追加 で本部用アカウントを1つ作る
3. 上のルールの「本部用のメールアドレス」をそのアドレスに書き換える
4. 当日の朝、本部のスマホで `gac_event/staff/crowd.html` を開いて1回ログイン（ログインは残る）
5. ボタンを押すと、公式サイトの「会場の混雑状況」にすぐ反映される。30分更新がないと薄く表示される

会場を増やす・減らすときは `config.js` の `CROWD.venues`。

## 5人の実況

`staff/crowd.html` の下の欄にセリフを書いて「公開する」と、サイトを開いている人の画面ですぐその人がしゃべる。空にすると、いつものセリフに戻る。

## スマホで確認（同じWi-Fi）

`python tools/serve.py` を動かしたまま、スマホで `http://（PCのIPアドレス）:5173/` を開く。
https ではないので、iPhone の「振ると揺れる」は動かない（本番の https では動く）。スタンプラリーは動く。

## スタンプラリー

1. `tools/rally-admin.html` を**自分のPCで**ダブルクリックして開く（サーバーには置かない）
2. お店の一覧・日ごとの合言葉・引き換え用のスタッフ番号を入れて「作る」
3. 出てきた `shops` と `staffPinHash` を `config.js` の `RALLY` に貼る（合言葉そのものはサイトに載らない）
4. 同じページを印刷して、各お店にその日のQRを貼る
5. 何個で達成か（`RALLY.goal`）、景品の説明、引き換え場所も `config.js` で変える

仕組みと弱点:
- QRには合言葉が入っているので、QRの写真を回されると離れた場所でも押せてしまう。合言葉を日ごとに変えて被害を1日に留める
- スタンプはスマホのブラウザに保存するだけ。ブラウザのデータを消すと消える
- 引き換えはスタッフが来場者のスマホで番号を入れる。達成画面は時計が動き背景が流れ続けるので、スクショの使い回しは見れば分かる
- 今入っている店と合言葉は仮（くれーぷ・そーす・さくさく・たこ・れもん。1日目と2日目で同じ）。スタッフ番号の仮の値は 6363。本番前に必ず作り直す
