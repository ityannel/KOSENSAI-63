"""スタンプラリーの QR と、config.js に入れる値を作る。

お店の一覧（tools/rally-shops.json）から、お店ごと・開催日ごとに推測できない長い鍵を作り、
  - site/assets/config.js の RALLY.shops と RALLY.staffPin を書きかえる（鍵そのものではなく、暗号化した値だけ）
  - tools/rally-qr.html：お店に貼る QR の印刷用ページ（1日目・2日目で別の QR）
  - tools/rally-secret.json：鍵とスタッフ番号の控え（刷り直すとき用）
を作る。rally-qr.html と rally-secret.json は公開しない（.gitignore 済み）。

    cp tools/rally-shops.example.json tools/rally-shops.json   # お店を書きかえる
    python tools/make-rally-qr.py                              # site.config.json の default（ふつうは本番）
    python tools/make-rally-qr.py --env preview                # 確認用のサイトで試すとき
    python tools/make-rally-qr.py --new                        # 鍵とスタッフ番号を全部作り直す

2回目からは rally-secret.json の鍵を使い回す（お店を足したときは、そのお店の分だけ新しく作る）。
"""
import base64
import hashlib
import io
import json
import re
import secrets
import sys
from pathlib import Path

import qrcode

from site_env import ROOT, pick

TOOLS = ROOT / "tools"
CONFIG = ROOT / "site" / "assets" / "config.js"
SECRET = TOOLS / "rally-secret.json"
PIN_ITERATIONS = 300_000

ENV, BASE, _ = pick([a for a in sys.argv[1:] if a != "--new"])
renew = "--new" in sys.argv

shops_file = TOOLS / "rally-shops.json"
if not shops_file.exists():
    sys.exit("tools/rally-shops.json がありません。tools/rally-shops.example.json をコピーして、お店を書いてください。")
shops = json.loads(shops_file.read_text(encoding="utf-8"))
for s in shops:
    if not re.fullmatch(r"[a-z0-9_-]+", s["id"]):
        sys.exit(f"id は半角の小文字・数字・-・_ だけにしてください：{s['id']}")

config = CONFIG.read_text(encoding="utf-8")
dates = re.findall(r'open: "(\d{4}-\d{2}-\d{2})T', config.split("export const FESTIVAL")[1].split("\n};")[0])

secret = {} if renew or not SECRET.exists() else json.loads(SECRET.read_text(encoding="utf-8"))
keys = secret.setdefault("keys", {})
for s in shops:
    for d in dates:
        keys.setdefault(s["id"], {}).setdefault(d, secrets.token_urlsafe(18))
if "pin" not in secret:
    secret["pin"] = f"{secrets.randbelow(10**8):08d}"
    secret["salt"] = secrets.token_hex(16)
SECRET.write_text(json.dumps(secret, ensure_ascii=False, indent=2), encoding="utf-8")


def code_hash(shop_id, date, key):
    return hashlib.sha256(f"kosen63:{shop_id}:{date}:{key}".encode()).hexdigest()


pin_hash = hashlib.pbkdf2_hmac("sha256", secret["pin"].encode(), bytes.fromhex(secret["salt"]), PIN_ITERATIONS).hex()


def js_shop(s):
    extra = "".join(f', {k}: {json.dumps(s[k], ensure_ascii=False)}' for k in ("room", "place") if s.get(k))
    codes = ", ".join(f'"{d}": "{code_hash(s["id"], d, keys[s["id"]][d])}"' for d in dates)
    return f'    {{ id: {json.dumps(s["id"])}, name: {json.dumps(s["name"], ensure_ascii=False)}{extra}, codes: {{ {codes} }} }},'


block = "\n".join([
    "  // @rally-generated-start（tools/make-rally-qr.py が書きかえる。手で直さない）",
    "  shops: [",
    *[js_shop(s) for s in shops],
    "  ],",
    "  // 引き換えのときにスタッフが入れる番号（PBKDF2 で何十万回も混ぜた値。番号そのものはここに載らない）",
    f'  staffPin: {{ salt: "{secret["salt"]}", iterations: {PIN_ITERATIONS}, hash: "{pin_hash}" }},',
    "  // @rally-generated-end",
])
config, n = re.subn(r"  // @rally-generated-start.*?// @rally-generated-end", lambda _: block, config, flags=re.S)
if n != 1:
    sys.exit("config.js の RALLY に @rally-generated-start / end の印が見つかりません")
CONFIG.write_text(config, encoding="utf-8")


def qr_data_uri(text):
    img = qrcode.make(text, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


day_label = {d: f"{int(d[5:7])}/{int(d[8:10])}" for d in dates}
cards = []
for d in dates:
    for s in shops:
        url = f"{BASE}rally.html?s={s['id']}&c={keys[s['id']][d]}"
        cards.append(f"""
  <div class="card">
    <p class="top">スタンプラリー</p>
    <img src="{qr_data_uri(url)}" alt="">
    <p class="name">{s['name']}</p>
    <p class="day">{day_label[d]} だけ使える QR</p>
    <p class="hint">スマホのカメラで読むと<br>スタンプが押されます</p>
  </div>""")

html = f"""<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>スタンプラリーの QR（印刷用・公開しない）</title>
<link href="https://fonts.googleapis.com/css2?family=WDXL+Lubrifont+JP+N&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap" rel="stylesheet">
<style>
  body {{ font-family: "Zen Kaku Gothic New", "Yu Gothic", Meiryo, sans-serif; font-weight: 700; margin: 16px; color: #634A2E; }}
  .note {{ margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; background: #FFE0D6; }}
  .sheet {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }}
  .card {{ border: 2px solid #634A2E; border-radius: 12px; padding: 10px; text-align: center; break-inside: avoid; background: #FFFBF2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .top {{ margin: 0; font-family: "WDXL Lubrifont JP N", sans-serif; font-size: 20px; color: #C8323A; }}
  .card img {{ width: 160px; height: 160px; }}
  .name {{ margin: 4px 0; font-family: "WDXL Lubrifont JP N", sans-serif; font-size: 22px; }}
  .day {{ display: inline-block; margin: 0 0 4px; padding: 1px 10px; border-radius: 999px; background: #634A2E; color: #FEEBC4; font-size: 13px; }}
  .hint {{ margin: 0; font-size: 11px; }}
  @media print {{ .note {{ display: none; }} body {{ margin: 0; }} }}
</style></head><body>
<p class="note">お店に貼る QR です。<b>このページとスタッフ番号は公開しない</b>でください。日付の QR はその日だけ使えます（前の日の QR は次の日には押せません）。<br>
引き換えのスタッフ番号：<b>{secret['pin']}</b>（本部のスタッフだけに伝える）</p>
<div class="sheet">{''.join(cards)}
</div></body></html>"""
(TOOLS / "rally-qr.html").write_text(html, encoding="utf-8")
print(f"{len(shops)} 店 × {len(dates)} 日ぶんの QR → tools/rally-qr.html")
print("config.js の RALLY.shops と RALLY.staffPin を書きかえました")
print(f"スタッフ番号：{secret['pin']}（控え：tools/rally-secret.json。公開しない）")
