#!/usr/bin/env bash
# 共有したときの画像（OGP）を作る：tools/ogp.html を Chrome で 1200×630 の画像にして、site/assets/img/ogp.jpg に書く。
# 使い方（リポジトリのいちばん上で）：bash tools/make-ogp.sh   ※ ogp.html は Google Fonts を読むので、ネットにつながっていること
set -e
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PNG="$(mktemp --suffix=.png)"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=15000 --screenshot="$(cygpath -w "$PNG" 2>/dev/null || echo "$PNG")" "file:///$(cygpath -m "$HERE/ogp.html" 2>/dev/null || echo "$HERE/ogp.html")"
python - "$PNG" "$HERE/../site/assets/img/ogp.jpg" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
assert im.size == (1200, 630), im.size
im.save(sys.argv[2], "JPEG", quality=88, optimize=True, progressive=True)
print("ogp.jpg", im.size)
PY
