# 第63回 函館高専祭「縁」公式サイト

[English](#english) / 日本語

函館工業高等専門学校（函館高専）の学園祭「第63回 函館高専祭 縁（えにし）」のために、学生が作った公式サイトです。2026年10月24日(土)・25日(日)に開催します。

- 公開中のサイト：<https://hakodate-kosensai.pages.dev/>
- ビルド不要の静的サイト（HTML / CSS / JavaScript）に、リアルタイムの部分だけ Firebase を使っています。
- 学園祭の運営を、そのまま支える機能を入れています。ほかの学校祭・イベントのサイトの雛形としても、自由に使ってください。

## できること

| 機能 | 内容 |
|---|---|
| 開催前・中・後の切り替え | カウントダウン、いま・次の予定、終了後の「思い出」。時刻は自動で切り替わる |
| みどころ | ステージ・企画のチケット形式の一覧。「いまやっている」は NOW 表示 |
| 校内マップ | 階ごとの地図、検索、道案内（曲がり角ごと）、混雑の色、QR で「いまここ」 |
| 縁日（模擬店） | 店ごとの紹介、ジャンル、待ち時間・完売の表示（お店の人がスマホで更新） |
| Enistagram | 来場者の投稿（写真・いいね・報告）。写真は確認してから公開できる |
| スタンプラリー・投票 | QR を読むだけのスタンプ、模擬店総選挙 |
| 会場ディスプレイ（サイネージ） | 校内の大きな画面に、ステージの「いま・次」、混雑、投稿、協賛を自動で切り替えて出す |
| 本部コンソール（`site/staff/`） | お知らせ、スケジュールの変更・追加・削除、混雑、投稿の確認、模擬店の管理、集計 |
| 英語の来場案内 | `site/en.html` |

## すぐ動かす

Python 3 があれば、ビルドなしで動きます。

```bash
python tools/serve.py
```

<http://localhost:5173/> を開きます。ポートは `site.config.json` の `local` で変えられます。サイトの読み込み時に `?now=2026-10-24T13:20` を付けると、その時刻として動かして確かめられます（ページごとに対応）。

リアルタイムの機能（お知らせ・混雑・投稿・スタンプなど）は Firebase につながります。自分のプロジェクトで動かす手順は、下の「自分のサイトとして使う」を見てください。

## フォルダ

```
site/                公開するサイト本体（ビルド不要）。ここを配信するだけ
  assets/config.js   文章・日程・企画・協賛など。ふだんはここを書き換える
  staff/             本部コンソール（スタッフ専用）
  README.md          サイトの作りの詳しい説明（日本語）
firestore.rules      Firestore のセキュリティルール
tests/firestore-rules/  ルールのテスト（Firebase エミュレーターで動かす）
tools/               QR・OGP・フォント・ローカルサーバーなどの補助スクリプト
design/              デザインの素材（Figma 書き出し、OGP の案、X のヘッダーなど）
app/ src/ public/    以前の試作（React / 旧アプリ）。いまのサイトでは使っていません
```

サイトの作り（データの持ち方、Service Worker、CSP、各画面の役割など）は [`site/README.md`](site/README.md) に詳しく書いてあります。

## 自分のサイトとして使う

1. **Firebase のプロジェクトを作る**（Firestore と Authentication）。`site/assets/live.js` の `firebaseConfig` を、自分のプロジェクトの値に書き換えます。この値は公開される前提のもので、守っているのは Firestore のルールです。
2. **ルールを入れる**：`firestore.rules` をデプロイします。スタッフとして入れる人は、Firestore の `staff/{メールアドレス}` に登録した人だけです。
3. **中身を書き換える**：`site/assets/config.js`（日程、企画、出演者、模擬店、協賛）、`site.config.json`（URL）、`site/assets/img/`（絵・ロゴ）。
4. **公開する**：`site/` を、Cloudflare Pages・Firebase Hosting・GitHub Pages など、静的ファイルを置ける場所へ。セキュリティの設定は `site/_headers`（Cloudflare Pages）と `firebase.json`（Firebase Hosting）にあります。

### ルールのテスト

```bash
cd tests/firestore-rules
npm install
npm test
```

Firebase エミュレーター（Java が必要）を使います。

## ライセンスと、含まれていないもの

- **コード**は [MIT License](LICENSE) です。自由に使い、変えて、配ってかまいません。
- 画像・写真・ロゴ・ポスターの絵・校内の文章（出演者の紹介、模擬店の紹介など）は、**ライセンスの対象外**で、それぞれの権利者のものです。再利用はできません。詳しくは [`NOTICE.md`](NOTICE.md) を見てください。
- 出演者や写っている人について、削除してほしいときは、Issue か、サイトの案内にある連絡先へお知らせください。

## 貢献

不具合の報告、提案、プルリクエストを歓迎します。Issue に、困ったこと・直したいことを書いてください。

---

## English

The official website for the **63rd Hakodate KOSEN Festival "縁 (Enishi)"**, a school festival at the National Institute of Technology (KOSEN), Hakodate College, held on October 24-25, 2026. Built by students.

- Live site: <https://hakodate-kosensai.pages.dev/> (an English visitor page is at `/en.html`)
- A static site (plain HTML / CSS / JavaScript, no build step) with Firebase (Firestore + Auth) for the real-time parts.
- Features: festival timetable with a live "NOW" display, indoor campus map with turn-by-turn directions and crowd levels, food-stall boards with wait times, a photo feed, a stamp rally, digital signage for screens around the campus, and a staff console to run it all (announcements, schedule changes, crowd levels, moderation).

**Run locally:** `python tools/serve.py`, then open <http://localhost:5173/>.

**Use it for your own event:** create a Firebase project, put its config in `site/assets/live.js`, deploy `firestore.rules`, edit `site/assets/config.js` and `site.config.json`, and host the `site/` folder anywhere that serves static files. See [`site/README.md`](site/README.md) (Japanese) for details.

**License:** the code is under the [MIT License](LICENSE). Images, photos, logos, artwork and the festival's text content are **not** covered and remain the property of their owners; see [`NOTICE.md`](NOTICE.md).
