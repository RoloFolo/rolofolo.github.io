// Quantore prototype. Geen CMS: alle inhoud komt uit content.json. Deze code tekent alleen.
(function () {
  "use strict";

  var C = null;
  var app = document.getElementById("app");

  // Veilige tekst in HTML.
  function e(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ext(href) { return /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ""; }
  function link(l, cls) { return '<a class="' + (cls || "") + '" href="' + e(l.href) + '"' + ext(l.href) + ">" + e(l.label) + "</a>"; }

  // Iconen per categorie (lijnwerk, kleur via currentColor).
  var I = {
    papier: '<path d="M7 3h11l5 5v21H7z"/><path d="M18 3v5h5M11 14h9M11 19h9M11 24h6"/>',
    pen: '<path d="M21 4l7 7-15 15-8 2 2-8z"/><path d="M18 7l7 7"/>',
    map: '<path d="M3 9h10l3 3h13v15H3z"/><path d="M3 9V6h9l3 3"/>',
    printer: '<path d="M9 12V4h14v8M9 23H5V12h22v11h-4"/><path d="M9 18h14v10H9z"/>',
    spray: '<path d="M11 12h10v16H11zM13 12V7h6v5M19 7h5M24 4v6"/>',
    koffie: '<path d="M5 11h18v8a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z"/><path d="M23 13h2a3 3 0 0 1 0 6h-2M10 4v3M15 4v3"/>',
    stoel: '<path d="M10 4h12v12H10zM7 16h18v4H7zM16 20v6M10 28h12M16 26v2"/>',
    scherm: '<path d="M3 5h26v17H3zM12 27h8M16 22v5"/>',
    doos: '<path d="M4 10l12-6 12 6v13l-12 6-12-6z"/><path d="M4 10l12 6 12-6M16 16v13"/>'
  };
  function ico(name) {
    return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + (I[name] || I.doos) + "</svg>";
  }

  // Heldenbeeld: kantoorspullen in de huiskleuren.
  var HERO_SVG =
    '<svg class="hero-beeld" viewBox="0 0 440 400" aria-hidden="true">' +
    '<circle cx="250" cy="200" r="170" fill="#163d6b"/>' +
    '<rect x="80" y="230" width="260" height="120" rx="10" fill="#f28c00"/>' +
    '<path d="M80 270h260" stroke="#d97a00" stroke-width="4"/>' +
    '<rect x="186" y="250" width="48" height="10" rx="5" fill="#fff" opacity=".8"/>' +
    '<g transform="rotate(-8 190 160)"><rect x="110" y="110" width="150" height="120" rx="6" fill="#fff"/>' +
    '<rect x="128" y="132" width="90" height="8" rx="4" fill="#c9d1dc"/><rect x="128" y="150" width="110" height="8" rx="4" fill="#c9d1dc"/><rect x="128" y="168" width="70" height="8" rx="4" fill="#c9d1dc"/></g>' +
    '<g transform="rotate(10 300 150)"><rect x="250" y="70" width="90" height="160" rx="8" fill="#2f7d4f"/><rect x="262" y="84" width="66" height="34" rx="4" fill="#fff" opacity=".9"/><circle cx="295" cy="200" r="9" fill="none" stroke="#fff" stroke-width="5"/></g>' +
    '<g transform="rotate(-35 330 300)"><rect x="250" y="292" width="170" height="18" rx="9" fill="#fff"/><rect x="250" y="292" width="40" height="18" rx="9" fill="#0d2b4e"/><path d="M420 301l18 0" stroke="#fff" stroke-width="6" stroke-linecap="round"/></g>' +
    '<circle cx="100" cy="100" r="28" fill="#f28c00"/><path d="M90 100l8 8 14-16" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  // Gegenereerd beeld voor een nieuwsbericht, afhankelijk van de categorie.
  var KLEUR = { Logistiek: ["#163d6b", "#f28c00"], Duurzaamheid: ["#2f7d4f", "#cde8d6"], "Coöperatie": ["#f28c00", "#0d2b4e"], Regio: ["#0d2b4e", "#9fb6d6"] };
  function nieuwsBeeld(n) {
    var k = KLEUR[n.categorie] || ["#163d6b", "#f28c00"];
    var icon = { Logistiek: "doos", Duurzaamheid: "papier", "Coöperatie": "koffie", Regio: "map" }[n.categorie] || "doos";
    return '<svg class="beeld" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="320" height="180" fill="' + k[0] + '"/>' +
      '<circle cx="270" cy="30" r="90" fill="' + k[1] + '" opacity=".35"/><circle cx="40" cy="170" r="60" fill="' + k[1] + '" opacity=".25"/>' +
      '<g transform="translate(128 58) scale(2)" color="#fff">' + ico(icon).replace("<svg", '<svg width="32" height="32"') + "</g></svg>";
  }

  function datum(d) {
    try { return new Date(d + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }); }
    catch (x) { return d; }
  }

  function kop(titel, intro, kruimel, extraClass) {
    return '<section class="paginakop ' + (extraClass || "") + '"><div class="wrap">' +
      (kruimel ? '<div class="kruimel">' + kruimel + "</div>" : "") +
      "<h1>" + e(titel) + "</h1>" + (intro ? "<p>" + e(intro) + "</p>" : "") + "</div></section>";
  }

  function catKaart(c) {
    return '<a class="cat" href="#/assortiment/' + e(c.slug) + '"><span class="ico">' + ico(c.icoon) + "</span>" +
      "<h3>" + e(c.naam) + "</h3><p>" + e(c.intro) + '</p><span class="meer pijl">Bekijk </span></a>';
  }
  function nieuwsKaart(n) {
    return '<a class="item" href="#/nieuws/' + e(n.slug) + '">' + nieuwsBeeld(n) +
      '<div class="tekst"><span class="tag">' + e(n.categorie) + "</span><time>" + datum(n.datum) + "</time>" +
      "<h3>" + e(n.titel) + "</h3><p>" + e(n.samenvatting) + "</p></div></a>";
  }
  function cijfers(lijst) {
    return '<div class="cijfers">' + lijst.map(function (c) {
      return '<div class="cijfer"><b>' + e(c.waarde) + "</b><span>" + e(c.label) + "</span></div>";
    }).join("") + "</div>";
  }
  function gesorteerdNieuws() {
    return C.nieuws.slice().sort(function (a, b) { return a.datum < b.datum ? 1 : -1; });
  }

  // ---------- Pagina's ----------
  var P = {};

  P.home = function () {
    var h = C.home;
    return '<section class="hero"><div class="wrap hero-in"><div>' +
      '<p class="label">' + e(h.hero.label) + "</p><h1>" + e(h.hero.titel) + '</h1><p class="lead">' + e(h.hero.tekst) + "</p>" +
      '<div class="knoppen">' + h.hero.knoppen.map(function (k) { return link(k, "knop " + k.stijl); }).join("") + "</div>" +
      "</div>" + HERO_SVG + "</div></section>" +
      '<div class="wrap">' + cijfers(h.cijfers) + "</div>" +
      '<section class="sectie"><div class="wrap"><div class="sectiekop"><div><h2>' + e(h.uitgelichtTitel) + '</h2><p class="muted">' + e(h.uitgelichtTekst) + "</p></div>" +
      '<a class="knop secundair" style="color:var(--navy)" href="#/assortiment">Alle categorieën</a></div>' +
      '<div class="cats">' + C.categorieen.map(catKaart).join("") + "</div></div></section>" +
      '<section class="sectie zacht"><div class="wrap"><div class="blokken">' + h.blokken.map(function (b) {
        return '<div class="blok ' + e(b.kleur) + '"><h3>' + e(b.titel) + "</h3><p>" + e(b.tekst) + '</p><a class="pijl" href="' + e(b.link.href) + '">' + e(b.link.label) + " </a></div>";
      }).join("") + "</div></div></section>" +
      '<section class="sectie"><div class="wrap"><div class="sectiekop"><h2>' + e(h.nieuwsTitel) + '</h2><a class="pijl" href="#/nieuws">Alle berichten </a></div>' +
      '<div class="nieuws">' + gesorteerdNieuws().slice(0, 3).map(nieuwsKaart).join("") + "</div></div></section>" +
      '<section class="wrap"><div class="cta"><div><h2>' + e(h.cta.titel) + "</h2><p>" + e(h.cta.tekst) + "</p></div>" + link(h.cta.knop, "knop primair") + "</div></section>";
  };

  P.assortiment = function (slug) {
    var A = C.assortiment;
    if (!slug) {
      return kop(A.titel, A.intro) +
        '<section class="sectie"><div class="wrap"><div class="cats">' + C.categorieen.map(catKaart).join("") + "</div></div></section>";
    }
    var c = C.categorieen.filter(function (x) { return x.slug === slug; })[0];
    if (!c) return P.nietGevonden();
    return kop(c.naam, c.intro, '<a href="#/">Home</a> / <a href="#/assortiment">Assortiment</a> / ' + e(c.naam)) +
      '<section class="sectie"><div class="wrap"><div class="subs">' + c.subs.map(function (s) {
        return '<div class="sub"><span class="vak">' + ico(c.icoon) + "</span><div><b>" + e(s) + "</b><small>A-merken en Quantore huismerk</small></div></div>";
      }).join("") + "</div>" +
      '<div class="bestel"><p>' + e(A.bestelTekst) + "</p>" + link(A.bestelKnop, "knop primair") + "</div>" +
      '<h2 style="margin-top:64px">Andere categorieën</h2><div class="cats">' +
      C.categorieen.filter(function (x) { return x.slug !== slug; }).slice(0, 4).map(catKaart).join("") + "</div></div></section>";
  };

  P.verkooppunten = function () {
    var V = C.verkooppunten;
    setTimeout(zoekKoppelen, 0);
    return kop(V.titel, V.intro) +
      '<section class="sectie"><div class="wrap"><p class="melding">' + e(V.demoMelding) + "</p>" +
      '<form class="zoek" id="zoek" role="search" onsubmit="return false">' +
      '<input id="zoekterm" type="search" placeholder="Zoek op plaats, postcode of naam" aria-label="Zoek op plaats, postcode of naam">' +
      '<select id="land" aria-label="Land"><option value="">Nederland en België</option><option value="NL">Nederland</option><option value="BE">België</option></select>' +
      '<select id="soort" aria-label="Soort"><option value="">Winkel en webshop</option><option value="winkel">Met winkel</option><option value="webshop">Met webshop</option></select>' +
      '</form><p class="muted" id="aantal" aria-live="polite"></p><div class="punten" id="punten"></div></div></section>';
  };
  function zoekKoppelen() {
    var term = document.getElementById("zoekterm");
    if (!term) return;
    var land = document.getElementById("land"), soort = document.getElementById("soort");
    function toon() {
      var q = term.value.trim().toLowerCase();
      var r = C.verkooppunten.lijst.filter(function (p) {
        if (land.value && p.land !== land.value) return false;
        if (soort.value && !p[soort.value]) return false;
        return !q || (p.naam + " " + p.plaats + " " + p.postcode).toLowerCase().indexOf(q) >= 0;
      });
      document.getElementById("aantal").textContent = r.length + (r.length === 1 ? " verkooppunt" : " verkooppunten");
      document.getElementById("punten").innerHTML = r.length ? r.map(function (p) {
        return '<div class="punt"><span class="pin">' + e(p.land) + "</span><div><h3>" + e(p.naam) + '</h3><span class="muted">' + e(p.postcode) + " " + e(p.plaats) + "</span>" +
          '<div class="kenmerken">' + (p.winkel ? "<span>Winkel</span>" : "") + (p.webshop ? "<span>Webshop</span>" : "") + "</div></div></div>";
      }).join("") : '<div class="geen">Geen verkooppunten gevonden. Probeer een andere plaats.</div>';
    }
    term.addEventListener("input", toon); land.addEventListener("change", toon); soort.addEventListener("change", toon);
    toon();
  }

  P.cooperatie = function () {
    var K = C.cooperatie;
    return kop(K.titel, K.intro) +
      '<section class="sectie"><div class="wrap twee"><div>' + K.secties.map(function (s) {
        return '<div class="tekstblok"><h2>' + e(s.kop) + "</h2><p>" + e(s.tekst) + "</p></div>";
      }).join("") + "</div><aside>" +
      '<div class="kaart"><h3>Ruim honderd jaar samen</h3><ol class="tijdlijn">' + K.tijdlijn.map(function (t) {
        return "<li><b>" + e(t.jaar) + "</b>" + e(t.tekst) + "</li>";
      }).join("") + "</ol></div>" +
      '<div class="kaart" style="margin-top:20px"><h3>' + e(K.werkenBij.titel) + "</h3><p>" + e(K.werkenBij.tekst) + "</p>" + link(K.werkenBij.knop, "knop primair") + "</div>" +
      "</aside></div></section>";
  };

  P.duurzaamheid = function () {
    var D = C.duurzaamheid;
    return kop(D.titel, D.intro, "", "groenkop") +
      '<div class="wrap groenkop" style="background:none">' + cijfers(D.kerncijfers) + "</div>" +
      '<section class="sectie"><div class="wrap twee"><div><p class="doel">' + e(D.doel) + "</p>" + D.secties.map(function (s) {
        return '<div class="tekstblok"><h2>' + e(s.kop) + "</h2><p>" + e(s.tekst) + "</p></div>";
      }).join("") + '</div><aside><div class="kaart"><h3>Keurmerken en certificaten</h3><div class="badges">' +
      D.certificaten.map(function (c) { return "<span>" + e(c) + "</span>"; }).join("") + "</div></div></aside></div></section>";
  };

  P.nieuws = function (slug) {
    if (!slug) {
      return kop("Nieuws & verhalen", "Het laatste nieuws uit de coöperatie, de vakhandel en ons distributiecentrum.") +
        '<section class="sectie"><div class="wrap"><div class="nieuws">' + gesorteerdNieuws().map(nieuwsKaart).join("") + "</div></div></section>";
    }
    var n = C.nieuws.filter(function (x) { return x.slug === slug; })[0];
    if (!n) return P.nietGevonden();
    return kop(n.titel, "", '<a href="#/">Home</a> / <a href="#/nieuws">Nieuws & verhalen</a>') +
      '<section class="sectie"><div class="wrap"><article class="artikel"><span class="tag">' + e(n.categorie) + "</span><time>" + datum(n.datum) + "</time>" +
      nieuwsBeeld(n).replace('class="beeld"', 'class="beeld" style="border-radius:14px;margin:24px 0 32px;width:100%;height:auto"') +
      n.tekst.map(function (p) { return "<p>" + e(p) + "</p>"; }).join("") +
      '<p><a class="pijl" href="#/nieuws">Terug naar het overzicht </a></p></article></div></section>';
  };

  P.contact = function () {
    var K = C.contact;
    setTimeout(function () {
      var f = document.getElementById("form");
      if (!f) return;
      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = new FormData(f);
        location.href = "mailto:" + K.email + "?subject=" + encodeURIComponent("Vraag van " + d.get("naam")) +
          "&body=" + encodeURIComponent(d.get("bericht") + "\n\n" + d.get("naam") + "\n" + d.get("email"));
      });
    }, 0);
    return kop(K.titel, K.intro) +
      '<section class="sectie"><div class="wrap twee"><div><form class="form" id="form">' +
      '<label>Naam<input name="naam" required autocomplete="name"></label>' +
      '<label>E-mailadres<input name="email" type="email" required autocomplete="email"></label>' +
      '<label>Je vraag<textarea name="bericht" required></textarea></label>' +
      '<p class="melding">' + e(K.formulierMelding) + "</p>" +
      '<button class="knop primair" type="submit">Verstuur</button></form></div>' +
      '<aside class="kaart adres"><h3>' + e(K.bedrijf) + "</h3>" + K.adres.map(function (r) { return "<p>" + e(r) + "</p>"; }).join("") +
      '<p style="margin-top:1em"><a href="tel:' + e(K.telefoon.replace(/\s/g, "")) + '">' + e(K.telefoon) + "</a></p>" +
      '<p><a href="mailto:' + e(K.email) + '">' + e(K.email) + "</a></p></aside></div></section>";
  };

  P.nietGevonden = function () {
    return kop("Pagina niet gevonden", "Deze pagina bestaat niet (meer).") +
      '<section class="sectie"><div class="wrap"><a class="knop primair" href="#/">Naar de homepage</a></div></section>';
  };

  // ---------- Router ----------
  function route() {
    var parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    var pagina = parts[0] || "home";
    var render = P[pagina] && pagina !== "nietGevonden" ? P[pagina] : P.nietGevonden;
    app.innerHTML = render(parts[1]);
    var titel = app.querySelector("h1");
    document.title = (pagina === "home" ? C.site.naam + " — " + C.site.tagline : (titel ? titel.textContent + " — " : "") + C.site.naam) + " (prototype)";
    [].forEach.call(document.querySelectorAll("#menu a"), function (a) {
      if (a.getAttribute("href") === "#/" + pagina) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.getElementById("menu").classList.remove("open");
    document.getElementById("menuknop").setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
  }

  function chrome() {
    document.getElementById("proto").textContent = C.site.prototypeMelding;
    document.getElementById("menu").innerHTML = C.menu.map(function (m) { return link(m); }).join("");
    var F = C.footer;
    document.getElementById("voet").innerHTML = '<div class="wrap"><div class="voet-in"><div>' +
      document.querySelector(".logo").outerHTML + "<p>" + e(C.site.tagline) + "</p><p>" + e(C.contact.adres.join(", ")) + "<br>" + e(C.contact.telefoon) + "</p></div>" +
      F.kolommen.map(function (k) {
        return "<div><h4>" + e(k.kop) + "</h4><ul>" + k.links.map(function (l) { return "<li>" + link(l) + "</li>"; }).join("") + "</ul></div>";
      }).join("") + '</div><div class="onder">' + e(F.onderregel) + "</div></div>";
    var knop = document.getElementById("menuknop");
    knop.addEventListener("click", function () {
      var open = document.getElementById("menu").classList.toggle("open");
      knop.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  fetch("content.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { C = data; chrome(); route(); window.addEventListener("hashchange", route); })
    .catch(function (err) {
      app.innerHTML = '<p class="wrap laden">De inhoud kon niet worden geladen (' + e(err.message) + "). Open de site via een webserver, niet als los bestand.</p>";
    });
})();
