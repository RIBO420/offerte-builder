# HERO planning: reverse engineering (Top Tuinen)

> **Uitgangspunten:** zie `../README.md`. toptuinen.app bestaat al en staat gedeeltelijk (onder andere een roosterprogramma); de huidige stack van toptuinen.app is leidend; Ricardo beslist alles. Dit bestand beschrijft alleen wat er in HERO te zien was.

- **Datum:** 20-10-2026
- **Bron:** het live HERO-account van Top Tuinen, menu Planning (Afspraken, Kalender, Planbord, Instellingen)
- **Methode:**
  - alle schermen, pop-ups en instellingen geopend en zonder op te slaan weer gesloten
  - de afspraken van één week (wk 43) en van vier weken hoogseizoen (18-5 t/m 12-6-2026) alleen gelezen, via hetzelfde endpoint dat het planbord gebruikt
  - de code van het planbord doorzocht op instellingen
- **Zekerheid:** hoog voor de opbouw, de instellingen en het gebruik (gezien in de schermen én in de data). Slepen en vergroten heb ik niet zelf uitgevoerd, omdat dat de planning zou veranderen. Het gedrag daarvan heb ik afgeleid uit de configuratie in de code.

---

## 1. Kernbevindingen

1. **Teams zijn in HERO geen rij op het bord, maar een kleur.** De "categorieën" Team Groen, Team Blauw, Team Oranje en Team Paars zijn labels met een kleur. De rijen op het planbord zijn de **medewerkers**. Een klus met 3 man staat dus 3 keer op het bord, op 3 rijen. Wil je zien wat Team Groen doet, dan moet je dat zelf in je hoofd samenvoegen.
2. **Slepen en vergroten springt in grote stappen. Dat ligt aan de instellingen, niet aan de bibliotheek.** Het planbord gebruikt FullCalendar Scheduler. Er is geen aparte "snap" ingesteld, dus een kaart springt per kolombreedte:

   | Weergave | Stap bij slepen en vergroten |
   |---|---|
   | Dag | 15 minuten |
   | 3 dagen | 2 uur |
   | 7 dagen / Kalenderweek / 14 dagen | 3 uur |
   | 4 weken / Maand | 1 hele dag |

   Dat zijn de "sprongen" waar de planner tegenaan loopt.
3. **Vanuit een lijst naar het bord slepen kan niet.** In de configuratie staat `droppable: false`. Er bestaat geen "opdrachtenbakje"; je maakt een afspraak door een stuk van het raster te selecteren en dan een zijpaneel in te vullen.
4. **Hoe teams in de praktijk werken** (4 weken hoogseizoen):
   - elk team heeft **één vaste kernpersoon** en daarnaast **per dag wisselende helpers**
   - Team Groen werkt met 1 tot 3 man
   - een medewerker van Team Oranje helpt soms een dag bij Team Groen
5. **Workarounds die laten zien wat er mist:**
   - een "NOG IN TE VULLEN"-afspraak op een team, zonder medewerkers (7 afspraken zonder medewerker in 4 weken) → **er is behoefte aan een bakje met "nog te plannen" werk**
   - in de beschrijving: "48 manuur totaal gepland! & [namen]" → **er is behoefte aan begrote uren per klus en aan "gepland tegenover begroot"**
   - de reistijd van 07:30 tot 08:00 wordt **elke dag met de hand** gekopieerd voor 7 man; de herhaalfunctie wordt niet gebruikt → **er is behoefte aan standaardblokken**
   - verlof wordt ingevoerd als afspraak in de categorie "Kantoor" → **er is behoefte aan afwezigheid als apart soort blok**
   - een klus van meerdere dagen = per dag een losse afspraak (er waren 0 meerdaagse afspraken) → **een klus moet over meerdere dagen te verdelen zijn**
6. **Kwartieren zijn de norm.** Bijna alle begin- en eindtijden liggen op :00, :15, :30 of :45. Dat ondersteunt een vaste stap van 15 minuten.
7. **Een paar cijfers** over 4 weken hoogseizoen:
   - 100 afspraken (reistijd niet meegeteld), waarvan 82 aan een project gekoppeld
   - 37 projecten; de meeste hebben 1 tot 3 afspraken, de grootste 13
   - een afspraak duurt gemiddeld 4,6 uur, de langste 8 uur
8. **De Opdrachten-module van HERO wordt niet gebruikt** (0 opdrachten). Er wordt direct vanuit het project ingepland.

---

## 2. Planbord (`/partner/CalendarScheduler`)

**Indeling**

- **Werkbalk:**
  - weergave kiezen: Dag, 3 dagen, 7 dagen, Kalenderweek, 14 dagen, 4 weken, Maand
  - vorige / Vandaag / volgende en een knop Datum
  - de titel bovenaan, bijvoorbeeld "19 – 25 okt 2026 wk43"
- **Filters:** Categorie (meerkeuze met zoekveld) en Vakgebied.
- **Knoppen:**
  - `+ Nieuwe afspraak`
  - `Import/export`: kalender importeren of exporteren (ICS)
  - een tandwiel voor de instellingen van het bord
- **Rijen ("Bronnen")**, per groep in en uit te klappen:
  - *Over het algemeen* → "Projecten gepland": afspraken zonder medewerker
  - *Medewerkers* → één rij per medewerker (8 stuks). Per rij een sleepgreep (volgorde), een ster (favoriet) en een oog (zichtbaarheid van de groep).
  - Groepen voor voertuigen, machines en dergelijke kunnen, maar er zijn 0 bronnen aangemaakt.
- **Kolommen:**
  - Kalenderweek: per dag 4 kolommen van 3 uur (07, 10, 13, 16)
  - Dagweergave: uren met kwartierlijnen
- **Kaartje:** 4 regels die je zelf instelt (zie §5.4). Bij Top Tuinen is dat:
  - met een project: tijd · projectnummer · klant · aantal medewerkers
  - zonder project: tijd · titel · categorie · aantal medewerkers
  - de kleur volgt de categorie
- **Tooltip bij aanwijzen:** tijd, projectnaam, adres, klant, projectnummer, categorie en aantal medewerkers.
- **Op een kaartje klikken** opent een pop-up met:
  - titel, datum en tijd
  - project of contactpersoon (met adres), contactpersoon (met telefoonnummer)
  - categorie, medewerkers (als labels), beschrijving
  - de knoppen **Kopiëren · Verwijderen · Bewerken**
- **Een stuk van het raster selecteren** opent het zijpaneel "Afspraak maken" (§2.1).
- **Slepen en vergroten** gaan per kolombreedte (zie §1, punt 2). Vergroten kan alleen aan de eindkant.

### 2.1 Zijpaneel "Afspraak maken" / bewerken

| Veld | Type |
|---|---|
| Titel | tekst |
| Begindatum + Van, Einddatum + Tot | datum en tijd |
| Herhaling | Uniek / Dagelijks / Wekelijks / Maandelijks / Jaarlijks |
| Project / Contactpersoon | zoeken, met de knop "Naar het project" |
| Categorie | keuzelijst (bepaalt de kleur) |
| Medewerkers | meerkeuze |
| Bronnen | meerkeuze (voertuigen, machines; bij Top Tuinen leeg) |
| Beschrijving | tekst |
| Markeer de afspraak als voltooid | vinkje |

Knoppen: Annuleren / Overnemen.

### 2.2 Instellingen van het bord (tandwiel)

- **Periode bij het openen:** Dag … Maand (bij Top Tuinen: Kalenderweek)
- **Dagtijden:** van 0:00 tot 24:00, per heel uur (bij Top Tuinen 7:00 tot 18:00)
- **Zichtbare dagen:** ma t/m zo (alle 7 staan aan)
- **Kleuren volgens:** Vakgebied / Project / Categorie / Contactpersoon-Klant (bij Top Tuinen: Categorie)
- **Bronnen:** Medewerkers, met een volgnummer ("Serie")

---

## 3. Kalender (`/partner/Calendar`)

- Een maand- en weekweergave zonder rijen per medewerker.
- De kaartjes hebben de kleur van hun categorie.
- Er is een knop "Kalender exporteren".
- Hier zie je de workarounds terug, zoals "NOG IN TE VULLEN – Team Groen" en "verlof – Kantoor".

## 4. Afspraken (`/partner/CalendarEvents/index/assigned`)

- **Tabbladen:** Mijn afspraken · Afspraken gemaakt · Alle afspraken
- **Kolommen:** Start, Einde, Titel, Categorie, Projectnaam, Projectadres, Medewerkers, Bronnen, Gemaakt door, Klaar op
- **Per rij:** bewerken, kopiëren en verwijderen
- **Exporteren:** "Afspraken exporteren" en "Exporteren"

## 5. Planning → Instellingen (`/partner/CalendarOptions`)

1. **Bronnen:** naam en type. Bij Top Tuinen staan hier geen bronnen.
2. **Brontypen:** Voertuig, Ruimte, Machine, Gereedschap, Overig.
3. **Categorieën:** een naam en een kleur.

   | Categorie | Kleur |
   |---|---|
   | Afspraak op locatie | geelgroen |
   | Kantoor | geel |
   | Team Blauw | blauw |
   | Team Groen | groen |
   | Team Oranje | oranje |
   | Team Paars | paars |

4. **Afspraakweergave:** welke informatie op de 4 regels van een kaartje staat, apart in te stellen voor afspraken *met* en *zonder* project of contactpersoon. Per regel kies je uit:
   - Contactpersoon
   - Aantal toegewezen medewerkers en resources
   - Categorie
   - Klantadres of projectadres (als dat afwijkt)
   - Klantnaam
   - Klantnaam of contactpersoon
   - Project- of klantnummer
   - Projectnaam
   - Projectnummer en projectnaam of contactnummer
   - Begin- en eindtijd
   - Titel

## 6. Waar de planning op aansluit

**Projectstappen in HERO**

📞 Nieuw – eerste contact → 🚗 Afspraak op locatie → 📄 Offerte → 🗣 Detailgesprek → 🤝 **Opdracht toekenning** → 🖊️ **Opdracht bevestiging** → 👷 Start uitvoering → ⌛ In uitvoering → 💵 Factuur → ⚠️ Claim → ✅ Afgesloten → 📁 Gearchiveerd.

De stappen "Opdracht toekenning" en "Opdracht bevestiging" zijn in HERO het moment waarop een klus "aangenomen" is. In toptuinen.app is dat de bron voor het opdrachtenbakje.

**Soorten afspraak in de data**

| Code | Betekenis |
|---|---|
| `execution` | uitvoering |
| `office` | kantoor / reistijd |
| `school` | wordt gebruikt bij Team Oranje |
| `meeting` | overleg |
| `bad_weather` | slecht weer |

**Afwezigheid**

Er is een apart endpoint voor afwezigheid (`/employees/Absences/ajax_edit/`), maar in de praktijk wordt verlof als afspraak ingevoerd.

## 7. Datamodel van HERO (afgeleid)

Zie `hero-planning-datamodel.json`.

**Afspraak (event)**

- `id`, `project_match_id`
- `category_id` + `category{name, color}`
- `type`, `title`, `description`
- `start`, `end`, `all_day`
- `partners[]` (de medewerkers), `resources[]` (voertuigen en dergelijke)
- `color`, `is_done`, `is_recurring`, `address`

**Bronnen (rijen)**

Een boomstructuur van id's: `other` → `other/projects`, en `partner` → `partner/{medewerkerId}`.

**Endpoints**

| Endpoint | Waarvoor |
|---|---|
| `POST /partner/CalendarScheduler/ajax_events {start,end}` | afspraken ophalen |
| `GET /partner/CalendarScheduler/resources/` | de rijen |
| `GET /partner/CalendarScheduler/scheduler_options` | instellingen |
| `POST /partner/CalendarEvents/update_event` | slepen of vergroten opslaan |
| `GET /partner/CalendarEvents/get_types` | soorten afspraak |
| `/partner/Calendar/ajax_export` | ICS-export |

## 8. Wat ik niet heb gezien of gedaan

- Echt slepen of vergroten (dat zou de planning wijzigen). Het gedrag heb ik afgeleid uit de configuratie (§1, punt 2).
- De medewerker-app van HERO (hoe een medewerker zijn planning ziet).
- Of er meldingen gaan naar medewerkers als de planning verandert.
