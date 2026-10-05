# Hub: urenbron- en exportcontracten

Implementatiewave 12 september 2026. Actuele scope: eigen OS-medewerkers, klanten, projecten en planning; HERO en bronappimport uitgesloten op gebruikersverzoek. Deze agent heeft geen deployment of gegevensmigratie uitgevoerd.

## Eén projectbron

`convex/lib/projectUrenBron.ts` kiest `projecten.urenBron` (`legacy` of `segmenten`). Zonder keuze wordt alleen automatisch gekozen als hoogstens één bron feitelijke uren heeft. Twee gevulde bronnen zonder keuze leveren een conflict; uren worden nooit samengevoegd. Segmentkosten sluiten pauze en concept uit, maar tellen expliciet aan het project gekoppelde arbeid/reis/laden/loods/BES mee. De datum blijft de uitvoeringsdatum. Organisatie wordt op beide bronnen gecontroleerd; historische registraties zonder orgId worden via hun eigen project afgebakend. Medewerker-id gaat vóór de historische naamkoppeling.

De selector `urenRapportage.getProjectUrenBron`/`setProjectUrenBron` vereist kantoor. Wijzigingen bewaren actor en tijdstip. `getProjectUrenConflicten` + `ProjectUrenConflicten` tonen alle onopgeloste projecten onafhankelijk van andere rapportagequeries, ook historische projecten. De project-nacalculatie blijft bij een conflict laadbaar en biedt de selector aan.

## Gecontroleerde consumenten

| Bestand / consument | Gegevensbron na wijziging | Gedrag bij onopgeloste keuze |
|---|---|---|
| `nacalculaties.calculate` | Geselecteerde projectminuten/dagen/scopes | `error` met uitleg, `data: null` |
| `nacalculaties.getWithDetails` + `use-nacalculatie` + clientexport | Dezelfde geselecteerde registraties, resolved medewerkernamen | `urenBronConflict: true`, geen clientberekening |
| `nacalculaties.save` | Controleert bron opnieuw binnen transactie | Weigert conflict en inmiddels gewijzigde uren/dagen |
| `mobile.getProjectDetailsForMedewerker` | Alleen geselecteerde bron, eigen medewerker-id/legacy fallback | `totaalUren: null`, expliciete `urenBronConflict` |
| `projectKosten` list/detail/scope/samenvatting/periode/budget/threshold | Geselecteerde minuten; individuele medewerker-id voor arbeidskostentarief | Gestructureerde `URENBRON_CONFLICT`; geen financiële actie op onbekend totaal |
| `projecten.updateStatus` afronden | Geselecteerde daadwerkelijke uren | Blokkeert bij conflict; segmenten voldoen ook aan urenvoorwaarde |
| `projecten.getWithDetails` | Geselecteerde uren/count | Null plus conflictvlag, dossier blijft laadbaar |
| `projecten` actieve-projectsamenvatting | Geselecteerde minuten | Null voortgang/totaal plus conflictvlag |
| `dashboard.getAdminDashboardData` | Maanduren uit eigen projecten volgens bron; actieve projecten idem | Maanduren null + lijst conflicten; rest dashboard blijft beschikbaar |
| `offertes` dashboard/projectvoortgang | Geselecteerde minuten | Null voortgang/totaal plus conflictvlag |
| `projectRapportages` voortgang en tijdlijn | Geselecteerde registraties | Gestructureerd conflict; geen onvolledige grafiek |
| `medewerkers.getWithStats` en productiviteit | Eigen projecten volgens bron, medewerker-id primair | Gestructureerd conflict; geen onvolledig medewerkergetal |
| `teams` twee analyticsqueries | Eigen projecten volgens bron | Gestructureerd conflict; geen onvolledig teamgetal |
| `voormanDashboard.getVoormanStats` | Geselecteerde bron per project | Affected aanwezigheid null, bronkeuzelijst; geen onterechte rode ontbreektmelding |
| `beurtNacalculatie` | Respecteert selectie vóór normanalyse van segmentcategorieën | Conflict blokkeert; gekozen legacy met uren geeft `URENBRON_CATEGORIEEN_ONTBREKEN`, omdat activiteitstypen ontbreken. Er worden geen werk/reis/BES-categorieën verzonnen. |
| `urenRapportage.getPeriode` + nieuwe Hub exports | Expliciet nieuwe dagsegmenten, alle opgeslagen statussen; geen projectledgeroptelling | Deze eigen bron blijft beschikbaar om bronconflicten op te lossen |
| `urenRegistraties` CRUD / `export.ts` historische CSV | Expliciet historische registratiebron behouden | Geen stille migratie of automatische kopie |
| `export.exportProjecten` / `export.exportMedewerkers` | Geselecteerde projecturenbron, medewerker-id primair; offerte-loze klus gebruikt eigen klantkoppeling | Gestructureerd bronconflict; geen afwijkende algemene project-/medewerkertotalen in CSV |
| Archief/hard-delete/backfill/seed/admin cleanup | Originele opslagtabellen behouden | Geen rapportage-adapter toepassen op mutaties die oorspronkelijke documenten beheren |

Voor bestaande arrayrapporten die geen onbekend totaal kunnen uitdrukken wordt bewust een gestructureerde fout teruggegeven in plaats van nul of een gedeeltelijke som. De dashboard-errorboundary toont een herstelactie naar `/projecten/[id]/nacalculatie`, met `/uren` als veilige fallback. De primaire dashboard- en projectdetailqueries blijven laadbaar met nullwaarden. De UI toont “Urenbron kiezen” en geen schijnbare 0% of ontbrekende registratie.

Segmenten hebben nog geen legacy-scopekoppeling. Hun projectkosten tellen volledig mee; zonder expliciete scope wordt geen scope verzonnen. De kostentabel gebruikt hiervoor algemeen. Gecategoriseerde onderhoudsnormen gebruiken alleen bewezen werken/reis/BES-categorieën.

## Excel-sjablonen

Assets: `public/templates/hub/{salaris,facturatie,jaarrapportage}.xlsx`, overgenomen uit de openbare bronrepository commit `cf6e158b203c7a5fd5714ad8b264a6ad3bbb367d`. Geen ingevulde privé-exports/backupbestanden.

`src/lib/hub-export.ts` vult uitsluitend de aangewezen invoercellen. De ZIP wordt via JSZip geopend; andere onderdelen worden ongewijzigd behouden. Formulecellen kunnen niet worden overschreven. De sparse jaargegevens groeien in één doorgang, met overgenomen datum/tijd/getalopmaak. Exceltekst wordt inlineString en XML-geëscapet, ook als deze met `=` begint.

- Salaris: persoon-dagspan minus pauze; reisuren apart zichtbaar maar al inbegrepen. Geen klantfilter toegestaan. Maximaal 25 medewerkers. Afwezigheids-/tariefinvoer en formules blijven intact.
- Facturatie: alle segmentsoorten in Registraties; alleen werken per klant-dag in Werkregels. Privénotities worden niet meegenomen. H blijft leeg voor templateberekening; bij pauzedoorbelasting bevat H uren.minuten. Pauzeverdeling gebeurt vóór klantfilter, per volledige medewerkerdag, met behoud van hele minuten. Limits 3000 registraties, 600 klant-dagen, 150 factuurklanten.
- Gedeelde afronding komt eenmaal per bezoek in de klant-dagregel. Afvoerbedragen komen uitsluitend uit `werkbezoekAfvoer`, gededupliceerd op record-id, met revisie in de kostenverwijzing. Onbeslist bedrag blokkeert factuurexport met uitleg. `aanhangerRetouren` wordt nergens als kosteningang gebruikt. Er is geen ongeverifieerd standaardtarief.
- Jaarrapportage: heel gekozen jaar, maximaal 25.000 regels, 150 klanten en 25 medewerkers. Uren per regel blijven exact `minuten / 60`; geen cumulatief afrondverlies. Matrixnamen worden expliciet gevuld.
- Sjabloonformules gebruiken namen; twee verschillende klant- of medewerker-id’s met dezelfde exportnaam worden daarom expliciet geweigerd in facturatie/jaar in plaats van stil samengevoegd.
- Bestaande historische CSV-functies blijven beschikbaar naast deze sjabloonexport.
- F43: inhoudskeuze Alles / Alleen werk / Werk + pauze in dezelfde dialoog. De laatste keuze belast klantgekoppelde pauzes direct door en overige pauzes naar rato; verdeling gebeurt op de volledige medewerkerdag vóór inhoud- en klantfilter. Werk + pauze houdt pauzeregels ook bij klantselectie zichtbaar. Salaris en jaar gebruiken deze facturatiekeuze niet. Alle drie modi zijn tegen het echte facturatiesjabloon gecontroleerd op behoud van formules en overige ZIP-onderdelen.

## Dagtransacties en offline

`slaDagvoorstelOp` bewaart alle gewijzigde blokken en een ontvangstbewijs atomair, met inhoudsgebonden sleutel, verwachte dagrevisie en slotcontrole. `bevestigSegment` en `updateSegment` ondersteunen ook optionele stabiele `sleutel`; dan is `verwachteRevisie` verplicht. Exacte replay retourneert het oorspronkelijke id vóór revisie-/slotcontrole, maar na actor/organisatie/medewerkertoegang. Andere inhoud onder dezelfde sleutel wordt geweigerd. Geen dubbele uren, revisies of auditregels bij retries.

Notitie-only edits op een ingediende eigen dag hebben afzonderlijk audit-event `notitie_gewijzigd`; materiële correcties maken kantoorakkoord ongeldig. Wijziging van klantId controleert de organisatie. Dagindiening roept `werkbezoek.assertDagGereed` aan vóór writes. De backend beheert daar gedeelde afronding/foto/afvoer, trailerretour en persoonlijke delegaties.

## Uitgevoerde verificatie

- Unit/integratie: echte drie sjablonen gevuld; iedere bestaande formule en ieder ongemoeid ZIP-onderdeel gelijk gebleven; 1000-regelige groei met oorspronkelijke formats; salarisgaten, pauze vóór klantfilter, factuurkosten eenmaal, onbesliste kosten blokkeren, capaciteiten en formule-injectieveilige tekst.
- Backend: receipt replay na indienen, sleutelhergebruik, verouderde revisie, volledige batchvalidatie vóór eerste write, slot, note-only audit, org/medewerkergrenzen, accountloze krachten, projectbronconflict/keuze en medewerker-id-tarief.
- Regressies: dashboard/rapportage-organisatiegrenzen, medewerkers-instellingen, projectkosten-notities, projectstatus, onderhoudsnacalculatie, kostenberekeningen en dashboardhook.
- Testresultaten en type-/lintuitvoer staan in `/private/tmp/ledger-consumers-tests.txt`, `/private/tmp/ledger-consumers-tsc.txt`, `/private/tmp/ledger-consumers-lint.txt`; finale totaalaantallen worden na de laatste aanpassing aan de hoofdtaak gemeld.

## Aanvullende pariteit: materiaal, eigen export en planningshistorie

| Flow | Concrete implementatie / controle | Begrenzing |
|---|---|---|
| F12 / F50 materiaalsuggesties | `convex/lib/materiaalSuggesties.ts` bevat de 33 publieke bronregels uit `20260620000013_native_planning.sql:411–464`. Hoofdletterongevoelige substringmatch, stabiele naamdeduplicatie en organisatie-overrides; uitschakelen onderdrukt ook een standaardregel. | Een suggestie is optioneel totdat iemand deze accepteert. Geen voorraad- of kostenboeking. |
| F12 handmatige benodigdheden | `materiaalDelta.voegBenodigdheidToe` bewaart handmatige en geaccepteerde suggesties apart van de afgeleide receptregels. Omschrijvingswijzigingen verwijderen deze niet. Herhaalde acceptatie geeft hetzelfde actieve item. | Kantoor kan een benodigdheid archiveren; bestaande afvinkhistorie blijft bestaan. |
| F50 laden en afvinken | De bestaande web-routechecklist toont suggesties en handmatige invoer naast de materiaaldelta; native sluit dezelfde API aan. Busuitrusting wordt afgetrokken. | Medewerker moet op die datum zijn toegewezen of eigen daadwerkelijk werk op het werkitem hebben; contractwerkzaamheden worden via hun oudercontract op organisatie gecontroleerd. |
| F12 beheer regels | `materiaal-regels-paneel.tsx` binnen bestaande dagkaartinstellingen, met nieuwe regel en aan/uit. `getSuggestieRegels` / `bewaarSuggestieRegel` zijn kantoor-only. | Historische afvinkvinkjes blijven afzonderlijke gegevens. |
| F51 persoonlijke CSV/XLSX | `eigen-uren-export.tsx` binnen Mijn week; bestaande exportdropdown voor eigen registraties en eigen dagtotalen. De server leest met medewerker-datumindex. | Geen volledige personeelsdataset naar de browser; geen andere medewerkers. De zes minutenbegrippen komen uit dezelfde rapportagehelper. |
| F41–F45 schaalbare periode-export | `HubExportDialog` leest pas bij export maandvensters via `useConvex.query`, voegt segmenten en gedeelde bezoek-/afvoermetadata op id samen. Keuzelijsten komen uit onafhankelijk kantoor-endpoint `getExportKeuzes`. | `getPeriode` weigert organisatiebereik boven 31 dagen. De Excel-capaciteiten blijven expliciete fouten, geen stille afkapping. |
| F09 historie bij verwijderen | `werkitemHistorie` detecteert uren, machinegebruik, bezoekafronding/foto/afvoer en materiaalchecks. Gewoon verwijderen wordt archiveren; hard-delete blokkeert. Ook verlopen soft-delete cleanup archiveert zulke dossiers. | Lege planning zonder uitvoeringshistorie blijft verwijderbaar. Archiveren herschrijft oorspronkelijke uitvoeringsdatum niet. |
| F10 verplaatsen en mislukking | Bestaande weekbord/dagkaart awaiten de mutatie en tonen fouten; er is geen optimistische lokale wijziging die na fout blijft hangen. `werkitems.updatePlanning` valideert samengestelde bestaande + gewijzigde datum/tijdwaarden vóór schrijven. | Alleen einddatum wijzigen kan niet meer vóór een bestaande begindatum uitkomen. Uitgevoerde segmenten/bezoeken worden niet meeverplaatst. |
| F11 ploegbeheer | Bestaande maken/hernoemen/activeren/deactiveren en dagbemanning blijven; kleur is nu doorgegeven door teamformulier, hook en create/update-validatie. Hard-delete weigert teams met project-/bemanningshistorie. | Eigen handmatige bezoektoewijzingen en team/dagfallback blijven; HERO is uitgesloten. |
| F13 klantbeheer | Bestaande CRM archiveren/herstellen blijft. Nieuw `veldKlanten.zoek` toont eigen geplande klanten/klussen eerst en zoekt andere actieve organisatieklanten; minimale projectie zonder privécontactvelden. Native picker aangesloten door mobiele agent. Web heeft dezelfde API via `veld-klus-kiezer.tsx` binnen bestaande segmentdialoog. | Een medewerker heeft een actieve eigen koppeling nodig; werkitemselectie gebruikt dezelfde expliciete bezoektoewijzing en team/dagfallback als de dagkaart. Bij kantoorinvoer op andermans dag blijft de toegewezen dagklussenpicker; de ongeplande veldactie is voor de eigen dag. |
| F13 ongeplande uitvoering | `veldKlanten.maakUitvoeringsklus` maakt voor een bestaande of minimale nieuwe klant een echte klus: ingevulde werkomschrijving, aanleg/onderhoudcategorie, uitvoeringsdag en eigen toewijzing. Daarna loopt registratie via de gewone urenmutatie. | Verplichte actor/orggebonden inhoudssleutel in `veldKlantOpdrachten` voorkomt dubbele klant/klus bij replay. Datum, daglock, archivering en organisatie worden vóór schrijven gecontroleerd. Geen dummy-offerte, factuur, mail of automatische uren. |

Werksoort is afzonderlijk op het segment bewaard. Geplande aanleg/onderhoud leidt tot `Tuinaanleg`/`Tuinonderhoud`; `anders` kent de zes bronkeuzes `Winkel`, `Loods opruimen`, `Vergadering`, `Administratie`, `Bezichtiging`, `Inspectie`. Nieuwe invoer accepteert geen vrije verzonnen waarden. Een tijdcorrectie houdt de bestaande werksoort aan, ook na latere wijziging van planningcategorie. De projectnaam wordt niet gebruikt als vervangend activiteitstype. Bestaande geïmporteerde historische strings blijven bewaard.

Aanvullende verificatie: 5 suites / 103 tests geslaagd (`/private/tmp/materiaal-wave-tests.txt`), inclusief de bestaande materiaaldelta-routechecks, echte exportsjablonen, 12 maandvensters die een schrikkeljaar volledig afdekken, manuele materiaalhistorie, autorisatie, werksoort, gedeeltelijke datumupdate en archiefbescherming. Root-typecheck schoon (`/private/tmp/materiaal-wave-tsc.txt`). De eerdere bredere urenbronregressie telde 12 suites / 307 tests; deze aantallen zijn overlappend en worden niet opgeteld.

F13-verificatie: 3 suites / 539 tests geslaagd (`/private/tmp/f13-tests.txt`), waaronder zes nieuwe integratiescenario's voor replay na dagindiening, gewijzigde payload, echte vervolg-urenregistratie, tenant-/archief-/rol-/actiefgrenzen, ongeldige kalenderdag en geplande-first selectie met expliciet lege bezoektoewijzing. Inclusief orgtabelclassificatie en migratieregressies. Typecheck en gerichte ESLint schoon (`/private/tmp/f13-final-tsc.txt`, `/private/tmp/f13-final-lint.txt`). Webcategorieën bevatten nu ook laden/loods en de zes specifieke anders-werksoorten.

## Onafhankelijke integratiereview en laatste correcties

De F01–F51-matrix is opnieuw vergeleken met de aangesloten code. Drie concrete afwijkingen zijn in deze review gesloten: de F43-inhoudskeuze ontbrak nog, de algemene project-/medewerker-CSV las nog alleen legacy, en segmentarbeid in het kostenoverzicht bood een niet-passende legacy-verwijderactie. Deze laatste regel verwijst nu naar de normale urencorrectie, zodat audit en dagslot behouden blijven. Historische `exportUren` blijft nadrukkelijk een export van de oorspronkelijke registratiebron.

Voor F22-crashherstel is `urenSegmenten.getEigenOpdracht({sleutel,actie?})` toegevoegd, met `toevoegen` als standaard en `wijzigen` als tweede namespace. Alleen de nog actieve gekoppelde medewerker kan het eigen actor-/organisatiereceipt lezen. Dit helpt de native app een al verwerkte conceptinvoer herkennen; er is geen algemene inzage in ontvangsten of andermans uren.

Conceptstatusbeleid is expliciet verschillend per toepassing: nieuwe veldrapportage/salaris/facturatie/jaar volgen de bron en nemen alle opgeslagen registraties mee, ook niet ingediende dagen. De dialoog vermeldt dat. Projectnacalculatie verwerkt feitelijke projectarbeid en sluit concept en pauze uit. Dit zijn afzonderlijke betekenissen; geen verborgen statustransformatie of dubbel grootboektotaal.

Laatste gerichte bewijs: 3 suites / 112 tests geslaagd in `/private/tmp/hub-review-tests.txt`, waaronder echte Excel-bestanden voor alle inhoudkeuzes, directe en naar-rato pauzeverdeling vóór klantfilter, afvoerfilter, onveranderde salarisberekening en beide CSV-consumenten met gemengde bron. Ontvangstherstel create/update is ook in `/private/tmp/hub-receipt-tests.txt` gecontroleerd (37 tests van de overlappende integratiesuite). Type-/lintbewijs: `/private/tmp/hub-review-tsc.txt`, `/private/tmp/hub-review-lint.txt`.

De twee aanvullende UI-gaten zijn inmiddels aangesloten: F36 via `veld-registratie-lijst.tsx` met vrije perioden, filters, actorinzage en maandvensters; F09 via `KlusInstructie`/`wijzigKlusInstructie` met naam, categorie, instructie, klant en uitvoerlocatie, concurrentiecontrole en relatie-/historiebescherming. Eigen klanttijdlijnnotities blijven de bestaande equivalent voor losse kantoornotities. De finale per-ID-status staat in de [F01–F51-eindmatrix](2026-09-12-hub-eindstatus-f01-f51.md).

Externe inrichting en acceptatie zijn afzonderlijk: Clerk-identiteitsmethoden en koppelingen van onze eigen medewerkers, werkelijke afvoertarieven, organisatieprotocollen/noodcontacten, reminderontvangers/tijden, platformdistributie en echte toestelacceptatie voor offline herstart/foto's/accountwissel. Bron-API's of configuratievelden aanwezig betekent niet dat die externe diensten al zijn ingericht of succesvol in productie beproefd. De hoofdtaak beheert totaal-suite- en runtimebewijs; deze review claimt geen productieacceptatie.

## Scopewijziging: afronden zonder externe import

Op expliciet gebruikersverzoek zijn F14/F15 vervallen. Verwijderd: `heroImport.ts`, `heroLogica.ts`, `hubHistorie.ts`, `hubHistorieLogica.ts`, beide bijbehorende testsuites, de HERO-instellingenpagina/link en sync-cron. Generated API verwijzingen zijn verwijderd. Geen bestaande klanten, medewerkers, projecten, uren of opslagbestanden zijn gewijzigd. De eigen projecturenbronkeuze en historie-/archiefbescherming blijven actief.

De vijf importtabellen (`heroImportRijen`, `heroImportRuns`, `heroKoppelingen`, `hubHistorieBronnen`, `hubHistorieRuns`) zijn op 5 oktober 2026 uit het schema verwijderd. Ze bestonden alleen op de dev-deployment, waren daar aantoonbaar leeg (`npx convex data`) en hebben nooit op productie gestaan.

Historische bronimport is geen test-, configuratie- of rolloutvoorwaarde meer. Het back-uprunbook beschrijft alleen behoud en herstel van onze eigen Convex/Storage-gegevens. Historische HERO-vergelijkingen in bestaande andere domeindocumenten en de UI-componentnaam HeroProjectCard zijn geen connector en blijven ongemoeid.

Verificatie na verwijderen: 4 relevante suites / 557 tests geslaagd (`/private/tmp/no-hero-tests.txt`): orgclassificatie, historische organisatieconversie, eigen urenintegratie en Excel. Root-TypeScript, gerichte ESLint en diffcontrole schoon (`/private/tmp/no-hero-tsc.txt`, `/private/tmp/no-hero-lint.txt`). Zoekcontrole vindt geen actieve `api.heroImport`, `internal.heroImport`, `api.hubHistorie` of `/instellingen/hero` meer. Retired opslag is nog aanwezig zonder eindgebruikersfunctie; code-sync hoeft daarvoor geen bestaande gegevens te wijzigen.


## Finale exportselectie

F41/F42/F44 ondersteunen nu willekeurige sets van medewerkers en, buiten salaris, klanten. Zoekvelden wijzigen de selectie niet; alles en expliciet leeg zijn verschillende toestanden. De generator behandelt medewerkersselectie vóór dagberekening; klantselectie pas ná pauzetoerekening over alle klanten van de geselecteerde medewerkers. Salaris weigert zowel enkelvoudige als meervoudige klantfilters. Maandvensters, inhoudkeuzes, afvoerbedragen en capaciteitsgrenzen blijven hetzelfde. Dezelfde 22 exporttests controleren alle drie echte sjablonen met subsets en formule-/ZIP-behoud (`/private/tmp/hub-export-multiselect-tests.txt`).

De vijf importtabellen (`heroImportRijen`, `heroImportRuns`, `heroKoppelingen`, `hubHistorieBronnen`, `hubHistorieRuns`) zijn op 5 oktober 2026 uit het schema verwijderd. Ze bestonden alleen op de dev-deployment, waren daar aantoonbaar leeg (`npx convex data`) en hebben nooit op productie gestaan.
