# Verklein afbeeldingen boven 800 KB tot max. 1920 px breed (jpg) of 1200 px (png); bestandsnaam blijft gelijk.
import os, sys
from PIL import Image
d = sys.argv[1]; before = after = 0
for n in os.listdir(d):
    p = os.path.join(d, n)
    if not n.lower().endswith(('.jpg', '.jpeg', '.png')) or os.path.getsize(p) < 800_000: continue
    s0 = os.path.getsize(p); before += s0
    im = Image.open(p); im.load()
    maxw = 1200 if n.lower().endswith('.png') else 1920
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    if n.lower().endswith('.png'):
        im = im.quantize(colors=256, method=Image.FASTOCTREE) if im.mode == 'RGBA' else im.convert('P', palette=Image.ADAPTIVE)
        im.save(p, optimize=True)
    else:
        im.convert('RGB').save(p, quality=82, optimize=True, progressive=True)
    after += os.path.getsize(p)
    print(n, s0 // 1000, '->', os.path.getsize(p) // 1000, 'KB')
print('totaal', before // 1_000_000, '->', after // 1_000_000, 'MB')
