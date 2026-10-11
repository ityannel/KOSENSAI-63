# CLAUDE.md

第63回 函館高専祭「縁」の公式サイト。ビルドなしの静的サイト（`site/`）に、Firebase（Firestore・Auth）でリアルタイムの部分をつないでいる。
人間向けの詳しい手順は [`HANDOVER.md`](HANDOVER.md)、サイトの作りは [`site/README.md`](site/README.md)。ここには、**AI が作業するときに守ること**だけを書く。

## 先に決めておくこと

- 会話と文章は日本語。画面の文言は、やさしい日本語で、短く。
- コードには**コメントを書かない**（2026-10-11 に全部削除した）。理由や決まりごとは、この文書か `HANDOVER.md` に書く。
- 頼まれていない機能やリファクタは足さない。直すのは、頼まれた範囲だけ。
- 本番に出す前に、画面を**実際に開いて見る**。「見た」と書くのは、見たものだけ。見ていないものは「見ていない」と書く。
- 破壊的な操作（履歴の書き換え、`firestore.rules` の変更、本番データの削除、ブランチの削除）は、人間の許可を取ってから。
- 秘密を書かない。サービスアカウントの鍵、パスワード、トークンを、ファイル・コミット・会話に出さない。Firebase の `apiKey` は公開前提の値で、守りは `firestore.rules`。

## 構造

```
site/                   公開する本体。ビルドなし。ここだけを配信する
  assets/config.js      日程・企画・出演者・模擬店・協賛・文章。ふだんはここを直す
  assets/*.js           画面ごとのコード（main / map / signage / tickets / detail / shops-board / side ...）
  assets/style.css      トップほか全体の見た目（約190KB。あとから足して上書きする作り）
  assets/map.css        マップの見た目
  assets/signage.*      会場ディスプレイ
  staff/                本部コンソール（スタッフ専用）
  en.html               英語の来場案内
  sw.js                 Service Worker（電波がなくても開ける）
  _headers              Cloudflare Pages のセキュリティ設定（CSP など）
firestore.rules         Firestore のセキュリティルール
firebase.json           Firebase Hosting の設定（CSP は _headers と同じ内容を持つ）
tests/firestore-rules/  ルールのテスト（Firebase エミュレーターと Java が必要）
tools/                  ローカルサーバー・QR・OGP・フォント・デプロイ
app/ src/ public/       以前の試作。いまは使わない。触らない
```

## 確かめ方

```bash
python tools/serve.py        # http://localhost:5173/
```

- `?now=2026-10-24T13:20` … その時刻として動かす（トップ・みどころ・マップ・サイネージなど）
- `?test=1` … テスト用パネル
- サイネージは、`signage.html?now=…&only=stage` で、1つの画面だけを出し続ける。1920×1080 で見る
- プレビューが古い画面のときは、Service Worker とキャッシュが原因。`navigator.serviceWorker.getRegistrations()` の `unregister()` と `caches.delete()`、`fetch(url, {cache: "reload"})` で更新する

## 変更のたびの決まり（忘れやすい）

1. **`site/sw.js` の `VERSION`（`kosen63-vNNN`）を1つ上げる**。上げないと、来場者の端末に古い画面が残る。`<<<<<<<` が `sw.js` に入っていないかも見る。
2. JS は `node --check ファイル` を通す。
3. 文字が増えたら、リポジトリのいちばん上から `python tools/update-font-subset.py`（フォントの読み込みを更新）。
4. **インラインの `<script>` を HTML に直接書かない**。CSP が止める（許可は `_headers` / `firebase.json` のハッシュだけ）。コードは `site/assets/*.js` に置いて、`<script type="module" src>` で読む。
5. 要素に `hidden` を使うとき、CSS で `display` を指定していると `hidden` が効かなくなる。`[hidden] { display: none; }` を、その要素に書く。
6. CSS は、まず**最後に書かれた指定**を探す（同じセレクタが何か所にもあり、あとの方が勝つ）。直すより、末尾に足す方が安全なことが多い。
7. 長さの単位は `--u`（= `100cqi / 402`）。スマホの幅 402px を基準にした比率。px を直接書くと、画面によって崩れる。
8. 書体：見出しは `--hud-font`（WDXL Lubrifont JP N）、本文は `--text-font`（Zen Kaku Gothic New）。
9. 変更したら、コミットして、2か所に出す（下）。

## 出し方

```bash
git push
bash tools/deploy-cloudflare.sh                                          # Cloudflare Pages（公開 URL）
npx -y firebase-tools deploy --only hosting --project enishi-7f43f       # Firebase（ミラー。ルールも変えたときは hosting,firestore:rules）
```

- 出したあと、`curl -sL` か、`?x=乱数` を付けて、公開サイトに**変更が出ているか**を確かめる。Cloudflare は、反映が遅れることがある（遅れたらもう一度出す）。`/index.html` は `/` に転送されるので、`curl` には `-L` を付ける。
- コミットの末尾に、共同作成者の行を付ける運用（`Co-Authored-By: …`）。
- 公開は GitHub の `main` に置く。

## データの持ち方

- `config.js` の `STAGE.acts`（出演）は `act(日, 開始, 終了, 名前, 種類, 一言, 紹介文, 写真, [追加の写真], インスタ)` で書く。写真は `site/assets/img/stage/` の webp（大きい版は `-l`）。
- `EVENTS`（企画）、`LIST_EVENTS`（みどころのページだけに出す）、`SHOPS`（模擬店）、`GENRES`、`DEPT_EXHIBITS`（学科展示）、`SPONSORS`。
- **スケジュールの変更**は、Firestore の `site_schedule/current` の `changes`（キー＝各予定の `sid`）。時間の変更、`deleted: true`（削除）、`+` で始まるキー（追加した予定）を持つ。反映は `applySchedule`（`config.js`）が、配列を直接書き換える。ページを開くたびに適用されるので、`config.js` を読む側は、書き換え後の配列を見る。
- お知らせは `site_live/current`（`assets/notice.js` が、トップ・マップ・サイネージ・プレビューで共有）。

## AI 機能（`functions/`、`site/ai.html`）

- `functions/api/ask.js`（来場者向けの AIくん）と `functions/api/moderate.js`（本部向けの投稿確認）は、Cloudflare Pages Functions。**Gemini のキーは `env.GEMINI_API_KEY` だけ**。コード・コミット・会話に書かない。
- `site/assets/ai-context.json` は、`tools/make-ai-context.mjs` が `config.js` から作る。`config.js` を変えたら作り直す（デプロイスクリプトが自動で動かす）。
- AIくんは、来場者に「AI」と分かるようにする。来場者のふりをした、いいね・コメントは作らない。
- `moderate` は、本部ログインが必須（Firestore の `staff/{メール}` を、本人のトークンで読めるかで確かめる）。AI の判断で、投稿を自動で非公開にしない。

## 触るときに気をつける場所

- `firestore.rules`：来場者は読むだけ・決まった形の書き込みだけ。変えたら、`tests/firestore-rules/` にテストを足し、人間が読む。エミュレーターが動かない環境では、ルールを「機械で確かめた」と書かない。
- `staff/`：本部コンソール。ログインは Firebase Auth のメール・パスワード。`staff/{メール}` に登録された人だけがスタッフ。
- `sw.js` の `CORE`：新しいページや大事なファイルを足したら、必要に応じて足す。
- 写真や名前の出る場所（出演者・学生主事）：本人や団体から削除の希望があれば、最新版から外す。
- ライセンス：コードは MIT。画像・写真・ロゴ・校内の文章は対象外（[`NOTICE.md`](NOTICE.md)）。素材を足すときは、使ってよいものだけ。

## やってはいけないこと

- 動いているものを、確かめずに、まとめて整理・分割する（開催前は、特に）。
- 本番の Firestore に、手で書き込む（本部コンソールか、決まった手順で）。
- `main` に、履歴を書き換える push（`--force`）。
- 個人情報（名前・メール・電話）を、コード・コミット・Issue に貼る。
