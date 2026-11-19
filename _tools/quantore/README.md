# Quantore-prototype: zo is het gemaakt

De map `quantore-c01c1018/` is een statische 1:1-kopie van de bovenste laag van www.quantore.com
(homepage en de 42 pagina's uit hoofdmenu en footer), zonder login, zonder tracking en zonder CMS.
Links naar diepere pagina's (artikelen, nieuws) gaan naar de echte site.

## Hoe het werkt

- Het origineel is een Gatsby/React-site die per schermbreedte een andere pagina opbouwt.
  Daarom heeft elke pagina drie versies: `index.html` (desktop, vanaf 1024 px), `t.html` (tablet, 769–1023 px)
  en `m.html` (mobiel, tot en met 768 px). Een klein script in de `<head>` kiest de juiste.
- `assets/site.css` bevat alle opmaak van het origineel; afbeeldingen en lettertypes staan in `assets/`.
- `assets/proto.js` doet na wat het origineel met React deed: het hamburgermenu met submenu's,
  de header die krimpt en wegschuift bij scrollen, de uitklapblokken in de footer, de slider
  en formulieren die niets versturen. De vastgelegde toestanden staan in `assets/proto-data.js`.
- Elke pagina heeft `noindex` en een label "Prototype · niet de officiële website".

## Opnieuw kopiëren

Nodig: Node met Playwright (al aanwezig in Claude Code-cloudsessies), `npm i cheerio@1.0.0`, Python met Pillow.
Netwerktoegang tot www.quantore.com en images.ctfassets.net.

```sh
sed 's#^#https://www.quantore.com#' top.txt > top-urls.txt
node snap.js top-urls.txt raw 4          # pagina's opslaan in drie breedtes
node headerstates.js                     # menutoestanden en scrollgedrag vastleggen
node capture.js https://www.quantore.com/ # uitklapblokken vastleggen
node build.js raw site                   # omzetten naar statische site
cp src/* site/assets/
node fetch-assets.js assets.json site/assets
python3 -I shrink.py site/assets         # te grote afbeeldingen verkleinen
node test.js http://localhost:8000/      # testen (eerst: cd site && python3 -m http.server 8000)
```

## Inhoud aanpassen

Er is geen CMS: vraag Claude om de tekst in de HTML-bestanden aan te passen.
Let op dat elke pagina drie versies heeft (index.html, t.html, m.html).
