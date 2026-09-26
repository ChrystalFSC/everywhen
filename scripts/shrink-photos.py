# Converts images/raw/*.img into small progressive JPEGs in images/photos/ (560 px wide, cropped to 16:10).
import os
from PIL import Image, ImageOps
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
raw, out = os.path.join(root, 'images', 'raw'), os.path.join(root, 'images', 'photos')
os.makedirs(out, exist_ok=True)
total = 0
for f in sorted(os.listdir(raw)):
    if not f.endswith('.img'):
        continue
    im = ImageOps.exif_transpose(Image.open(os.path.join(raw, f))).convert('RGB')
    im = ImageOps.fit(im, (560, 350), Image.LANCZOS, centering=(0.5, 0.45))
    dst = os.path.join(out, f[:-4] + '.jpg')
    im.save(dst, 'JPEG', quality=70, optimize=True, progressive=True)
    total += os.path.getsize(dst)
print(len(os.listdir(out)), 'photos,', round(total / 1024), 'KB')
