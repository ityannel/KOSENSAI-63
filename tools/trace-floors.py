"""「学生生活の手引き」の平面図（PDF の線のデータ）から、校内マップの部屋の四角を取り出す。

    python tools/trace-floors.py ../reference/handbook-R08.pdf

やっていること
- 見開き2ページを1枚につなぐ（右ページは左ページの座標で +DX ずらす）。2階は1階にぴったり重なるようにずらす
- ページの外枠・柱の印・棟の名前の枠を取り除く
- 部屋番号（例 L107）のまわりの「線で囲まれたところ」を塗りつぶしで探して、部屋の四角にする

できるもの
    site/assets/map/rooms.json   部屋番号 → 階・四角（[左, 上, 幅, 高さ]、取れなかったら null）・番号の位置
    tools/trace-debug-*.png      確認用（見つけた部屋を赤で囲んだ画像。青い番号＝取れた、赤い番号＝取れなかった）

建物の形・廊下・道案内の道・部屋の名前は site/assets/campus.js に手で書いている（線から自動で作ると形が崩れるため）。
座標はこのツールと同じ（ORIGIN を引いた pt）。取れなかった部屋の四角も campus.js で足している。
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "map"
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "reference" / "handbook-R08.pdf"

# 階ごとの図の部品：(ページ（0 始まり）, ずらす x, ずらす y, 使う範囲)。ずらした結果が1階の図と重なるようにしてある
# （2階以上のずれは、2階の壁の線と重なりがいちばん多くなる位置を計算で求めた）
# 3階と4階は同じ見開きにあり、4階は H棟・L棟だけが左のページに小さく描いてある
IN_4F = lambda x, y: x < 440 and y > 400
FLOORS = {
    "1F": [(21, 0, 0, None), (22, 561.3, 0, None)],
    "2F": [(23, 7, 34, None), (24, 561.3 + 7, 34, None)],
    "3F": [(25, -75.5, 60, lambda x, y: not IN_4F(x, y)), (26, 485.8, 60, None)],
    "4F": [(25, 106.5, 60, IN_4F)],
}
SCALE = 4          # 部屋さがしの画像の細かさ（1pt あたりのピクセル）
ORIGIN = (28.5, 104.0)  # 図の左上（1階のページの座標）。campus.js の座標もこれに合わせている
MAX_ROOM = 16000   # これより広い「部屋」は廊下や外に漏れたとみなす（pt²）
CODE = re.compile(r"\b([A-Z])(\d{3})\b")


def decode(text):
    """この PDF の英数字は 29 ずれて入っている（'$' → 'A'、'\\x14' → '1'）"""
    return "".join(chr(ord(c) + 29) if ord(c) < 0x60 else c for c in text)


def page_parts(page, dx, dy=0):
    segs, rects, spans = [], [], []
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                segs.append((it[1].x + dx, it[1].y + dy, it[2].x + dx, it[2].y + dy))
            elif it[0] == "re":
                r = it[1]
                rects.append((r.x0 + dx, r.y0 + dy, r.x1 + dx, r.y1 + dy))
            elif it[0] == "c":  # 曲線は端と端を結ぶ（細かい形は要らない）
                segs.append((it[1].x + dx, it[1].y + dy, it[4].x + dx, it[4].y + dy))
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                x0, y0, x1, y1 = s["bbox"]
                spans.append({"text": decode(s["text"]).strip(), "bbox": (x0 + dx, y0 + dy, x1 + dx, y1 + dy), "size": s["size"]})
    return segs, rects, spans


def clean_lines(segs, rects, spans):
    # 棟の名前など「部屋番号ではない長めの字」。その字のすぐ外を囲む枠の線だけを消す
    label_boxes = []
    for t in spans:
        x0, y0, x1, y1 = t["bbox"]
        if not CODE.search(t["text"]) and max(x1 - x0, y1 - y0) > 25:
            label_boxes.append((x0, y0, x1, y1))
    def in_label(x0, y0, x1, y1):
        for bx0, by0, bx1, by1 in label_boxes:
            m = 5  # 字から枠までの距離
            if abs(y0 - y1) < 0.2:  # 横線：字の上か下のすぐ近くで、字の幅くらいの長さ
                near = min(abs(y0 - by0), abs(y0 - by1)) < m
                inside = bx0 - m <= min(x0, x1) and max(x0, x1) <= bx1 + m
                if near and inside and abs(x1 - x0) > 0.6 * (bx1 - bx0):
                    return True
            if abs(x0 - x1) < 0.2:  # 縦線：字の左か右のすぐ近くで、字の高さくらいの長さ
                near = min(abs(x0 - bx0), abs(x0 - bx1)) < m
                inside = by0 - m <= min(y0, y1) and max(y0, y1) <= by1 + m
                if near and inside and abs(y1 - y0) > 0.6 * (by1 - by0):
                    return True
        return False

    rects = [r for r in rects if (r[2] - r[0]) > 4 or (r[3] - r[1]) > 4]          # 柱の印
    rects = [r for r in rects if (r[2] - r[0]) < 500 and (r[3] - r[1]) < 700]      # ページの外枠
    lines = set()
    for x0, y0, x1, y1 in segs:
        lines.add(tuple(round(v, 1) for v in (x0, y0, x1, y1)))
    for x0, y0, x1, y1 in rects:
        for s in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x0, y1, x1, y1), (x0, y0, x0, y1)):
            lines.add(tuple(round(v, 1) for v in s))
    lines = [l for l in lines if abs(l[0] - l[2]) + abs(l[1] - l[3]) > 0.3]
    lines = [l for l in lines if abs(l[1] - l[3]) < 700 and abs(l[0] - l[2]) < 500]  # ページいっぱいの線
    lines = [l for l in lines if not in_label(*l)]                                    # 字を囲んだ枠
    return lines


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(PDF)
    raw = {}
    for floor, parts in FLOORS.items():
        segs, rects, spans = [], [], []
        for page, sx, sy, keep in parts:
            s_, r_, t_ = page_parts(doc[page], 0, 0)
            ok = (lambda x0, y0, x1, y1: keep(x0, y0) and keep(x1, y1)) if keep else (lambda *a: True)
            segs += [(a + sx, b + sy, c + sx, d + sy) for a, b, c, d in s_ if ok(a, b, c, d)]
            rects += [(a + sx, b + sy, c + sx, d + sy) for a, b, c, d in r_ if ok(a, b, c, d)]
            spans += [{**t, "bbox": (t["bbox"][0] + sx, t["bbox"][1] + sy, t["bbox"][2] + sx, t["bbox"][3] + sy)} for t in t_ if ok(*t["bbox"])]
        raw[floor] = (clean_lines(segs, rects, spans), spans)

    # どの階も同じ座標
    xs = [v for lines, _ in raw.values() for l in lines for v in (l[0], l[2])]
    ys = [v for lines, _ in raw.values() for l in lines for v in (l[1], l[3])]
    bx0, by0 = ORIGIN
    w, h = max(xs) + 10 - bx0, max(ys) + 10 - by0

    data = {"viewBox": [0, 0, round(w, 1), round(h, 1)], "rooms": {}}
    for floor, (lines, spans) in raw.items():
        L = [(l[0] - bx0, l[1] - by0, l[2] - bx0, l[3] - by0) for l in lines]

        # 部屋さがし
        W, H = int(w * SCALE) + 1, int(h * SCALE) + 1
        img = Image.new("L", (W, H), 255)
        dr = ImageDraw.Draw(img)
        for a, b, c, e in L:
            dr.line([(a * SCALE, b * SCALE), (c * SCALE, e * SCALE)], fill=0, width=3)
        free = np.asarray(img) > 128
        labels, _ = ndimage.label(free)
        debug = img.convert("RGB")
        ddr = ImageDraw.Draw(debug)
        for s in spans:
            for m in CODE.finditer(s["text"]):
                c = m.group(0)
                cx = (s["bbox"][0] + s["bbox"][2]) / 2 - bx0
                cy = (s["bbox"][1] + s["bbox"][3]) / 2 - by0
                px, py = min(int(cx * SCALE), W - 1), min(int(cy * SCALE), H - 1)
                lab = labels[py, px]
                rect = None
                if lab:
                    region = labels == lab
                    ys_, xs_ = np.where(region)
                    area = len(xs_) / SCALE / SCALE
                    bw, bh = xs_.max() - xs_.min() + 1, ys_.max() - ys_.min() + 1
                    if area < MAX_ROOM and len(xs_) / (bw * bh) > 0.55:
                        rect = [round(xs_.min() / SCALE, 1), round(ys_.min() / SCALE, 1),
                                round(bw / SCALE, 1), round(bh / SCALE, 1)]
                        ddr.rectangle([xs_.min(), ys_.min(), xs_.max(), ys_.max()], outline=(220, 60, 60), width=3)
                data["rooms"][c] = {"floor": floor, "label": [round(cx, 1), round(cy, 1)], "rect": rect}
                ddr.text((px, py), c, fill=(0, 0, 255) if rect else (255, 0, 0))

        debug.resize((W // 2, H // 2)).save(ROOT / "tools" / f"trace-debug-{floor}.png")
        found = sum(1 for r in data["rooms"].values() if r["floor"] == floor and r["rect"])
        total = sum(1 for r in data["rooms"].values() if r["floor"] == floor)
        print(f"{floor}: 部屋番号 {total} 個（形が取れたもの {found}）")
        print("  形が取れなかったもの:", " ".join(sorted(c for c, r in data["rooms"].items() if r["floor"] == floor and not r["rect"])))

    (OUT / "rooms.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
