# ローカル確認用: site/ フォルダを http://localhost:5173 で配信する
import functools, http.server, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / "site"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
http.server.ThreadingHTTPServer(("", 5173), handler).serve_forever()
