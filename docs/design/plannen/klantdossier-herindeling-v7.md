# Plan: klantdossier-herindeling v7 + gesprekslog met taakherkenning

**Bron:** briefing SAIS WORKS 17 aug 2026 + prototype `toptuinen-klantdossier-v7.html`
**Doel:** het klantdossier visueel identiek aan het prototype, met ónze design tokens, en het gesprekslog met LLM-taakherkenning als kernfunctie. Opname is fase 2.

---

## 0. Waarom dit snel kan

De verkenning laat zien dat ~70% van de tabinhoud al bestaat en alleen verplaatst hoeft te worden:

| Prototype-paneel | Bestaat al | Werk |
|---|---|---|
| Taken (open/afgerond) | `KlantTakenCard` (863 r., compleet met composer) | verplaatsen |
| Tijdlijn (datumgroepen, filters, zoeken) | `KlantTijdlijn` (1048 r.) | verplaatsen |
| Onderhoud | `OnderhoudSectie` (497 r., incl. losse-beurt-dialog) | verplaatsen |
| Offertes / Facturen | `KlantOffertesSectie` / `KlantFacturenSectie` | verplaatsen + filterchips/totaalbalk |
| Statregel | `cijferbalk.tsx`-patroon (Cel + gap-px-grid) | generaliseren |
| Identiteitskop | bestaande kop op `klanten/[id]/page.tsx` | vrijwel ongewijzigd |
| URL-sync tabs | `useTabState` (`?tab=`) | hergebruiken |

**Nieuw te bouwen:** verticaal submenu met statuspillen, tabframe, `projecten.listVoorKlant`, instellingen-tab met echt bewerkformulier, gesprekscomposer + Convex-schema-uitbreiding + Anthropic-analyse, en (fase 2) de opnameketen.

---

## 1. Architectuurbesluiten (tevens antwoord op briefing §5)

1. **Tabs, geen routes.** In-page tabs met de bestaande `useTabState`-hook: `/klanten/[id]?tab=tijdlijn`. Deeplinkbaar (eis van de Meldingen-module), geen layout-herbouw, sluit aan bij `contracten/[id]`. De statregel-tegels en "Alle taken"-knoppen roepen `setTab` aan.
2. **AI-call in een Convex-action.** `convex/gesprekAnalyse.ts` → action `analyseer({tekst, klantNaam})` met `@anthropic-ai/sdk`, model `claude-haiku-4-5`, `ANTHROPIC_API_KEY` in Convex env (dev + prod). Huidige datum in de prompt, gedwongen JSON-uitvoer: `{taken: [{titel, deadline: "YYYY-MM-DD"|null, confidence}]}`. Zelfde auth-laag (`requireKantoor`) als de rest. Client wacht max ±8 s; bij fout of timeout wordt het gesprek gewoon vastgelegd met de melding "geen taken herkend" (vastgelegd punt 2 uit de briefing).
3. **Datamodel: tijdlijn uitbreiden, geen nieuwe tabel.** `klantTijdlijn` krijgt optionele velden `gekoppeldeTaakIds?: Id<"klantTaken">[]`, `opnameDuurSec?`, `audioId?: Id<"_storage">`, `transcriptieStatus?: "gelukt"|"mislukt"`. `klantTaken` krijgt `bronTijdlijnId?` → badge "uit gesprek". Types Gebeld/Gemaild/Afspraak/Notitie mappen op bestaand `kanaal`/`eventType` (telefoon/email/intern + nieuw eventType `afspraak` indien nodig).
4. **Opnameketen (fase 2), bewust simpel:** `MediaRecorder` → upload naar Convex storage → Next-route `/api/transcribe` (Deepgram Nova, `language: nl` — zelfde route die de mobiele hooks al verwachten) → zelfde analyse-action → zelfde bevestigings-UI. Na bevestigde transcriptie audio verwijderen; bij mislukte transcriptie audio bewaren + entry `transcriptieStatus: "mislukt"` (vastgelegde punten 4+5). Opname start pas na de bevestig-checkbox met de meldingszin (punt 3).
5. **Taken nooit zonder bevestiging** (punt 1): de action geeft alleen vóórstellen terug; pas "Vastleggen en taken aanmaken" schrijft via één mutation `tijdlijn.legGesprekVast` (entry + gekozen taken atomair, met koppeling beide kanten op).

---

## 2. Visuele vertaling (prototype → tokens)

- **Kaart met kopbalk** (`wcard`/`whead`): nieuw prop-variant op `SectiePaneel` (`kopbalk`-stijl: 1px rand in donkerder grijsgroen, lichte kopbalkachtergrond) zodat alle bestaande secties hem gratis krijgen. Geen nieuwe kaartprimitief.
- **Kleuren**: prototypekleuren mappen op bestaande tokens — `--groen`→primary, `--groen-tint`→`surface-primair`-familie, `--amber(-bg)`→`surface-aandacht`-familie, `--lijn`→border. Groen alleen functioneel (actief item, primaire knop, statusbadges); de resterende decoratieve groenvlakken in het dossier verdwijnen.
- **Statuspillen submenu**: grijs streepje bij leeg, amber bij openstaand, rood bij factuur >30 dagen open — logica per teller in de nav-component, data uit de queries die de tabs toch al nodig hebben (één verzamelquery `klanten.dossierTellingen` om acht losse queries te voorkomen).
- **Typografie**: beslispunt (zie §6) — briefing wil Outfit/Instrument Sans ("de halfschreef is eruit"), onze huisstijl is Fraunces/Geist.
- **Mobiel**: prototype laat het submenu horizontaal scrollen — dat mag bij ons niet (nooit zijwaarts scrollen). Alternatief: wrap-chips boven de inhoud op <lg, zelfde statuspillen.
- **Motion**: `PaginaReveal`/`REVEAL_KLASSE`-regime, geen framer-motion, bewaker-test dekt de nieuwe map automatisch (`src/components` valt onder `WORTELS`).

---

## 3. Werkverdeling

**WS1 — Fundament (eerst, blokkeert de rest):**
`klanten/[id]/page.tsx` (714 r.) splitsen: kop + statregel + `DossierNav` + tabframe blijven op de pagina; inhoud naar `src/components/klanten/dossier/` (`tab-actueel.tsx`, `tab-tijdlijn.tsx`, …). `ContactChip`/`Feit` naar eigen bestand. Nieuwe `DossierNav` (verticaal, 5 groepen, statuspillen, sticky; wrap-chips op mobiel). `KlantCijferstrip` (4 cellen) door `Cel`/grid uit `cijferbalk.tsx` te exporteren/generaliseren. Nieuwe query `klanten.dossierTellingen`. `loading.tsx` herbouwen. E2e-selectors `klant-crud.spec.ts` r. 165–405 meefixen.

**WS2 — Inhoudstabs (parallel na WS1):**
Tijdlijn/Taken/Onderhoud/Offertes/Facturen-tabs vullen met bestaande componenten; facturen-filterchips (Alle/Niet betaald/Betaald) + totaalbalk; nieuwe query `projecten.listVoorKlant` (index `by_klant` bestaat al) + projectentabel met planning/status/waarde.

**WS3 — Instellingen-tab (parallel na WS1):**
Contactgegevens-weergave + écht bewerkformulier (nu kan naam/adres/e-mail nergens gewijzigd worden op deze pagina; `klanten.update` bestaat), voorkeuren-switches (bevestigingsmail; nieuw veld `opnameToestemming`), GDPR-blok verhuizen (dialog + blockers bestaan al).

**WS4 — Gesprekslog (na WS1, naast WS2/3):**
Schema-uitbreiding, `gesprekAnalyse.analyseer`-action, mutation `tijdlijn.legGesprekVast`, `GesprekComposer`-component (typechips, textarea, analysepaneel met checkboxen, twee bevestigingsknoppen), badge "uit gesprek" in `TaakRegel`, label "N taken aangemaakt uit dit gesprek" in `TijdlijnEntryRij`. Unit-tests voor de mutation + composer-test (portal-valkuil-les toepassen).

**WS5 — Opnameketen (fase 2, apart gepland):**
Opname-UI (meldingszin + bevestiging, timer, stop), upload, `/api/transcribe` (herbruikbaar door mobile), audio-opruiming, foutpad. Meest fragiele deel; pas starten als WS4 live is.

**Uitvoeringsregime:** bouwagents op Opus 5 zonder browser, checkpoint-commits pathspec-scoped, gate = drie sloten (typecheck + lint + tests), visuele controle doe ik zelf in de preview. Convex-schemawijzigingen: dev deployen vóór de frontend ernaar verwijst; prod-deploy vóór git push.

**Volgorde:** WS1 → (WS2 ∥ WS3 ∥ WS4) → integratieronde + visuele schouw → gate → push. Daarna WS5.

---

## 4. Risico's

1. **E2e- en unit-tests** rond de klantpagina breken bij de herindeling → in WS1 meteen meenemen, niet achteraf.
2. **`KlantTakenCard`/`KlantTijdlijn` niet verbouwen** — alleen frameloos renderen via bestaande props; 1900 regels beproefde code ongemoeid laten.
3. **Tellers**: acht losse queries op één pagina zou traag en flikkerend zijn → één `dossierTellingen`-query.
4. **LLM-uitvoer**: JSON-schema afdwingen + zod-parse serverzijde; bij parse-fout zelfde nette terugval als bij timeout.
5. **Tijdlijn-toegang**: klantrol heeft nul queries op `klantTijdlijn` — zo houden; gespreksdata is intern.
6. **Seed/demo**: gesprekslog-demodata alleen in `demoSeed`, niet-routeerbare contactgegevens-regel respecteren.

---

## 5. Ureninschatting (voor terugkoppeling aan SAIS)

- **(a) Herindeling + gesprekslog met taakherkenning:** 3 bouwdagen (WS1 ~1 dag, WS2+WS3 samen ~1 dag parallel, WS4 ~1 dag incl. tests en prompt-tuning).
- **(b) Opnamefunctie:** 1,5–2 bouwdagen (opname-UI ~0,5, transcriptieketen + foutpaden + opruiming ~1–1,5).

## 6. Besluiten (Ricardo, 17 aug 2026)

1. **Typografie:** Fraunces/Geist blijft — we nemen indeling en kaartstijl van het prototype over, niet de fontwissel. Wordt als bewuste afwijking van briefing §4 aan SAIS gemeld.
2. **Scope:** eerst fase A (herindeling + gesprekslog), fase B (opname) als aparte ronde erachteraan.
3. **Terugkoppeling SAIS:** antwoorddocument direct opstellen → `antwoord-briefing-sais-klantdossier.md` naast dit plan.
