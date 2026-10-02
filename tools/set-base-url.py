"""HTML の OGP（LINE や X でリンクを貼ったときの URL・画像）を、公開する場所の URL に書きかえる。

    python tools/set-base-url.py                  # site.config.json の default（ふつうは本番）
    python tools/set-base-url.py --env preview    # 確認用のサイトに出すとき

公開（firebase deploy やアップロード）の前に1回動かす。
"""
import re

from site_env import ROOT, pick

env, base, _ = pick()
changed = []
for page in sorted((ROOT / "site").glob("*.html")):
    html = page.read_text(encoding="utf-8")
    name = "" if page.name == "index.html" else page.name
    new = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf"\g<1>{base}{name}\g<2>", html)
    new = re.sub(r'(<meta (?:property|name)="(?:og|twitter):image" content=")[^"]*?(assets/img/ogp\.jpg")', rf"\g<1>{base}\g<2>", new)
    if new != html:
        page.write_text(new, encoding="utf-8")
        changed.append(page.name)
print(f"{env}（{base}）にしました：{', '.join(changed) or '変更なし'}")
