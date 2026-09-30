"""site.config.json から、サイトを置く場所（URL）を読む。tools/ の道具で共通に使う。

    --env local / --env preview / --env production で選ぶ（書かなければ site.config.json の default）
    URL を直接書いてもよい（例：python tools/make-here-qr.py http://192.168.1.14:5173/）
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "site.config.json").read_text(encoding="utf-8"))


def pick(argv=None):
    """(環境の名前, baseUrl, --env 以外の引数) を返す。baseUrl は必ず / で終わる。"""
    argv = list(sys.argv[1:] if argv is None else argv)
    env = CONFIG["default"]
    rest = []
    url = None
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--env":
            env = argv[i + 1]
            i += 2
            continue
        if a.startswith("--env="):
            env = a.split("=", 1)[1]
        elif a.startswith(("http://", "https://")):
            url = a
        else:
            rest.append(a)
        i += 1
    if url is None:
        if env not in CONFIG["environments"]:
            sys.exit(f"site.config.json に「{env}」がありません（{' / '.join(CONFIG['environments'])}）")
        url = CONFIG["environments"][env]["baseUrl"]
    else:
        env = "custom"
    return env, url if url.endswith("/") else url + "/", rest
