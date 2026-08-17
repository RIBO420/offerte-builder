# TOP TUINEN — All-in-One Bedrijfssoftware

## Compleet Scope Document

**Opgesteld door:** LOQIC
**Versie:** 1.0 — Maart 2026
**Status:** Vertrouwelijk

---

## Inhoudsopgave

1. [Inleiding](#1-inleiding)
2. [Rollenstructuur & Permissies](#2-rollenstructuur--permissies)
3. [Modules](#3-modules)
   - 3.1 [Offerte Calculator & Builder](#31-offerte-calculator--builder)
   - 3.2 [Facturatie](#32-facturatie)
   - 3.3 [CRM & Klantbeheer](#33-crm--klantbeheer)
   - 3.4 [Projectmodule](#34-projectmodule)
   - 3.5 [Planningmodule](#35-planningmodule)
   - 3.6 [Urenregistratie](#36-urenregistratie)
   - 3.7 [HR Module](#37-hr-module)
   - 3.8 [Wagenpark, Materieel & Gereedschapsbeheer](#38-wagenpark-materieel--gereedschapsbeheer)
   - 3.9 [Onderhoudscontracten & SLA-beheer](#39-onderhoudscontracten--sla-beheer)
   - 3.10 [Garantiebeheer & Servicemeldingen](#310-garantiebeheer--servicemeldingen)
   - 3.11 [Klantportaal (App)](#311-klantportaal-app)
   - 3.12 [Interne Communicatie](#312-interne-communicatie)
   - 3.13 [Rapportages & Dashboards](#313-rapportages--dashboards)
   - 3.14 [Boekhoudkoppeling](#314-boekhoudkoppeling)
   - 3.15 [E-mailmodule & Communicatie-automatisering](#315-e-mailmodule--communicatie-automatisering)
   - 3.16 [Smart Operations Dashboard](#316-smart-operations-dashboard)
4. [Module-overzicht & Status](#4-module-overzicht--status)
5. [Technische Randvoorwaarden](#5-technische-randvoorwaarden)
6. [Notities voor Ricardo](#6-notities-voor-ricardo)
7. [Agent Strategie — Parallelle Ontwikkeling](#7-agent-strategie--parallelle-ontwikkeling)

---

## 1. Inleiding

Dit document beschrijft de complete scope van de all-in-one bedrijfssoftware voor Top Tuinen. Het doel is een volledig overzicht te geven van alle modules, functionaliteiten en gebruiksvriendelijkheidsvereisten, zodat Ricardo op basis hiervan een gedetailleerd Plan van Aanpak (PVA) en Projectleiddraad (PLD) kan opstellen.

De software wordt ontwikkeld als een webapplicatie met een bijbehorende mobiele app voor medewerkers in het veld. Het systeem vervangt losse tools en spreadsheets door een geintegreerd platform dat alle bedrijfsprocessen van Top Tuinen afdekt: van offerte tot facturatie, van planning tot nacalculatie, van HR tot wagenparkbeheer.

### Uitgangspunten

- De software moet bruikbaar zijn door medewerkers met beperkte digitale vaardigheden (hoveniers in het veld)
- Elke handeling moet zo min mogelijk klikken vereisen
- Het systeem moet proactief waarschuwen en herinneren (push-notificaties, automatische meldingen)
- Rollen en permissies bepalen wat een gebruiker ziet en kan doen
- Data wordt eenmaal ingevoerd en stroomt automatisch door naar alle relevante modules
- De klant krijgt een eigen portaal voor transparante projectinzage

---

## 2. Rollenstructuur & Permissies

Het systeem werkt met een gelaagd permissiemodel. Elke rol ziet alleen wat relevant is en kan alleen wat toegestaan is.

| Rol | Kan zien | Kan doen |
|-----|----------|----------|
| **Directie / Admin** | Alles: dashboards, financials, HR, projecten, CRM | Alles beheren, goedkeuren, instellingen wijzigen, gebruikers aanmaken |
| **Projectleider** | Eigen projecten, planning, nacalculatie, meerwerk, inkooporders | Projecten aanmaken, plannen, meerwerk goedkeuren, facturen klaarzetten |
| **Voorman** | Eigen dagplanning, projectdetails, to-do's, uren team, materialen | Uren registreren (eigen + team), meerwerk melden, foto's uploaden, toolbox-meetings registreren |
| **Medewerker** | Eigen dagplanning, eigen uren, eigen verlof | Eigen uren invullen, verlof aanvragen, foto's uploaden |
| **Klant (portaal)** | Eigen project: voortgang, foto's, documenten, facturen | Offerte accorderen (digitale handtekening), meerwerk goedkeuren, communiceren |
| **Onderaannemer / ZZP** | Toegewezen projecten, eigen uren | Eigen uren registreren, documenten uploaden |
| **Materiaalman** | Materieelstatus, defectmeldingen, reparatiehistorie, voorraad | Defecten beoordelen, reparaties toewijzen (intern/extern), apparaten gereed melden, keuringen registreren |

---

## 3. Modules

### 3.1 Offerte Calculator & Builder

**Status:** Gereed ~60%

De kern van het systeem. Maakt volledige offertes op basis van omrekenfactoren. Van materiaalkeuze tot arbeidstijd, alles wordt doorberekend tot een complete offerte die de klant digitaal kan ondertekenen.

**Kernfuncties:**

- Offerte samenstellen op basis van omrekenfactoren (materiaal, arbeid, transport, overhead)
- Automatische prijsberekening op basis van m2, stuks, strekkende meters, etc.
- Offerteversies bijhouden (v1, v2, v3) met wijzigingslog
- Markering welke versie definitief getekend is
- PDF-export met professionele opmaak en bedrijfshuisstijl
- Digitale handtekening-flow: klant ontvangt e-mail, accordeert online met handtekening
- Bevestigingstekst: "Hierbij bevestig ik dat ik akkoord ga met deze offerte en geef ik toestemming om digitaal te ondertekenen"
- Automatische statusupdate in CRM na ondertekening
- Koppeling naar projectaanmaak: getekende offerte wordt automatisch een project
- Optionele posten / keuzemogelijkheden voor de klant ("wilt u optie A of B?")
- Interne notities per offerteregel (niet zichtbaar voor klant)

**Gebruiksvriendelijkheid & foutpreventie:**

> - Offerteversies worden automatisch genummerd — gebruiker kan geen versie overschrijven
> - Verplichte velden voordat offerte verzonden kan worden (klantgegevens, projectadres, minimaal 1 regel)
> - Waarschuwing bij onrealistisch lage of hoge bedragen ("Deze offerte is EUR 0, klopt dat?")
> - Getekende offertes zijn vergrendeld — wijzigingen resulteren automatisch in nieuwe versie
> - Concept-offertes krijgen watermerk "CONCEPT" op PDF
> - Digitale handtekening vereist expliciet vinkje dat klant begrijpt dat dit juridisch bindend is

**Opmerking voor Ricardo:**
Bekijk in Hero hoe zij offerteversies en de digitale handtekeningflow hebben opgebouwd. Let op de juridische disclaimer-tekst bij de handtekening.

---

### 3.2 Facturatie

**Status:** Nog te bouwen

Volledige facturatiemodule die naadloos aansluit op de offerte. Ondersteunt deelfacturatie, termijnbetalingen, meerwerk-facturatie en een volledig geautomatiseerd incassotraject.

**Kernfuncties:**

- Deelfacturatie met flexibele percentages (bijv. 50% vooraf, 30% bij start, 20% bij oplevering)
- Standaard deelfactuur-templates instelbaar, maar per project aanpasbaar
- Meerwerk apart factureren, gekoppeld aan goedgekeurd meerwerk in het project
- Automatische factuurgeneratie op basis van mijlpalen of handmatige trigger
- Factuurstatus tracking in CRM: concept, verzonden, bekeken, betaald, te laat
- Automatische betalingsherinneringen (configureerbare intervallen: 7, 14, 21 dagen)
- Automatische aanmaningsbrieven (1e aanmaning, 2e aanmaning, ingebrekestelling)
- Koppeling met incassobureau: automatisch dossier doorsturen na x dagen onbetaald
- Creditnota's aanmaken
- BTW-berekening (21% / 9% verlaagd tarief bij woningen ouder dan 2 jaar)
- Exportfunctie naar boekhoudpakket (Exact Online, Twinfield, Moneybird, etc.)

**Gebruiksvriendelijkheid & foutpreventie:**

> - Factuur kan niet verzonden worden zonder gekoppelde offerte of meerwerkopdracht
> - Systeem waarschuwt als deelfacturen samen meer dan 100% van offertewaarde zijn
> - Betaalstatus wordt automatisch bijgewerkt via bankfeed of handmatige afvinken
> - Aanmaningen stoppen automatisch zodra betaling binnenkomt
> - Verwijderde facturen worden nooit echt verwijderd — alleen gecrediteerd (fiscale eis)
> - Pop-up bij handmatig bedrag: "Dit wijkt af van het offertebedrag. Weet je het zeker?"

**Opmerking voor Ricardo:**
De facturatiemodule moet een API-koppeling hebben richting gangbare boekhoudpakketten. Check welk pakket Top Tuinen gebruikt en bouw daar als eerste de koppeling voor.

---

### 3.3 CRM & Klantbeheer

**Status:** Nog te bouwen

Centraal klantbeheersysteem waarin alle klantinteracties, offertes, projecten, facturen en communicatie samenkomen. Een klantdossier met volledig overzicht.

**Kernfuncties:**

- Klantkaart met contactgegevens, projecthistorie, offertes, facturen en notities
- Automatische statusupdates: lead → offerte verzonden → getekend → in uitvoering → opgeleverd → onderhoud
- Tagging en segmentatie (type klant: particulier, zakelijk, VvE, gemeente, etc.)
- Communicatiehistorie: alle e-mails, belnotities en acties per klant
- Automatische opvolgherinneringen ("Offerte 7 dagen geleden verzonden, nog geen reactie")
- Koppeling met alle modules: vanuit klantkaart direct naar project, factuur, contract
- Klant-importfunctie (CSV/Excel) voor bestaande klantenlijsten
- GDPR-compliant: verwijderverzoek uitvoeren met audit trail

**Gebruiksvriendelijkheid & foutpreventie:**

> - Duplicaatdetectie bij aanmaken nieuwe klant (op basis van e-mail, telefoonnummer, adres)
> - Verplicht minimaal een contactmethode (e-mail of telefoon) bij nieuwe klant
> - Zoekfunctie die ook op gedeeltelijke naam, adres of projectnaam werkt
> - Klant verwijderen is niet mogelijk zolang er openstaande facturen of lopende projecten zijn

---

### 3.4 Projectmodule

**Status:** Nog te bouwen

Het hart van de dagelijkse operatie. Elk project bevat alles: planning, uren, materialen, meerwerk, foto's, documenten, nacalculatie en interne communicatie. Een project wordt automatisch aangemaakt na ondertekening van een offerte.

**Kernfuncties:**

- Automatische projectaanmaak vanuit getekende offerte (met alle offertedata overgenomen)
- Projectdashboard: status, voortgang, budget vs. werkelijk, deadlines
- To-do lijsten per project, toewijsbaar aan medewerkers
- Documentbeheer per project (tekeningen, vergunningen, KLIC-meldingen, contracten)
- Interne chat per project (voorman, projectleider, directie)
- Foto-upload met verplichte categorisering: "voor", "tijdens", "na"
- Voortgangsfoto's met automatische datum- en locatiestempel
- Meerwerk registratie door voorman (beschrijving, foto, geschatte kosten)
- Meerwerk goedkeuringsflow: voorman meldt → projectleider beoordeelt → klant accordeert
- Materiaalregistratie per project (besteld, geleverd, verbruikt)
- Nacalculatie: begrote uren/kosten vs. werkelijke uren/kosten per project
- Projectafsluiting checklist (voor/na foto's, nacalculatie, klanttevredenheid)
- KLIC-melding reminder: bij aanlegprojecten met graafwerk automatische check "KLIC-melding gedaan?"

**Gebruiksvriendelijkheid & foutpreventie:**

> - Project kan niet afgesloten worden zonder ingevulde nacalculatie en voor/na foto's
> - Meerwerk vereist altijd een foto als onderbouwing
> - Automatische notificatie als projectkosten 80% van budget bereiken
> - Documenten worden automatisch gecategoriseerd op bestandstype
> - To-do's zonder deadline krijgen een waarschuwing: "Wil je hier een deadline aan koppelen?"
> - KLIC-melding check blokkeert projectstart bij graafprojecten tot bevestiging

**Opmerking voor Ricardo:**
Bekijk Hero voor inspiratie op de projectstructuur. Let op hoe zij de documentindeling, to-do's en samenwerkingsfunctie hebben opgebouwd.

---

### 3.5 Planningmodule

**Status:** Nog te bouwen

Visuele planning van medewerkers, materieel en projecten. De planning is de bron van waarheid voor wie wanneer waar werkt — en voedt automatisch de urenregistratie.

**Kernfuncties:**

- Drag-and-drop weekplanning met medewerkers op de Y-as en dagen op de X-as
- Beschikbaarheidspaneel: apart overzicht van wie nog NIET ingepland is op een dag ("beschikbare pool")
- Medewerker slepen van beschikbare pool naar project → automatisch ingepland en uit pool verwijderd
- Medewerker inplannen op project → automatische koppeling met urenregistratie
- Bus-/voertuigtoewijzing per dag: elke bus zichtbaar in planning, toewijzen aan team/project
- Bustype-categorisering: aanlegbus, onderhoudsbus, transportbus — standaarduitrusting per bustype vastleggen
- Slimme materieel-suggesties: bij inplannen van werkzaamheid (bijv. "gras maaien") automatisch benodigde machines voorstellen (grasmaaier, kantenmaaier, bladblazer)
- Taak-naar-machine koppeltabel: per type werkzaamheid vastleggen welke machines standaard nodig zijn
- Materieel/machineplanning: beschikbaarheid van voertuigen, machines, gereedschap in een overzicht
- Capaciteitsoverzicht: hoeveel uur is er beschikbaar vs. ingepland? Hoeveel bussen/machines vrij?
- Medewerker-app dagweergave: medewerker ziet vandaag zijn project, adres, team, welke bus, welke machines mee moeten
- Voorman-app: overzicht van zijn team, welke bus, welke machines, route naar projectlocatie
- Seizoensplanning / jaarkalender: overzicht op maand-/kwartaalniveau voor capaciteitsplanning
- Onderhoudscontracten automatisch inplannen per seizoen
- Weer-integratie: actuele weerdata en voorspelling per werkdag per locatie
- Waarschuwing bij vorst, zware regen of storm ("Op woensdag wordt vorst verwacht bij project X")
- Conflictdetectie: waarschuwing als medewerker, bus of machine dubbel ingepland wordt
- Reistijdindicatie tussen projecten als medewerker op meerdere locaties werkt

**Gebruiksvriendelijkheid & foutpreventie:**

> - Medewerker kan niet ingepland worden op een dag dat hij/zij verlof heeft — verschijnt niet in beschikbare pool
> - Machine kan niet ingepland worden als APK verlopen is of status "defect" heeft
> - Bus kan niet ingepland worden als APK verlopen is — blokkade met rode waarschuwing
> - Kleurcodering: aanleg = groen, onderhoud = blauw, intern = grijs, spoedklus = rood
> - Bij planningswijziging automatisch push-notificatie naar betrokken medewerker(s)
> - Weerdata is informatief — planning wordt niet automatisch gewijzigd (voorkomt chaos)
> - Slimme materieel-suggesties zijn suggesties — planner kan altijd handmatig aanpassen/verwijderen
> - Als geen bus is toegewezen aan een ingepland project: waarschuwing "Geen bus toegewezen"
> - Als een machine als "defect" is gemeld maar toch gesuggereerd wordt: duidelijke rode markering

**Opmerking voor Ricardo:**
De taak-naar-machine koppeltabel is cruciaal: vraag Top Tuinen om een complete lijst van werkzaamheidstypes (maaien, snoeien, schoffelen, aanplanten, bestrating, schuttingbouw, etc.) en welke machines/gereedschap daar standaard bij horen. Dit wordt de basis voor de slimme suggesties.

---

### 3.6 Urenregistratie

**Status:** Nog te bouwen

Medewerkers registreren dagelijks hun uren via de mobiele app. Het systeem koppelt uren automatisch aan het juiste project op basis van de planning.

**Kernfuncties:**

- Medewerker opent app → ziet automatisch de projecten waarop hij/zij vandaag is ingepland
- Een tik: project selecteren, uren invullen, optioneel opmerking toevoegen
- Onderscheid uurtypes: productief, reistijd, pauze, intern, ziekte, verlof
- Voorman kan uren invoeren voor zijn hele team
- Dagelijks urenoverzicht voor voorman: wie heeft al ingevuld, wie niet?
- Automatische herinnering (push-notificatie) als uren niet zijn ingevuld voor 18:00
- Weekoverzicht per medewerker met goedkeuringsflow (voorman → projectleider)
- Export naar Excel (per week, per maand, per project, per medewerker)
- Uren stromen automatisch naar nacalculatie van het project
- Uren stromen automatisch naar salarisverwerking/loonadministratie

**Gebruiksvriendelijkheid & foutpreventie:**

> - Uren kunnen alleen geregistreerd worden op projecten waarop de medewerker is ingepland (voorkomt foute boekingen)
> - Maximum 12 uur per dag per medewerker — bij overschrijding: verplichte bevestiging
> - Herinnering escaleert: 18:00 push-notificatie, 20:00 tweede herinnering, volgende ochtend melding aan voorman
> - Uren van vorige week kunnen nog 2 werkdagen worden aangepast, daarna vergrendeld
> - Voorman ziet real-time wie er al heeft ingevuld en wie niet (rood/groen overzicht)

---

### 3.7 HR Module

**Status:** Nog te bouwen

Personeelsbeheer inclusief certificeringen, verzuim, verlof en functioneringsgesprekken. Het systeem bewaakt proactief alle verplichtingen en deadlines.

**Kernfuncties:**

- Personeelsdossier per medewerker: contactgegevens, functie, startdatum, contracttype
- Certificeringenbeheer: VCA, BHV, kettingzaag, rijbewijs BE, machineveiligheid
- Per certificaat: behaaldatum, verloopdatum, scan van certificaat uploaden
- Automatische melding 3 maanden, 1 maand en 1 week voor verloopdatum
- Dashboard: overzicht alle certificeringen met rood/oranje/groen status
- Verlofregistratie: vakantiedagen aanvragen, goedkeuren, saldo bijhouden
- Ziekteverzuim: ziekmelden, herstelmelden, verzuimgesprekken vastleggen
- Functioneringsgesprekken: planning, verslaglegging, afspraken vastleggen
- RI&E (Risico-inventarisatie en -evaluatie) registratie en opvolging
- Toolbox-meetings: onderwerp, datum, aanwezigen registreren (wettelijk verplicht)
- Onboarding-checklist voor nieuwe medewerkers
- Onderaannemers / ZZP'ers: VCA-status, verzekeringsbewijs, modelovereenkomst bijhouden

**Gebruiksvriendelijkheid & foutpreventie:**

> - Medewerker met verlopen VCA wordt automatisch uitgesloten van planning (kan niet ingepland worden)
> - Toolbox-meeting vereist minimaal een onderwerp en een aanwezige
> - Verlopen certificaten worden rood weergegeven op het dashboard van de directie
> - ZZP'er kan niet worden ingezet als verzekeringsbewijs of modelovereenkomst ontbreekt
> - Bij 3 ziekmeldingen binnen 3 maanden: automatische melding aan HR/directie
> - Onboarding-checklist moet volledig afgevinkt zijn voordat medewerker op projecten kan worden ingepland

---

### 3.8 Wagenpark, Materieel & Gereedschapsbeheer

**Status:** Nog te bouwen

Volledig beheer van het wagenpark, machinepark en handgereedschap. Van bussen tot heggenscharen, van minigravers tot kettingzagen. Inclusief reparatie-workflow, keuringen en automatische meldingen. Het doel: altijd weten wat beschikbaar is, wat kapot is, wat gekeurd moet worden en wie er verantwoordelijk voor is.

**Kernfuncties:**

**Voertuigen:**
- Voertuigregister met kenteken, merk, type, aanschafdatum, km-stand
- Bustype-categorisering: aanlegbus, onderhoudsbus, transportbus — met standaarduitrusting per type

**Fleet and Go Integratie:**
- API-koppeling met Fleet and Go voor live voertuigdata
- Live GPS-tracking: kaartweergave met real-time positie van alle bussen/voertuigen
- Kilometerregistratie automatisch vanuit Fleet and Go (geen handmatige invoer meer nodig)
- Rithistorie per voertuig: waar is de bus geweest, welke routes, hoeveel km per dag
- Automatische ritregistratie zakelijk vs. prive op basis van Fleet and Go data
- Geofencing: melding als voertuig buiten verwacht werkgebied komt (optioneel)
- Brandstofverbruik per voertuig op basis van Fleet and Go data (indien beschikbaar in API)
- Koppeling met planning: verwachte locatie vs. werkelijke locatie — zichtbaar of bus op de juiste plek is

**Keuringen & Onderhoud:**
- APK-registratie met automatische meldingen (3 maanden, 1 maand, 1 week voor verloopdatum)
- Onderhoudsschema per voertuig (olie, banden, grote beurt) met automatische planning

**Machines:**
- Machineregister (minigraver, stobbenfrezen, bladzuigers, hoogwerkers, etc.)
- Per machine: merk, type, serienummer, aanschafdatum, aanschafwaarde
- Keuringen & certificeringen per machine: kettingzagen (jaarlijkse keuring), hoogwerkers (NEN-keuring), heftrucks, etc.
- Automatische keuringsmeldingen (3 maanden, 1 maand, 1 week voor verloopdatum)
- Machine met verlopen keuring wordt automatisch geblokkeerd in planning

**Handgereedschap:**
- Register van alle handgereedschappen (heggenscharen, bladblazers, bosmaaiers, etc.)
- Per gereedschap: unieke identificatie (nummer/label), type, merk, aanschafdatum, huidige status

**Defect- en Reparatie-workflow:**
1. Voorman meldt defect via app (apparaat selecteren + beschrijving + foto + ernst: "onbruikbaar" of "beperkt bruikbaar")
2. Automatische statuswijziging naar "defect" — apparaat verdwijnt uit beschikbare pool in planning
3. Materiaalman ontvangt melding, beoordeelt en kiest: "Kan ik zelf repareren" of "Moet naar externe partij"
4. **(Intern):** Materiaalman repareert, markeert als gereed, apparaat terug in beschikbare pool
5. **(Extern):** Systeem maakt automatisch een reparatie-opdracht aan met leverancier/reparateur (bijv. Frisse), verwachte retourdatum
6. Bij retour: materiaalman checkt en zet op "operationeel" of "nog niet goed"
- Volledige reparatiehistorie per apparaat (wat was er kapot, wanneer, hoe opgelost, kosten)

**Beschikbaarheid:**
- Realtime overzicht van alle materieel: beschikbaar, ingepland, in reparatie, bij externe partij, afgeschreven
- Toewijzing aan project/bus via planningmodule

**Kosten:**
- Totale kostenregistratie per apparaat (aanschaf, onderhoud, reparaties, brandstof, afschrijving, keuring)
- Schademeldingen: medewerker kan schade melden met foto en beschrijving

**Gebruiksvriendelijkheid & foutpreventie:**

> - Voertuig/machine met verlopen APK of keuring kan niet worden ingepland (harde blokkade)
> - Defectmelding vereist minimaal een foto en een ernstindicatie
> - Bij defectmelding wordt apparaat AUTOMATISCH op status "niet beschikbaar" gezet — geen handmatige actie nodig
> - Materiaalman krijgt push-notificatie bij elke nieuwe defectmelding
> - Apparaat in reparatie bij externe partij: systeem stuurt herinnering als verwachte retourdatum is verstreken
> - Kilometerstand kan alleen hoger worden dan vorige registratie (voorkomt foute invoer bij handmatige fallback)
> - Fleet and Go data synchroniseert minimaal elke 5 minuten — bij verbindingsproblemen duidelijke melding
> - Als Fleet and Go API niet bereikbaar is: systeem schakelt over naar handmatige invoer-modus met melding
> - Wekelijks automatisch overzicht: welke keuringen verlopen binnenkort, welke apparaten zijn al >2 weken in reparatie
> - Bij afschrijving apparaat: waarschuwing "Dit apparaat is ouder dan X jaar, overweeg vervanging"
> - Dubbele defectmelding voor hetzelfde apparaat wordt automatisch samengevoegd
> - Dashboard voor directie: totale materieelkosten, top 5 duurste reparaties, gemiddelde levensduur per type

**Opmerking voor Ricardo:**
Dit is een complexe module. (1) Fleet and Go API-documentatie opvragen en testen welke data beschikbaar is (GPS, km, brandstof, ritten). Bouw een proof-of-concept met live kaartweergave als eerste. (2) Vraag Top Tuinen om een complete inventarislijst van alle voertuigen, machines en gereedschappen. (3) Welke keuringen wettelijk verplicht zijn per apparaattype. (4) Wie de materiaalman is en hoe het reparatieproces nu verloopt. (5) Welke externe reparateurs ze gebruiken (bijv. Frisse). Bouw de defect-workflow als eerste — dat heeft direct dagelijks nut.

---

### 3.9 Onderhoudscontracten & SLA-beheer

**Status:** Nog te bouwen

Beheer van terugkerende onderhoudscontracten. Automatische planning per seizoen, automatische facturatie per termijn, en contractverlenging.

**Kernfuncties:**

- Contractregister: klant, locatie, looptijd, opzegtermijn, tarief
- Werkzaamheden per contract per seizoen definieren (voorjaar: snoeien, zomer: maaien, herfst: bladruimen, winter: controle)
- Automatisch inplannen in planningmodule op basis van seizoensdefinities
- Automatische facturatie per termijn (maandelijks, per kwartaal, jaarlijks)
- Contractverlenging: automatisch verlengen tenzij opgezegd, met melding aan klant
- Tariefwijzigingen: jaarlijkse indexering instellen, automatisch doorvoeren met melding aan klant
- Koppeling met projectmodule: elk onderhoudsbezoek wordt een mini-project met uren en foto's
- Contractwaarde-overzicht in dashboard: totale jaarwaarde onderhoud

**Gebruiksvriendelijkheid & foutpreventie:**

> - Contract kan niet verlopen zonder dat directie een melding heeft ontvangen
> - Opzegtermijn wordt automatisch bewaakt ("Klant X kan tot 1 december opzeggen")
> - Tariefwijziging vereist goedkeuring directie voordat klant geinformeerd wordt
> - Contractoverzicht toont duidelijk welke contracten binnenkort verlopen

---

### 3.10 Garantiebeheer & Servicemeldingen

**Status:** Nog te bouwen

Na oplevering van een project loopt garantie. Klachten en serviceverzoeken worden geregistreerd, gekoppeld aan het oorspronkelijke project en afgehandeld.

**Kernfuncties:**

- Garantieperiode per project instellen (standaard: 1 jaar na oplevering)
- Automatische melding bij nadering en aflopen garantietermijn
- Servicemeldingen registreren: klant belt met klacht → koppelen aan project
- Status per melding: ontvangen, in beoordeling, ingepland, afgehandeld
- Onderscheid: garantieclaim (kosteloos) vs. serviceverzoek (betaald)
- Foto's en beschrijving bij elke servicemelding
- Koppeling met planning: servicebezoek inplannen vanuit melding

**Gebruiksvriendelijkheid & foutpreventie:**

> - Garantieclaim binnen garantietermijn krijgt automatisch label "kosteloos"
> - Servicemelding buiten garantie krijgt melding "Garantie verlopen — doorbelasten?"
> - Afgehandelde meldingen vereisen beschrijving van uitgevoerde werkzaamheden

---

### 3.11 Klantportaal (App)

**Status:** Concept

Een apart portaal (app) voor klanten van Top Tuinen. De klant kan meekijken met de voortgang van het project. Transparant, open en eerlijk.

**Kernfuncties:**

- Projectvoortgang inzien: status, planning, voor/na foto's
- Offerte bekijken en digitaal ondertekenen
- Meerwerk bekijken en goedkeuren (met digitale handtekening)
- Facturen inzien en betaalstatus bekijken
- Documenten inzien (tekeningen, contracten, opleverdocumenten)
- Foto's bekijken die het team heeft geupload
- Servicemelding indienen na oplevering
- Optioneel: chat/berichtfunctie met projectleider

**Gebruiksvriendelijkheid & foutpreventie:**

> - Klant ziet alleen eigen projecten, nooit die van andere klanten
> - Digitale handtekening vereist expliciete bevestiging en juridische disclaimer
> - Klant kan geen bestanden verwijderen of projectgegevens wijzigen
> - Bij inactieve klant (geen login > 6 maanden) wordt account niet verwijderd maar geinactiveerd
> - Eenvoudige login: e-mail + wachtwoord of magic link (geen complex wachtwoordbeleid)

**Opmerking voor Ricardo:**
Het klantportaal wordt in een latere fase gebouwd. Nu alleen de architectuur rekening mee houden zodat de API's klaarzetten voor het portaal later eenvoudig is.

---

### 3.12 Interne Communicatie

**Status:** Nog te bouwen

Projectgebonden en algemene communicatie binnen het team. Vervangt losse WhatsApp-groepen door gestructureerde communicatie die altijd terug te vinden is.

**Kernfuncties:**

- Chat per project: alle betrokkenen kunnen berichten en foto's delen
- Algemeen kanaal voor bedrijfsbrede mededelingen
- Directe berichten tussen medewerkers
- Push-notificaties bij nieuwe berichten
- Bestanden en foto's delen in chat (automatisch opgeslagen bij project)
- Zoekfunctie in chatgeschiedenis
- @mention functie om specifieke personen te taggen

**Gebruiksvriendelijkheid & foutpreventie:**

> - Chat is geen vervanging voor formele processen (meerwerk via meerwerkmodule, niet via chat)
> - Berichten in projectchat worden bewaard als onderdeel van projectdossier
> - Foto's gedeeld in chat worden automatisch geexporteerd naar projectfoto's

---

### 3.13 Rapportages & Dashboards

**Status:** Deels aanwezig

Stuurinformatie voor de directie. Real-time inzicht in omzet, marges, bezettingsgraad, kosten en projectstatus. Data-gedreven beslissingen nemen.

**Kernfuncties:**

- Omzetdashboard: gerealiseerde omzet, verwachte omzet, openstaande offertes
- Margedashboard: marge per project, gemiddelde marge per type project
- Uren-dashboard: bezettingsgraad, productieve uren vs. totale uren, uren per project
- Financieel overzicht: openstaande facturen, te laat betaald, cashflow-prognose
- Kostenanalyse: kosten per project, per afdeling, per kostensoort
- Nacalculatie-overzicht: welke projecten zitten boven/onder budget?
- HR-dashboard: verzuimpercentage, verlopen certificaten, openstaande gesprekken
- Wagenparkdashboard: kosten per voertuig, onderhoudsstatus
- Onderhoudscontracten: totale contractwaarde, contracten die verlopen
- Exportfunctie naar Excel en PDF voor alle rapportages

**Gebruiksvriendelijkheid & foutpreventie:**

> - Dashboards laden snel (max 3 seconden) ook bij veel data
> - Datums en filters worden onthouden per gebruiker
> - Vergelijkingsmogelijkheid: dit kwartaal vs. vorig kwartaal / dit jaar vs. vorig jaar
> - Rode vlag bij afwijking > 10% van budget op een project

---

### 3.14 Boekhoudkoppeling

**Status:** Nog te bouwen

Integratie met het boekhoudpakket van Top Tuinen zodat alle financiele data automatisch doorstroomt. Geen dubbele invoer.

**Kernfuncties:**

- API-koppeling met Exact Online, Twinfield, Moneybird of ander pakket
- Facturen automatisch doorzetten naar boekhouding
- Inkoopfacturen verwerken en koppelen aan projecten
- Grootboekrekeningen mapping (eenmalig instellen)
- Betalingsstatussen synchroniseren (betaald in boekhoudpakket = betaald in systeem)
- BTW-aangifte voorbereiden op basis van systemdata

**Gebruiksvriendelijkheid & foutpreventie:**

> - Koppeling toont duidelijke foutmeldingen als synchronisatie mislukt
> - Handmatige override mogelijk als automatische mapping niet klopt
> - Logboek van alle gesynchroniseerde transacties (audit trail)

**Opmerking voor Ricardo:**
Uitzoeken welk boekhoudpakket Top Tuinen gebruikt. De API-koppeling hiermee is prioriteit.

---

### 3.15 E-mailmodule & Communicatie-automatisering

**Status:** Nog te bouwen

Geautomatiseerde e-mailcommunicatie vanuit het systeem. Elke e-mail die het bedrijf verstuurt (offertes, facturen, herinneringen, contracten) gaat via deze module met professionele templates en automatische bijlagen.

**Kernfuncties:**

- E-mail template bibliotheek met standaardteksten per trigger (offerte, factuur, herinnering, oplevering, etc.)
- Templates aanpasbaar per verzending: standaardtekst wordt geladen, gebruiker kan tekst aanpassen voor verzending
- Automatische bijlagen: algemene voorwaarden worden ALTIJD meegezonden bij offertes en contracten
- Extra bijlagen toevoegen: gebruiker kan per e-mail aanvullende documenten bijvoegen (procesomschrijving, brochure, tekeningen, etc.)
- Offerte-e-mail flow: offerte klaarzetten → e-mail template laden → eventueel aanpassen → verzenden met offerte-PDF + algemene voorwaarden als bijlage
- Factuur-e-mail flow: factuur genereren → template laden → verzenden met factuur-PDF
- Herinnerings-e-mail flow: automatisch na configureerbaar aantal dagen (7/14/21) met oplopende urgentie in toon
- Aanmanings-e-mail flow: 1e aanmaning, 2e aanmaning, ingebrekestelling — elk met eigen template en juridische tekst
- Opleverings-e-mail: automatisch na projectafsluiting met samenvatting, voor/na foto's en garantie-informatie
- Onderhoudscontract verlenging: automatische e-mail met nieuw tarief en verlengingsbevestiging
- Interne notificatie-e-mails: certificaatverlopen, APK-meldingen, verzuimmeldingen
- E-mail log per klant: alle verzonden e-mails zichtbaar in klantdossier (CRM)
- Open/klik tracking: zien of klant de e-mail heeft geopend en de offerte heeft bekeken
- Afzenderadres configureerbaar per type (info@, administratie@, projecten@)
- Reply-to instelling: antwoorden van klanten komen op het juiste e-mailadres binnen

**Gebruiksvriendelijkheid & foutpreventie:**

> - E-mail kan niet verzonden worden zonder onderwerp en ontvanger
> - Algemene voorwaarden worden automatisch bijgevoegd en kunnen niet per ongeluk verwijderd worden bij offertes
> - Preview-functie: gebruiker ziet exact hoe de e-mail eruitziet voordat deze verzonden wordt
> - "Verzenden" vereist bevestiging ("Weet je zeker dat je deze offerte wilt versturen naar klant X?")
> - Template-wijzigingen door gebruiker worden niet opgeslagen als nieuwe standaard (tenzij expliciet gekozen)
> - Bounced e-mails (onbezorgbaar) genereren een melding: "E-mail aan klant X is niet bezorgd — controleer het e-mailadres"
> - Bij ontbrekend e-mailadres in klantkaart: blokkade met melding "Geen e-mailadres bekend voor deze klant"
> - Bijlagen groter dan 10MB worden automatisch gecomprimeerd of via downloadlink aangeboden

**Opmerking voor Ricardo:**
De e-mailmodule moet via een eigen SMTP-server of een dienst als SendGrid/Mailgun werken (niet via Gmail/Outlook van de klant). Dit garandeert bezorgbaarheid en tracking. SPF/DKIM/DMARC records moeten worden ingesteld op het domein van Top Tuinen.

---

### 3.16 Smart Operations Dashboard

**Status:** Nog te bouwen

Een intelligent, rolgebonden dashboard dat per gebruiker de juiste to-do's, meldingen en suggesties toont. Het systeem denkt actief mee en vertelt de gebruiker wat er gedaan moet worden, in plaats van dat de gebruiker zelf alles moet onthouden. Het dashboard werkt op basis van data uit alle modules en genereert automatisch actiepunten. Primair ontworpen voor de materiaalman (Mickey), maar elke rol krijgt een eigen variant.

**Materiaalman Dashboard (Mickey):**

- Dagelijkse to-do lijst: automatisch gegenereerd op basis van planning, defecten, keuringen en bestellingen
- Defectmeldingen inbox: alle openstaande defecten met prioriteit (onbruikbaar = rood, beperkt = oranje)
- Keuringskalender: welke apparaten/voertuigen moeten binnenkort gekeurd worden (tijdlijn-weergave)
- Blokkade-overzicht: welke apparaten/bussen zijn nu niet inzetbaar en waarom (defect, keuring, bij reparateur)
- Bestellijst per project: welke materialen moeten besteld worden voor aankomende klussen
- Automatische bestelsuggestie: op basis van geplande werkzaamheden en standaard materiaallijsten per projecttype
- Reparatie-tracking: overzicht van alle apparaten bij externe reparateurs met verwachte retourdatum
- Busoverzicht: welke bus is waar (live kaart via Fleet and Go), welke bus heeft welke lading, welke bus moet naar APK
- Slimme meldingen: "Kettingzaag #3 is al 3 weken bij reparateur — opvolgen?" / "Bus 2 moet over 2 weken naar APK" / "Voor project X (start maandag) zijn de tegels nog niet besteld"

**Voorman Dashboard:**

- Dagplanning: welk project, welk team, welke bus, welke machines
- To-do's per project: openstaande taken voor vandaag
- Defectmeldingen: status van eerder gemelde defecten
- Uren-overzicht team: wie heeft al ingevuld, wie niet

**Directie Dashboard:**

- Financieel overzicht: omzet, marges, openstaande facturen, cashflow
- Operationeel overzicht: bezettingsgraad, projectstatus, nacalculatie-afwijkingen
- HR-signalen: verlopen certificaten, verzuimtrends, openstaande gesprekken
- Materieel-signalen: totale kosten, apparaten die vaak kapot gaan, vervangingssuggesties

**Systeem-brede Intelligentie:**

Het systeem combineert data uit planning, materieel, projecten en inkoop om proactief te waarschuwen:

- "Project X start over 3 dagen. Er is een minigraver nodig maar die is ingepland op project Y. Oplossing: huur een externe minigraver of verplaats project Y"
- "Heggenschaar #2 is dit jaar al 4x gerepareerd voor EUR 1.200 totaal. Nieuwprijs is EUR 800. Overweeg vervanging"
- "Volgende week zijn er 3 onderhoudsprojecten maar slechts 2 onderhoudsbussen beschikbaar"
- "Medewerker Jan heeft VCA die over 6 weken verloopt. Hij is ingepland op projecten t/m week 40. Plan de VCA-cursus in voor die tijd"
- Data-gedreven suggesties: het systeem leert van historische data welke werkzaamheden gemiddeld hoeveel tijd kosten en waarschuwt bij afwijkingen

**Gebruiksvriendelijkheid & foutpreventie:**

> - Dashboard laadt altijd binnen 3 seconden, ook bij veel data
> - To-do's zijn gesorteerd op urgentie: blokkades eerst, dan deadlines vandaag, dan deze week
> - Elke melding heeft een duidelijke actieknop: "Bestel nu", "Plan keuring", "Bel reparateur", "Markeer als afgehandeld"
> - Afgehandelde items verdwijnen van de to-do lijst maar blijven vindbaar in historie
> - Meldingen worden niet herhaald als ze al gezien en geacteerd zijn
> - Slimme suggesties zijn suggesties — nooit automatische acties. De gebruiker beslist altijd
> - Bij conflicten (bijv. dubbele machineplanning) toont het systeem het conflict en mogelijke oplossingen
> - Push-notificaties voor urgente blokkades (apparaat kapot dat morgen nodig is) — ook buiten de app
> - Weekoverzicht: elke vrijdag automatisch samenvatting van wat er komende week klaarstaat, wat er mist, en wat er actie vereist

**Opmerking voor Ricardo:**
Dit dashboard is het kloppend hart van de software. Het maakt het verschil tussen "een systeem waarin je data invoert" en "een systeem dat met je meedenkt". Bouw eerst een simpele versie met statische to-do's op basis van queries (keuringen, defecten, bestellingen). De slimme suggesties (conflicten, vervangingsadviezen) zijn fase 2. Fleet and Go kaartweergave integreren als iframe of via hun JavaScript SDK.

---

## 4. Module-overzicht & Status

| # | Module | Status | Prioriteit |
|---|--------|--------|------------|
| 1 | Offerte Calculator & Builder | ~60% gereed | **P0 — Live** |
| 2 | Facturatie | Nog te bouwen | **P0** |
| 3 | CRM & Klantbeheer | Nog te bouwen | **P0** |
| 4 | Projectmodule | Nog te bouwen | **P0** |
| 5 | Planningmodule | Nog te bouwen | **P0** |
| 6 | Urenregistratie | Nog te bouwen | **P0** |
| 7 | HR Module | Nog te bouwen | **P1** |
| 8 | Wagenpark, Materieel & Gereedschap | Nog te bouwen | **P1** |
| 9 | Onderhoudscontracten | Nog te bouwen | **P1** |
| 10 | Garantie & Service | Nog te bouwen | **P2** |
| 11 | Klantportaal | Concept | **P2** |
| 12 | Interne Communicatie | Nog te bouwen | **P2** |
| 13 | Dashboards & Rapportages | Deels aanwezig | **P1** |
| 14 | Boekhoudkoppeling | Nog te bouwen | **P1** |
| 15 | E-mailmodule | Nog te bouwen | **P0** |
| 16 | Smart Operations Dashboard | Nog te bouwen | **P0** |

**P0** = Must-have voor eerste release | **P1** = Tweede fase | **P2** = Derde fase

---

## 5. Technische Randvoorwaarden

### Platformeisen

- Webapplicatie (responsive) voor directie, projectleiders en administratie
- Mobiele app (iOS + Android) voor voormannen en medewerkers in het veld
- Klantportaal als aparte app of progressive web app (PWA)
- Offline-functionaliteit: uren en foto's invoeren zonder internetverbinding, synchroniseren zodra verbinding er is

### Integraties

- Boekhoudpakket (Exact Online / Twinfield / Moneybird)
- Fleet and Go API: live GPS-tracking, kilometerregistratie, rithistorie, brandstofdata
- E-mailservice (SendGrid, Mailgun of Postmark) voor transactionele e-mails met tracking
- SPF/DKIM/DMARC configuratie op domein Top Tuinen voor e-mailbezorgbaarheid
- Weerdata API (KNMI of vergelijkbaar)
- Digitale handtekening (eigen implementatie of koppeling met bijv. DocuSign)
- Bankfeed voor automatische betaalstatusherkenning (optioneel)
- GPS / locatiediensten voor ritregistratie

### Beveiliging & Privacy

- GDPR-compliant: verwerkersovereenkomst, recht op verwijdering, data-export
- SSL/TLS encryptie op alle verbindingen
- Rolgebaseerde toegangscontrole (RBAC)
- Twee-factor authenticatie voor directie/admin accounts
- Automatische sessie-timeout bij inactiviteit
- Dagelijkse backups met 30 dagen retentie

---

## 6. Notities voor Ricardo

### Hero als referentie

Gebruik de Hero-inloggegevens om de volgende functies te bekijken en als inspiratie te gebruiken:

- **Projectstructuur:** hoe zijn projecten opgebouwd met to-do's, documenten en samenwerking?
- **Offerteversies:** hoe worden verschillende versies bijgehouden en welke is definitief?
- **Digitale handtekening flow:** hoe wordt de klant uitgenodigd en wat is de juridische tekst?
- **Permissiemodel:** hoe verschilt de weergave per rol?

### Architectuuroverwegingen

- Ontwerp de API zo dat het klantportaal later zonder grote refactor kan worden aangesloten
- Elke module moet als microservice of losstaand component kunnen functioneren
- Urenregistratie en planning moeten real-time synchroniseren (websockets of polling)
- Foto-uploads moeten gecomprimeerd worden op het device voordat ze worden verzonden
- Offline-queue voor uren en foto's: lokaal opslaan, bij verbinding automatisch synchroniseren

### Data-integriteit principes

- Data wordt eenmaal ingevoerd en stroomt door: offerte → project → factuur → boekhouding
- Verwijderen is nooit definitief: alles krijgt een "soft delete" met mogelijkheid tot herstel
- Elke wijziging wordt gelogd (wie, wat, wanneer) voor audit trail
- Getekende documenten (offertes, meerwerk) zijn onwijzigbaar na ondertekening

---

## 7. Agent Strategie — Parallelle Ontwikkeling

> Gebaseerd op Anthropic's "[Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)" (Nov 2025) — toegepast op het Top Tuinen project.

### Het probleem

Dit project omvat 16 modules die elk complex zijn. Een enkele agent die alles sequentieel bouwt is te traag en verliest context. Anthropic identificeert twee kernproblemen:

1. **One-shotting:** De agent probeert te veel tegelijk, raakt context kwijt, en laat half-af werk achter
2. **Premature completion:** Na een paar features kijkt de agent rond en verklaart het project klaar

### De oplossing: Initializer + Coding Agent patroon

Anthropic's aanpak vertaald naar Top Tuinen:

#### Fase 1: Initializer Agent (eenmalig)

Een initializer agent draait eenmalig en richt de ontwikkelomgeving in:

1. **Feature List (JSON):** Alle 200+ features uit dit scope document worden vertaald naar een `feature_list.json` met testbare stappen. Elke feature start als `"passes": false`. Agents mogen features alleen op `true` zetten, nooit verwijderen of aanpassen.

2. **Progress File:** Een `claude-progress.txt` dat als overdrachts-document dient tussen sessies. Elke agent schrijft aan het einde van zijn sessie: wat is gedaan, wat is de huidige staat, wat moet de volgende agent oppakken.

3. **Init Script:** Een `init.sh` dat de dev-server opstart en een basis end-to-end test draait voordat nieuwe features worden gebouwd. Dit voorkomt dat een agent begint te bouwen op een kapotte codebase.

#### Fase 2: Coding Agents (incrementeel)

Elke coding agent sessie volgt dit protocol:

1. `pwd` — orientatie in de directory
2. Lees `claude-progress.txt` en `feature_list.json`
3. Check git log voor recent werk
4. Draai `init.sh` — bevestig dat de app werkt
5. Kies de hoogste prioriteit feature die nog niet af is
6. Bouw **een feature per sessie** — niet meer
7. Commit met beschrijvende message
8. Update progress file
9. Laat de codebase in een "mergeable" staat achter

### Toepassing: Parallelle Agents per Module-cluster

Waar Anthropic's artikel focust op een enkele agent, schalen wij op met **parallelle agents per onafhankelijk module-cluster**:

```
LEAD AGENT (orchestrator)
├── Agent Cluster A: "Core Flow"
│   ├── Offerte Calculator (afmaken)
│   ├── CRM & Klantbeheer
│   └── Facturatie
│
├── Agent Cluster B: "Operatie"
│   ├── Projectmodule
│   ├── Planningmodule
│   └── Urenregistratie
│
├── Agent Cluster C: "Infra & Communicatie"
│   ├── E-mailmodule
│   ├── Smart Operations Dashboard
│   └── Boekhoudkoppeling
│
└── Agent Cluster D: "Support Modules" (fase 2)
    ├── HR Module
    ├── Wagenpark & Materieel
    └── Onderhoudscontracten
```

**Waarom deze clusters?**
- **Cluster A** deelt het offerte→klant→factuur datamodel. Eenmaal het klantmodel staat, bouwen CRM en Facturatie daar parallel op.
- **Cluster B** deelt het project→planning→uren datamodel. Planning voedt uren, uren voeden nacalculatie.
- **Cluster C** is cross-cutting infra die alle andere modules bedient.
- **Cluster D** is onafhankelijk genoeg om later te starten.

### Coordinator-patronen

Per Anthropic's "Future Work" sectie, gespecialiseerde agents presteren beter op sub-taken:

| Agent Rol | Verantwoordelijkheid |
|-----------|---------------------|
| **Lead / Orchestrator** | Bewaakt `feature_list.json`, wijst werk toe, lost merge-conflicten op, draait integration tests |
| **Module Agent** | Bouwt features binnen een module, commit incrementeel, update progress |
| **Testing Agent** | Draait na elke module-commit de end-to-end tests, rapporteert regressies |
| **QA / Review Agent** | Reviewt code op patronen, consistentie, en adherence aan het scope document |

### Concrete bestanden die we aanmaken

```
.planning/
├── feature_list.json          # Alle features met passes: true/false
├── claude-progress.txt        # Overdrachts-document tussen sessies
├── module-dependencies.json   # Welke modules van welke afhangen
├── init.sh                    # Dev-server + smoke test
└── clusters/
    ├── cluster-a-progress.txt
    ├── cluster-b-progress.txt
    ├── cluster-c-progress.txt
    └── cluster-d-progress.txt
```

### Regels voor agents

1. **Een feature per sessie.** Niet meer. Liever een feature goed dan drie half.
2. **Altijd committen.** Beschrijvende git messages. Nooit een sessie afsluiten zonder commit.
3. **Progress file updaten.** De volgende agent moet binnen 30 seconden weten waar hij aan toe is.
4. **Feature list is heilig.** Je mag alleen `passes` van `false` naar `true` zetten. Nooit features verwijderen of herschrijven.
5. **Init script draaien voor je begint.** Als de app kapot is, fix dat EERST.
6. **Shared interfaces eerst.** Database schema's, API contracts en TypeScript types worden door de Lead vastgesteld voordat module-agents beginnen.
7. **Merge via Lead.** Module-agents werken op eigen branches. De Lead merged naar main na review.

### Risico-mitigatie

| Risico | Mitigatie |
|--------|----------|
| Merge-conflicten tussen clusters | Shared types/schema's worden door Lead beheerd in `packages/shared` |
| Agent bouwt iets dat niet in scope is | Feature list is de enige bron van waarheid — als het er niet in staat, bouw het niet |
| Kwaliteitsverlies door snelheid | Testing Agent draait na elke merge; QA Agent reviewt wekelijks |
| Context-verlies over sessies | Progress files + git log + feature list geven volledige context in < 2 minuten |
| Deadlock tussen afhankelijke modules | Module-dependencies.json definieert volgorde; Lead unblocked waar nodig |

---

*Einde document — LOQIC (c) 2026*
