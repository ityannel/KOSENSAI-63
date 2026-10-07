// 「投稿を消してほしい」お願いを受ける Google フォームを、自動でつくる（Google Apps Script）。
// 使い方：https://script.google.com →「新しいプロジェクト」→ これを貼る → 関数 makeTakedownForm を選んで「実行」→ 許可（最初だけ）→ 実行ログのURLを見る。
// できた「回答用URL」を、site/assets/config.js の LEGAL.takedownForm に入れて、サイトを出しなおすと、ご利用にあたって（terms.html）にボタンが出る。
function makeTakedownForm() {
  const form = FormApp.create("Enistagram の投稿の削除のお願い（第63回 函館高専祭）");
  form.setDescription(
    "Enistagram（地図の投稿）の、削除のお願いを受け付けます。確認して、学生会が対応します。\n" +
    "いただいた名前や連絡先は、確認と連絡のためだけに使います。"
  ).setCollectEmail(false).setAllowResponseEdits(false).setProgressBar(false);

  form.addMultipleChoiceItem().setTitle("どんなお願いですか").setRequired(true)
    .setChoiceValues(["自分（または家族）が写っている", "自分の作品・写真・文章が使われている", "個人情報（名前・連絡先など）が出ている", "悪口・いやがらせの内容", "その他"]);
  form.addParagraphTextItem().setTitle("消してほしい投稿のようす").setRequired(true)
    .setHelpText("投稿した人の名前、場所、時間、書いてある文、写真の内容など、探せる手がかりを書いてください。（画面のスクリーンショットがあれば、下のURL欄に）");
  form.addTextItem().setTitle("スクリーンショットなどのURL（任意）").setRequired(false);
  form.addMultipleChoiceItem().setTitle("あなたは").setRequired(true)
    .setChoiceValues(["本人", "保護者・家族", "作品などの権利をもつ人", "その他"]);
  form.addTextItem().setTitle("お名前（ニックネームでも可）").setRequired(true);
  form.addTextItem().setTitle("連絡先（メールアドレスまたは電話番号）").setRequired(true)
    .setHelpText("確認が必要なときだけ、連絡します。");
  form.setConfirmationMessage("お知らせありがとうございました。確認して、学生会が対応します。");

  const sheet = SpreadsheetApp.create("Enistagram 削除のお願い（回答）");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log("回答用URL（config.js の LEGAL.takedownForm に入れる）: " + form.getPublishedUrl());
  Logger.log("編集用URL: " + form.getEditUrl());
  Logger.log("回答のスプレッドシート: " + sheet.getUrl());
}
