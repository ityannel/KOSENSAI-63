"""カウントダウン・開催中の表示・絵の下の日付に使う字（WDXL Lubrifont JP N）と、
学生主事メッセージの字（Zen Kaku Gothic New）を読み込み直す。

フォントは全部だと10MBあるので、index.html では「使う字だけ」を Google Fonts から読み込んでいる。
config.js の企画名・会場名・学生主事メッセージを変えたら、これを動かして index.html と map.html の読み込み先を更新する。

    python tools/update-font-subset.py
"""
import re
import urllib.parse
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
config = (SITE / "assets" / "config.js").read_text(encoding="utf-8")

# 画面に出る決まった言葉
FIXED = ("高専祭まであと日時間分秒0123456789:〜@ -!！●"
         "開催中本日は終了まもなく開場の公開しましたお楽しみください会場を"
         "第回函館ご来場ありがとうございました明NOWEXT"
         "学生主事より~.SUNMOTEWDHFRA")  # 絵の下の日付（10.24 SAT）と「学生主事より」
# config.js の企画名（EVENTS の title）と会場名（VENUES の name / alias）
titles = re.findall(r'title:\s*"([^"]+)"', config)
# ステージの出演者（act("日", "始まり", "終わり", "名前", "種類")）
acts = re.findall(r'act\("\d+",\s*"[\d:]+",\s*"[\d:]+",\s*"([^"]+)",\s*"([^"]*)"([^)]*)\)', config)
titles += [n + k for n, k, _ in acts]
venues = re.findall(r'(?:name|alias):\s*"([^"]+)"', config.split("export const VENUES")[1].split("];")[0])
# 縁日（模擬店の紹介）：店名は WDXL、ひとこと・団体・ジャンルは Zen Kaku
shops_src = config.split("export const SHOPS")[1].split("];")[0]
titles += re.findall(r'name:\s*"([^"]+)"', shops_src) + ["縁日", "ABCDEFGHKLM-12345F@"]
shop_text = "".join(re.findall(r'(?:note|group):\s*"([^"]+)"', shops_src)) + "".join(re.findall(r'id:\s*"([^"]+系|ドリンク)"', config)) + "模擬店・店地図でお店をさがすあそび・体験すべて"

# PC の左右（side.js）：タブとメニューの言葉、日付
side = (SITE / "assets" / "side.js").read_text(encoding="utf-8")
side_words = re.findall(r'\[\s*"[a-z.?=]+",\s*"([^"]+)",\s*"([^"]+)"', side)  # MENU（#の場所）と MORE（ページ）
SIDE_FIXED = "第回函館高専祭MENUSUNMOTEWDHFRA" + "ほかの見どころも見るとじる詳しく学内のみ終了したイベントを件（）地図で場所を見るここへの道案内模擬店総選挙で、このお店に投票お店をさがす日時場所種類団体前次ご来場の皆さまへ公開はまで協賛LOGO●アプリとして使う追加のしかたお店のQRを読むやめるいまの混雑空いていますふつう混雑しています入場制限中スタンプカード模擬店スタンプラリーNo.あと個で景品！達成引き換え済みうらを見るあそびかた縁引換済ポンッ押す合言葉を入れるチクタクブーンドーン！パシャワーキャーストンダッ×"  # みどころのボタンと、みどころのページの見出し
chars = "".join(dict.fromkeys(FIXED + "".join(titles) + "".join(venues) + SIDE_FIXED + "".join(a + b for a, b in side_words)))
url = "https://fonts.googleapis.com/css2?family=WDXL+Lubrifont+JP+N&display=swap&text=" + urllib.parse.quote(chars)

for page in ["index.html", "mido.html", "rally.html", "vote.html"]:  # map.html は字をしぼらずに読みこむ（場所の名前・投稿はどんな字も出るので）
    path = SITE / page
    html = path.read_text(encoding="utf-8")
    html, n = re.subn(r'href="https://fonts\.googleapis\.com/css2\?family=WDXL\+Lubrifont\+JP\+N[^"]*"',
                      'href="' + url.replace("&", "&amp;") + '"', html)
    assert n == 1, f"{page} に WDXL Lubrifont の読み込みが見つかりません"
    path.write_text(html, encoding="utf-8")
print(f"{len(chars)} 字を読み込むようにしました")

# Zen Kaku Gothic New の字：学生主事メッセージ（config.js の MESSAGE の body）と、みどころのチケット（トップページだけ）
body = config.split("export const MESSAGE")[1].split("};")[0].split("body:")[1]
# みどころのチケット（出演者の種類・ひとこと・説明、企画の種類・説明、場所の名前）も Zen Kaku
ticket = "".join(k + "".join(re.findall(r'"([^"]*)"', rest)) for _, k, rest in acts)
ticket += "".join(re.findall(r'(?:copy|kind):\s*"([^"]+)"', config)) + "".join(venues) + "タイムテーブルをすべて見る→"
# みどころのページ（mido.html）の札と文
ticket += shop_text
# ご来場の皆さまへ（VISIT）の説明の字
ticket += "".join(re.findall(r'detail:\s*"([^"]+)"', config)) + "0123456789.:〜／SATSUN"
ticket += "いまやっています（あと分）終了しましたで始まります日時場所種類前次学内の方限定の企画です。YouTube で生配信します（配信中はトップページに出ます）。【仮】出演者と時間は仮のものです。団体チラシを押すと、大きく開きます（指で拡大できます）"
ticket += "スポンサー計社のご協賛により開催しております。ご協力いただいた皆さまに、心より感謝申し上げます。©函館工業高等専門学校学生会ホーム画面に追加すると、すぐ開けて、電波が弱くても地図やみどころが見られます画面の下（iPad は上）の共有ボタン→「ホーム画面に追加」"
ticket += "模擬店の QR を読むか、お店で聞いた合言葉を入れると、スタンプが押されます。対象の模擬店で、お店の QR を読むか、合言葉を入れるスタンプが個たまったら達成で、この画面を見せて景品と交換対象のお店は、決まりしだいここに出ますうらを見るスタンプは このスマホの、このブラウザの中に保存されます。閉じても次の日に開いても残りますが、別のブラウザ・シークレットモード・履歴の削除では引き継がれません。第回函館高専祭「縁」模擬店スタンプラリー本部で景品と交換できます玄関ホールの【仮】合言葉が違うみたいです。お店の人にもう一度聞いてみてください。のスタンプはもう押してありますを押しました！あと個達成です開催日に押せますスタッフ用番号引き換える引き換え済みです にご参加ありがとうございました！番号が違います（スタッフが入力します）"
ticket += "対象の模擬店に置いてあるQRを読むと、スタンプが押されます。模擬店に置いてある QR を枠に入れてくださいスタンプラリーの QR ではないようですスマホのカメラアプリでお店の QR を読んでも、スタンプは押せますカメラを準備しています…読めましたこのブラウザではカメラが使えません。カメラを使えませんでした。カメラを許可するか、QR を読む準備ができませんでした。この QR ではスタンプを押せませんでした。お店の人に聞いてみてください。"
ticket += "空いていますふつう混雑しています入場制限中"  # いまの混雑（会場名・度合いは Zen Kaku）
ticket += "本部がリアルタイムで更新たった今分前に更新時間前・古いかも校内マップで場所を見る→"
ticket += "←サイトにもどるすべていまやっているステージ企画この条件のみどころはありません。【仮】出演者と時間は仮のものです団体名・企画名でさがす学内のみ"
msg = "".join(dict.fromkeys("".join(re.findall(r'"([^"]+)"', body)) + ticket))
zen = "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&display=swap&text=" + urllib.parse.quote(msg)
for page in ["index.html", "mido.html", "rally.html", "vote.html"]:
    path = SITE / page
    html = path.read_text(encoding="utf-8")
    html, n = re.subn(r'href="https://fonts\.googleapis\.com/css2\?family=Zen\+Kaku\+Gothic\+New[^"]*"', 'href="' + zen.replace("&", "&amp;") + '"', html)
    assert n == 1, f"{page} に Zen Kaku Gothic New の読み込みが見つかりません"
    path.write_text(html, encoding="utf-8")
print(f"Zen Kaku Gothic New の {len(msg)} 字を読み込むようにしました")
