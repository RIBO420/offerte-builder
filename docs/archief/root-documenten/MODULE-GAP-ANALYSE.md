# Module-gap-analyse — TOP Tuinen App v1

**Datum:** 2026-07-10
**Bron:** codebase-audit (convex/, src/, mobile/) getoetst aan `prd-toptuinen-app-v1.md`
**Doelgroep:** Ricardo (lead dev) en het bouwteam
**Verdicten:** `werkt` (dekt PRD) · `deels` (bruikbare basis, PRD-kern ontbreekt) · `leeg omhulsel` (schema/UI zonder werkende logica) · `ontbreekt` (niets aanwezig)

Geen enkele module haalt "werkt" tegen de PRD; geen enkele module ontbreekt volledig. Alle 10 onderzochte gebieden zijn **deels**, met daarbinnen wel duidelijke lege omhulsels (meerwerk-tabel, boekhoudkoppeling, betalingen/Mollie, contractFacturen-facturatie) en volledig ontbrekende PRD-kernen (werkitem-entiteit, beurtengenerator, klanttijdlijn, route-dagkaart, bouwstenencatalogus).

---

## 1. Fase 0 — Werkitem-entiteit (PRD 1.1) + Leads/Klanten scheiden (PRD 1.3)

**Verdict: deels** — leads/klanten-scheiding bestaat grotendeels; de werkitem-entiteit bestaat niet.

### Wat er staat

- Er is **geen** werkitem-entiteit. `projecten` (schema.ts:521) is het enige klus-record: naam, status (gepland/in_uitvoering/afgerond/nacalculatie_compleet/gefactureerd), **verplichte** `offerteId`, optionele `klantId`, `toegewezenMedewerkerIds`. Een project kan dus niet bestaan zonder offerte.
- Het type `onderhoudsbeurt` bestaat nergens: `onderhoudscontracten` + `contractWerkzaamheden` (schema.ts:2274/2341) zijn seizoenstemplates met frequentie en geschatteUrenPerBeurt — geen beurtengenerator, geen plan-/uitvoerbaar beurt-record.
- Planningsvelden staan niet op het project maar verspreid over drie tabellen: `weekPlanning` (medewerker×project×datum), `planningTaken`, `voorcalculaties` (normuren). Grondverzet-velden ontbreken volledig (alleen `klicMeldingGedaan`).
- Leads en klanten zijn **wél** al twee tabellen: `configuratorAanvragen` fungeert als leads-tabel (pipelineStatus nieuw→contact_gehad→offerte_verstuurd→gewonnen/verloren, bron, geschatteWaarde, gekoppeldKlantId) naast `klanten`.
- Promotie bestaat en werkt: `markGewonnen` (configuratorAanvragen.ts:625) dedupliceert op e-mail, maakt/koppelt klantrecord, logt leadActiviteit; kanban-drag naar "Gewonnen" roept dit aan en terugslepen is UI- én serverzijdig geblokkeerd.
- UI is één menu-item `/klanten` met tabs Klanten/Leads (KlantenPageWithTabs, klanten/page.tsx:1486) i.p.v. twee menu-items; badge per tab bestaat.
- Verwarrend: `klanten.pipelineStatus` bevat zelf óók een "lead"-stadium (pipelineHelpers.ts) — twee concurrerende pipeline-modellen.
- `leadActiviteiten` en klanten-CRUD zijn volledig geïmplementeerd en aangeroepen vanuit de UI.

### Wat de PRD vraagt vs. wat er is

| PRD-eis/veld (1.1 + 1.3) | Bestaand equivalent | Actie |
|---|---|---|
| werkitem-entiteit met `type` | ontbreekt; alleen `projecten` | nieuw (of projecten generaliseren) |
| type `onderhoudsbeurt` | ontbreekt; `contractWerkzaamheden` = template zonder datum/status | nieuw |
| `klant_id` | projecten.klantId (optioneel) | uitbreiden: verplicht maken |
| `titel` | projecten.naam | hergebruik |
| `status` (beurt: gepland/uitgevoerd/gefactureerd/vervallen) | projecten.status (alleen project-statussen) | uitbreiden |
| `geplande_start`/`geplande_eind` | ontbreekt op projecten; weekPlanning.datum per medewerker | nieuw |
| `team_id` | ontbreekt; wel `teams`-tabel (schema.ts:1110) + toegewezenMedewerkerIds | nieuw veld, teams hergebruiken |
| `geschatte_uren` | voorcalculaties.normUrenTotaal; contractWerkzaamheden.geschatteUrenPerBeurt | uitbreiden/verplaatsen naar werkitem |
| `offerte_id` (nullable) | projecten.offerteId (VERPLICHT) | uitbreiden: optioneel maken |
| `factuur_id` | ontbreekt; omgekeerd facturen.projectId | hergebruik omgekeerde relatie of nieuw |
| `contract_id` | ontbreekt op projecten | nieuw |
| `adres` (default klantadres) | ontbreekt; wel onderhoudscontracten.locatie | nieuw |
| `ontgraven_volume_m3`, `mba_status`, `dso_referentie` | ontbreekt (alleen klicMeldingGedaan) | nieuw |
| geen vrij notitieveld | klanten.notities + configuratorAanvragen.notities bestaan | conflict, migreren naar tijdlijn |
| Leads-tabel apart van Klanten | configuratorAanvragen vs klanten (twee tabellen) | hergebruik |
| Twee aparte menu-items | één route /klanten met tabs (page.tsx:1486) | uitbreiden |
| teller-badge per item | Leads-tab badge bestaat | hergebruik |
| Lead→Gewonnen = klantpromotie | markGewonnen (configuratorAanvragen.ts:625), werkt | hergebruik |
| promotie + eerste werkitem/offerte | ontbreekt in markGewonnen | uitbreiden |
| Klanten-kanban (actief contract/lopend/slapend/aandacht) | klanten.pipelineStatus bestaat, geen kanban-UI voor klanten | nieuw (na toetsing Mickey) |

### Concrete gap

1. Werkitem-entiteit met `type` moet nog volledig ontworpen/gebouwd worden; de verplichte `offerteId` op `projecten` (raakt alle 26 functies in projecten.ts) blokkeert losse werkitems en beurten.
2. Beurten als instantie (datum + status) bestaan niet — hard vereist voor de beurtengenerator (2.1), planbord-wachtrij (2.2) en facturatiemodus (2.8).
3. `markGewonnen` maakt geen eerste werkitem/offerte aan; leadrecord blijft naast klantrecord bestaan.
4. Twee pipeline-modellen (configuratorAanvragen.pipelineStatus én klanten.pipelineStatus met eigen 'lead'-stadium) moeten geconsolideerd.
5. Vrije notitievelden botsen met de PRD-regel "alles via tijdlijn" — migratie nodig.

---

## 2. Onderhoudscontracten (PRD 2.1) — beurtengenerator, losse beurt, facturatiemodus, planningsattendering

**Verdict: deels** — werkende, geïsoleerde contractadministratie; alles wat PRD 2.1 specifiek eist ontbreekt.

### Wat er staat

- convex/onderhoudscontracten.ts (1028 regels) implementeert 7 queries en 9 mutations: `create` genereert automatisch contractnummer (OHC-YYYY-NNN), jaarlijksTarief, contractWerkzaamheden per seizoen én een volledig termijnschema in contractFacturen (generateTermijnPeriodes o.b.v. betalingsfrequentie). `renewContract` verlengt met nieuw termijnschema; `cancelContract`; PDF-export (getForPdf + contract-pdf.tsx).
- Drie UI-routes werken echt: `/contracten` (lijst + stats), `/contracten/nieuw` (wizard incl. werkzaamheden), `/contracten/[id]` (detail met tabs werkzaamheden + termijnfacturen, verlengen/opzeggen/PDF).
- Indexatievelden bestaan in schema maar `laatsteIndexatieDatum` wordt nooit geschreven; geen indexatielogica.
- `getExpiringContracts` en `getUpcomingWork` zijn geïmplementeerd maar door **geen enkele** UI, notificatie of cron gebruikt.
- contractFacturen is een dead-end: status blijft altijd "gepland", factuurId wordt nergens gezet, facturen.ts kent het contract niet.
- crons.ts bevat nul contractverwijzingen; mobile bevat nul contractverwijzingen.

### Wat de PRD vraagt vs. wat er is

| PRD 2.1 eis | Bestaand equivalent | Actie |
|---|---|---|
| Contract: klant, looptijd, opzegtermijn, prijs | onderhoudscontracten.{klantId, startDatum, eindDatum, opzegtermijnDagen, tariefPerTermijn} | hergebruik |
| Bouwstenen uit catalogus (bijlage A) met frequentie per bouwsteen | contractWerkzaamheden.{omschrijving, scope (vrije string), frequentie, frequentieEenheid} — geen catalogus-koppeling | uitbreiden (koppel aan bouwsteencatalogus) |
| Prijs per beurt | ontbreekt (alleen tariefPerTermijn op contractniveau; geschatteUrenPerBeurt is uren, geen prijs) | nieuw veld op contractWerkzaamheden |
| Seizoensvenster per bouwsteen | contractWerkzaamheden.seizoen (1 van 4 vaste seizoenen) | uitbreiden (venster = datumrange, niet enum) |
| Indexatieclausule (AV art. 5.3) | {indexatiePercentage, laatsteIndexatieDatum} — velden bestaan, nul logica; renewContract vraagt handmatig nieuwTarief | uitbreiden (indexatie-berekening + zichtbaar in PDF) |
| Facturatiemodus per contract (per bezoek / maandverzamel / vast maandbedrag) | ontbreekt; alleen betalingsfrequentie → termijnschema (feitelijk enkel modus 3, zonder factuurgeneratie) | nieuw veld + engine-koppeling §2.8 |
| Beurtengenerator (werkitems type onderhoudsbeurt, 12-mnd horizon, nachtelijke job) | ontbreekt volledig; crons.ts heeft geen contract-jobs | nieuw |
| Beurten → planbord-wachtrij | ontbreekt; geen link contract↔planningTaken/weekPlanning | nieuw |
| Termijnfacturen → echte facturen | contractFacturen.{factuurId, status gefactureerd/betaald} bestaan in schema maar worden nooit gezet | uitbreiden (facturatie-engine koppelen) |
| Geaccepteerde onderhoud-offerte → concept-contract | ontbreekt; onderhoud-offerteforms bestaan los | nieuw (conversie-mutation) |
| Losse beurt zonder contract | ontbreekt volledig | nieuw (tabel/werkitem) |
| Planningsattendering (taak kantoor + inplan-mailknop, escalatie) | getExpiringContracts + getUpcomingWork bestaan maar nergens gebruikt | uitbreiden (queries herbruikbaar; taak + mail = nieuw) |
| Klantkaart: contracten + losse beurten als regels | getByKlant bestaat; losse beurten bestaan niet | uitbreiden |

### Concrete gap

1. **Beurtengenerator ontbreekt volledig** — geen doeltabel (werkitem bestaat niet), geen cron, geen 12-maands horizon. Hardste afhankelijkheid: Fase 0 (1.1) eerst.
2. Facturatiemodus per contract bestaat niet; het huidige termijnschema-model dekt alleen conceptueel "vast bedrag" en genereert nooit echte facturen.
3. Losse beurt zonder contract: nul code.
4. Attendering: bruikbare queries bestaan, maar taak/mail/escalatie en elke UI-consumer ontbreken.
5. Offerte-acceptatie → concept-contract: geen conversiepad.
6. Indexatie: velden zonder logica (leeg omhulsel binnen een verder werkende module).

---

## 3. Planbord (PRD 2.2) — weekbord, route-dagkaart, wachtrij, tijdcascade, teams

**Verdict: deels** — werkende maar simpele weekplanner per medewerker; geen planbord zoals de PRD beschrijft.

### Wat er staat

- `/planning/weekplanner` is een grid met rijen = **individuele medewerkers** (niet teams), kolommen = ma–vr (alleen weekweergave). Drag-and-drop werkt echt (native HTML5 DnD): projecten uit een zijbalk slepen, bestaande toewijzing verslepen, verwijderen.
- Backend `weekPlanning` (medewerkerId+projectId+datum, optioneel uren/voertuigId) heeft 20+ functies: assign/move/remove, capaciteit, conflictdetectie (dubbelboeking), voertuigtoewijzing met APK/defect-validatie, materieelsuggesties op scope.
- `/planning` toont maand/kwartaal/jaar-capaciteitsheatmaps (alleen-lezen).
- `planningTaken` = taken per project (uit voorcalculatie, met volgorde/status), beheerd op projectdetail en afgevinkt via voormanDashboard — maar **niet gekoppeld aan het weekbord**.
- Teams bestaan als entiteit (statische ledenlijst) maar worden nergens in de planning gebruikt.
- De `routes`-tabel is GPS-trackingoutput (locationSessions), géén planbord-route; er is geen convex/routes.ts. Dichtstbijzijnde dagkaart is voormanDashboard (web).
- Volledig afwezig: wachtrij/opdrachtenbak, duur-resize, dupliceren, splitsen, ziekte-uitval-scenario, afwezigheidsblokken (alleen filter op uurtype in getBeschikbaar; verlofaanvragen niet gekoppeld), klant-beschikbaarheidsvenster/voorkeursteam, route-dagkaart, standaardblokken, tijdcascade, reistijd/Google Maps Distance Matrix (nul code, geen geocoding), dagregie Vandaag/Planvenster, tijdlijn-events en audit-logging bij planwijzigingen, seizoensvenster-waarschuwing. Mobile: geen planning-/dagkaartschermen.

### Wat de PRD vraagt vs. wat er is

| PRD-eis (§2.2) | Bestaand equivalent | Actie |
|---|---|---|
| Weekbord rijen = teams/voormannen | weekPlanning.medewerkerId — rijen zijn losse medewerkers | uitbreiden: teamId/werkitem-model |
| Tijdvensters dag/3d/week/14d/4w/maand | alleen week interactief; maand/kwartaal/jaar read-only | uitbreiden |
| Slepen = verplaatsen | weekPlanning.assign/move + HTML5 DnD | hergebruik |
| Randen trekken = duur aanpassen | ontbreekt (dag-granulariteit, geen tijden/duur) | nieuw |
| Dupliceren met teamsamenstelling/tijden | ontbreekt | nieuw |
| Splitsen over dagen/teams | ontbreekt | nieuw |
| Wachtrij/opdrachtenbak (projecten, beurten, rest-taken) | zijbalk met alleen actieve projecten | uitbreiden/grotendeels nieuw |
| Terugkerende beurten in bak | ontbreekt (contracten genereren geen werkitems) | nieuw |
| Ziekte/uitval: dag loskoppelen → bak | ontbreekt | nieuw |
| Beschikbaarheidsvenster klant + voorkeursteam | ontbreekt op klanten | nieuw (2 velden + filter) |
| Afwezigheidsblokken (verlof/ziekte/feestdag) | alleen filter in getBeschikbaar op urenRegistraties.uurtype; verlofaanvragen niet gekoppeld | nieuw + koppeling verlof.ts |
| Teams met bemanning per dag | teams.leden = statische array | uitbreiden (per-dag bemanning) |
| Route-dagkaart (chronologisch, blokken) | ontbreekt; dichtstbij: voormanDashboard | nieuw |
| Tijdcascade + reistijd (Google Maps Distance Matrix) | ontbreekt volledig; geen geocoding | nieuw |
| Standaardblokken (loods, pauze, afronding) | ontbreekt | nieuw |
| Dagregie Vandaag vs Planvenster | ontbreekt | nieuw |
| Plannen logt tijdlijn-event | ontbreekt | nieuw |
| Seizoensvenster-waarschuwing | ontbreekt | nieuw |
| Audit-logging planwijzigingen | ontbreekt | nieuw |
| DayPilot Lite + databinding-adapter | niet aanwezig (dnd-kit geïnstalleerd maar ongebruikt) | nieuw |
| Voertuig per planning-entry | weekPlanning.voertuigId + assignVoertuig (APK/defect-check) | hergebruik (UI-consumer ontbreekt) |
| Conflict/capaciteitsbewaking | getConflicten, getCapaciteit, getCapacityOverview | hergebruik (niet zichtbaar op weekbord) |

### Concrete gap

1. Datamodel-mismatch is de kern: weekPlanning is medewerker-per-dag zonder team/tijd/duur/volgorde — het PRD-model (team_id + datums + tijden + volgorde) vergt schema-uitbreiding of nieuwe tabel plus migratie.
2. Route-dagkaart, tijdcascade, reistijd, standaardblokken, wachtrij: allemaal from scratch; reistijd vereist eerst geocoding (werklocaties.coordinates is optioneel/ongevuld) + Google Maps API-key.
3. Afgemaakte backend-functies (assignVoertuig, getConflicten, getBeschikbaar) hebben geen UI-consumer — functionaliteit lijkt af maar is onzichtbaar.
4. Wachtrij hangt af van gegenereerde beurten (2.1), die weer afhangen van het werkitem (1.1).

---

## 4. Uren & afrondingsflow (PRD 2.6 + bijlage C) — veld-app/mobile

**Verdict: deels** — werkende maar simpele uren-keten; vrijwel alles uit de Hub-herbouw ontbreekt, plus twee echte bugs.

### Wat er staat

- Expo-app tab Uren (1218 regels) klokt in/uit via convex/mobile.ts (clockIn/clockOut op locationSessions, GPS, 1 pauze per sessie) en schrijft bij uitklokken één urenRegistraties-rij. Offline batch-sync (syncUrenRegistraties, idempotencyKey) en handmatige invoer op web (/uren) werken.
- Uren kunnen **uitsluitend op projecten**: urenRegistraties.projectId is verplicht `v.id("projecten")` in álle schrijfpaden (add, importBatch, syncUrenRegistraties, clockOut).
- Geen segment-model: geen categorie (werken/pauze/reistijd/BES), geen begin/eindtijd — één urengetal per dag.
- Geen dag indienen/heropenen, geen audit-log (update/remove muteren vrij).
- Afrondingsflow op taakniveau ontbreekt: mobiel is planningTaken read-only; geen ✓/◐/○, geen rest-opdracht.
- `meerwerk`-tabel (schema.ts:814) heeft **nul** queries/mutations en geen UI — leeg omhulsel; convex/meerwerk.ts bestaat niet.
- Materiaaldelta: voertuigUitrusting (businventaris) bestaat, maar geen delta-berekening/route-knop/afvinklog.
- Wie-is-achter: rudimentair in voormanDashboard.getVoormanStats, maar **kapot** door naam-vs-id-vergelijking.
- Mobile-tabs: Home (toont bedrijfsomzet-stats aan iedereen), Uren (werkt), Chat (werkt), Foto's (stub, 22 regels), Notificaties, Profiel, project/[id], admin.

### Wat de PRD vraagt vs. wat er is

| PRD-eis (§2.6 / bijlage C) | Bestaand equivalent | Actie |
|---|---|---|
| Uren op elk werkitem | urenRegistraties.projectId verplicht; geen werkitem/beurt-tabel | nieuw (werkitem-model) + uitbreiden urenRegistraties |
| Urensegmenten (categorie, begin/eind, werkitem) | ontbreekt; dichtstbij locationSessions (1× pauze) en urenRegistraties.uren (één getal) | nieuw |
| BES-segment afvalverwerker | afvalverwerkers = stamdata, geen tijdregistratiekoppeling | nieuw |
| Dagkaart vult segmenten voor | ontbreekt (mobile Home = bedrijfsstats) | nieuw |
| Dag indienen / heropenen + audit-log | ontbreekt; syncStatus is offline-sync-veld; update/remove zonder audit | nieuw |
| Wie-is-achter (achterstand + afwijking > drempel) | getVoormanStats (alleen vandaag); matching kapot (id vs naam); geen drempel | uitbreiden + bugfix |
| Afrondingsflow taakniveau (✓/◐/○, rest-opdracht) | planningTaken.status kent "afgerond" (web); mobiel read-only | nieuw |
| Meerwerk-verzoek voorman → planning keurt goed | meerwerk-tabel zonder functies/UI | tabel hergebruiken, backend+UI nieuw |
| Materiaaldelta-checklist + route-knop | voertuigUitrusting bestaat; delta ontbreekt | hergebruik inventaris, delta nieuw |
| Foto's per opdracht → klanttijdlijn | mobile fotos.tsx = 22-regel stub; fotoStorage.ts bestaat | uitbreiden |
| Buiten-modus, noodprotocol, Excel-urenexport | ontbreekt | nieuw |
| Pauze als segment | startBreak/endBreak bestaat, maar pauze wordt NIET afgetrokken van uren | bugfix + vervangen door segmenten |

### Concrete gap

1. **Bug:** clockOut rekent uren = clockOutAt − clockInAt (mobile.ts ~r.154); pauze wordt genegeerd → structureel te hoge uren richting facturatie/nacalculatie.
2. **Bug:** getVoormanStats vergelijkt urenRegistraties.medewerker (naam-string) met medewerkers._id (r.55-57/110) → heeftUren/ingevuld vrijwel altijd false.
3. Segment-model, dag indienen/heropenen, afrondingsflow, materiaaldelta, meerwerk-flow: allemaal nieuw; keten contract → beurt → uren → factuur is architectureel nog onmogelijk zonder werkitem.
4. urenRegistraties.medewerker is een vrije naam-string (medewerkerId optioneel, mobiel zet alleen medewerkerClerkId); bron kent alleen import|handmatig (klok-uren gelogd als "handmatig") — herkomst en koppeling niet auditeerbaar.

---

## 5. Klanttijdlijn / Chat-ombouw (PRD 2.3) + interne vs klantthread-scheiding (PRD 1.2)

**Verdict: deels** — werkende chat-infrastructuur (twee generaties naast elkaar), maar geen klanttijdlijn en een tabelontwerp dat de PRD expliciet verbiedt.

### Wat er staat

- **Generatie 1 (legacy, actief):** offerte_messages, team_messages, direct_messages, chat_attachments — gebruikt door mobile (team/DM via chat.ts) en door de dashboard offerte-bewerken-pagina (offerteMessages.sendFromBusiness).
- **Generatie 2 (nieuw):** chat_threads/chat_messages (type: klant|team|direct|project) — gebruikt door het klantportaal (/portaal/chat) en de dashboard-chat "Klanten"-tab. chatThreads.ts is volledig geïmplementeerd (list/send/markAsRead/create/delete); dit werkt.
- Ontbreekt t.o.v. PRD 2.3: kanaal-veld (telefoon/whatsapp/email/intern/systeem), senderType "systeem", auto-events (nergens insert in chat_messages buiten chatThreads/chatMigration), searchIndex op chat_messages, entry-level werkitem_id/melding_id, tijdlijnweergave per klant.
- klanten.notities bestaat en wordt actief getoond/bewerkt — niet uitgefaseerd.
- Herbruikbaar patroon: leadActiviteiten (event-log per lead, type+beschrijving+metadata) — maar hangt aan leads, niet aan klanten.
- T.o.v. PRD 1.2: interne en klantthreads zitten in **één** tabel gescheiden door een type-vlag — precies het verboden ontwerp. sendMessage/listMessages checken thread.type niet; markAsRead heeft geen ownership-check; elke stafrol mag in klantthreads sturen.
- chatMigration.ts (3 internalMutations) wordt nergens aangeroepen — migratiestatus onbekend, oude tabellen blijven live.

### Wat de PRD vraagt vs. wat er is

| PRD-eis (2.3/1.2) | Bestaand equivalent | Actie |
|---|---|---|
| Eén tijdlijn per klant | chat_threads.type="klant" — meerdere threads per klant, geen tijdlijn-UI | uitbreiden/ombouwen |
| Entry: auteur + timestamp | chat_messages.senderName/senderUserId/createdAt | hergebruik |
| Entry: kanaal | ontbreekt (geen enkel kanaal-veld) | nieuw |
| Entry: werkitem_id | alleen thread-level offerteId/projectId | uitbreiden |
| Entry: melding_id | ontbreekt | nieuw |
| Bijlagen (foto's) | chat_messages.attachmentStorageIds (klant geblokkeerd in v1) | uitbreiden |
| Auto-events (offerte verzonden/geaccepteerd, ingepland, factuur, …) | ontbreekt; notifications = per-user feed; leadActiviteiten alleen per lead | nieuw (patroon leadActiviteiten kopiëren) |
| Filters per werkitem/kanaal + vrij zoeken | geen searchIndex op chat_messages (wel op team_messages) | nieuw |
| Notities-veld klantkaart uitfaseren + migreren | klanten.notities actief in UI | migreren + verwijderen |
| Tabs Team/Mededelingen/DM blijven intern | dashboard-chat draait op oude chat.ts | hergebruik |
| Tabs Klanten/Projecten = weergave tijdlijn, geen tweede opslag | Klanten-tab = chat_threads; offerte-bewerken schrijft naar offerte_messages (derde opslag) | herstructureren |
| 1.2: interne vs klantthreads = gescheiden tabellen | chat_threads mengt alles via type-vlag | herstructureren |
| 1.2: alleen kantoor verstuurt naar klant | sendMessage staat elke stafrol toe | uitbreiden (rolcheck) |
| 1.2: klant ziet alleen eigen dossier | linkedKlantId-check aanwezig | hergebruik + fix (type-check, markAsRead) |

### Concrete gap

1. De klanttijdlijn als concept (één tijdlijn, kanalen, auto-events, zoeken, filters) bestaat niet — nieuwbouw op een nieuw of omgebouwd datamodel.
2. **Split-brain berichtenopslag:** offerte-bewerken schrijft naar offerte_messages, portaal leest alleen chat_threads — bedrijfsberichten daar zijn onzichtbaar voor de klant.
3. Tabelscheiding intern/klant (PRD 1.2) vergt herstructurering vóór verdere chat-bouw; markAsRead-ownership en type-checks zijn concrete gaten.
4. Migratiepad legacy → unified is onduidelijk (chatMigration nooit gedraaid; mobile zit volledig op legacy).

---

## 6. Meldingen / cases-bord (PRD 2.4)

**Verdict: deels** — Servicemeldingen (MOD-010) is een werkende, smallere voorloper van het cases-bord. Advies: uitbreiden, niet vervangen.

### Wat er staat

- convex/servicemeldingen.ts (449 regels) volledig geïmplementeerd en aangeroepen: kanban-query met vier statuskolommen (nieuw / in_behandeling / ingepland / afgehandeld), create met automatische garantie-detectie (actieve garantie op project → isGarantie=true, kosten=0), statusupdate, serviceAfspraken (datum + medewerkerIds) waarbij "uitgevoerd" de melding automatisch afhandelt.
- UI: /servicemeldingen is een echt statusbord (kolommen, filters op prioriteit/garantie/zoek, create-dialog; status-move via knop, geen drag-and-drop); /servicemeldingen/[id] met statusworkflow, afspraken plannen, kosten bewerken.
- Garanties: eigen backend + UI; checkAndExpire is handmatig, geen cron.
- GarantiePakketten (offerte-upsell-tiers) en kwaliteitsControles (project-checklists) staan los van het cases-bord.
- Mobile bevat nul servicemelding-schermen; portaal-instroom ontbreekt (conform fase 2).

### Wat de PRD vraagt vs. wat er is

| PRD-eis / veld (2.4) | Bestaand equivalent | Actie |
|---|---|---|
| `klant_id` (verplicht) | servicemeldingen.klantId (verplicht) | hergebruik |
| `werkitem_id` (optioneel) | projectId (optioneel) + garantieId | uitbreiden (ook beurt/contract) |
| `type` serviceverzoek/klacht/schade | ontbreekt (alleen isGarantie-boolean) | nieuw veld + verzekeringsvlag bij schade |
| `kanaal` | ontbreekt | nieuw veld |
| `omschrijving` | beschrijving | hergebruik |
| `fotos` | fotos (array) | hergebruik |
| `eigenaar` (precies één, verplicht) | ontbreekt (userId = tenant, geen persoon) | nieuw (verplicht) |
| `status` nieuw/in behandeling/wacht op derden/opgelost | nieuw/in_behandeling/ingepland/afgehandeld | uitbreiden ("wacht_op_derden"; "ingepland" als afgeleide van serviceAfspraak); datamigratie op by_status-indexes |
| `aangemaakt_door` | ontbreekt | nieuw |
| `deadline` (optioneel) | ontbreekt (wel prioriteit — niet in PRD, behouden) | nieuw |
| Bord 4 kolommen + filter "mijn cases" | kanban-UI bestaat; "mijn cases" onmogelijk zonder eigenaar | hergebruik + uitbreiden |
| Teller-badge in menu | sidebar-item zonder badge | nieuw |
| @tag medewerker → veldtaak op dagkaart | ontbreekt; serviceAfspraken los van planbord; geen mention-systeem | nieuw (integratie serviceAfspraken ↔ planning + case-thread) |
| Interne case-thread | ontbreekt | nieuw (of hergebruik chatThreads) |
| Logging op klanttijdlijn | ontbreekt; geen tijdlijn-tabel | nieuw (afhankelijk van 2.3) |
| Promotie melding → werkitem met behoud koppeling | ontbreekt | nieuw |
| Routing-defaults per type | ontbreekt | nieuw |
| Portaal-instroom (fase 2) | ontbreekt in portaal.ts | later, zelfde tabel |

### Concrete gap

1. Het PRD-meldingobject mist type, kanaal, eigenaar, aangemaakt_door, deadline en de status "wacht op derden" — de eigenaar-eis is de kern en vergt een medewerker-identiteitslaag (huidige authz = userId = tenant).
2. @tag → veldtaak en promotie → werkitem: nul code; afhankelijk van planbord- en werkitem-modules.
3. Klanttijdlijn-logging kan niet zolang 2.3 niet bestaat.
4. Status-semantiek wijzigen raakt indexes by_status/by_user_status: datamigratie.

---

## 7. Facturatie-engine (PRD 2.8) + Debiteurenladder (PRD 3.2)

**Verdict: deels** — werkende basis-facturatiemodule, maar de statuskern is anders gemodelleerd dan de PRD; de debiteurenladder draait maar **verstuurt geen enkele e-mail**; boekhoudkoppeling en betalingen zijn lege omhulsels.

### Wat er staat

- facturen.generate vanuit projecten, deelfacturen (percentage/label), meerwerkfacturen, creditnota's, PDF, statusflow met overgangsvalidatie, klantnotificatie-mail bij "verzonden". UI: /facturen (status-tabs, overdue-widget), /projecten/[id]/factuur, portaal-inzage.
- Status is **één keten** (concept→definitief→verzonden→betaald/vervallen) in één veld — geen gescheiden documentstatus/betaalstatus. De dagelijkse cron zet verzonden facturen op "vervallen" zodra een herinnering triggert: betaalinformatie vervuilt de documentstatus.
- Deelbetalingen bestaan niet (markAsPaid = alles-of-niets). De betalingen-tabel is een losstaand Mollie-restant zonder factuurId en zonder webhook-route in http.ts — feitelijk dood.
- "Datum van dienst" ontbreekt; geen werkitem-koppeling; geen Te-versturen-wachtrij; geen automatische conceptgeneratie vanuit afgeronde beurten.
- Facturatiemodus per contract ontbreekt: alleen betalingsfrequentie + contractFacturen-termijnen die nooit tot echte facturen worden omgezet.
- Debiteurenladder: dagelijkse cron (8:00 UTC) met treden 7/14/21 (herinnering) en 30/45/60 (aanmaning), opt-in per gebruiker — maar betalingsherinneringen.ts bevat geen scheduler/Resend-call terwijl records `emailVerstuurd:true` krijgen. Alleen registratie.
- Boekhoudkoppeling: settings-UI en markForSync zetten "pending", maar er bestaat geen provider-API-code (geen Moneybird/Exact).

### Wat de PRD vraagt vs. wat er is

| PRD-eis (2.8 / 3.2) | Bestaand equivalent | Actie |
|---|---|---|
| Gescheiden documentstatus | facturen.status — één keten (schema.ts:852; overgangsmatrix facturen.ts:413) | uitbreiden: splits documentStatus + betaalStatus, migratie |
| Betaalstatus (open→gedeeltelijk→betaald/vervallen/geannuleerd) | ontbreekt; "vervallen" misbruikt als overdue-markering door cron | nieuw veld + logica |
| Deelbetalingen | ontbreekt; markAsPaid alles-of-niets; betalingen (Mollie) geen factuurId/webhook | nieuw; betalingen hergebruiken vergt factuurId-koppeling |
| Te-versturen-wachtrij + bulkverzenden | ontbreekt; dichtstbij "definitief"-tab; wel bulkArchive/bulkRestore | nieuw filter + bulk-verzendactie |
| Auto-conceptfactuur bij afgeronde beurt | ontbreekt volledig | nieuw |
| Facturatiemodus per contract | betalingsfrequentie (ander concept) | uitbreiden/vervangen |
| Termijnschema contract | contractFacturen gegenereerd maar nooit gefactureerd; factuurId nergens gezet | uitbreiden: facturatiestap bouwen |
| Datum van dienst | ontbreekt | nieuw veld |
| Referentie offerte/contract/werkitem op factuur | alleen projectId (+ meerwerkId) | uitbreiden |
| Verzonden/betaald → klanttijdlijn | alleen e-mail bij verzonden; geen tijdlijn-log | nieuw |
| Debiteurenladder: dagelijkse run | cron 8:00 UTC → processAutomatischeHerinneringen; treden instelbaar; opt-in | hergebruik, e-mailverzending toevoegen |
| Herinnering verstuurt e-mail/document | ontbreekt: emailVerstuurd:true wordt gelogd zónder verzending | nieuw (bug/misleidend) |
| Sjablonen per trede | dagen instelbaar; sjablonen ontbreken | uitbreiden |
| Ouderdomsoverzicht | getOverdueStats (buckets) op facturen-page | uitbreiden |
| Pauzeren ladder per factuur | ontbreekt | nieuw |
| Boekhoudsync facturen | schema + UI + markForSync; GEEN provider-actions | leeg omhulsel — implementatie nieuw |

### Concrete gap

1. **Misleidend gedrag:** de herinnerings-cron logt emailVerstuurd:true zonder ooit te mailen én patcht facturen naar "vervallen" — FAC-006/007 is half af en de data liegt.
2. Status splitsen (document vs. betaal) is een brede migratie: raakt facturen-page, portaal, export, getStats, dashboard en 1986 unit tests; "vervallen" moet ontrafeld worden (overdue vs. echt vervallen).
3. Deelbetalingen, wachtrij, datum-van-dienst, auto-conceptfacturen: nieuw; keten beurt→factuur onmogelijk zonder werkitem (1.1/2.1).
4. Lege omhulsels: betalingen/Mollie (geen webhook, geen factuurkoppeling), boekhoudsync (eeuwig "pending"), contractFacturen-facturatie.

---

## 8. Offertes (PRD 2.5 twee routes + bijlage A bouwstenencatalogus)

**Verdict: deels** — Route 1 (bestaande engine) bestaat en werkt echt; vrijwel alles wat §2.5 nieuw vraagt ontbreekt; Route 2 als zelfstandige builder bestaat niet.

### Wat er staat

- Wizards op /offertes/nieuw/aanleg en /offertes/nieuw/onderhoud (snelstart/pakket → klant+scopes → scope-details → bevestigen) rekenen client-side via src/lib/offerte-calculator.ts (2027 regels, met tests): normuren (seed), correctiefactoren, producten (prijsboek, ~34 seed-records) en instellingen (uurtarief, scopeMarges, btwPercentage) → regels (materiaal/arbeid/machine) met marge per regel/scope en één btw-percentage over de hele offerte. convex/berekeningen.ts bevat server-side deelberekeningen.
- Pakketten zijn hardcoded frontend-constanten (src/lib/constants/packages.ts) — niet de PRD-tegels Onderhoud Tuin/Reiniging/Compleet.
- Standaardtuinen-templates en een regel-editor op /offertes/[id]/bewerken (vrije regels, marge-override, optionele regels) bestaan.
- Ontbreekt: bouwstenen-tabel/catalogusbeheer (bijlage A, 23 records — nergens in schema of seeds), prijsmodel uur/vast per bouwsteen, frequentie×prijs→jaarprijs in de wizard, artikel-picker in de regel-editor (add-regel-dialog heeft nul productkoppeling), gebruiksteller op producten, tekstblokkenbibliotheek, btw-code per product/regel, uurtarief-met-ingangsdatum, hoofdstukken/subtotalen/korting.
- Acceptatie triggert alleen notificaties/e-mail — geen contract/werkitem-generatie of harde validatie.

### Wat de PRD vraagt vs. wat er is

| PRD-eis (§2.5 / bijlage A) | Bestaand equivalent | Actie |
|---|---|---|
| Route 1: onderhoud-wizard blijft ongewijzigd | wizard + offerte-calculator.ts + berekeningen.ts — werkt | hergebruik (niet aanraken) |
| Pakket-tegels Onderhoud Tuin / Reiniging / Compleet | packages.ts — hardcoded, andere pakketten | uitbreiden/vervangen door data |
| Bouwstenencatalogus (bijlage A, 23 records) | ontbreekt; dichtstbij: contractWerkzaamheden en normuren | nieuw (tabel `bouwstenen`) |
| Catalogusbeheer-scherm §2.5f | ontbreekt (/instellingen beheert wel normuren/correctiefactoren/marges) | nieuw |
| Prijsmodel per bouwsteen: uurbasis/vast, overschrijfbaar | ontbreekt; calculator heeft hardcoded prijsconstanten (KUNSTGRAS 45, OVERHEAD 200 e.d.) | nieuw |
| Uurtarief mét ingangsdatum | instellingen.uurtarief (één number, geen historie) | uitbreiden |
| Frequentie per bouwsteen → jaarprijs/maandbedrag | frequentie alleen in contractenmodule, niet in wizard | nieuw in wizard |
| Route 2: vrije regel-editor (offerte én factuur) | /offertes/[id]/bewerken (edit bestaande offerte) | uitbreiden tot zelfstandige route |
| Artikel aanklikken vult regel | ontbreekt — add-regel-dialog heeft geen product-query | nieuw |
| Gebruiksteller per artikel + sortering | ontbreekt — geen usage-veld; regels hebben geen productId | nieuw |
| Tekstblokkenbibliotheek | ontbreekt; dichtstbij pdfVoorwaarden + emailTemplates | nieuw |
| Btw-code per regel/product (9%/21%) | ontbreekt — één btwPercentage op totaal | nieuw (veld + calc aanpassen) |
| Hoofdstukken/subtotalen, korting per regel & totaal | ontbreekt — platte regels-array | nieuw |
| Productbestand onder Leveranciers, import + ontdubbeling | producten + leveranciers bestaan; leverancier = vrije string; bulkImport insert blind (geen ontdubbeling, geen €0-validatie) | uitbreiden |
| Acceptatie → verplicht werkitem/contract | updateStatus doet alleen notificaties/e-mail | nieuw (harde validatie + generatie) |
| Live overzichtsblok (posten, uren, inkoop, marge) | deels: totals-card + calculateTotals; geen inkoop-vs-verkoop | uitbreiden |

### Concrete gap

1. Bouwstenencatalogus is de grootste bouwsteen: tabel + seed (23 records) + beheer-UI + prijsmodel + wizard-integratie — nul aanwezig.
2. Route 2 (zelfstandige offerte/factuur-builder met artikel-picker, tekstblokken, hoofdstukken, korting, btw per regel) bestaat niet; de bestaande regel-editor is een startpunt.
3. Acceptatie-keten (geaccepteerd → verplicht werkitem/contract) ontbreekt volledig, ook in de portaal-acceptatieflow.
4. producten.bulkImport zonder ontdubbeling/€0-validatie is precies het HERO-"Voorrijkosten"/Infinity%-risico dat §2.5c wil voorkomen — HERO-import (492 artikelen) mag hier niet doorheen zonder validatielaag.
5. Btw per regel en uurtarief-historie raken het gedeelde offerte-record en calculateTotals — moet backwards-compatibel om Route 1 niet te breken.

---

## 9. Rollenmodel & autorisatie (PRD 1.2)

**Verdict: deels** — serieus fundament (7 rollen, Clerk, veilig klantportaal), maar handhaving is binair en er zijn kritieke onbeschermde endpoints. De misklik-test (§8.3) faalt drievoudig.

### Wat er staat

- 7-rollenmodel (directie, projectleider, voorman, medewerker, klant, onderaannemer_zzp, materiaalman; legacy admin/viewer genormaliseerd) in convex/roles.ts met permissiematrix; Clerk-auth voor web én mobile.
- Klantenportaal is goed: alle 10 portaal-functies gebruiken requireKlant + klantId-index-scoping + veldfiltering (arbeidsregels en interne velden gestript) — de PRD-eis "RLS op klant_id" is daar correct vertaald. proxy.ts scheidt /portaal van /dashboard; invitation-flow werkt.
- Maar: van 676 publieke functions gebruiken er 240 requireNotViewer ("niet-klant mag alles") en slechts **1** requirePermission — de matrix is decoratief. Een medewerker/voorman kan via directe API-calls klanten.create/update, facturen.generate, instellingen.update etc. uitvoeren.
- Misklik-test faalt: (1) chat_threads = één tabel met type-vlag (verboden ontwerp); (2) chatThreads.sendMessage laat elke stafrol in een klant-thread posten, inclusief e-mailnotificatie naar de klant; (3) Klanten-chattab en verstuurknop zichtbaar voor álle stafrollen; /api/email (Resend) checkt alleen "ingelogd".
- Echt onbeschermde endpoints: users.adminListUsers (lekt alle e-mails/clerkIds zonder login), users.adminMigrateExistingUsersToAdmin (privilege-escalatie naar directie), offertes.getByNummer (volledige offerte incl. interne prijzen op raadbaar nummer), fotoStorage.getUrl/getUrls, projectKosten.getBudgetStatus, standaardtuinen.get, emailLogs.updateFromWebhook.
- Mobile haalt de misklik-test wél: chat daar is alleen team/DM/project.

### Wat de PRD vraagt vs. wat er is

| PRD-eis (§1.2) | Bestaand equivalent | Actie |
|---|---|---|
| Rol `kantoor` | directie + projectleider (roles.ts) | hergebruik; "kantoor" = {directie, projectleider} als capability-groep |
| Rol `voorman` | bestaat | hergebruik |
| Rol `medewerker` (ZZP later) | medewerker + onderaannemer_zzp bestaan al | hergebruik (ZZP vóór op PRD) |
| Rol `klant` | users.role="klant" + linkedKlantId → klanten | hergebruik |
| RLS op klant_id | requireKlant (auth.ts:107) + by_klant-indexen + veldfiltering in portaal.ts | hergebruik; goed |
| Capability "versturen naar klant" alleen kantoor | ONTBREEKT: sendMessage (r.151) staat alle stafrollen toe; /api/email alleen auth(); sendPortalInvitation alleen requireNotViewer | nieuw: rolcheck op alle klant-gerichte send-paden + knop verbergen |
| Verstuurknop bestaat niet in UI voor andere rollen | ONTBREEKT: Klanten-tab zichtbaar voor alle stafrollen | uitbreiden: tab + input achter rolgate |
| Interne threads en klantthreads gescheiden tabellen | ONTBREEKT: één chat_threads met type-vlag | nieuw: splitsen |
| API weigert (server-side per functie) | requireNotViewer 240×, requirePermission 1× | uitbreiden: requirePermission uitrollen over mutations |
| Rollenmodel vóór portaal/chat-ombouw | portaal veilig; chat niet | chat-scheiding heeft prioriteit |

### Concrete gap

1. **Direct dicht te zetten (kritiek):** adminListUsers, adminCheckDataOwnership, adminMigrateExistingUsersToAdmin, offertes.getByNummer, fotoStorage.getUrl/getUrls, emailLogs.updateFromWebhook.
2. Misklik-test halen = (1) klant-threads eigen tabel of harde rolcheck in sendMessage, (2) Klanten-tab/verstuurknop achter rolgate, (3) rolcheck op /api/email en sendPortalInvitation.
3. requirePermission uitrollen over de mutations (nu 1 van 676) zodat de permissiematrix daadwerkelijk afdwingt.
4. Begrip "kantoor" definiëren (directie vs projectleider) — afstemmen met Mickey.

---

## 10. Infrastructuur (crons, e-mail/Resend, Google Maps, env-vars, test-infra, Convex dev/prod)

**Verdict: deels** — e-mail-, push- en test-infra werken; herinnerings-cron mailt niet; Google Maps ontbreekt volledig; dev-omgeving kan echte mails sturen.

### Wat er staat

- **Crons (convex/crons.ts): 2 jobs.** (1) daily cleanup 03:00 UTC → softDelete.runDailyCleanup. (2) betalingsherinneringen 08:00 UTC → processAutomatischeHerinneringen: maakt alleen records met emailVerstuurd:true en patcht facturen naar "vervallen" — **geen e-mail** (geen fetch/scheduler in het hele bestand).
- **E-mail, twee routes:** (a) convex/portaalEmail.ts internalActions (fetch api.resend.com) via scheduler.runAfter vanuit facturen.ts:474, projecten.ts:381, chatThreads.ts:213, offertes.ts:1096 en klanten.ts:1035 (die laatste via Clerk REST /v1/invitations met notify:true — Clerk mailt zelf); (b) Next-route /api/email met Resend SDK (configurator-pagina's, use-email.ts). emailLogs logt; Resend-webhook met svix-verificatie.
- **Push:** notifications.ts sendExpoPushNotification → exp.host (echte devices).
- **Dode feature:** offerteReminders.ts heeft een complete Resend-mailer (700 regels) maar scheduleReminders wordt nergens aangeroepen.
- **Google Maps:** geen key, geen geocoding/Distance Matrix; alleen een statische maps-link in lead-detail-modal.tsx.
- **Test-infra echt:** Vitest (jsdom, coverage), 9 Playwright-specs in e2e/ met Clerk testing tokens, CI-workflows.
- **Convex:** .env.local wijst naar dev-deployment met een RESEND_API_KEY erin — localhost-testen kan echte mails sturen. .env.local.example sterk verouderd (mist RESEND_*, MOLLIE_*, CALENDLY_*, FLEETGO_*, WEBSITE_WEBHOOK_SECRET, ALLOWED_ORIGIN, SITE_URL). Sentry DSN hardcoded in sentry.client.config.ts.

### Wat de PRD vraagt vs. wat er is

| PRD-eis | Bestaand equivalent | Actie |
|---|---|---|
| Automatische betalingsherinneringen (FAC-006/007) | cron + processAutomatischeHerinneringen — maakt records, verstuurt geen mail | uitbreiden: koppel aan portaalEmail/Resend-action |
| Offerte-/factuur-/portaalmails | portaalEmail.ts (5 send-actions) + emailLogs + Resend-webhook | hergebruik |
| Offerte follow-up reminders | offerteReminders.ts — volledig gebouwd, geen callers | uitbreiden: aanroepen bij verzenden, of verwijderen |
| Reisafstand/geocoding (Google Maps) | ontbreekt — alleen maps-deeplink | nieuw: Distance Matrix/Geocoding + GOOGLE_MAPS_API_KEY |
| Push-notificaties veldwerkers | sendExpoPushNotification + registerPushToken | hergebruik |
| Test/CI | Vitest + Playwright + ci.yml | hergebruik |

### Concrete gap

1. Herinnerings-mail koppelen (met dry-run/env-guard — zodra de mail-action aangesloten wordt gaat de cron dagelijks klanten mailen).
2. Google Maps volledig from scratch (key, billing, geocoding van werklocaties, Distance Matrix) — voorwaarde voor tijdcascade (2.2).
3. Omgevingshygiëne: NODE_ENV/sandbox-guard rond álle send-functies, .env.local.example actualiseren, Sentry DSN uit code.
4. offerteReminders: activeren of verwijderen — nu dode code die bij activering direct kan mailen.

---

## Totaaloverzicht

| # | Module | PRD | Verdict | Bruikbare basis | Grootste gap |
|---|---|---|---|---|---|
| 1 | Werkitem-entiteit + Leads/Klanten | 1.1 + 1.3 | deels | leads/klanten-scheiding + markGewonnen werken | werkitem-entiteit en beurt-type bestaan niet; offerteId verplicht op projecten |
| 2 | Onderhoudscontracten | 2.1 | deels | contractadministratie + termijnschema + PDF werken | beurtengenerator, facturatiemodus, losse beurt, attendering-UI: alles nieuw |
| 3 | Planbord | 2.2 | deels | weekplanner (DnD) + capaciteit/conflict-backend | team/tijd/duur-model, wachtrij, route-dagkaart, tijdcascade/reistijd: nieuw |
| 4 | Uren & afrondingsflow | 2.6 + bijl. C | deels | klok in/uit + offline sync + web-invoer werken | segmenten, indienen/audit, afrondingsflow, meerwerk (leeg omhulsel); 2 bugs (pauze, wie-is-achter) |
| 5 | Klanttijdlijn / chat | 2.3 + 1.2 | deels | chatThreads + portaalchat werken | tijdlijn (kanalen, auto-events, zoeken) bestaat niet; verboden één-tabel-ontwerp |
| 6 | Meldingen / cases-bord | 2.4 | deels | servicemeldingen-kanban + garantie-detectie werken | type/kanaal/eigenaar/deadline, @tag, promotie→werkitem, tijdlijn-logging |
| 7 | Facturatie + debiteurenladder | 2.8 + 3.2 | deels | generate/deelfactuur/creditnota/PDF/cron-treden werken | status-splitsing, deelbetalingen, wachtrij, beurt→factuur; ladder mailt niet; boekhoudsync + Mollie = lege omhulsels |
| 8 | Offertes | 2.5 + bijl. A | deels | Route 1-wizards + calculator + regel-editor werken | bouwstenencatalogus, Route 2, artikel-picker, btw per regel, acceptatie-keten |
| 9 | Rollen & autorisatie | 1.2 | deels | 7 rollen, Clerk, veilig klantportaal | binair afgedwongen (requirePermission 1×), misklik-test faalt, onbeschermde admin-endpoints |
| 10 | Infrastructuur | div. | deels | Resend-mails, push, Vitest/Playwright/CI werken | herinnerings-mail ontbreekt, Google Maps ontbreekt, dev kan echte mails sturen |

**Lege omhulsels binnen deels-modules:** meerwerk-tabel (geen functies/UI), betalingen/Mollie (geen webhook/factuurkoppeling), boekhoudkoppeling (UI zonder provider-code), contractFacturen-facturatie (factuurId nooit gezet), indexatievelden (geen logica), offerteReminders (geen callers), mobile fotos.tsx (22-regel stub).

**Rode draad / bouwvolgorde:** vrijwel elke module wacht op het **werkitem** (1.1): beurtengenerator (2.1) heeft geen doeltabel, planbord-wachtrij (2.2) niets om te tonen, uren (2.6) niets om op te boeken, facturatie (2.8) geen beurt om te factureren. Daarnaast blokkeert het ontbreken van de **klanttijdlijn** (2.3) de logging-eisen van 2.2, 2.4 en 2.8, en moet de **chat-tabelscheiding + rolhandhaving** (1.2) vóór elke verdere chat/portaal-bouw.

---

## Alle risico's

### Kritiek (security — direct dichtzetten)

1. `users.adminListUsers` en `users.adminCheckDataOwnership` zijn publieke queries zonder enige auth — iedereen met de Convex-URL kan alle gebruikers (e-mail, naam, clerkId) opsommen.
2. `users.adminMigrateExistingUsersToAdmin` is een publieke mutation zonder auth die alle rol-loze users naar 'directie' promoveert — privilege-escalatie.
3. `offertes.getByNummer` geeft zonder auth het volledige offerte-document (incl. arbeidsregels, marges, interne notities) op een voorspelbaar offertenummer.

### Hoog (security / dataverlies / misleidend gedrag)

4. Misklik-test §8.3 faalt: voorman/medewerker kan via chatThreads.sendMessage in een klant-thread posten (API weigert niet) én ziet de Klanten-tab; klant krijgt zelfs een e-mailnotificatie.
5. Interne en klant-chat delen één tabel (chat_threads met type-vlag) — precies het lekscenario dat PRD 1.2 structureel uitsluit; sendMessage/listMessages negeren thread.type; een intern project-thread met gezet klantId zou voor de klant leesbaar worden zodra chatMigration draait.
6. chatThreads.markAsRead (chatThreads.ts:222) heeft geen ownership-check: elke geauthenticeerde gebruiker kan van elk thread-id unread-tellers resetten.
7. /api/email verstuurt Resend-mail voor elke ingelogde rol (ook klant) — capability "versturen naar klant" is niet kantoor-only.
8. Herinnerings-cron logt emailVerstuurd:true zonder ooit e-mail te versturen — gebruiker denkt dat aanmaningen de deur uit zijn terwijl er niets gebeurt; de cron patcht bovendien dagelijks verzonden facturen naar "vervallen" (ook in dev).
9. LIVE MAIL IN DEV: RESEND_API_KEY staat in .env.local; factuur/offerte verzenden, chatbericht, project-notificatie en klant-uitnodiging schedulen echte Resend-/Clerk-mails naar klant-adressen — ook vanaf localhost tegen de dev-deployment. Clerk-invitations (notify:true) zijn niet te dempen met een Resend-testkey. Geen NODE_ENV/sandbox-guard rond welke send-functie dan ook.
10. Pauze wordt niet afgetrokken: clockOut rekent uren = clockOutAt − clockInAt (mobile.ts ~r.154) — structureel te hoge uren richting facturatie/nacalculatie.
11. voormanDashboard.getVoormanStats vergelijkt urenRegistraties.medewerker (naam-string) met medewerkers._id → de enige bestaande achterstand-signalering geeft foutieve output.
12. Mobile Home-tab toont omzet-/offertestatistieken (getRevenueStats/getStats) aan iedere ingelogde medewerker — gevoelige bedrijfsdata in de veld-rol.
13. Split-brain berichtenopslag: dashboard offerte-bewerken schrijft naar offerte_messages, klantportaal leest alleen chat_threads — bedrijfsberichten onzichtbaar voor de klant.
14. producten.bulkImport insert zonder ontdubbeling of €0-prijsvalidatie — het HERO-'Voorrijkosten'/Infinity%-risico dat §2.5c wil voorkomen; HERO-import (492 artikelen) niet via deze mutation zonder validatielaag.

### Middel (architectuur / migratie)

15. Autorisatie is de facto binair (requireNotViewer 240×, requirePermission 1×) — medewerker kan via API facturen genereren, klanten muteren, instellingen wijzigen.
16. projecten.offerteId is verplicht — losse werkitems/beurten zonder offerte zijn schema-technisch onmogelijk; raakt alle 26 functies in projecten.ts en vele indexes.
17. Twee concurrerende pipeline-modellen (configuratorAanvragen.pipelineStatus én klanten.pipelineStatus met eigen 'lead'-stadium) — bron van verwarrende tellers en migratierisico.
18. Planning zit in drie losse tabellen (weekPlanning, planningTaken, voorcalculaties) i.p.v. op het item — consolidatie is een datamigratie, geen veldje erbij; weekPlanning mist team/tijd/duur/volgorde.
19. Teams zijn statisch (leden-array); bemanning-per-dag vereist een nieuw per-dag-model, anders kloppen uren-per-persoon en individuele afwezigheid niet.
20. Afwezigheid loopt via urenRegistraties.uurtype (naam-matching, foutgevoelig) i.p.v. verlofaanvragen — twee bronnen van waarheid bij het bouwen van afwezigheidsblokken.
21. contractFacturen suggereert werkende facturatie maar is een doodlopend spoor (status nooit voorbij 'gepland', factuurId nooit gezet); het termijnschema-model botst conceptueel met PRD-facturatiemodus 'per bezoek'/'maandverzamel' — migratiepad nodig, kans op dubbel model.
22. betalingen (Mollie) suggereert werkende betaalflow maar heeft geen webhook-route en geen factuurkoppeling — niet op voortbouwen zonder herontwerp.
23. Boekhoudkoppeling-UI wekt indruk van werkende sync; markForSync laat facturen eeuwig op 'pending' staan.
24. Factuurstatus splitsen (document/betaal) raakt facturen-page, portaal, export, getStats, dashboard en 1986 unit tests; de cron-mutatie verzonden→vervallen moet bij migratie ontrafeld.
25. Statuswijziging servicemeldingen (ingepland → wacht_op_derden/opgelost) raakt indexes by_status/by_user_status — datamigratie nodig; eigenaar/@tag vergen een medewerker-identiteitslaag bovenop het userId-tenant-model.
26. Alles is user-scoped (facturen, producten, instellingen, normuren, contracten): PRD gaat uit van bedrijfsbrede kantoortaken, planbord, wachtrij en gedeelde catalogus — scoping-keuze (org-laag) nodig.
27. cancelContract laat geplande termijnen op 'gepland' staan — bij bouwen van de facturatie-engine kunnen opgezegde contracten spookfacturen opleveren.
28. seizoen als enum (4 waarden) is te grof voor PRD-seizoensvensters en 'venster opent over 14 dagen'-attenderingen — schemawijziging contractWerkzaamheden.
29. markGewonnen matcht bestaande klant via ongeïndexeerd .filter() op exact e-mail (case-mismatch mogelijk) en maakt geen werkitem/offerte aan; lead-record blijft naast klantrecord bestaan.
30. klanten.userId verplicht maar configuratorAanvragen heeft geen userId — inconsistente tenancy bemoeilijkt samenvoegen leads/klanten.
31. Vrije notitievelden (klanten.notities, configuratorAanvragen.notities) botsen met PRD-regel 'geen vrij notitieveld, alles via tijdlijn' — migratie nodig.
32. urenRegistraties.medewerker is vrije naam-string (medewerkerId optioneel, mobiel zet alleen clerkId); bron kent alleen import|handmatig — koppeling en herkomst fragiel voor loonexport/audit; update/remove zonder audit-log terwijl PRD heropenen-met-audit eist.
33. meerwerk-tabel is een leeg omhulsel; facturen.factuurType 'meerwerk' en facturen.meerwerkId verwijzen naar een tabel die nooit gevuld kan worden.
34. Calculatielogica gedupliceerd: client (offerte-calculator.ts) én server (berekeningen.ts) met hardcoded prijzen — 'catalogus is data' botst met deze constanten; bouwstenen als aparte laag toevoegen, niet refactoren.
35. instellingen.uurtarief zonder ingangsdatum-historie: tariefwijziging verandert met terugwerkende kracht oude offertes bij 'herbereken' (recalculate-dialog bestaat).
36. Geen relatie producten↔leveranciers (vrije string) en producten↔offerte-regels (geen productId): gebruiksteller en 'artikel vult regel' vereisen eerst productId op de regel; bestaande offertes hebben die niet.
37. Acceptatie-keten ontbreekt: updateStatus laat 'geaccepteerd' toe zonder contract/project/werkitem; harde validatie moet ook de portaal-acceptatie (publicOffertes/customerResponse) dekken.
38. Pakketten zijn frontend-constanten; acceptatietest 7 ('nieuwe bouwsteen zonder deploy') faalt zonder data-gedreven pakketten.
39. Reistijd vereist eerst geocoding (werklocaties.coordinates optioneel/ongevuld, geen geocoding-code) + Google Maps API-key/billing.
40. Naamconflict: bestaande routes-tabel is GPS-tracking; een planbord-'route' als entiteit noemen veroorzaakt verwarring — PRD zegt bewust dat route geen entiteit is.
41. Wachtrij/beurtengenerator-afhankelijkheidsketen: 2.2-wachtrij veronderstelt beurten uit 2.1, die het 1.1-werkitem veronderstellen — volgorde bewaken.
42. Klanttijdlijn-logging (2.4, 2.8) kan niet zolang er geen tijdlijn-tabel bestaat (2.3) — modulevolgorde.
43. chatMigration.ts wordt nergens aangeroepen — migratiestatus onbekend; oude chat-tabellen blijven live (mobile zit volledig op legacy chat.ts); offerteMessages.listByToken/sendFromCustomer zijn dode code.
44. chatThreads.sendMessage triggert automatisch een Resend-mail bij elk bedrijfsbericht — bij ombouw naar tijdlijn met auto-events kan dit mailstormen veroorzaken.
45. garanties.checkAndExpire is handmatig (geen cron): verlopen-status kan stil achterlopen en beïnvloedt auto-garantiedetectie bij nieuwe meldingen.
46. isGarantie/kosten-logica (garantie ⇒ kosten 0) staat niet in PRD 2.4 — bij herontwerp bewust behouden of expliciet schrappen.

### Laag (hygiëne / schaal)

47. generateContractNummer doet collect() over alle contracten van de user — race-gevoelig bij gelijktijdige creates, schaalt slecht; verifieer productiedata vóór schemamigratie.
48. Servicemeldingen-bord filtert client-side na .collect() op alle meldingen — schaalt matig bij groeiend case-volume.
49. Rate limiting in security.ts is in-memory per Convex-instance — beperkte bescherming tegen token-bruteforce op shareToken.
50. Weekplanner toont alleen ma–vr en gebruikt toISOString (UTC) voor datumstrings — mogelijk off-by-one rond middernacht/zomertijd.
51. assignVoertuig/getConflicten/getBeschikbaar hebben geen UI-consumer — af-ogende functionaliteit is onzichtbaar voor de planner.
52. offerteReminders.ts (700 regels incl. Resend-mailer) is orphaned — dode code die bij activering direct kan mailen.
53. Expo push (exp.host) verstuurt naar echte devices; dev-chatberichten kunnen echte pushes triggeren als productie-tokens in de dev-DB staan.
54. .env.local.example sterk verouderd (mist RESEND_*, MOLLIE_*, CALENDLY_*, FLEETGO_*, WEBSITE_WEBHOOK_SECRET, ALLOWED_ORIGIN, SITE_URL) — onboarding/nieuwe omgeving faalt stil.
55. Sentry DSN hardcoded in sentry.client.config.ts — dev-events vervuilen het productie-Sentry-project.
56. E2E (Playwright) vereist draaiende dev + Convex met echte Clerk-user; specs kunnen via scheduler.runAfter echte mails triggeren tijdens testruns.
57. emailLogs.updateFromWebhook is een publieke mutation zonder signature-check (svix-verificatie zit alleen in de Next-route; de Convex-functie is direct aanroepbaar).
58. PRD-rol 'kantoor' bestaat niet als één begrip; onderscheid directie vs projectleider afstemmen.
59. fotoStorage.getUrl/getUrls zonder auth: wie een storageId kent krijgt een download-URL (projectfoto's, documenten).
