#!/usr/bin/env bash
# OGP の案を画像にして、design/ogp/ogp-a.jpg 〜 e.jpg と、並べた見本 sheet.jpg を作る（リポジトリのいちばん上で：bash design/ogp/make-variants.sh）
set -e
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
HERE="$(cd "$(dirname "$0")" && pwd)"
for v in a b c d e; do
  PNG="$(mktemp --suffix=.png)"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=15000 --screenshot="$(cygpath -w "$PNG")" "file:///$(cygpath -m "$HERE/variants.html")?v=$v" >/dev/null 2>&1
  python - "$PNG" "$HERE/ogp-$v.jpg" <<'PY'
import sys
from PIL import Image
Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "JPEG", quality=88)
PY
done
python - "$HERE" <<'PY'
import sys
from PIL import Image, ImageDraw
h = sys.argv[1]; names = "abcde"
W, H, G = 600, 315, 16
sheet = Image.new("RGB", (W * 2 + G * 3, (H + G + 26) * 3 + G), "#f4ead2")
d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    im = Image.open(f"{h}/ogp-{n}.jpg").resize((W, H), Image.LANCZOS)
    x = G + (i % 2) * (W + G); y = G + (i // 2) * (H + G + 26)
    sheet.paste(im, (x, y + 26)); d.text((x, y + 4), n.upper(), fill="#634A2E")
sheet.save(f"{h}/sheet.jpg", quality=90)
print("sheet.jpg")
PY
