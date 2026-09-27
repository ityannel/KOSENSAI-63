# 公式サイト（site/）

`https://www.hakodate-ct.ac.jp/gac_event/` に置く静的サイト。ビルド不要で、このフォルダの中身をそのままアップロードする。

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | ページの骨組み |
| `assets/config.js` | **文章・日程・PICK UP・協賛など。普段はここだけ書き換える** |
| `assets/main.js` | 開催前・中・後の切り替え、カウントダウン、描画 |
| `assets/live.js` | 当日の更新内容・混雑状況を Firestore から受け取る |
| `assets/rally.js` | スタンプラリー（スタンプはスマホの中だけに保存） |
| `staff/crowd.html` | 本部用：会場の混雑状況を切り替える画面（リンクはどこにも貼らない） |
| `assets/style.css` | 見た目 |

## 手元で確認

```
python tools/serve.py
```

http://localhost:5173 を開く。URL に付けると時間や表示を試せる:

- `?now=2026-10-25T13:45` … その時刻として表示（開催中の見た目を確認）
- `?phase=during` / `?phase=after` … 表示を強制
- `?demo=1` … 食レポ・配信・お知らせのサンプルを表示
- `?sky=night` … ポスターの空を固定（`dawn` / `day` / `sunset` / `dusk` / `night`）。普段は函館の今の時刻で変わる

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

## 混雑状況（体育館・玄関ホール・第一講義室）

1. Firebase コンソール → Authentication → ログイン方法で「メール / パスワード」を有効にする
2. Authentication → ユーザーを追加 で本部用アカウントを1つ作る
3. 上のルールの「本部用のメールアドレス」をそのアドレスに書き換える
4. 当日の朝、本部のスマホで `gac_event/staff/crowd.html` を開いて1回ログイン（ログインは残る）
5. ボタンを押すと、公式サイトの「会場の混雑状況」にすぐ反映される。30分更新がないと薄く表示される

会場を増やす・減らすときは `config.js` の `CROWD.venues`。

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
