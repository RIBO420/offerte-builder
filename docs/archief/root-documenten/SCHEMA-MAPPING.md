# SCHEMA-MAPPING — PRD §7.4: veld-mapping voor PRD v1.1

**Doel:** per PRD-entiteit (fase 0/1) de voorgestelde PRD-velden mappen op het bestaande Convex-schema (`offerte-builder/convex/schema.ts`, 2708 regels, geverifieerd 2026-07-10).

**Leidend principe:** PRD-veldnamen zijn *voorstellen*. Waar een bestaand veld semantisch equivalent is, wint de bestaande naam (actie = **hergebruik**). Acties:

- **hergebruik** — bestaand veld dekt de PRD-eis; PRD v1.1 neemt de bestaande naam over
- **hernoem** — bestaand veld dekt de eis maar de naam is misleidend/conflicteert; migratie nodig
- **uitbreiden** — bestaand veld/tabel bestaat maar moet worden verruimd (extra literals, optioneel↔verplicht, extra veld op bestaande tabel)
- **nieuw** — geen equivalent; nieuw veld of nieuwe tabel

Regelnummers verwijzen naar `convex/schema.ts`.

---

## 1. Werkitem (PRD fase 0, §1.1)

Er is **geen** werkitem-entiteit. Het dichtstbijzijnde record is `projecten` (r521). Kernblokkade: `projecten.offerteId` is **verplicht** (`v.id("offertes")`, r523) — een werkitem zonder offerte (losse beurt, servicebezoek) kan schema-technisch niet bestaan. Advies: `projecten` generaliseren tot werkitem, niet een parallelle tabel ernaast zetten.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| `type` (project / onderhoudsbeurt / losse_beurt / servicebezoek) | ontbreekt — `projecten` heeft geen type-veld | **nieuw** veld `type` op `projecten` (default `"project"` voor bestaande records) |
| `klant_id` | `projecten.klantId` (r524, `v.optional(v.id("klanten"))`) | **uitbreiden**: verplicht maken (datamigratie: records zonder klantId vullen via offerte) |
| `titel` | `projecten.naam` (r525) | **hergebruik** — PRD v1.1 gebruikt `naam` |
| `status` | `projecten.status` (r526–533: voorcalculatie/gepland/in_uitvoering/afgerond/nacalculatie_compleet/gefactureerd) | **uitbreiden**: beurt-statussen toevoegen (`vervallen`; `gepland/afgerond/gefactureerd` bestaan al); indexes `by_status`/`by_user_status` blijven werken |
| `geplande_start` / `geplande_eind` | ontbreekt op `projecten`; planning zit in `weekPlanning.datum` (r611, per medewerker×dag) | **nieuw** op werkitem; `weekPlanning` blijft de dag-toewijzing |
| `team_id` | ontbreekt; wel `teams`-tabel (r1110) en `projecten.toegewezenMedewerkerIds` (r535) | **nieuw** veld `teamId: v.optional(v.id("teams"))`; `teams` **hergebruik** |
| `geschatte_uren` | `voorcalculaties.normUrenTotaal` (r578); `contractWerkzaamheden.geschatteUrenPerBeurt` (r2363) | **uitbreiden**: veld `geschatteUren` op werkitem; voor beurten gevuld vanuit `geschatteUrenPerBeurt`, voor projecten vanuit voorcalculatie |
| `offerte_id` (nullable) | `projecten.offerteId` (r523, **verplicht**) | **uitbreiden**: `v.optional()` maken — de kernmigratie van fase 0 |
| `factuur_id` | ontbreekt; omgekeerde relatie `facturen.projectId` (r848) + index `by_project` (r958) | **hergebruik** omgekeerde relatie; geen veld op werkitem nodig |
| `contract_id` | ontbreekt op `projecten` | **nieuw**: `contractId: v.optional(v.id("onderhoudscontracten"))` + index |
| `adres` (default = klantadres) | ontbreekt; wel `onderhoudscontracten.locatie` (r2283, object adres/postcode/plaats) en `werklocaties` (r1528) | **nieuw** op werkitem, zelfde object-vorm als `onderhoudscontracten.locatie` |
| `ontgraven_volume_m3`, `mba_status`, `dso_referentie` | ontbreekt; alleen `projecten.klicMeldingGedaan` (r548) | **nieuw** (grondverzet-blok); `klicMeldingGedaan` **hergebruik** |
| geen vrij notitieveld (alles via tijdlijn) | `klanten.notities` (r64), `configuratorAanvragen.notities` (r2080), `projecten` heeft er geen | **hernoem/migreren**: notities → tijdlijn-entries (zie §6), daarna velden deprecaten |

**Leads/klanten (§1.3):** `configuratorAanvragen` (r2001) fungeert als leads-tabel naast `klanten` (r56) — twee tabellen bestaan al: **hergebruik**. `configuratorAanvragen.pipelineStatus` (r2085: nieuw/contact_gehad/offerte_verstuurd/gewonnen/verloren) is de lead-funnel; **conflict**: `klanten.pipelineStatus` (r66) bevat óók een `"lead"`-stadium — dit stadium **hernoemen/verwijderen** zodat er één lead-model overblijft. Promotie `markGewonnen` (configuratorAanvragen.ts:625) **hergebruik**, **uitbreiden** met aanmaak van eerste werkitem/offerte. Let op: `klanten.userId` verplicht (r57) vs `configuratorAanvragen` zonder userId — tenancy gelijktrekken bij migratie.

---

## 2. Contract + facturatiemodus (PRD §2.1)

Basis-contractadministratie bestaat en is degelijk: **hergebruik `onderhoudscontracten`** (r2274).

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| `klant_id` | `onderhoudscontracten.klantId` (r2276, verplicht) | **hergebruik** |
| `looptijd_start` / `looptijd_eind` | `startDatum` / `eindDatum` (r2291–2292, YYYY-MM-DD) | **hergebruik** |
| `opzegtermijn` | `opzegtermijnDagen` (r2293) | **hergebruik** |
| `prijs` | `tariefPerTermijn` (r2296) + `jaarlijksTarief` (r2303) | **hergebruik** |
| `indexatie_clausule` | `indexatiePercentage` (r2306) + `laatsteIndexatieDatum` (r2307) — velden bestaan, logica niet | **hergebruik** velden, indexatie-berekening **nieuw** |
| `status` | `status` (r2310: concept/actief/verlopen/opgezegd) | **hergebruik** |
| `auto_verlenging` | `autoVerlenging` (r2318) + `verlengingsPeriodeInMaanden` (r2319) | **hergebruik** |
| `facturatiemodus` (per_bezoek / maandverzamel / vast_maandbedrag) | ontbreekt; `betalingsfrequentie` (r2297: maandelijks/per_kwartaal/halfjaarlijks/jaarlijks) is een **ander concept** (termijnritme, feitelijk alleen modus "vast bedrag") | **nieuw** veld `facturatiemodus`; `betalingsfrequentie` behouden als ritme binnen modus vast_maandbedrag — **niet hernoemen**, wel documenteren dat het geen modus is |
| bouwsteen-regels per contract | `contractWerkzaamheden` (r2341: `omschrijving`, `scope` vrije string r2346, `frequentie` r2355, `frequentieEenheid` r2356, `volgorde` r2367) | **hergebruik** tabel, **uitbreiden** met `bouwsteenId` (FK naar nieuwe catalogus, §4) |
| `prijs_per_beurt` per bouwsteen | ontbreekt (`geschatteUrenPerBeurt` r2363 is uren, geen prijs) | **nieuw** veld op `contractWerkzaamheden` |
| seizoensvenster (datumrange) per bouwsteen | `contractWerkzaamheden.seizoen` (r2349: enum voorjaar/zomer/herfst/winter) | **uitbreiden**: `vensterStart`/`vensterEind` (MM-DD) toevoegen; enum behouden voor weergave/migratie |
| termijnschema | `contractFacturen` (r2376: `termijnNummer`, `periodeStart`, `periodeEinde`, `bedrag`, `status` gepland/gefactureerd/betaald, `factuurId` optional r2378) | **hergebruik**; facturatiestap die `factuurId` daadwerkelijk zet is **nieuw** (wordt nu nooit geschreven) |

---

## 3. Beurt (werkitem type `onderhoudsbeurt`, PRD §2.1)

**Bestaat niet.** `contractWerkzaamheden` is een seizoenstemplate (spec), geen plan-/uitvoerbare instantie met datum en status. De beurt wordt een **werkitem** (§1) — geen aparte tabel.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| beurt-record zelf | ontbreekt | **nieuw**: werkitem met `type: "onderhoudsbeurt"` (via gegeneraliseerde `projecten`) |
| `contract_id` | ontbreekt | **nieuw** (zie §1, `contractId`) |
| `contract_werkzaamheid_id` (welke bouwsteen-regel) | ontbreekt | **nieuw**: `contractWerkzaamheidId: v.optional(v.id("contractWerkzaamheden"))` |
| `status` (gepland/uitgevoerd/gefactureerd/vervallen) | `projecten.status` mist `vervallen`; `uitgevoerd` ≈ bestaand `afgerond` | **uitbreiden** status-union; **hergebruik** `afgerond` i.p.v. nieuw literal `uitgevoerd` |
| `geplande_datum` / venster | ontbreekt | **nieuw** (= `geplande_start`/`geplande_eind` uit §1) |
| beurtengenerator (12-mnd horizon, nachtelijke cron) | ontbreekt volledig (`convex/crons.ts` heeft 2 jobs, geen contract-job) | **nieuw** (functie, geen schema; wel doeltabel = werkitem) |
| losse beurt zonder contract | ontbreekt | **nieuw**: werkitem `type: "losse_beurt"`, `contractId` leeg, `offerteId` leeg — vereist de optioneel-maak-migratie uit §1 |

---

## 4. Bouwsteen / catalogus (PRD §2.5f + bijlage A)

**Bestaat niet** — geen tabel, geen seed. Dichtstbijzijnde verwanten: `normuren` (r273: `activiteit`, `scope`, `normuurPerEenheid`, `eenheid`), `producten` (r250) en `contractWerkzaamheden` (r2341).

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| tabel `bouwstenen` | ontbreekt | **nieuw** (23 seed-records uit bijlage A) |
| `naam`, `omschrijving` | patroon: `producten.productnaam` (r252), `normuren.activiteit` (r275) | **nieuw**, naamgeving volgens bestaand patroon (`naam`/`omschrijving`) |
| `prijsmodel` (uurbasis / vaste_prijs, overschrijfbaar) | ontbreekt; calculator heeft hardcoded constanten (src/lib/offerte-calculator.ts) | **nieuw** |
| `default_frequentie`, `seizoensvenster` | `contractWerkzaamheden.frequentie`/`seizoen` als per-contract kopie | **nieuw** op catalogus; contract-regel blijft de overschrijfbare kopie |
| `default_uren_per_beurt` | `contractWerkzaamheden.geschatteUrenPerBeurt` (r2363) als kopie | **nieuw** op catalogus, zelfde veldnaam **hergebruiken** |
| koppeling contract-regel → bouwsteen | ontbreekt (`contractWerkzaamheden.scope` is vrije string, r2346) | **uitbreiden**: `bouwsteenId` op `contractWerkzaamheden` |
| `btw_code` per artikel (9/21) | ontbreekt op `producten`; alleen `instellingen.btwPercentage` (r326, één percentage) en `boekhoudInstellingen.btwMappings` (r2587, sync-only) | **nieuw** veld `btwPercentage` op `producten` én op offerte-/factuurregel (optioneel, backwards-compatibel) |
| `gebruiksteller` per artikel | ontbreekt op `producten`; regels hebben geen `productId` | **nieuw**: `productId` op regel + telveld/telquery |
| `uurtarief` met ingangsdatum | `instellingen.uurtarief` (r301, één getal zonder historie) | **uitbreiden**: historie-array of aparte tabel `uurtariefHistorie` met `ingangsdatum`; `uurtarief` blijft als "huidig" |
| tekstblokkenbibliotheek | dichtstbij: `instellingen.pdfVoorwaarden` (r377) en `emailTemplates` (r2529) | **nieuw** tabel `tekstblokken` (patroon `emailTemplates`) |

---

## 5. Melding / case (PRD §2.4)

**Hergebruik `servicemeldingen`** (r2445) als basis — werkend kanban-bord bestaat. Uitbreiden, niet vervangen.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| `klant_id` (verplicht) | `servicemeldingen.klantId` (r2447, verplicht) | **hergebruik** |
| `werkitem_id` (optioneel) | `servicemeldingen.projectId` (r2448, optioneel) + `garantieId` (r2449) | **hergebruik** `projectId`; betekenis verbreedt automatisch mee zodra `projecten` = werkitem |
| `type` (serviceverzoek / klacht / schade) | ontbreekt; alleen `isGarantie` boolean (r2455) | **nieuw** veld `type` + `verzekeringsVlag` bij schade; `isGarantie` **hergebruik** (orthogonaal: garantie vs betaald) |
| `kanaal` (telefoon/whatsapp/email/portaal/intern) | ontbreekt | **nieuw** |
| `omschrijving` | `servicemeldingen.beschrijving` (r2452) | **hergebruik** — PRD v1.1 gebruikt `beschrijving` |
| `fotos` | `servicemeldingen.fotos` (r2474) | **hergebruik** |
| `eigenaar` (precies één, verplicht) | ontbreekt — `userId` (r2446) is tenant, geen behandelaar | **nieuw**: `eigenaarId: v.id("users")` (of `medewerkers`) + index voor "mijn cases" |
| `aangemaakt_door` | ontbreekt | **nieuw** |
| `deadline` | ontbreekt; wel `prioriteit` (r2466, laag/normaal/hoog/urgent — behouden) | **nieuw** |
| `status` (nieuw / in_behandeling / wacht_op_derden / opgelost) | `status` (r2458: nieuw/in_behandeling/ingepland/afgehandeld) | **uitbreiden**: `wacht_op_derden` toevoegen; `afgehandeld` **hergebruik** i.p.v. `opgelost`; `ingepland` wordt afgeleide van `serviceAfspraken` (datamigratie op `by_status`/`by_user_status`) |
| geplande servicebezoeken | `serviceAfspraken` (r2497: `meldingId`, `datum`, `medewerkerIds`, status gepland/uitgevoerd/geannuleerd) | **hergebruik**; koppeling naar planbord **nieuw** |
| promotie melding → werkitem | ontbreekt | **nieuw**: `werkitemId`-koppeling behouden bij promotie (mutation, geen schemaveld extra nodig naast `projectId`) |
| logging op klanttijdlijn | ontbreekt (geen tijdlijn) | **nieuw**, afhankelijk van §6 |

---

## 6. Tijdlijn-entry (PRD §2.3 + §1.2)

**Bestaat niet.** `chat_threads`/`chat_messages` (r2665/r2692) zijn chat, geen tijdlijn, en mengen bovendien klant- en interne threads via `type`-vlag — precies wat PRD §1.2 verbiedt. Beste sjabloon: `leadActiviteiten` (r2120) — event-log met type/beschrijving/metadata, maar hangt aan leads i.p.v. klanten.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| tabel `klantTijdlijn` (één tijdlijn per klant) | ontbreekt; dichtstbij `leadActiviteiten` (r2120) en `chat_messages` | **nieuw** tabel, patroon `leadActiviteiten` kopiëren met `klantId` i.p.v. `leadId` |
| `klant_id` | `leadActiviteiten.leadId` (r2121) als patroon; `chat_threads.klantId` (r2672) | **nieuw** (`klantId: v.id("klanten")` + index `by_klant, createdAt` zoals `by_lead` r2133) |
| `auteur` + timestamp | `chat_messages.senderName`/`senderUserId`/`createdAt` (r2699–2704); `leadActiviteiten.gebruikerId` (r2130) | **hergebruik** naamgeving (`senderName`/`senderUserId` of `gebruikerId`) |
| `kanaal` (telefoon/whatsapp/email/intern/systeem) | ontbreekt in alle chat-tabellen | **nieuw** |
| `senderType` incl. `systeem` | `chat_messages.senderType` (r2694: bedrijf/klant/medewerker — geen systeem) | **uitbreiden** (of eigen veld op tijdlijn-tabel) |
| `werkitem_id` per entry | alleen thread-niveau: `chat_threads.offerteId`/`projectId` (r2673–2674) | **nieuw** op entry-niveau |
| `melding_id` per entry | ontbreekt | **nieuw** |
| bijlagen | `chat_messages.attachmentStorageIds` (r2702) | **hergebruik** veldnaam |
| auto-events (offerte verzonden, ingepland, factuur, …) | ontbreekt; `notifications` (r1692) is per-user feed, geen klantdossier; `leadActiviteiten.type`+`metadata` (r2122, r2131) is het patroon | **nieuw** (inserts vanuit bestaande mutations) |
| vrij zoeken | geen searchIndex op `chat_messages`; wel op `team_messages` | **nieuw** searchIndex op tijdlijn-tabel |
| migratie `klanten.notities` | `klanten.notities` (r64), `configuratorAanvragen.notities` (r2080) | **hernoem/migreren** naar tijdlijn-entries, velden daarna deprecaten |
| scheiding intern vs klant (§1.2) | `chat_threads.type` (r2666) = één tabel met vlag | **hernoem/herstructureren**: klant-communicatie naar eigen tabel (tijdlijn); `team`/`direct`/`project`-threads blijven intern |

---

## 7. Mail_trigger (PRD fase 0/1: uitgaande mail per gebeurtenis)

Er is geen `mail_triggers`-tabel, wel twee bruikbare bouwstenen: `emailTemplates` (r2529) met een string-veld `trigger` (r2532) en `email_logs` (r408) voor aflevering-tracking.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| `trigger` (gebeurtenis-slug) | `emailTemplates.trigger` (r2532, vrije string: offerte_verzonden, factuur_verzonden, herinnering_1…3, aanmaning_1/2, ingebrekestelling, oplevering, contract_verlenging) + index `by_trigger` (r2541) | **hergebruik**; nieuwe triggers (beurt_inplannen, melding_status, betaling_ontvangen) = literals toevoegen aan documentatie, schema hoeft niet te wijzigen (string) |
| `onderwerp` / `inhoud` / `variabelen` | `emailTemplates.onderwerp` (r2533), `inhoud` (r2534), `variabelen` (r2535) | **hergebruik** |
| `actief` | `emailTemplates.actief` (r2536) | **hergebruik** |
| sjabloon per aanmaningstrede | trigger-strings `herinnering_1..3`/`aanmaning_1..2` bestaan al in conventie | **hergebruik** conventie; koppeling vanuit debiteurenladder **nieuw** (zie §8-risico) |
| verzendlog + status | `email_logs` (r408: `type` r411, `to`, `subject`, `status` r420 incl. delivered/bounced, `resendId` r428, timestamps r433–436) | **hergebruik**; `type`-union **uitbreiden** met nieuwe triggertypes. Let op: `email_logs.offerteId` is **verplicht** (r409) — **uitbreiden** naar optioneel + `factuurId`/`werkitemId` zodat niet-offerte-mails logbaar zijn |
| daadwerkelijke verzending bij cron | ontbreekt: `betalingsherinneringen.emailVerstuurd` (r982) wordt op true gezet zonder mail | **nieuw**: cron koppelen aan Resend-action; veld `emailVerstuurd` **hergebruik** maar pas zetten ná echte verzending |

---

## 8. Factuur — documentstatus / betaalstatus (PRD §2.8 + §3.2)

`facturen` (r847) heeft één statusketen: `status` (r852: concept/definitief/verzonden/betaald/vervallen). PRD eist splitsing document- vs betaalstatus.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| `document_status` (concept → definitief → verzonden) | `facturen.status` (r852) — bevat deze drie literals al | **hernoem/splitsen**: `status` → `documentStatus` (concept/definitief/verzonden) via migratie; indexes `by_status` (r961) en `by_user_status` (r964) migreren mee |
| `betaal_status` (open / gedeeltelijk_betaald / betaald / vervallen / geannuleerd) | ontbreekt; nu `status: "betaald"` + `betaaldAt` (r938); `"vervallen"` wordt door de cron misbruikt als overdue-markering | **nieuw** veld `betaalStatus`; migratie moet `vervallen` ontrafelen (overdue ≠ geannuleerd) |
| `betaald_bedrag` / `openstaand_bedrag` (deelbetalingen) | ontbreekt; `markAsPaid` is alles-of-niets; `betalingen`-tabel (r2136) is Mollie-restant **zonder** `factuurId` | **nieuw**: betalingsregistratie per factuur (nieuw veld `factuurId` op `betalingen` = **uitbreiden**, of nieuwe tabel `factuurBetalingen`) |
| `datum_van_dienst` | ontbreekt (alleen `factuurdatum` r932, `vervaldatum` r933) | **nieuw** |
| referentie offerte/contract/werkitem | `facturen.projectId` (r848, verplicht!), `meerwerkId` (r873), `referentieFactuurId` (r877) | **uitbreiden**: `projectId` optioneel maken zodra maandverzamelfacturen zonder één werkitem bestaan; `contractId` **nieuw** |
| `factuur_type` | `factuurType` (r861: regulier/meerwerk) + `isDeelfactuur` (r867), `isCreditnota` (r876) | **hergebruik**; evt. **uitbreiden** met `contract_termijn` |
| financieel | `subtotaal` (r926), `btwPercentage` (r927), `btwBedrag` (r928), `totaalInclBtw` (r929) | **hergebruik**; btw per regel = **nieuw** optioneel veld op `regels` (r904) |
| debiteurenladder-treden | `betalingsherinneringen` (r970: `type` r973 herinnering/eerste_aanmaning/tweede_aanmaning/ingebrekestelling, `volgnummer` r979, `dagenVervallen` r980, `verstuurdAt` r981) + `instellingen.herinneringInstellingen` (r356: `herinneringDagen`, `aanmaningDagen`, `automatischVersturen`) | **hergebruik**; echte mailverzending **nieuw** (zie §7) |
| ladder pauzeren per factuur | ontbreekt | **nieuw** veld op `facturen` (bijv. `herinneringenGepauzeerd`) |
| termijn → factuur | `contractFacturen.factuurId` (r2378, wordt nooit gezet) | **hergebruik** veld, schrijvende facturatiestap **nieuw** |
| boekhoudsync | `facturen.boekhoudSyncStatus` (r943), `externalBookkeepingId` (r942), `boekhoudSync`-tabel (r2610) | **hergebruik** schema; provider-implementatie is nieuw maar buiten scope §7.4 |

---

## 9. Urensegment (PRD §2.6 + bijlage C)

**Bestaat niet.** `urenRegistraties` (r744) is één urengetal per medewerker×project×dag; `locationSessions` (r1316) heeft wel begin/eind + één pauze maar is GPS-sessie, geen urenbron.

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| tabel `urensegmenten` (categorie + begin/eind + werkitem) | ontbreekt; dichtstbij `locationSessions.clockInAt`/`clockOutAt`/`breakStartAt`/`breakEndAt` (r1329–1333) | **nieuw** tabel; `urenRegistraties` blijft (voorlopig) als dag-aggregaat / legacy-bron |
| `werkitem_id` | `urenRegistraties.projectId` (r745, **verplicht** `v.id("projecten")`) | **uitbreiden**: segment verwijst naar werkitem (= gegeneraliseerd `projecten`); dekt beurten pas na §1-migratie |
| `categorie` (werken / pauze / reistijd / BES) | ontbreekt; pauze zit impliciet in `locationSessions.breakStartAt/EndAt` (wordt nu níét verrekend — bekende bug in mobile.ts clockOut) | **nieuw** |
| `begin` / `eind` | `locationSessions.clockInAt`/`clockOutAt` (r1329/r1331) als patroon | **nieuw** op segment (timestamps) |
| `medewerker_id` | `urenRegistraties.medewerkerId` (r766, optioneel) naast `medewerker` (r747, vrije naam-string) en `medewerkerClerkId` (r765) | **hergebruik** `medewerkerId`, maar **uitbreiden** naar verplicht op segmenten; naam-string `medewerker` deprecaten (bron van de Wie-is-achter-bug) |
| `bron` | `urenRegistraties.bron` (r752: import/handmatig) | **uitbreiden**: literals `mobiel_klok`/`dagkaart` toevoegen (mobiele klok logt nu ten onrechte "handmatig") |
| `bes_afvalverwerker_id` | ontbreekt; `afvalverwerkers` (r1944) is stamdata | **nieuw** optioneel FK-veld op segment |
| dag indienen / heropenen + audit | ontbreekt; `syncStatus` (r757) is offline-sync, géén indienstatus | **nieuw**: `dagStatus` (open/ingediend) + audit-logtabel of tijdlijn-events |
| idempotente offline sync | `urenRegistraties.idempotencyKey` (r755) + index `by_idempotency` (r771), `clientTimestamp` (r756) | **hergebruik** patroon op segmenten-tabel |
| afrondingsflow taakniveau (✓/◐/○) | `planningTaken.status` (r595: gepland/gestart/afgerond) | **uitbreiden**: `deels_afgerond` + rest-opdracht-afsplitsing (mutation); mobiel schrijfbaar maken |
| meerwerk-verzoek voorman | `meerwerk`-tabel (r814: `regels`, `status` r828 aangevraagd/goedgekeurd/afgewezen/gefactureerd, `goedgekeurdDoor` r834) — tabel compleet, **nul** functies/UI | **hergebruik** tabel; backend/UI nieuw (geen schemawijziging nodig) |

---

## 10. Team-bemanning (PRD §2.2 planbord)

`teams` (r1110) bestaat maar is statisch; het planbord plant per individuele medewerker (`weekPlanning`, r608).

| PRD-veld (voorstel) | Bestaand Convex-veld | Actie |
|---|---|---|
| `team` (naam, actief) | `teams.naam` (r1112), `beschrijving` (r1113), `isActief` (r1115) | **hergebruik** |
| standaard-ledenlijst | `teams.leden` (r1114, `v.array(v.id("medewerkers"))`) | **hergebruik** als *default*-bemanning |
| bemanning per dag (wie zit die dag in het team) | ontbreekt; dichtstbij `weekPlanning` (r608: `medewerkerId` r609, `projectId` r610, `datum` r611, `uren` r612) | **nieuw** tabel `teamBemanning` (teamId × datum × medewerkerIds) **of** `weekPlanning` **uitbreiden** met `teamId` zodat de bestaande rijen de per-dag-bemanning worden — voorkeur: uitbreiden, geen dubbele waarheid |
| planbord-rij = team | `weekPlanning.medewerkerId` (rijen zijn nu personen) | **uitbreiden**: `teamId: v.optional(v.id("teams"))` op `weekPlanning` + index `by_team_datum` |
| tijden/duur/volgorde per blok | ontbreekt (`datum` is dag-granulariteit; geen start-/eindtijd) | **nieuw**: `startTijd`/`eindTijd`/`volgorde` op planning-entry (nodig voor route-dagkaart en tijdcascade) |
| voertuig per blok | `weekPlanning.voertuigId` (r613) | **hergebruik** |
| afwezigheid (verlof/ziekte/feestdag) | `verlofaanvragen` (r2217) bestaat maar is niet gekoppeld; afwezigheid loopt nu via `urenRegistraties`-uurtype met naam-matching | **hergebruik** `verlofaanvragen` als bron; koppeling aan planbord **nieuw**; naam-matching-route deprecaten |
| beschikbaarheidsvenster + voorkeursteam klant | ontbreekt op `klanten` (r56) | **nieuw**: 2 optionele velden op `klanten` |
| team-prestaties | `teams`-consumers: teams.ts `getTeamPrestaties` | **hergebruik** |

**Naamconflict:** de bestaande `routes`-tabel (r1435) is GPS-tracking-output. De planbord-"route" is per PRD géén entiteit — noem niets nieuws `routes`.

---

## Samenvatting per actie

| Actie | Kern |
|---|---|
| **Hergebruik (ongewijzigd)** | `onderhoudscontracten` vrijwel volledig; `servicemeldingen`+`serviceAfspraken` als case-basis; `emailTemplates.trigger`-conventie; `betalingsherinneringen`+`herinneringInstellingen`; `meerwerk`-tabel; `teams`; `weekPlanning.voertuigId`; leads/klanten-scheiding (`configuratorAanvragen`/`klanten`); financiële velden op `facturen` |
| **Hernoem/herstructureer** | `facturen.status` → `documentStatus` + nieuw `betaalStatus` (met vervallen-ontrafeling); klant-chat uit `chat_threads` naar eigen tijdlijn-tabel; `klanten.pipelineStatus`-stadium `"lead"` schrappen; notitievelden → tijdlijn |
| **Uitbreiden (migratie-gevoelig)** | `projecten.offerteId` verplicht → optioneel + `type`/`klantId`-verplicht (raakt 26 functies + indexes); status-unions (`projecten`, `servicemeldingen`); `contractWerkzaamheden` + `bouwsteenId`/`prijsPerBeurt`/venster; `weekPlanning` + `teamId`/tijden; `urenRegistraties.bron`-literals; `email_logs.offerteId` optioneel |
| **Nieuw (tabellen)** | `bouwstenen` (catalogus, bijlage A), `klantTijdlijn` (patroon `leadActiviteiten`), `urensegmenten`, `tekstblokken`, `uurtariefHistorie`; velden: `facturatiemodus`, melding-`eigenaarId`/`type`/`kanaal`/`deadline`, werkitem-grondverzetblok, `datumVanDienst`, deelbetalingen |

**Grootste migratierisico's:** (1) `projecten.offerteId` optioneel maken; (2) factuur-status splitsen (cron misbruikt `vervallen`); (3) twee pipeline-modellen samenvoegen; (4) `chat_threads`-type-vlag ontvlechten; (5) `urenRegistraties.medewerker` naam-string → `medewerkerId`.
