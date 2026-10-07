#!/usr/bin/env bash
# X（旧 Twitter）の公式アカウント用の画像を作る：tools/x-profile.html を Chrome で画像にして、design/x/header.png（1500×500）と icon.png（400×400）に書く。
# 使い方（リポジトリのいちばん上で）：bash tools/make-x-images.sh   ※ Google Fonts を読むので、ネットにつながっていること
set -e
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../design/x"; mkdir -p "$OUT"
shot() { # 名前 幅 高さ
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=$2,$3 --virtual-time-budget=15000 --screenshot="$(cygpath -w "$OUT/$1.png" 2>/dev/null || echo "$OUT/$1.png")" "file:///$(cygpath -m "$HERE/x-profile.html" 2>/dev/null || echo "$HERE/x-profile.html")?v=$1"
}
shot header 1500 500
shot headerA 1500 500   # 案：緑のロゴだけ
shot headerB 1500 500   # 案：題字と日付の文字だけ
shot headerC 1500 500   # 案：電線だけ
shot icon 400 400
python - "$OUT" <<'PY'
import sys
from PIL import Image
for n, s in (("header", (1500, 500)), ("headerA", (1500, 500)), ("headerB", (1500, 500)), ("headerC", (1500, 500)), ("icon", (400, 400))):
    im = Image.open(f"{sys.argv[1]}/{n}.png").convert("RGB")
    assert im.size == s, (n, im.size)
    im.save(f"{sys.argv[1]}/{n}.png", optimize=True); print(n, im.size)
PY
