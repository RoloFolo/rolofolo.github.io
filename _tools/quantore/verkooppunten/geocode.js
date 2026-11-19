// Haalt alle verkooppunten op van quantore.com (Gatsby page-data) en zoekt per adres de coördinaten.
// NL: PDOK Locatieserver (overheid, vrij). BE: OpenStreetMap Nominatim (max. 1 verzoek per seconde).
// Gebruik: node geocode.js [uitvoer.json]     (standaard: stores.json naast dit script)
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, 'stores.json');
const REGIONS = ['be-antwerpen', 'be-brussel', 'be-limburg', 'be-oost-vlaanderen', 'be-vlaams-brabant',
  'be-west-vlaanderen', 'drenthe', 'flevoland', 'friesland', 'gelderland', 'groningen', 'limburg',
  'noord-brabant', 'noord-holland', 'overijssel', 'utrecht', 'zeeland', 'zuid-holland'];
const UA = 'quantore-prototype-geocoder/1.0';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function json(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'nl' } });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}

function splitStreet(s) {
  const m = s.trim().replace(/\s+/g, ' ').match(/^(.*?)\s+(\d+)\s*([A-Za-z]?)\b/);
  return m ? { street: m[1], nr: m[2], add: m[3] } : { street: s.trim(), nr: '', add: '' };
}

async function pdok(st) {
  const pc = st.postalCode.replace(/\s/g, '');
  const { nr, add } = splitStreet(st.street);
  const base = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fl=centroide_ll,weergavenaam,type&q=';
  // Eerst gevelde zoekvragen (exact postcode + huisnummer); vrije tekst alleen als terugval,
  // en dan alleen een treffer in dezelfde postcode of plaats.
  const tries = [
    [`postcode:${pc} AND huisnummer:${nr}` + (add ? ` AND huisletter:${add}` : ''), 'adres', true],
    [`postcode:${pc} AND huisnummer:${nr}`, 'adres', true],
    [`postcode:${pc}`, 'postcode', true],
    [`${st.street} ${st.postalCode} ${st.city}`, 'adres', false], [st.city, 'woonplaats', false]];
  for (const [q, type, exact] of tries) {
    if (/huisnummer:$|huisnummer: /.test(q) || !q.trim()) continue;
    const d = await json(base + encodeURIComponent(q) + '&fq=type:' + type);
    const doc = d.response.docs[0];
    const plausible = doc && (exact || doc.weergavenaam.replace(/\s/g, '').includes(pc) ||
      doc.weergavenaam.toLowerCase().includes(st.city.toLowerCase()));
    if (plausible) {
      const [lng, lat] = doc.centroide_ll.match(/[-\d.]+/g).map(Number);
      return { lat, lng, precision: type, match: doc.weergavenaam };
    }
  }
  return null;
}

async function nominatim(st) {
  const { street, nr } = splitStreet(st.street);
  const pc = st.postalCode.replace(/\D/g, '');
  const base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=be&';
  const tries = [
    [`street=${encodeURIComponent(`${nr} ${street}`)}&postalcode=${pc}&city=${encodeURIComponent(st.city)}`, 'adres'],
    [`street=${encodeURIComponent(`${nr} ${street}`)}&city=${encodeURIComponent(st.city)}`, 'adres'],
    [`postalcode=${pc}&city=${encodeURIComponent(st.city)}`, 'postcode'],
    [`city=${encodeURIComponent(st.city)}`, 'woonplaats']];
  for (const [q, precision] of tries) {
    await sleep(1100);
    const d = await json(base + q);
    if (d[0]) return { lat: +d[0].lat, lng: +d[0].lon, precision, match: d[0].display_name };
  }
  return null;
}

(async () => {
  const stores = [];
  for (const slug of REGIONS) {
    const d = await json(`https://www.quantore.com/page-data/verkooppunten/${slug}/page-data.json`);
    const region = d.result.data.region.name;
    for (const { node: n } of d.result.data.stores.edges) {
      stores.push({
        id: n.id, name: n.storeName.trim(), street: n.street.trim().replace(/\s+/g, ' '),
        postalCode: n.postalCode.trim(), city: n.city.trim(), phone: (n.phoneNumber || '').trim(),
        website: (n.websiteUrl || '').trim(), webOnly: !!n.webOnly,
        country: slug.startsWith('be-') ? 'BE' : 'NL', region, regionSlug: slug,
      });
    }
  }
  console.log(stores.length, 'verkooppunten opgehaald');
  for (const st of stores) {
    // Land volgt de regio; een NL-postcode (1234 AB) in een BE-regio wint toch.
    const nlPostcode = /^\d{4}\s?[A-Za-z]{2}$/.test(st.postalCode.trim());
    const isBE = st.regionSlug.startsWith('be-') && !nlPostcode;
    st.country = isBE ? 'BE' : 'NL';
    if (isBE) st.postalCode = st.postalCode.replace(/\D/g, '');   // "B - 3700" -> "3700"
    try {
      Object.assign(st, (isBE ? await nominatim(st) : await pdok(st)) || { lat: null, lng: null, precision: 'geen' });
    } catch (e) {
      console.error('fout', st.name, e.message);
      Object.assign(st, { lat: null, lng: null, precision: 'geen' });
    }
    console.log(st.precision.padEnd(10), st.country, st.name, '|', st.street, st.postalCode, st.city);
  }
  fs.writeFileSync(OUT, JSON.stringify(stores, null, 1));
  const bad = stores.filter(s => s.precision !== 'adres');
  console.log(`\nKlaar: ${stores.length}, niet op adresniveau: ${bad.length}`);
})();
