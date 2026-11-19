# Maak interne links expliciet (map/ -> map/index.html), zodat de site ook werkt op hosts
# die geen index.html bij een map tonen (zoals raw.githack.com of een los bestand).
import os, re, sys
root = sys.argv[1]
href = re.compile(r'href="((?:\./|\.\./|[a-z0-9-]+/)[^"#?:]*?/)(#[^"]*)?"')
n = 0
for d, _, files in os.walk(root):
    for f in files:
        p = os.path.join(d, f)
        if f.endswith('.html'):
            s = open(p, encoding='utf-8').read()
            t = href.sub(lambda m: 'href="' + m.group(1) + 'index.html' + (m.group(2) or '') + '"', s)
            t = t.replace("{d:'./',t:'t.html',m:'m.html'}", "{d:'index.html',t:'t.html',m:'m.html'}")
            t = re.sub(r'href="(\./|(?:\.\./)+)"', lambda m: 'href="' + m.group(1) + 'index.html"', t)
        elif f in ('proto.js', 'proto-data.js'):
            s = open(p, encoding='utf-8').read()
            t = s.replace("{ d: './', t: 't.html', m: 'm.html' }", "{ d: 'index.html', t: 't.html', m: 'm.html' }")
            t = re.sub(r'href=\\"(%ROOT%[^"\\#]*?/)(#[^"\\]*)?\\"', lambda m: 'href=\\"' + m.group(1) + 'index.html' + (m.group(2) or '') + '\\"', t)
            t = t.replace('href=\\"%ROOT%\\"', 'href=\\"%ROOT%index.html\\"')
        else:
            continue
        if t != s:
            open(p, 'w', encoding='utf-8').write(t); n += 1
print('aangepast', n)
