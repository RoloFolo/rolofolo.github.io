"""Zet de interactieve verkooppuntenkaart in verkooppunten/overzicht (index.html, t.html en m.html).

Vervangt de sectie met het statische kaartje. De oude inhoud (plaatje + regiolijst) blijft binnen
#vp-finder staan als terugval zonder JavaScript. Mag vaker gedraaid worden.
Gebruik: python -I apply.py [map met de site]   (standaard: ../../../quantore-c01c1018)
"""
import pathlib
import re
import sys

here = pathlib.Path(__file__).resolve().parent
site = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here.parents[2] / 'quantore-c01c1018'
page_dir = site / 'verkooppunten' / 'overzicht'

START, END = '<!--vp-finder-->', '<!--/vp-finder-->'
OLD = re.compile(r'<section class="Spacer-sc-126avrt-0 hdbaYg">(<div class="Container__Wrapper-sc-6d4fop-0 jnVBkS styles__Container-sc-p5akz6-0 hXNlEQ">.*?</ul></div></div>)</section>', re.S)
DONE = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.S)
FALLBACK = re.compile(r'<div id="vp-finder" class="vp">(.*?)</div><script', re.S)


def block(fallback):
    return (START + '<section class="Spacer-sc-126avrt-0 hdbaYg"><div class="Container__Wrapper-sc-6d4fop-0 jnVBkS">'
            '<link rel="stylesheet" href="../../assets/vp-finder.css">'
            f'<div id="vp-finder" class="vp">{fallback}</div>'
            '<script src="../../assets/vp-data.js"></script><script src="../../assets/vp-finder.js"></script>'
            '</div></section>' + END)


for name in ('index.html', 't.html', 'm.html'):
    f = page_dir / name
    s = f.read_text(encoding='utf-8')
    if START in s:
        old = DONE.search(s).group(0)
        s = s.replace(old, block(FALLBACK.search(old).group(1)))
    else:
        m = OLD.search(s)
        if not m:
            sys.exit(f'{f}: sectie met het kaartje niet gevonden')
        s = s[:m.start()] + block(m.group(1)) + s[m.end():]
    f.write_text(s, encoding='utf-8')
    print('bijgewerkt:', f)
