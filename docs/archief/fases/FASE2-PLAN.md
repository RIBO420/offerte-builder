# Fase 2 — Plan (PRD §3)

**Status:** klaar om te starten zodra fase 1 gereviewd/gemerged is. Vraag Claude om "start fase 2" — dit document is de opdracht.
**Bron:** `prd-toptuinen-app-v1.md` §3 + doorgeschoven punten uit `FASE1-RAPPORT.md`.

## Bouwstappen (afhankelijkheidsvolgorde)

### 2.1 Debiteurenladder (PRD §3.2) — geen open afhankelijkheden
De facturen leven sinds fase 1 in de app (§2.8), dus de enige PRD-randvoorwaarde is vervuld.
- Treden: verzonden dag 0 → herinnering dag 14 → tweede herinnering dag 21 → dag 28 automatische taak voor Elke (bellen/aanmaning). Elke trede instelbaar (interval, sjabloon via mailTriggers, escalatietype); 3–4 heldere Nederlandse treden, niet HERO's zes half-Duitse.
- Ladder draait automatisch dagelijks (cron); per factuur pauzeren/overslaan (betalingsafspraak).
- Herinneringsmails via de bestaande concept-mails-wachtrij + mailguard (geen volautomatische klantmail zonder kantoor-instelling).
- Openstaande-postenoverzicht: "verschuldigd sinds"-badge + aanmaanniveau per factuur — de lijst ís het debiteurenoverzicht.
- Betalingsregistratie met deelbedragen bestaat al (fase 1); bankkoppeling/reconciliatie is fase 3-kandidaat (wacht op boekhoudpakket-keuze, §7.6).
- Hergebruik: `betalingsherinneringen`-tabel bestaat (inventariseren), `conceptMails`, `mailTriggers`, documentstatus/betaalstatus-splitsing.

### 2.2 Klantenportaal uitbreiden (PRD §3.1)
- Klant ziet: eigen werkitems + status, facturen, eigen meldingen (portaal bestaat; uitbreiden met werkitems/meldingen).
- Klant dient melding in (serviceverzoek/klacht, met foto's) → landt op HETZELFDE cases-bord van fase 1 (§2.4), met automatische ontvangstbevestiging via mailTriggers.
- Klantthread per werkitem/melding: visueel onmiskenbaar anders (banner "ZICHTBAAR VOOR KLANT", afwijkende achtergrond); versturen alleen door kantoor; composer standaard op intern — extern = twee bewuste handelingen.
- Fundament ligt er: rollenmodel, klant-scoping, gescheiden threads, tijdlijn.

### 2.3 Machinepark + generieke vervallogica-engine (PRD §3.3)
- "Vloot & Materieel"-widget wordt echte module: machines/bussen, kleurcode per team, status (rood = kapot → beïnvloedt planbord-beschikbaarheid), standaardinventaris per bus (voedt de delta-checklist uit fase 1 — lost ook de bus-per-team-aanname op).
- Middelen als planbare resource: schaars materieel (hoogwerker, kraan) koppelen aan werkitem; dubbel claimen op één dag = waarschuwing op het planbord.
- Generieke engine `verval_items`: item, type (APK/keuring/certificaat/verzekering), vervaldatum, waarschuwtermijn, ontvanger-rol → melding + optionele plantaak op het cases-bord. (Zelfde engine bedient in fase 3 de HR-certificeringen.)
- Hergebruik: voertuigen/voertuigOnderhoud/voertuigUitrusting-tabellen, attendering-cron-patroon, meldingen-bord.

### 2.4 Rapportages activeren + nacalculatie-loop (PRD §3.4)
- Geen nieuwbouw: valideren zodra de keten echte data levert. Werkelijke uren (urenSegmenten, fase 1) stromen terug naar de receptuurnormen — het tabblad "Calculatie Analyse" bestaat al. Normuren per bouwsteen groeien uit deze loop (PRD §2.5a).

### 2.5 Kleinere fase 2-items uit bijlage B
- Lijstweergave van afspraken (Mijn/Alle, filter/sortering) als derde goedkope weergave op de planbord-data.
- "Stel volgorde voor"-knop op de dagkaart (eenvoudige heuristiek, planner beslist) — route-intelligentie stap 2.

## Randvoorwaarden / input van mensen
| Wie | Wat | Blokkeert |
|---|---|---|
| Ricardo | Google Maps-key (reistijd), EMAIL_VERZENDEN_ACTIEF op prod, fase 1-merge | reistijd-kwaliteit; verzending |
| Mickey | catalogus-defaults, drempels, blok-tijden, bundels | schaduw-offerte §8.2 |
| Yannick/Hans | boekhoudpakket + bankkoppeling (§7.6) | alleen reconciliatie (fase 3) |
| Romeo | HERO-export + standaardteksten | artikelimport, mail-startvulling |

## Niet in fase 2 (fase 3/4, ter herinnering)
AI-intake aanleg (§4.1), HR-module + medewerkerportaal (§4.2), Gmail-koppeling (§4.3), WhatsApp Business API, planbord-AI/Timefold (§4.4, pas na een seizoen data), bankreconciliatie, UBL/Peppol, SOP-bibliotheek, HERO-uitfasering (besluit Romeo/Yannick, §7.2).
