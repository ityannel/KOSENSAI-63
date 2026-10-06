// ステージ出演団体の「ひとこと」を集める Google フォームを、自動でつくる（Google Apps Script）。
// 使い方：https://script.google.com で「新しいプロジェクト」→ このファイルの中身を貼る → 関数 makeBandForm を選んで「実行」
//        （最初だけ、Googleアカウントの許可を聞かれる）→ 実行ログに、団体に送る回答用URLと、集計を見る編集用URLが出る。
// 集まった答えは、サイトの config.js の STAGE（act("日", "始まり", "終わり", "名前", "種類", "ひとこと", "説明")）にそのまま入れられる形で聞いている。
const ACTS = [ // 出演の順（10/24 → 10/25）
  "Endless bond", "cresc.", "MOSAiC", "+10せんち！", "Neo abyss", "LunaTi☪︎³",
  "イイカンジ", "Criminals", "ゴーストノート", "疫病Jr.", "Untitled", "ダンス愛好会",
];

function makeBandForm() {
  const form = FormApp.create("第63回 函館高専祭「縁」 ステージ出演団体の紹介（ひとことコメント）");
  form.setDescription(
    "函館高専祭の公式サイトとステージ会場のモニターで、みなさんの出演を紹介します。\n" +
    "お客さんに向けた、ひとことコメントを教えてください。所要時間は3分ほどです。\n" +
    "いただいた文は、少しだけ手直し（改行・長さ）して載せることがあります。"
  ).setCollectEmail(false).setAllowResponseEdits(true).setProgressBar(false);

  form.addListItem().setTitle("団体名").setRequired(true).setChoiceValues(ACTS)
    .setHelpText("出演する団体を選んでください。");
  form.addTextItem().setTitle("連絡先の名前（代表者）").setRequired(true);
  form.addTextItem().setTitle("連絡先（メールアドレス、またはLINE名など）").setRequired(false)
    .setHelpText("文の確認が必要なときだけ、使います。");

  form.addCheckboxItem().setTitle("ジャンル").setRequired(true)
    .setChoiceValues(["バンド", "アコースティック", "ダンス", "お笑い・コント", "その他"])
    .setHelpText("あてはまるものを選んでください（出演チケットの色の分けかたに使います）。");

  form.addTextItem().setTitle("ひとことコメント（20字くらいまで）").setRequired(true)
    .setHelpText("お客さんへの呼びかけや、意気込みを、短く。例：「全力で盛り上げます！」");
  form.addParagraphTextItem().setTitle("団体の紹介・演目の説明（100字くらいまで）").setRequired(false)
    .setHelpText("どんな団体か、どんなステージか。曲名を入れても大丈夫です。");

  form.addTextItem().setTitle("メンバー数").setRequired(false);
  form.addTextItem().setTitle("SNS（Instagram・Xなど）のIDまたはURL").setRequired(false)
    .setHelpText("サイトに載せてもよいものだけ。");

  // ロゴ・ポスター：Apps Script では「ファイルのアップロード」の質問をつくれないので、共有リンクで受け取る
  // （フォームの編集画面で「質問を追加 → ファイルのアップロード」を足せば、直接送ってもらえる。その場合、回答者は Google にログインが必要）
  form.addSectionHeaderItem().setTitle("ロゴ・ポスターの募集")
    .setHelpText("バンドのロゴや、ステージのポスター・フライヤーがあれば、サイトとモニターで使わせてください。画像は、PNG（背景が透明だとうれしいです）かJPEG、できるだけ大きいサイズで。");
  form.addTextItem().setTitle("ロゴ画像の共有リンク（Googleドライブ、Dropboxなど）").setRequired(false)
    .setHelpText("「リンクを知っている全員が見られる」設定にしてください。");
  form.addTextItem().setTitle("ポスター・フライヤー画像の共有リンク").setRequired(false)
    .setHelpText("ライブのポスターや、団体の写真でも大丈夫です。複数あるときは、フォルダのリンクで。");
  form.addMultipleChoiceItem().setTitle("ロゴ・ポスターを、サイトとモニターに載せてもよいですか").setRequired(false)
    .setChoiceValues(["はい", "いいえ"])
    .setHelpText("画像の権利は、そのまま団体にあります。高専祭の紹介以外には使いません。");

  form.addMultipleChoiceItem().setTitle("サイトとモニターに、文と団体名を載せてもよいですか").setRequired(true)
    .setChoiceValues(["はい", "いいえ（団体名と時間だけ載せてください）"]);

  form.setConfirmationMessage("ご回答ありがとうございました！ ステージ、楽しみにしています。");

  // 回答をスプレッドシートにも集める
  const sheet = SpreadsheetApp.create("ステージ出演団体のひとことコメント（回答）");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log("団体に送るURL（回答用）: " + form.getPublishedUrl());
  Logger.log("つくったフォーム（編集用）: " + form.getEditUrl());
  Logger.log("回答のスプレッドシート: " + sheet.getUrl());
}
