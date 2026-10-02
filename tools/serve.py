# ローカル確認用: site/ フォルダを site.config.json の local の URL（ふつうは http://localhost:5173）で配信する
import functools, http.server, json, pathlib
from urllib.parse import urlparse
top = pathlib.Path(__file__).resolve().parent.parent
root = top / "site"
port = urlparse(json.loads((top / "site.config.json").read_text(encoding="utf-8"))["environments"]["local"]["baseUrl"]).port or 5173
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
print(f"http://localhost:{port}/")
http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
