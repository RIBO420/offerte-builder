# Functionele inventaris — prototype v13 (klantdossier + werkbord)

Bron: `toelichting-prototype-v13-toptuinen.md` + `toptuinen-klantdossier-v13.html` (deze map).
Nepdata in het prototype is inconsistent — **gedrag telt, niet de code**. Vormgeving is een
voorstel: wij bouwen in ons eigen design system (Loof & Leem, SectiePaneel); structuur,
kleurbetekenis en gedrag nemen we over.

---

## A. Klantdossier

### A1. Statregel (4 klikbare tegels, elk → tabblad)
| Tegel | Kleur(betekenis) | Klik → | Inhoud |
|---|---|---|---|
| Openstaand | amber (geld) | facturen | som open facturen, subtekst "N open facturen / geen open facturen" |
| Open taken | groen (werk) | taken | aantal niet-klaar taken, subtekst "eerstvolgende: [deadline] / alles afgerond" |
| Offertes | kleibruin (kansen) | offertes | aantal, subtekst "1 in concept / N offertes" |
| Laatste contact | donkergroen (relatie) | tijdlijn | "vandaag" of datum, subtekst "Klant sinds [datum]" |

Elke tegel: 4px gekleurde linkerbalk. Doel: scannen op kleur i.p.v. tekst.

### A2. Submenu-tellers (statusgekleurd)
- **grijs streepje** (`—`): niets
- **amber**: iets open — Actueel = open taken + open facturen; Taken = open taken; Facturen = open facturen
- **rood**: Facturen-teller wordt rood als een open factuur > 30 dagen open staat
- Tijdlijn/Aanleg/Bestanden: neutrale telling (tijdlijn telt alleen niet-systeem-events)

Groepering: **Actueel** (los, default) · **Historie**: Tijdlijn, Taken · **Werk**: Aanleg,
Onderhoud · **Financieel**: Offertes, Facturen · **Klant**: Bestanden, Instellingen.
Elk tabblad deeplinkbaar (bij ons: bestaande `?tab=`-aanpak volstaat).

### A3. Tabblad Actueel
Boven: kaart **Gesprek vastleggen**. Daaronder 2 kolommen (stapelt op smal):
links openstaande taken (volledige taakkaarten + "Alle taken"), rechts laatste 3
contactmomenten (+ "Hele tijdlijn"). Rationale: loggen + resulterende taken = één workflow.

### A4. Gesprek vastleggen + AI-taakherkenning
1. Type-chip: **Gebeld** (default) / Gemaild / Afspraak / Notitie
2. Vrije tekst; leeg → melding
3. Vastleggen → analyse-indicator → max ~3 voorgestelde taken, elk: checkbox (default aan), titel, deadline-chip
4. **Verplichte bevestigingsstap**: "Vastleggen en taken aanmaken" óf "Alleen gesprek vastleggen"
5. Resultaat: taken (status todo, prio normaal, ai-herkomst, uitzetter = ik) + tijdlijnitem met badge "✓ N taken aangemaakt uit dit gesprek"

LLM-contract (productie): klein Claude-model, JSON per taak `{titel, deadline|null, confidence}`,
**huidige datum meegeven in de prompt** (anders gaat "volgende week dinsdag" mis).

### A5. Opnemen
- Knop onder invoerveld; klant op luidspreker, mic-opname (geen telefonie).
- Eerst verplichte meldingsnotice; timer start pas na "Melding gedaan, start opname"; annuleren kan.
- Na stop: transcript **ter controle** tonen + herkende taken + zelfde bevestigingsstap.
- Tijdlijnitem krijgt badge `OPNAME · [duur]`.

### A6. Taakkaart
**Ingeklapt**: checkbox (klaar-toggle), titel, tags: status, prioriteit, deadline (amber
zolang open), `x/y` subtaken, badge "UIT GESPREK" (ai), avatars: **maker groen, checker amber**.
Klaar = doorgestreept + gedimd.

**Open**: toelichting, subtaken met voortgangsbalk + "+ Subtaak toevoegen", **Wie doet wat**:
selects "Maakt het" / "Checkt het voor verzending" (opties: Niemand + álle accounts, admins
gemarkeerd), status (4 knoppen): Te doen / Bezig / **"Klaar, moet gecheckt door [voornaam]"**
(amber) / Helemaal klaar; prioriteit (3 knoppen).

Elke status-/toewijzingswijziging reset de stilstandteller. Check-status → toast
"Klaargezet voor [checker]".

**Iedereen met een account is toewijsbaar, ook admins** (expliciete klant-eis; blokkeert nu gebruik).

### A7. Bestanden-tab (naamvoorstel klant: "Bestanden")
- **Foto's**: grid met label-badge **Voor / Tijdens / Na / Schets**, meta titel + datum + uploader. Uploadzone; op mobiel opent de camera.
- **Documenten**: rijen met type-icoon, titel, meta (nummer, datum, bron). **Verzonden offertes en facturen komen er automatisch in** ("automatisch toegevoegd"); ook bron "door klant gestuurd".

### A8. Instellingen-tab (aanvulling op bestaand)
Toggles: "Bevestigingsmail bij inplannen" en "Gesprekken mogen opgenomen worden"
(mondelinge toestemming vastgelegd). GDPR-verwijderverzoek bestaat al.

---

## B. Werkbord "Mijn dag" (vervangt de lijstweergave)

Voor dagelijkse operatie: kleine taken die langs meerdere mensen gaan.

### B1. Perspectief (bovenste rij)
- **Van mij**: maker == ik || checker == ik
- **Uitgezet door mij**: uitzetter == ik && maker != ik
- **Alles**: heel team
- Extra filterchips: Alles / Te doen / Bezig / Wacht op check (klaar verborgen bij "Alles")
- (De "Ik ben X"-picker is demo-speelgoed; productie = ingelogde gebruiker.)

### B2. Verdeel op (tweede rij) + sleepbetekenis
| Indeling | Kolommen | Drop betekent |
|---|---|---|
| **Wanneer** (default) | Vandaag (incl. te laat), Morgen, Deze week, Later (geen datum) | deadline gezet, stilstand-reset |
| **Wie** | kolom per persoon (maker óf checker) + "Niet toegewezen" | maker = persoon, uitzetter = ik, stilstand-reset |
| **Status** | Te doen / Bezig / Wacht op check / Klaar | status wijzigt, stilstand-reset |
| **Klant** | kolom per klant | slepen doet niets |

### B3. "Dit blijft liggen" (rode kolom, sticky links)
Triggers (klaar uitgesloten; alleen taken waar ík betrokken ben als maker/checker/uitzetter):
1. deadline voorbij → "deadline voorbij ([datum])" (hard)
2. status check && ≥ 2 dagen stil → "ligt Xd te wachten op [checker]" (hard)
3. ≥ 3 dagen stil && maker != ik → "Xd geen beweging bij [maker]" (zacht)

Per kaartje: klant, titel, reden, bij wie, knoppen **Herinneren** (plaatst automatische
reminder-reactie bij de taak, gericht aan checker bij check-status, anders maker) en
**Zelf oppakken** (maker = ik, reset). Weergave: **Als kolom** (default) / **Als balk**
bovenaan (leeg = groene strip "Niets blijft liggen. Alles loopt.") / **Verbergen**.
**Geen dubbeling** met gewone kolommen. Principe: teller loopt bij **stilstand, niet drukte**.

### B4. Bordkaartje (ingeklapt)
Klantpill, titel, status (weggelaten in Status-indeling), "Hoog" alleen bij hoge prio,
deadline, x/y subtaken, 💬 n reacties, "Te laat" (rood), "Xd stil" (≥2d), "door jou
uitgezet" (blauw), avatars.

### B5. Reactiepaneel (drawer rechts)
Klik kaartje → zijpaneel met dezelfde inhoud als de open taakkaart + **Reacties**:
lijst (avatar, naam, tijd, tekst) + invoerveld (Enter of Plaatsen). Overleg hoort bij
de taak, niet in WhatsApp.

### B6. Logboek + uren (zwevende knop rechtsonder op het bord)
"Logboek [X,Xu]" met live dagtotaal → paneel "Wat heb ik gedaan": chronologische lijst +
invoerveld. Urenparsing: `1,5u`/`2u`/`45m` → uren (minuten afgerond op 0,1). Zonder
tijdsaanduiding: alleen logregel. Footer: "Naar urenstaat" (→ /uren).

---

## C. Kleurbetekenis (mappen op onze tokens, niet letterlijk overnemen)
groen = werk/afgerond · amber = geld/aandacht (check-status, open facturen, checker-avatar) ·
rood = vastgelopen/te laat/30+ dagen · kleibruin = offertes/documenten · blauw = informatief/verzonden.
Prototype-font (Plus Jakarta Sans) nemen we NIET over; Instrument Sans/Outfit blijft.

---

## D. Harde eisen (letterlijk, "Wat vastligt")
1. Taken worden nooit aangemaakt zonder bevestiging van de gebruiker
2. Vastleggen blokkeert nooit op de AI: faalt de analyse, dan wordt het gesprek gewoon opgeslagen
3. Geen opname zonder de melding vooraf
4. Opnames en transcripties vallen onder het GDPR-verwijderverzoek; audio weg zodra de transcriptie bevestigd is
5. Faalt de transcriptie, dan blijft de audio bewaard zodat het gesprek handmatig gelogd kan worden
6. Elk tabblad is deeplinkbaar
7. "Wacht op check" is een echte status, geen label: er hangen filters en signalering aan

## E. Waardenlijsten
Taakstatus `todo|bezig|check|klaar` · prioriteit `hoog|normaal|laag` · contacttypes
`Gebeld|Gemaild|Afspraak|Notitie|Systeem` · fotolabels `voor|tijdens|na|schets` ·
taakrollen: maker ("Maakt het", groen), checker ("Checkt het voor verzending", amber),
uitzetter · bordindelingen `wanneer|wie|status|klant` · perspectieven `mij|uitgezet|alles` ·
blijft-liggen-modi `kolom|balk|uit`.
