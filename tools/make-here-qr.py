"""校内に貼る「いまここ」QR を、部屋ごとに印刷できるページにする。

QR を読むと map.html?here=ID が開き、地図にその場所が「いまここ」と出て、そこからの道案内ができる。
場所は site/assets/config.js の MAP.spots（入口・廊下の角）と MAP.places（会場）。
部屋番号でもよいので、ほかの場所に貼りたいときは下の EXTRA に部屋番号を足す（例 "C203"）。

    python tools/make-here-qr.py                       # site.config.json の default（ふつうは本番）
    python tools/make-here-qr.py --env preview         # 確認用のサイト
    python tools/make-here-qr.py http://192.168.1.14:5173/   # 手元で試すとき（URL を直接書いてもよい）

できた tools/here-qr.html をブラウザで開いて印刷する。
"""
import base64
import io
import re
import sys
from pathlib import Path

import qrcode

from site_env import ROOT, pick

_, BASE, _ = pick()

EXTRA = []  # 例：[("C203", "C203 講義室", "2F")]

config = (ROOT / "site" / "assets" / "config.js").read_text(encoding="utf-8")
map_part = config.split("export const MAP")[1].split("\n};")[0]
rooms = []
for line in map_part.splitlines():
    m = re.search(r'\{ id: "([^"]+)".*?name: "([^"]+)"', line)
    if m:
        f = re.search(r'floor: "([^"]+)"', line)
        r = re.search(r'room: \[?"([A-Z])(\d)', line)  # 部屋が1つでも、いくつか（配列）でも
        floor = f.group(1) if f else (f"{r.group(2)}F" if r else "")
        rooms.append({"id": m.group(1), "name": m.group(2), "floor": floor})
rooms += [{"id": i, "name": n, "floor": f} for i, n, f in EXTRA]


def qr_data_uri(text):
    img = qrcode.make(text, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


cards = []
for r in rooms:
    url = f"{BASE}map.html?here={r['id']}"
    cards.append(f"""
  <div class="card">
    <p class="top"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.6 6-11a6 6 0 0 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>「いまここ」QR</p>
    <img src="{qr_data_uri(url)}" alt="">
    <p class="name">{r['name']}<small>{r['floor']}</small></p>
    <p class="hint">スマホのカメラか、校内マップの<br>QR のボタンで読むと、いまの場所が出ます</p>
    <p class="url">{url}</p>
  </div>""")

html = f"""<!doctype html>
<html lang="ja"><head><meta charset="UTF-8"><title>「いまここ」QR（印刷用）</title>
<link href="https://fonts.googleapis.com/css2?family=WDXL+Lubrifont+JP+N&family=Zen+Kaku+Gothic+New:wght@700;900&display=swap" rel="stylesheet">
<style>
  /* サイトと同じ字と色：見出しは WDXL Lubrifont、文は Zen Kaku Gothic New。クリーム色の紙・こげ茶の字 */
  body {{ font-family: "Zen Kaku Gothic New", "Yu Gothic", Meiryo, sans-serif; font-weight: 700; margin: 16px; color: #634A2E; }}
  .note {{ margin-bottom: 12px; }}
  .sheet {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }}
  .card {{ border: 2px solid #634A2E; border-radius: 12px; padding: 10px; text-align: center; break-inside: avoid; background: #FFFBF2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .top {{ display: flex; align-items: center; justify-content: center; gap: 4px; margin: 0; font-family: "WDXL Lubrifont JP N", sans-serif; font-weight: 400; font-size: 20px; color: #C8323A; }}
  .top svg {{ width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }}
  .card img {{ width: 150px; height: 150px; }}
  .name {{ margin: 4px 0; font-family: "WDXL Lubrifont JP N", sans-serif; font-size: 22px; font-weight: 400; }}
  .name small {{ margin-left: 6px; font-size: 14px; color: #8B6E4E; }}
  .hint {{ margin: 0; font-size: 11px; }}
  .url {{ margin: 4px 0 0; font-size: 8px; color: #999; word-break: break-all; }}
  @media print {{ .note {{ display: none; }} body {{ margin: 0; }} }}
</style></head><body>
<p class="note">「いまここ」QR {len(rooms)} 枚。貼る場所の目の高さに。QR の先：{BASE}map.html?here=…</p>
<div class="sheet">{''.join(cards)}
</div></body></html>"""
out = ROOT / "tools" / "here-qr.html"
out.write_text(html, encoding="utf-8")
print(f"{len(rooms)} 枚ぶん作りました → {out}")
