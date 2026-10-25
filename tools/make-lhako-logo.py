import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

IMG = Path(__file__).resolve().parent.parent / "site" / "assets" / "img"
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else IMG / "lhako-logo-src.png"
WIDTH = 1200

im = Image.open(SRC).convert("RGB")
if im.width > WIDTH:
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
px = np.asarray(im).astype(np.float64)
mn, mx = px.min(axis=2), px.max(axis=2)

core = Image.fromarray(((mx < 70) * 255).astype("uint8"))
zone = np.asarray(core.filter(ImageFilter.MaxFilter(9))) > 0

ink_alpha = (255 - mn) / 255
ink_alpha = np.where(ink_alpha < 0.03, 0, ink_alpha)
other_alpha = np.clip((245 - mn) / 45, 0, 1)
alpha = np.where(zone, ink_alpha, other_alpha)

safe = np.maximum(ink_alpha, 1e-6)[..., None]
ink_color = np.clip((px - 255 * (1 - safe)) / safe, 0, 255)
color = np.where(zone[..., None], ink_color, px)
lifted = 255 * (px / 255) ** 0.8
dark = np.where(zone[..., None], 255.0, lifted)


def save(rgb, name):
    out = np.dstack([rgb, alpha * 255]).clip(0, 255).astype("uint8")
    Image.fromarray(out, "RGBA").save(IMG / name, quality=92, method=6)
    print(IMG / name)


save(color, "lhako-logo.webp")
save(dark, "lhako-logo-dark.webp")
