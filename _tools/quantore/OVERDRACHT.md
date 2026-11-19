# Overdracht: Quantore-prototype

Stand van zaken op 19 november 2026, uit een Claude Code-cloudsessie.
Alles staat op de branch `claude/quantore-prototype-6rngko` van `RoloFolo/rolofolo.github.io`.

## Wat er is

- `quantore-c01c1018/`: statische 1:1-kopie van de bovenste laag van www.quantore.com.
  - 43 pagina's: de homepage, alle pagina's uit het hoofdmenu en de footer, en `/verkooppunten/overzicht`.
  - De originele opmaak, het logo, het lettertype (Adelle) en de afbeeldingen staan lokaal; de site laadt niets van buiten.
  - Drie versies per pagina, net als het origineel: `index.html` (desktop, vanaf 1024 px), `t.html` (tablet, 769–1023 px) en `m.html` (mobiel, tot en met 768 px). Een script in de `<head>` kiest de juiste.
  - Werkend gedrag: de uitklapmenu's op desktop, het hamburgermenu met submenu's, de header die bij scrollen krimpt en wegschuift, de uitklapblokken in de footer en de slider. Dat zit in `assets/proto.js` en `assets/proto-data.js`.
  - Niet meegekopieerd: Inloggen, Extranet, tracking (Google Tag Manager) en de React-scripts van het origineel. Formulieren versturen niets.
  - Links naar diepere pagina's (artikelen, nieuws) gaan naar de echte quantore.com.
  - Elke pagina staat op `noindex` en heeft linksonder het label "Prototype · niet de officiële website".
  - Alle interne links verwijzen expliciet naar `index.html`, dus de site werkt op elke statische host.
  - Grootte: ongeveer 41 MB, waarvan het meeste afbeeldingen. Foto's boven 800 KB zijn verkleind.
- `quantore-c01c1018/firebase.json`: hostingconfiguratie voor Firebase.
- `_tools/quantore/`: de scripts waarmee de kopie gemaakt is. Uitleg staat in `README.md`.

**Getest:** alle 43 pagina's in alle drie de breedtes, vanuit de submap. Geen JS-fouten, geen kapotte afbeeldingen of links, geen verzoeken naar andere servers, geen zijwaarts scrollen. Het menu, de footerblokken, de slider en de scrollende header werken.

**Online bekijken** (zolang de repo openbaar is):
https://raw.githack.com/RoloFolo/rolofolo.github.io/d7bb9b9a90200147e44feb67724b5fa316283ee8/quantore-c01c1018/index.html

## Lokaal bekijken

```sh
git clone https://github.com/RoloFolo/rolofolo.github.io.git
cd rolofolo.github.io
git checkout claude/quantore-prototype-6rngko
cd quantore-c01c1018
python3 -m http.server 8000      # op Windows: py -m http.server 8000
```

Open daarna http://localhost:8000/. Gebruik een webserver: als los bestand (`file://`) werkt de keuze tussen desktop, tablet en mobiel niet goed.

## Lokaal opnieuw kopiëren (optioneel)

Dit is alleen nodig als quantore.com verandert of als je meer pagina's wilt. Je hebt Node 20 of nieuwer en Python 3 met Pillow nodig.

```sh
cd _tools/quantore
npm install
npx playwright install chromium
pip install pillow

sed 's#^#https://www.quantore.com#' top.txt > top-urls.txt   # top.txt = de lijst met pagina's
node snap.js top-urls.txt raw 4            # pagina's opslaan, drie breedtes (ca. 10 min)
node headerstates.js                       # menutoestanden en scrollgedrag (ca. 15 min)
node capture.js https://www.quantore.com/  # uitklapblokken en slider
node build.js raw site                     # omzetten naar statische site
cp src/* site/assets/
node fetch-assets.js assets.json site/assets
python3 -I shrink.py site/assets
python3 -I explicit-index.py site          # links expliciet naar index.html
(cd site && python3 -m http.server 8000) & node test.js http://localhost:8000/
```

Kopieer daarna `site/` over `quantore-c01c1018/` heen, maar laat `firebase.json` staan.

Meer of minder pagina's? Pas `top.txt` aan; elke regel is een pad, bijvoorbeeld `/contact`.

Aandachtspunten:
- **Klassenamen in `build.js`:** het scrollgedrag van de header gebruikt de klassenamen van het origineel (`fpJJVw`, `kpkoes`, `eZXlx`, `hqRMlw` en de compacte varianten). Als Quantore hun site opnieuw bouwt, veranderen die. Draai dan `headerstates.js` opnieuw en neem de nieuwe namen over uit de scroll-log in `header-states.json`.
- **Volgorde van de menuklikken:** het hamburgermenu speelt vastgelegde HTML-toestanden af, gekoppeld aan de positie van elk element in de `<header>`. Daarom worden Inloggen en Extranet verborgen (`hidden`) en niet verwijderd.
- **Mapnamen:** GitHub Pages (Jekyll) publiceert geen mappen die met `_` beginnen. Daarom heet de map met bestanden `assets` en niet `_assets`, en blijft `_tools/` onzichtbaar op de site.

## Live zetten

- **GitHub Pages:** merge de branch naar `main`. De site staat dan op https://naberiusgames.com/quantore-c01c1018/.
- **Firebase (project van het vriendenweekend):**
  ```sh
  npm install -g firebase-tools
  firebase login
  cd quantore-c01c1018
  firebase hosting:sites:create quantore-prototype --project <project-id>   # eenmalig; of haal "site" uit firebase.json
  firebase deploy --only hosting --project <project-id>
  ```

## Open punten

1. **Waar komt het live?** GitHub Pages (merge naar `main`) of Firebase (project-ID van het vriendenweekend nodig). Dit is nog niet gekozen.
2. **Rechten:** Adelle is een betaald lettertype, en de teksten en foto's zijn van Quantore. Zet de kopie alleen openbaar als jij of Quantore daar toestemming voor heeft.
3. **Klein verschil:** in het mobiele menu kan het derde submenu (Duurzaamheid) niet worden ingeklapt als alle drie de submenu's open staan. Het lag tijdens het vastleggen onder de rand van het scherm.
4. **Verkooppunten:** `/verkooppunten/overzicht` is een momentopname. Zoeken en filteren werken niet, want dat deed het origineel met React.
5. **Inhoud aanpassen:** er is geen CMS. Wijzigingen gaan in de HTML. Elke pagina heeft drie versies, dus pas `index.html`, `t.html` en `m.html` alle drie aan.

## Startprompt voor een lokale Claude Code-sessie

Plak dit in Claude Code, in je lokale clone op de branch `claude/quantore-prototype-6rngko`:

> Ik werk verder aan het Quantore-prototype in `quantore-c01c1018/`, een statische 1:1-kopie van de bovenste laag van quantore.com.
> Lees eerst `_tools/quantore/OVERDRACHT.md` en `_tools/quantore/README.md`.
> Jij bent het CMS: inhoud pas je aan in de HTML, en altijd in alle drie de versies (`index.html`, `t.html` en `m.html`).
> Houd per pagina `noindex` en het prototypelabel, en voeg geen login of tracking toe.
> Test na elke wijziging met `node _tools/quantore/test.js http://localhost:8000/`, terwijl de site wordt geserveerd vanuit `quantore-c01c1018/`.
> Mijn eerste vraag: …
