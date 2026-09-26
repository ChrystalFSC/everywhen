# Draws the Everywhen app icon (violet route arc on light lilac) at the sizes iOS and Android need.
from PIL import Image, ImageDraw
import math, os
here = os.path.dirname(os.path.abspath(__file__))
def icon(size, pad=0.0):
    S = size * 4
    im = Image.new("RGB", (S, S), (237, 230, 255))
    d = ImageDraw.Draw(im)
    m = S * pad
    # faint dot grid
    step = S / 14
    for i in range(1, 14):
        for j in range(1, 14):
            d.ellipse([i*step - S*.006, j*step - S*.006, i*step + S*.006, j*step + S*.006], fill=(214, 202, 250))
    # arc from bottom-left to top-right
    a, b = (m + S*.24, S - m - S*.26), (S - m - S*.24, m + S*.26)
    c = (S*.30, S*.28)
    pts = []
    for k in range(101):
        t = k / 100; u = 1 - t
        pts.append((u*u*a[0] + 2*u*t*c[0] + t*t*b[0], u*u*a[1] + 2*u*t*c[1] + t*t*b[1]))
    d.line(pts, fill=(139, 108, 240), width=int(S*.045), joint="curve")
    r = S*.055
    for (x, y), col in ((a, (91, 63, 196)), (b, (232, 178, 26))):
        d.ellipse([x-r, y-r, x+r, y+r], fill=col)
    return im.resize((size, size), Image.LANCZOS)
icon(180).save(os.path.join(here, "apple-touch-icon.png"))
icon(192).save(os.path.join(here, "icon-192.png"))
icon(512).save(os.path.join(here, "icon-512.png"))
icon(512, pad=.1).save(os.path.join(here, "icon-maskable-512.png"))
