# Stacking Mad op Google Play: stand van zaken

## Klaar

- App: `com.naberiusgames.stackingmad`, versie 1.3.0 (versionCode 12), richt zich op Android 16 (API 36).
- Engels standaard, Nederlands op een Nederlandse telefoon; wisselen onder ⚙️ > Language.
- Beloonde AdMob-video's voor +1 leven, Ga verder en Buit ×2; nooit reclame waar je niet om vraagt.
- Leeftijdsvraag bij de eerste start (blijft op de telefoon):
  onder 13 kindgerichte reclame (G, geen toestemmingsscherm), onder 16 nooit gepersonaliseerd,
  16+ Google's toestemmingsscherm (UMP). Privacyknop onder ⚙️ waar de wet dat vraagt.
- Webpagina: https://naberiusgames.com/stacking-mad/
- Privacybeleid: https://naberiusgames.com/stacking-mad/privacy.html
- `app-ads.txt` op de site heeft de uitgevers-ID al (dezelfde AdMob-account als ImpLegion).
- Winkelpakket (icoon, banner, 7 schermafbeeldingen, teksten EN/NL) is apart meegestuurd.
- Uploadsleutel: `upload.keystore` + `keystore.properties`, niet in deze repository.
  Zet ze in deze map (`stapelgek-full/android/`) om een Play-versie te ondertekenen.

## Nog te doen

1. ~~AdMob: app en beloond advertentieblok~~ klaar: `ca-app-pub-1349513335917341~4329559917` en
   `…/8077233231` staan in `gradle.properties`; Stacking Mad hangt aan het GDPR-bericht van ImpLegion;
   testtoestellen zijn al aangemeld. Versie 1.3.0, versionCode 13 is gebouwd.
2. Voor elke volgende Play-upload: `versionCode` in `app/build.gradle` ophogen, dan
   `cd .. && npm run build && cd android && ./gradlew bundleRelease assembleRelease`.
3. Play Console: app aanmaken, winkelpagina vullen, formulieren hieronder, AAB in een gesloten test.
4. Gesloten test: 12 testers, 14 dagen achter elkaar (geldt per app voor persoonlijke accounts
   die na november 2023 zijn aangemaakt). Daarna productie aanvragen.
5. In AdMob de app aan Google Play koppelen (App-instellingen > App-winkel toevoegen).
6. Daarna: knop "Get it on Google Play" op de webpagina en de homepage.

## Antwoorden voor de formulieren in de Play Console

**App-toegang:** alles is zonder inloggen te gebruiken.

**Advertenties:** ja, de app bevat advertenties.

**Advertentie-ID:** ja, gebruikt voor advertenties (via de AdMob-SDK).

**Doelgroep en content:** alle leeftijdsgroepen, ook onder 13, dus een gemengde doelgroep.
De app spreekt kinderen aan: ja. Advertenties volgen het Families-beleid
(AdMob is een gecertificeerde SDK; kinderen krijgen kindgerichte reclame met classificatie G).

**Leeftijdsclassificatie (IARC):** categorie Game (puzzel/arcade). Geen geweld (de bom en het
dynamiet blazen alleen blokken weg), geen angst, geen seks, geen grof taalgebruik, geen drugs of gokken.
Geen contact tussen gebruikers, geen gedeelde locatie, geen aankopen. Verwachting: PEGI 3 / Everyone.

**Gegevensveiligheid:** de app zelf verzamelt niets; de AdMob-SDK wel. Opgeven:
- Verzamelt of deelt de app gegevens: ja.
- Versleuteld onderweg: ja. Gebruikers kunnen verwijdering aanvragen: nee
  (de game bewaart alles op de telefoon; voor Google's gegevens verwijst het beleid naar Google).
- Locatie, bij benadering (afgeleid uit het IP-adres): verzameld en gedeeld, voor advertenties.
- App-activiteit, interacties in de app (met advertenties): verzameld en gedeeld, voor advertenties en analyse.
- App-info en prestaties, crashlogs en diagnose: verzameld, voor analyse.
- Apparaat- of andere ID's (advertentie-ID): verzameld en gedeeld, voor advertenties, analyse en fraudepreventie.
- Niets hiervan is verplicht voor de werking van het spel; het hoort bij de vrijwillige video's.

**Overheidsapp, financiële functies, gezondheid, nieuws:** nee.
