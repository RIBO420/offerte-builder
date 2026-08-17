# Plan van Aanpak — PRD toptuinen.app v1.2.1

**Datum:** 10 juli 2026 · **Basis:** `prd-toptuinen-app-v1.md` (Romeo, 8 juli) + analyse bestaande codebase (`offerte-builder`)

---

## 1. Oordeel over de PRD

**Sterk.** Doordacht, gebaseerd op een echte nulmeting, met bindende principes, acceptatietests als definition-of-done, en expliciete anti-eisen uit HERO-fricties. De fase-indeling is afhankelijkheidsvolgorde — verstandig. "Geen herbouw, engine blijft" is helder afgebakend.

**Maar: drie punten die vóór de bouw opgelost moeten worden.**

### 1.1 De gap-spec ontbreekt (BLOKKEREND)
De PRD zegt letterlijk: *"De concrete bouwopdracht staat in de losse gap-spec (`gap-spec-ricardo.md`) — begin daar."* Dat bestand is niet meegeleverd (niet in Downloads, niet in het project). De PRD is achtergrond; de bouwopdracht ontbreekt. **Actie: opvragen bij Romeo.**

### 1.2 Stack-aanname klopt niet: Supabase ≠ Convex
De PRD gaat uit van **Supabase** (RLS-policies §1.2, "bestaande Supabase-schema", §7.4 vraagt om Supabase-schema-export). De app draait op **Convex** (Next.js web + Expo mobile, zelfde Convex-backend). Gevolgen:

- RLS-eisen (kantoor↔klant-scheiding, klant ziet alleen eigen dossier) vertalen naar Convex-autorisatie: afdwingen in élke query/mutation via een centrale auth-helper (`security.ts`/`roles.ts` bestaan al — auditen en uitbreiden).
- De "misklik-test" (§8.3) blijft haalbaar: gescheiden tabellen voor interne threads vs. klantthreads kan in Convex net zo goed.
- §7.4-deliverable wordt: **Convex-schema-export + veld-mapping** i.p.v. Supabase-export.
- Ook de uren-app-herbouw ("zelfde database") betekent hier: veld-rol op de Convex-backend.

**Actie: Romeo informeren; veld-mapping-document maken zodat PRD v1.1 op het echte schema mapt.**

### 1.3 De nulmeting onderschat wat er al staat
Het schema bevat al: `onderhoudscontracten`, `contractWerkzaamheden`, `contractFacturen`, `servicemeldingen`, `serviceAfspraken`, `urenRegistraties`, `teams`, `weekPlanning`, `planningTaken`, `emailTemplates`, `betalingsherinneringen`, `leveranciers`/`producten`, `portaal`, chat-tabellen, vloot-tabellen. Veel PRD-onderdelen zijn dus **uitbreiden/activeren**, geen nieuwbouw. Dat is goed nieuws voor tempo, maar vereist eerst een eerlijke gap-analyse per module: wat is leeg omhulsel, wat werkt echt.

---

## 2. Openstaande beslispunten (vóór fase 0)

| # | Beslissing | Voorstel |
|---|---|---|
| B1 | Werkitem-modellering in Convex | Nieuwe tabel `werkitems` (type: project/onderhoudsbeurt) met migratie van `projecten` erin, óf `projecten` hernoemen/uitbreiden. Beslissen na schema-audit — dit raakt alles. |
| B2 | Interne vs. klantthreads | Bestaande `chat_threads`/`chat_messages` blijven intern; nieuwe aparte tabellen `klant_tijdlijn` (+ entries). Nooit één tabel met vlag (PRD-eis). |
| B3 | DayPilot Lite | Toetsen op React 19/Next 15-compatibiliteit vóór commitment; adapter-laag sowieso (PRD-eis). |
| B4 | Gap-spec | Bouwvolgorde pas definitief na ontvangst `gap-spec-ricardo.md`. |

---

## 3. Fasering (afhankelijkheidsvolgorde, conform PRD)

### Stap 0 — Voorbereiding (nu, geen productiecode)
1. `gap-spec-ricardo.md` opvragen bij Romeo.
2. **Schema-audit + veld-mapping** (PRD §7.4): per PRD-veldvoorstel → bestaand Convex-veld / nieuw / hernoemen. Output: `SCHEMA-MAPPING.md` → input voor PRD v1.1.
3. **Module-gap-analyse**: per bestaande module (contracten, meldingen, uren, planning, chat) vaststellen: werkt / leeg omhulsel / ontbreekt.
4. Beslispunten B1–B3 vastleggen.

### Stap 1 — Quick fixes (§5, losse sprint, kan per direct)
Badge "Leads", prullenbak → archiveren, autosave-indicator + concepten buiten KPI's, testrecord weg, datumlabels consistent.

### Stap 2 — Fase 0: fundament (§1)
- `werkitems`-entiteit (B1) met gedeelde kernvelden + grondverzet-velden op projecten.
- Rollenmodel `kantoor/voorman/medewerker/klant` + autorisatie in Convex-functies; verstuurknop bestaat alleen voor kantoor, API weigert voor de rest.
- Leads ↔ Klanten splitsen; lead-promotie zonder dubbele records.
- Geen vrij notitieveld op werkitem (tijdlijn is de waarheid).

### Stap 3 — Fase 1: de kern (§2) — volgorde binnen de fase
1. **Catalogusbeheer** (§2.5f) + uurtarief-instelling met ingangsdatum → Mickey kan 23 bouwstenen invoeren (referentie: `mickey-onderhoud-prijzen-tijden.html`, nog te ontvangen).
2. **Contract → beurtengenerator** + losse beurt met ritme + planningsattendering (§2.1).
3. **Planbord**: weekbord (DayPilot of alternatief) + wachtrij + route-dagkaart met tijdcascade (§2.2). Google Maps Distance Matrix API-key nodig.
4. **Klanttijdlijn** (ombouw chat-tabs, migratie notitieveld) + auto-events (§2.3).
5. **Meldingen/cases-bord** (§2.4) — `servicemeldingen` uitbreiden.
6. **Offertes**: vrije regel-editor (route 2), artikel-picker met gebruiksteller, tekstblokkenbibliotheek, harde validatie geaccepteerd→werkitem (§2.5). Engine en aanleg-wizard NIET aanraken.
7. **Veld-rol** (Hub-herbouw): urensegmenten, dag indienen, afrondingsflow op taakniveau, materiaaldelta, "Wie is achter" (§2.6).
8. **Transactionele mails** (`mail_triggers`) (§2.7).
9. **Facturatie-engine**: "Te versturen"-wachtrij, document- + betaalstatus splitsen, drie facturatiemodi (§2.8).

### Stap 4 — Fase 2 (§3): klantenportaal, debiteurenladder, machinepark + vervallogica-engine, nacalculatie-loop.
### Stap 5 — Fase 3/4 (§4): AI-intake, HR, Gmail, planbord-AI — pas na een seizoen data.

---

## 4. Definition of done
De 12 acceptatietests uit §8, per onderdeel gekoppeld aan de stap die hem moet halen. "Het scherm staat er" telt niet.

## 5. Benodigd van anderen (uit §7)
- Romeo: gap-spec, HTML-prototype Mickey-scherm, tekenprogramma-formaat (fase 3).
- Mickey: catalogus-defaults (niet blokkerend), afwijkingsdrempel, bundel-samenstellingen, standaardblok-tijden.
- Yannick/Hans: boekhoudpakket + bankkoppeling (fase 2/3).
- Ricardo: schema-export + veld-mapping (stap 0.2), voorbeeld-leverancierslijst.
