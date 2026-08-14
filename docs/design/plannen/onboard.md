# Plan: lege staten & eerste-gebruik (onboard-lens)

Fase 1 — alleen gelezen/geschouwd, niets gewijzigd. Geschouwd op http://localhost:3000
(1600×900, ingelogd als e2e-staf), aangevuld met code-inventaris van `EmptyState`
en `SectieLegeStaat`. Lens: leert een lege plek wat hij dóét en wat de
eerstvolgende actie is, of zegt hij alleen "niets gevonden"?

---

## 1. Inventaris + oordeel

### Eerste-gebruik-momenten

| Plek | Wat ik zag/las | Oordeel |
|---|---|---|
| **Login `/`** (`src/app/page.tsx`) | Kaart met logo, "Welkom terug / Log in bij Top Tuinen OS", Google-knop, e-mail+wachtwoord. | Verzorgd, maar kaal als het misgaat: **geen "Wachtwoord vergeten?"-link**, geen regel voor klanten die met een uitnodiging komen (die moeten de e-maillink gebruiken, niet dit formulier), geen hulp/contact-uitweg. Dit is óók de klant-ingang (naamregel: klant ziet "Top Tuinen OS" in de CardDescription — grensgeval, klant logt hier immers in). |
| **Publieke configurator `/configurator`** | **404 "Pagina niet gevonden"** — er bestaat geen indexpagina, alleen `/configurator/gazon`, `/boomschors`, `/verticuteren` (+ `status`, `bedankt`). | Wie de voor de hand liggende URL krijgt/onthoudt, strandt op een 404. Eerste indruk voor klanten = doodlopende steeg. |
| **`/configurator/gazon`** | "Gazon aanleggen — … direct een indicatieprijs. Vrijblijvend en eenvoudig in 4 stappen", stappenbalk, uitleg per veld. | Wizard zelf is goed begeleid. Twee smetten: **stap 1 vraagt meteen NAW-gegevens** vóór er iets van waarde is getoond (drempel/uitval), en placeholder "Amsterdam" bij een Limburgs bedrijf. |
| **Klant-uitnodigingsflow** (CLAUDE.md: `/portaal/registreren` → `/portaal/koppelen` → login op `/`) | Flow is technisch dicht; de loginpagina verwijst er alleen nergens naar. | Zie login-punt hierboven. |
| **`/offertes` leeg** (`src/components/empty-states.tsx` → `NoOffertes`) | "Welkom bij Top Tuinen OS" + twee startkaarten (Aanleg/Onderhoud) + 3 tips. | Sterkste first-use-moment van de app. Voorbeeld voor de rest. |
| **`/projecten` leeg** (`NoProjecten`) | Legt de workflow uit (project ontstaat uit geaccepteerde offerte) + link + tips. | Goed: leert het systeem, niet alleen "leeg". |

### Zoek-/filter-lege-staten (uitgelokt met "xyzzy" en 0-filters)

| Plek | Wat ik zag | Oordeel |
|---|---|---|
| **`/klanten` + zoekterm** (`klanten/page.tsx` ±1219–1232) | "Geen klanten gevonden / Geen resultaten voor \"xyzzy\"". | Zegt alleen "niets gevonden": **geen wis-knop** (facturen en projecten hebben die wél). |
| **`/klanten` + 0-filter** (Type "Overig (0)") | **"Nog geen klanten / Voeg je eerste klant toe om te beginnen."** terwijl er 27 klanten zijn — de conditie kijkt alleen naar `searchTerm`, niet naar pipeline-/typefilter. | Misleidende first-use-copy op een filter-no-match. Ergste vondst. |
| **`/klanten` teller** (±1204) | Bij filter/zoek: "0 klanten in je bestand". | Onwaar — het bestand heeft er 27; teller volgt de selectie maar de tekst claimt het bestand. |
| **`/offertes` + zoekterm** (`NoSearchResults`) | "Geen resultaten gevonden … Probeer andere zoektermen" + knop "Zoekopdracht wissen". | Goede copy en actie, máár de **KPI-kaarten erboven vallen naar € 0,00 / 0% conversie** — de pagina oogt één tel als bedrijf zonder omzet. |
| **Leads-kanban kolom** (`components/leads/kanban-column.tsx:86`) | "Geen leads" per kolom. | Prima — kolommen zijn klein, meer tekst zou schreeuwen. |

### Klantdossier-secties (`SectiePaneel` + `SectieLegeStaat`, gezien op E2E-testklant)

`SectieLegeStaat` (`src/components/ui/sectie-paneel.tsx:99`) is één `<p>` met alléén
`tekst` — geen hint of actie mogelijk. In gebruik:

| Sectie | Tekst | Oordeel |
|---|---|---|
| Taken (`klant-taken-card.tsx:557–559`) | "Nog geen taken." / "Alles afgevinkt." | Composer erboven ís de actie — acceptabel. "Alles afgevinkt." is sympathiek. |
| Tijdlijn (`klant-tijdlijn.tsx:863`) | "Nog niets vastgelegd." | Leert niet dát mail/offertes hier vanzelf verschijnen; nieuweling denkt dat het een leeg notitieblok is. |
| Onderhoud (`onderhoud-sectie.tsx:390`) | "Nog geen onderhoud." | Zegt niet dat je hier contract óf losse beurt vastlegt (knop "+ Losse beurt" staat wel in de kop). |
| Offertes/Facturen (`klant-documenten.tsx:147, 206`) | "Nog geen offertes." / "Nog geen facturen." | Facturen ontstaan elders (project/nacalculatie) — dat leert deze regel niet. |

### Overige modules

| Plek | Wat ik zag | Oordeel |
|---|---|---|
| **`/mails`** (Concept-mails) | "De wachtrij is leeg — Nieuwe concept-mails verschijnen hier zodra een mail-trigger afgaat, bijvoorbeeld bij het versturen van een offerte." | **Voorbeeldig**: wat, waarom, wanneer. Dit niveau overal. |
| **`/machinepark`** (page.tsx:142, 256) | "Nog geen materieel — Voeg voertuigen toe via Wagenparkbeheer of machines via Machinebeheer…" en "Nog geen actieve teams — Maak eerst een team aan bij Medewerkers." | Uitleg goed, maar noemt bestemmingen **zonder knop/link** — planbord-varianten (`dagkaart.tsx:770`, `weekbord.tsx:511`) hebben wél "Naar teams". Inconsistent. |
| **`/verzuim`** (page.tsx:123) | "Geen verzuimregistraties — Er zijn nog geen verzuimregistraties." | Circulair; wijst niet op de Ziekmelding-knop die er gewoon boven staat. |
| **`/veld` (Mijn dag)** (`veld-dag.tsx:256`) | "Je account is niet aan een medewerker gekoppeld — Kies hierboven een medewerker…" | Duidelijk. |
| **`/chat`** (page.tsx:184 e.v.) | "Nog geen gesprekken — Start een nieuw gesprek met een collega." + knop. | Goed. |
| **Klantportaal** (`portaal/(portal)/offertes|facturen|projecten|documenten`) | "Er zijn nog geen offertes voor u beschikbaar. Zodra Top Tuinen een…" | Goede, klantvriendelijke toon ("u", "Zodra…"). |
| **Facturen openstaand** (`openstaand-overzicht.tsx:192`) | "Geen openstaande posten — Alle verzonden facturen zijn betaald. Mooi zo!" | Leuk: lege staat als succesmoment. |

**Eindoordeel eerste vijf minuten kantoormedewerker:** met gevulde data begeleid
(dashboard-groet, "Aandacht nodig", sterke first-use-blokken op offertes/projecten);
de zwakke plekken zitten in de ránden: filter-no-match die tegen je liegt
(/klanten), one-liners in het dossier die niets leren, en de klant-kant
(/configurator-404, login zonder vangnet).

---

## 2. Concrete verbeteringen per bestand (met NL-microcopy)

1. **`src/app/(dashboard)/klanten/page.tsx`**
   - Lege-staat-conditie ook op filters laten letten. Drie varianten:
     - zoek: "Geen klanten gevonden — Geen resultaten voor \"…\"." + knop **"Zoekopdracht wissen"** (outline);
     - filter: "Geen klanten met deze status of dit type." + knop **"Filters wissen"**;
     - echt leeg: bestaande copy behouden.
   - Teller (±1204): bij actieve selectie "**{n} van 27 klanten**" i.p.v. "{n} klanten in je bestand".
2. **`src/app/(dashboard)/offertes/page.tsx`** — KPI-kaarten bij actieve zoek/filters labelen: onderschrift "**van huidige selectie**", of de kaarten op de ongefilterde set houden. Nu suggereert "xyzzy" € 0,00 omzet.
3. **`src/components/ui/sectie-paneel.tsx`** — `SectieLegeStaat` optionele `hint?: string` geven (tweede, gedempte zin op dezelfde regel; compact blijft compact).
4. **`src/components/tijdlijn/klant-tijdlijn.tsx`** — "Nog niets vastgelegd. **Noteer hierboven wat je bespreekt — verstuurde offertes en mails verschijnen hier vanzelf.**"
5. **`src/components/klanten/onderhoud-sectie.tsx`** — "Nog geen onderhoud. **Leg een contract vast of plan hierboven een losse beurt.**"
6. **`src/components/klanten/klant-documenten.tsx`** — offertes: "Nog geen offertes. **Start er één met Aanleg of Onderhoud rechtsboven.**"; facturen: "Nog geen facturen. **Die ontstaan vanuit een project na de nacalculatie.**"
7. **`src/app/page.tsx`** (login) — link **"Wachtwoord vergeten?"** (Clerk reset-flow) onder het wachtwoordveld; onder de kaart één regel: "**Uitnodiging ontvangen? Gebruik de link uit de e-mail om je account te activeren.**"
8. **`src/app/(public)/configurator/page.tsx`** (nieuw) — indexpagina in de stijl van de bestaande configurator-layout: "**Waar kunnen we u mee helpen?**" + drie kaarten (Gazon aanleggen / Boomschors / Verticuteren). Minimaal alternatief: redirect naar `/configurator/gazon`.
9. **Configurator-wizards** (`(public)/configurator/*`) — stapvolgorde heroverwegen: specificaties → foto's → prijsindicatie → gegevens ("**Bijna klaar — waar mogen we de indicatie naartoe sturen?**"). Kleiner: plaats-placeholder "Amsterdam" → "**Echt**".
10. **`src/app/(dashboard)/machinepark/page.tsx`** — acties toevoegen: "**Naar wagenpark**" (`/wagenpark`) en "**Naar machines**" (`/instellingen/machines`); teams-tab knop "**Naar teams**" (`/medewerkers/teams`), gelijk aan planbord.
11. **`src/app/(dashboard)/verzuim/page.tsx`** — "Geen verzuimregistraties. **Meld een medewerker ziek met de knop Ziekmelding rechtsboven; de statistieken vullen zich vanzelf.**"

## 3. Prioritering

- **P1 (misleidend/doodlopend):** 1 (klanten filter-no-match + teller), 8 (/configurator-404), 7 (login-vangnet).
- **P2 (leert te weinig):** 3+4+5+6 (SectieLegeStaat-hints), 2 (KPI's bij selectie), 10, 11.
- **P3 (polish):** 9 (stapvolgorde + placeholder).

## 4. Geraakte bestanden

- src/app/page.tsx
- src/app/(dashboard)/klanten/page.tsx
- src/app/(dashboard)/offertes/page.tsx
- src/app/(dashboard)/machinepark/page.tsx
- src/app/(dashboard)/verzuim/page.tsx
- src/app/(public)/configurator/page.tsx (nieuw)
- src/app/(public)/configurator/gazon/… (placeholder/stapvolgorde)
- src/components/ui/sectie-paneel.tsx
- src/components/tijdlijn/klant-tijdlijn.tsx
- src/components/klanten/onderhoud-sectie.tsx
- src/components/klanten/klant-documenten.tsx
