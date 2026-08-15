# Eindschouw: offerte-entree, werkbank, rapportages, dashboard

Verse-ogen-schouw, 15 aug 2026, commits bb8cb3d…0ce9c9b (+ f8dede2 conversie-centering).
Ingelogd geschouwd op 1680/1280/768/375, licht én donker. Meetmethode: browserpaneel;
let op — het paneel bevriest animaties/timers zodra het verborgen is, twee eerdere
"blanco pagina's" bleken dáárdoor, geen productbugs. Alles hieronder is dubbel
geverifieerd (DOM + code) voordat het een bevinding werd.

## Wat overtuigend staat

- **Kliktelling entree → offerte met regels: 4 klikken** (Nieuwe offerte → tegel A →
  palet W → oppervlakte typen; regels + totaal live). Gate "≤6, was 14" ruim gehaald.
  De offerte bestaat direct als autosave-concept (OFF-2026-0xx), "Alles wordt
  automatisch bewaard" klopt in de werkbank.
- **Klant reist mee op alle drie de paden** vanaf het klantdossier (tegel/werkblad,
  V-vrij, T-template): `?klantId=` in de URL, naam vooraf gekoppeld. Gate gehaald.
- **Afronden na de werkbank werkt** (fix 0ce9c9b): definitief maken → succesmodal →
  voorcalculatie → "Afronden en doorgaan" → toast "klaar om te verzenden", zonder fout.
- **facturen.getByProject** (fix 0ce9c9b): projectpagina + /factuur renderen foutloos;
  de code kiest nu netjes de oudste reguliere factuur i.p.v. `.unique()`-serverfout.
- **Rapportages kloppen tot op de euro.** Vorig jaar € 72.506 excl. (exact de
  seedwaarde), Zomer 2026 "35,1% minder dan Zomer 2025" (rekent exact terug naar
  € 42.170), en alle-tijd sluit op het dashboard: € 87.733 + € 33.095 = € 120.828
  incl. — dashboard en rapportage tonen dezelfde werkelijkheid. Vier vraagsecties,
  ankernav (werkt; scroll was alleen paneel-throttling), eerlijke lege staat bij
  nacalculatie, zelfs een eerlijke voetnoot dat 13% marge overal "niets zegt".
- **Dashboard-dagstaat**: 1029px hoog op 1680×1000 (gate ≤ ~1200), werkstrook boven,
  één Fraunces-heldcijfer, mobiel één kolom in prioriteitsvolgorde. Conversie-blok
  is na f8dede2 exact gecentreerd (120px links = 120px rechts).
- **De wetten**: nul horizontale scroll op 1680/1280/768/375 op dashboard, werkblad
  (aanleg én onderhoud), rapportages en offertelijst (tabel scrollt in eigen
  container); dark mode volwaardig op alle nieuwe schermen (geen zwarte grafieken);
  **nul console-errors** over de hele schouw; geen verzonnen data gevonden.
- **Regressies**: offertelijst rendert nu echt (geen "Offertes worden geladen…"-klem),
  oude offerte TOPTUINEN2025-301 met 4 regels per scope rendert, klantdossier goed,
  /chat met nette lege staat.

## Blokkerend

**B1. Vrij-editor verliest werk zonder waarschuwing.** Regel toevoegen (+ invullen)
en dan "Naar offerte" klikken zonder eerst "Opslaan": de regel is definitief weg,
geen prompt, geen autosave. Geverifieerd door terug te keren naar `/vrij`: 0 posten.
In een suite waar de werkbank "Alles wordt automatisch bewaard" belooft is dit stil
dataverlies op één klik afstand. (`src/app/(dashboard)/offertes/[id]/vrij/`.)

**B2. /rapportages/afdruk drukt bij élk bezoek direct af.** In `page.tsx` staat
`direct={searchParams.get("direct") !== "0"}` terwijl het commentaar in
`afdruk-blad.tsx` het omgekeerde contract belooft ("alleen bij `?direct=1`; wie de
URL zelf opent krijgt eerst het blad te zien") en de knop in `verhaal.tsx` helemaal
geen `direct` meestuurt. Gevolg: elke deeplink → meteen de native printdialoog
(bevroor tijdens de schouw reproduceerbaar twee browsertabs; het blad zelf heb ik
daardoor niet visueel kunnen keuren). Eénregelige fix: `=== "1"` + knop `direct=1`.

## Storend

**S1. Drie offerte-editors naast elkaar.** De werkbank (nieuw, Loof & Leem), de
vrije builder (oude look, handmatig opslaan, eigen klant-koppelstrip) en
`/bewerken` (oude regel-editor). De laatste twee detoneren naast het nieuwe werk;
het bekende punt "twee klant-koppel-implementaties" is hier onderdeel van.

**S2. Template-pad maakt zijn belofte niet waar.** Sheet zegt "kies er een en de
offerte staat klaar", maar "Gebruik deze" levert een offerte met 0 regels en € 0,
geland op de detailpagina; "Bewerken" opent vervolgens de óúde editor (S1) waar de
scopes alleen als tags zichtbaar zijn. Verwacht: landen in de werkbank met de
template-scopes voorgeselecteerd.

**S3. Uren-inconsistentie werkblad ↔ voorcalculatie.** Zelfde offerte (Grondwerk,
50 m²): werkblad rekent 12,50 uur (€ 562,50 arbeid), voorcalculatie zegt 11:15 uur
normuren. Twee normbronnen; de klant ziet het ene, de planning het andere.

**S4. Voorcalculatie-pagina is nog oud ontwerp.** Geist-koppen, SaaS-stepper met
"Voortgang 80%"-balk — het schuurt direct ná de werkbank in dezelfde flow.

**S5. Vrije offerte start altijd als type "aanleg"** (bekend punt): kop zegt
"Aanleg — eenmalig werk of maatwerk", ook als je onderhoudswerk wil schrijven.

## Cosmetisch

- Afrond-dialoog: "Geschatte duur: 1 **dagen**" en "11**.**25 uur" (punt i.p.v. komma).
- Oppervlakteveld toont "050" tijdens het typen (default-0 wordt niet geselecteerd);
  herstelt zich na blur.
- Werkbank-klantdropdown: klik op de offerte-subregel onder een recente klant
  selecteert de klant niet (dode zone in de rij); via zoeken werkt het wél.
- /projecten toont een lange lege tussenstaat zonder skeleton voordat de tabel komt
  (deels paneel-throttling, maar er stond aantoonbaar geen skeleton in de DOM).

## Advies polijstronde (volgorde)

1. B2 (één regel) en B1 (autosave of navigatie-guard in de vrij-editor).
2. S2+S1: template → werkbank laten landen; daarna de oude editors uitfaseren.
3. S3 één normbron geven; S4 meenemen zodra de voorcalculatie een werkbank-vervolg
   krijgt; S5 typekeuze (aanleg/onderhoud) in het V-pad.
4. Cosmetische rij in één veegbeurt.
