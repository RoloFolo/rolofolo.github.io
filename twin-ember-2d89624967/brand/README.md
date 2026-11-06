# Twin Ember — huisstijl

Twin Ember V.O.F. is het digitale productiehuis van Roland en Patrick. We beginnen met games (Darklife is de eerste titel) en maken alles wat digitaal is en een vonk nodig heeft.

> *Two embers. One fire.*

## Het verhaal

Een ember is wat overblijft als het vuur uit lijkt: een kool die blijft gloeien tot iemand er lucht bij geeft. Opgegroeid in het 8-bit tijdperk, rond ons 40e samen weer aangeblazen. Alles in deze huisstijl komt uit één beeld: **licht in het donker**.

| | Rol | Klasse |
|---|---|---|
| Roland | Sparkmaker — dromer: werelden, ideeën, art direction | Dreamer |
| Patrick | Firekeeper — strateeg: business, deals, het plan | Strategist |

## Logo

Gekozen: **beeldmerk A, de pixel-vlam**. Eén vlam uit twee helften (links ember, rechts amber), onderaan twee losse kolen die samen één vlam worden.

| Bestand | Gebruik |
|---|---|
| `logo/twin-ember-mark.svg` | Beeldmerk op donker (night) |
| `logo/twin-ember-mark-on-light.svg` | Beeldmerk op licht: cinder + ember (amber verdwijnt op papier) |
| `logo/twin-ember-mark-mono-bone.svg` / `-mono-ink.svg` | Eenkleurig, voor stempels, gravure, borduren |
| `logo/twin-ember-app-icon.svg` / `-cinder.svg` | Avatar en app-icoon, met marge voor ronde uitsnedes |
| `logo/twin-ember-lockup-dark.svg` / `-light.svg` | Beeldmerk + woordmerk |

Woordmerk: Big Shoulders Display 800, hoofdletters, "Ember" in `ember` (op licht: `ember-deep`). De lockups gebruiken live tekst; laat ze voor drukwerk omzetten naar contouren.

Regels: vrije ruimte rondom minimaal twee "pixels" van het beeldmerk. Minimaal 16 px (beeldmerk) of 6 mm (print). Geen gradiënt, schaduw, gloed, rotatie of andere kleuren.

## Kleur

Donker is de basis. `ember` is het vuur: spaarzaam, één primaire actie of accent per scherm.

| Token | Hex | Gebruik |
|---|---|---|
| `night-000` | #0e0c0b | Hero's, splash, app-iconen |
| `night-100` | #171412 | Standaard paginagrond |
| `night-200` | #241f1b | Kaarten, panelen |
| `ash` | #4a4038 | Alleen decoratieve lijnen |
| `smoke` | #a69c92 | Gedempte tekst, randen van velden |
| `bone` | #efe7dc | Hoofdtekst (13:1+ op night) |
| `ember` | #ff6a1f | Merkkleur; tekst erop is `on-ember` |
| `amber` | #ffb347 | Gloed: hover, focus, vonken |
| `cinder` | #9a3412 | Grote vlakken, nooit tekst |
| `on-ember` | #1a0e07 | Tekst op ember en amber |

**Lichte variant** (documenten): `paper` #f6f1ea, `paper-200` #ebe3d8, `ink` #1a1512, `ink-muted` #5f554c, `ember-deep` #c2410c.

Alle tokens staan in `tokens.json`; `tokens.css` zet ze als CSS-variabelen (`var(--ember)`).

## Typografie

| Familie | Font | Gebruik |
|---|---|---|
| display | Big Shoulders Display 700/800 | Titels, hero's, vaak hoofdletters |
| sans | Archivo 400–600 | Lopende tekst en interface |
| pixel | Silkscreen | Labels en tags, alleen kort ("PRESS START") |

Alle drie gratis via Google Fonts.

## Vorm, ruimte, beeld

- Bijna vierkant: `radius-sm` 2px standaard, `radius-md` 6px voor kaarten.
- Raster van 8px: `space-2` 8, `space-4` 16, `space-6` 24, `space-10` 40.
- Vlak, geen schaduwen. Diepte komt uit de night-trappen en uit gelaagdheid.
- Motief: **vonken als pixels** die opstijgen uit twee bronnen.
- Iconen (`icons/`): 24×24, 2px lijn, rechte hoeken, `currentColor`.
- Avatars (`avatars/`): 8-bit portretten van Roland en Patrick.

## Toon

Kort en zelfverzekerd. Warm, niet schreeuwerig: geen uitroeptekens, geen emoji. Retro als knipoog, nooit als grap. Naar buiten Engels, lokaal mag Nederlands.

Taglines: *Two embers. One fire.* · *Rekindled since the 8-bit era.* · *Small spark. Big fire.*

## Nog open

Domein en e-mailadressen, achternamen, KvK, BTW en IBAN. Key art en pitch van Darklife voor de website.
