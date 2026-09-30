"""空の絵のパターンを作る。

元の夕焼けの空（site/assets/img/sky-sunset.webp）から「雲の形」と「筆のタッチ」を取り出し、
色だけを時間帯・天気ごとに塗り替える。絵を描き直すわけではないので、雲の流れは元の絵のまま。

    python tools/make-skies.py

色を変えたいときは、下の PATTERNS の色を書き換えて、もう一度動かす。
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

IMG = Path(__file__).resolve().parent.parent / "site" / "assets" / "img"
SRC = IMG / "sky-sunset.webp"

# base  : 空の色。上から下へ（位置 0〜1 と色）
# cloud : 雲の色。上から下へ
# cover : 雲の量（1 = 元の絵と同じ、大きいほど雲が広がる）
# detail: 筆のタッチの強さ
# moon  : 月を描くか
PATTERNS = {
    "dawn": {  # 明け方：紫から桃色、地平線は淡い金色
        "base": [(0, "#6F83C2"), (0.3, "#A99BD0"), (0.5, "#EDB2C2"), (0.66, "#F8D0B6"), (1, "#FFE6C4")],
        "cloud": [(0, "#F4E2F0"), (0.5, "#FFE3E6"), (1, "#FFF0D8")],
        "cover": 1.0, "detail": 0.9,
    },
    "day": {  # 昼：青空と白い雲
        "base": [(0, "#3F93D2"), (0.3, "#6FB6E6"), (0.55, "#A9D8F0"), (1, "#E4F2F5")],
        "cloud": [(0, "#FFFFFF"), (0.6, "#F6FAFC"), (1, "#FFFFFF")],
        "cover": 0.9, "detail": 0.7,
    },
    "dusk": {  # 日暮れ：藍から紫、地平線に残る橙
        "base": [(0, "#22285A"), (0.28, "#4E4282"), (0.46, "#A45B8C"), (0.58, "#E08A6A"), (1, "#F2AE78")],
        "cloud": [(0, "#5A4E86"), (0.4, "#C47A96"), (0.6, "#FFB08A"), (1, "#FFC89A")],
        "cover": 1.0, "detail": 1.0,
    },
    "night": {  # 夜：紺の空と、月明かりに照らされた薄い雲
        "base": [(0, "#050B20"), (0.35, "#0F1A40"), (0.6, "#1A2752"), (1, "#27335F")],
        "cloud": [(0, "#1E2A55"), (0.5, "#2C3A6A"), (1, "#36447A")],
        "cover": 0.8, "detail": 0.5, "moon": True,
    },
    "cloudy": {  # くもり：灰色の雲が空をおおう
        "base": [(0, "#8E9BA5"), (0.5, "#B3BBC0"), (1, "#CFD3D2")],
        "cloud": [(0, "#D9DDE0"), (0.5, "#E6E8E8"), (1, "#EEEEEC")],
        "cover": 1.5, "detail": 1.1,
    },
    "rain": {  # 雨：暗い雨雲
        "base": [(0, "#4D5864"), (0.5, "#6A7580"), (1, "#8A939A")],
        "cloud": [(0, "#77818B"), (0.5, "#8C959C"), (1, "#A0A7AC")],
        "cover": 1.6, "detail": 1.2,
    },
    "snow": {  # 雪：白っぽい灰色の空
        "base": [(0, "#AEB8C3"), (0.5, "#CBD2D9"), (1, "#E2E6EA")],
        "cloud": [(0, "#EEF1F4"), (0.5, "#F4F6F8"), (1, "#FAFAFB")],
        "cover": 1.4, "detail": 0.8,
    },
}


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float) / 255


def vertical(stops, h):
    """上から下へのグラデーション（高さ h 行ぶん）"""
    ys = np.linspace(0, 1, h)
    pos = [p for p, _ in stops]
    cols = np.array([hex_rgb(c) for _, c in stops])
    return np.stack([np.interp(ys, pos, cols[:, k]) for k in range(3)], axis=1)  # (h, 3)


def blur(a, r):
    return np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=float) / 255


def main():
    src = np.asarray(Image.open(SRC).convert("RGB"), dtype=float) / 255
    h, w, _ = src.shape
    lum = src @ np.array([0.299, 0.587, 0.114])
    sat = (src.max(2) - src.min(2)) / np.maximum(src.max(2), 1e-6)
    # 雲らしさ：まわりより明るく、色が薄いところ
    cloud = np.clip((lum - blur(lum, 60)) * 4 + (1 - sat) * 1.2 - 0.55, 0, 1)
    # 筆のタッチ：細かい明暗
    detail = lum - blur(lum, 3)

    for name, p in PATTERNS.items():
        base = vertical(p["base"], h)[:, None, :]
        cl = vertical(p["cloud"], h)[:, None, :]
        c = np.clip(cloud * p["cover"] + (p["cover"] - 1) * 0.25, 0, 1)[..., None]
        out = base * (1 - c) + cl * c + detail[..., None] * p["detail"]
        if p.get("moon"):
            yy, xx = np.mgrid[0:h, 0:w]
            cx, cy, r = w * 0.88, h * 0.05, w * 0.028  # カウントダウンの上、右上の角
            d = np.hypot(xx - cx, yy - cy)
            glow = np.clip(1 - d / (r * 9), 0, 1) ** 2 * 0.35
            disc = np.clip((r - d) / 2 + 0.5, 0, 1)
            out = out + glow[..., None] * hex_rgb("#AFC4FF")
            out = out * (1 - disc[..., None]) + disc[..., None] * hex_rgb("#FFF6DA")
        Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(IMG / f"sky-{name}.webp", quality=84, method=6)
        print("wrote", f"sky-{name}.webp")


if __name__ == "__main__":
    main()
