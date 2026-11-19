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

Nodig: Node 20+, `npm install` en `npx playwright install chromium` in deze map, Python met Pillow. Zie ook OVERDRACHT.md.
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
python3 -I explicit-index.py site        # links expliciet naar index.html
node test.js http://localhost:8000/      # testen (eerst: cd site && python3 -m http.server 8000)
```

## Verkooppuntenkaart (`/verkooppunten/overzicht`)

Het origineel toonde een plaatje en een lijst met links. De kopie heeft een eigen klikbare kaart van Nederland en België:
klik op een provincie, dan op een gemeente, en je ziet de kantoorvakhandels daar, met telefoon, website en route.
Heeft een gemeente geen kantoorvakhandel, dan toont de kaart de dichtstbijzijnde. Je kunt zoeken op plaats, postcode of naam
en filteren op "met winkel" of "alleen online". Elke stap krijgt een eigen adres, bijvoorbeeld `#utrecht/woerden`, zodat je
kunt delen en de terugknop werkt. Zonder JavaScript blijft het oude plaatje met de regiolijst staan.

- `assets/vp-finder.js` en `assets/vp-finder.css`: de kaart. Plain JavaScript met SVG, zonder bibliotheken en zonder kaarttegels van buiten.
- `assets/vp-data.js`: gegenereerd, niet met de hand aanpassen.
- `verkooppunten/`: de scripts om de data te vernieuwen.

Verkooppunten bijwerken, bijvoorbeeld als er een winkel bij komt:

```sh
cd _tools/quantore/verkooppunten
node geocode.js          # haalt alle 18 regio's op van quantore.com (Gatsby page-data) en zoekt de coördinaten
node build-map.js        # grenzen + verkooppunten -> quantore-c01c1018/assets/vp-data.js
python -I apply.py       # zet de kaart in index.html, t.html en m.html (alleen nodig na een nieuwe kopie)
```

- **Coördinaten:** in Nederland via de PDOK Locatieserver, op postcode en huisnummer. In België via OpenStreetMap Nominatim, met maximaal één verzoek per seconde.
- **Grenzen:** Nederland komt uit de CBS-gebiedsindelingen 2025 (PDOK), België uit geoBoundaries (provincies en gemeenten). `build-map.js` downloadt ze eenmalig naar `verkooppunten/geo/` en vereenvoudigt ze zo dat de grenzen tussen buren dicht blijven.
- **Gemeente en provincie** van elk verkooppunt bepaalt de kaart zelf uit de coördinaten. `build-map.js` meldt het als dat afwijkt van de regio op quantore.com.

## Inhoud aanpassen

Er is geen CMS: vraag Claude om de tekst in de HTML-bestanden aan te passen.
Let op dat elke pagina drie versies heeft (index.html, t.html, m.html).
