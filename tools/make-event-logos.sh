#!/usr/bin/env bash
# 企画のロゴ（仮）を、透明な背景の画像にして site/assets/img/ に書く。リポジトリのいちばん上で：bash tools/make-event-logos.sh
set -e
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="$HERE/../site/assets/img"; TMP="$(mktemp -d)"
for n in hanabi stage tissue decor; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=1 --window-size=900,420 --virtual-time-budget=15000 --screenshot="$(cygpath -w "$TMP/$n.png")" "file:///$(cygpath -m "$HERE/event-logos.html")?v=$n" >/dev/null 2>&1
done
python - "$TMP" "$OUT" <<'PY'
import sys
from PIL import Image
for n in ("hanabi", "stage", "tissue", "decor"):
    im = Image.open(f"{sys.argv[1]}/{n}.png").convert("RGBA")
    bb = im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    im = im.crop((max(0, bb[0] - 8), max(0, bb[1] - 8), min(im.width, bb[2] + 8), min(im.height, bb[3] + 8)))
    im.save(f"{sys.argv[2]}/logo-{n}.webp", quality=90, method=6); print(n, im.size)
PY
