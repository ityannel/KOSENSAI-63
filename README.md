# 第63回 函館高専祭 アプリシステム

Firebase + HTML で構築したリアルタイム高専祭アプリです。WordPress のファイルマネージャーからそのままアップロードして使用できます。

## 📁 フォルダ構成

```
app/
├── firebase-config.js   ← Firebase 設定（要書き換え）
├── index.html           ← 来場者向けメイン画面
├── shop-manager.html    ← 模擬店スタッフ用管理画面
├── claim.html           ← QRクーポン引き換え確認（運営用）
└── portal.html          ← 運営コントロールパネル（ローカル専用・サーバー非公開）
```

## 🚀 セットアップ手順

### 1. Firebase の設定

`app/firebase-config.js` の設定値が Firebase コンソールのものになっていることを確認してください。

### 2. Firestore のデータ構造

Firebase コンソール → Firestore に以下のコレクションを作成してください。

#### `shops` コレクション（各模擬店を1ドキュメントとして追加）
```json
{
  "name": "クレープ班（3-J）",
  "status": "normal",
  "pass": "1234"
}
```
- `status`: `"normal"` / `"10min"` / `"20min"` / `"soldout"`
- `pass`: 模擬店スタッフに配る4桁のパスワード

#### `quiz_control` コレクション → `current` ドキュメント
```json
{
  "question_num": 0,
  "question_text": "",
  "options": [],
  "is_active": false,
  "show_answer": false
}
```

### 3. サーバーへのアップロード

WordPress の WP File Manager を使って `gac_event/app/` に以下をアップロード：
- `firebase-config.js`
- `index.html`
- `shop-manager.html`
- `claim.html`

**`portal.html` はサーバーにアップロードしないこと！**
ローカル PC のデスクトップなどに保存し、ブラウザで直接開いて使用します。

### 4. `index.php` の無効化

WP File Manager で `gac_event/index.php` を `index.php.bak` にリネームすると、サーバーが `app/index.html` を優先して表示するようになります。

## 🎮 運営当日の操作フロー

### クイズ開催手順（portal.html を PC で開いて操作）

1. 問題番号・問題文・選択肢を入力して **「次の問題をセット」** をクリック
2. **「クイズ開始」** → 来場者全員のスマホ画面がジャックされます
3. **「正解・解説表示」** → 正解を全画面に表示
4. **「クイズ終了」** → 通常の画面に戻ります

最速正解者は `portal.html` のモニターにリアルタイムで表示されます。

## ⚠️ セキュリティに関する注意事項

- `firebase-config.js` は公開サーバーに置くため、Firebase API キーは誰でも閲覧可能です。
  - **Firestore セキュリティルール**で不正な書き込みを防いでください。
  - テストモードのまま本番運用しないこと。
- GitHub に `firebase-config.js` をコミットする際は、API キーの取り扱いに注意してください。
- 使用済みの GitHub Personal Access Token は速やかに削除・再発行してください。

## 🔧 後輩への引継ぎポイント

- Firestore のコレクション構造は上記の通り
- 毎年の模擬店情報は `shops` コレクションを編集するだけで更新可能
- `portal.html` だけはサーバー非公開。毎年の運営責任者の PC に保存して引き継ぐこと
- Firebase プロジェクトの管理者権限を次の担当者に移譲すること
