# Toelichting bij het prototype

**Bestand:** `toptuinen-klantdossier-v13.html`
**Voor:** Ricardo
**Van:** SAIS WORKS (Romeo, Remon)
**Datum:** 19 augustus 2026

Open het bestand in de browser en klik er even doorheen. Dit document legt uit wat je ziet, wat de bedoeling erachter is, en wat wel en niet vastligt. Het prototype is gemaakt om gedrag te tonen, niet om code te leveren: alles zit in één HTML-bestand met nepdata.

---

## 1. Wat je ziet als je het opent

Twee schermen, je wisselt links in de zijbalk:

- **Klanten** opent het klantdossier van Romeo Savelberg
- **Mijn dag** opent het werkbord

Alles is klikbaar: taken openklappen, slepen op het bord, gesprekken vastleggen, opnemen, reageren, uren loggen.

---



## 2. Het klantdossier



### Statregel

Vier gekleurde tegels: Openstaand (amber, geld dat binnen moet), Open taken (groen, werk), Offertes (kleibruin, kansen), Laatste contact (donkergroen, relatie). Elke tegel is een knop naar het bijbehorende tabblad. De kleuren zijn geen decoratie: ze zorgen dat je op kleur scant in plaats van op tekst.

### Submenu links

Vier gegroepeerde vakjes, elk met een eigen kader zodat duidelijk is wat bij elkaar hoort:

- **Actueel** (los bovenaan, standaard geopend)
- **Historie**: Tijdlijn, Taken
- **Werk**: Aanleg, Onderhoud
- **Financieel**: Offertes, Facturen
- **Klant**: Bestanden, Instellingen

Tellers zijn statusgekleurd: grijs streepje als er niets is, amber bij iets open, rood bij een factuur ouder dan 30 dagen.

### Actueel

De landingsplek. Bovenaan de kaart **Gesprek vastleggen**, daaronder in twee kolommen de openstaande taken en de laatste contactmomenten. Reden voor die volgorde: loggen en de taken die eruit komen zijn één workflow, die hoort op één scherm.

### Gesprek vastleggen en taakherkenning

Kies een type (Gebeld, Gemaild, Afspraak, Notitie), typ wat er besproken is, klik Vastleggen. Het systeem analyseert de tekst en stelt taken voor met een deadline waar die uit de tekst blijkt. Jij vinkt aan wat klopt.

Probeer bijvoorbeeld: *"mevrouw wil volgende week een schetsontwerp zien, terugbellen over de planning en de offerte voor de vlonder sturen"*.

In het prototype gebeurt dat met simpele patroonherkenning, puur voor het effect. In productie is dit een LLM-call (wij gebruiken zelf de Claude API, klein model volstaat) die JSON teruggeeft met per taak een titel, een deadline of null, en een confidence. Geef de huidige datum mee in de prompt, anders gaat "volgende week dinsdag" mis.

### Opnemen

Knop **Gesprek opnemen** onder het invoerveld. Geen telefonie-integratie: de klant gaat op de luidspreker en de app neemt op via de microfoon. Voordat de opname start toont de app de verplichte meldingszin, en pas na bevestiging loopt de timer. Na stoppen zie je het transcript ter controle plus de herkende taken.

### Taakkaarten

Klik een taak open. Je krijgt toelichting, subtaken met voortgangsbalk, twee rollen (**maakt het** en **checkt het**), status en prioriteit. Ingeklapt zie je status, prioriteit, deadline, subtaakvoortgang en avatars: de maker groen, de checker amber.

De vierde status is bewust toegevoegd: **Klaar, moet gecheckt door [naam]**. Dat is het moment waarop de een klaar is en het bij de ander ligt. Zonder die status verdwijnt dat moment uit beeld.

Iedereen met een account is toewijsbaar, ook admins. Dat is nu niet zo in de app en het blokkeert het gebruik.

### Bestanden

Foto's (met labels Voor, Tijdens, Schets) en documenten in één tabblad. Verstuurde offertes en facturen komen daar automatisch in te staan. Op de telefoon opent de uploadzone de camera.

Naam nog open: wij stellen **Bestanden** voor. Alternatieven die langskwamen: Dossierkast, Bijlagen, Foto's en documenten. Kies wat in de app het beste past.

---



## 3. Het werkbord (Mijn dag)

Dit vervangt de lijstweergave. Het is bedoeld voor de dagelijkse operatie: kleine taken die langs meerdere mensen gaan. Grote strategische zaken horen hier niet in.

### Perspectief (bovenste rij)

- **Ik ben [naam]**: wissel van persoon, het hele bord kantelt mee
- **Van mij**: wat ik zelf moet doen of moet checken
- **Uitgezet door mij**: wat ik aan anderen heb gegeven
- **Alles**: het hele team

Drie verschillende vragen, drie knoppen. Zonder dit onderscheid moet iemand elke keer zelf uitfilteren wat van hem is.

### Verdeel op (tweede rij)

- **Wanneer** (standaard): Vandaag, Morgen, Deze week, Later. Voor dag-tot-dag plannen
- **Wie**: kolom per persoon
- **Status**: Te doen, Bezig, Wacht op check, Klaar
- **Klant**: kolom per klant

Slepen doet wat de indeling suggereert: bij Wanneer verzet je de planning, bij Wie draag je over aan iemand anders, bij Status wijzig je de status. Overdragen zet de stilstandteller terug op nul.

### Dit blijft liggen

De rode kolom links, vastgezet zodat hij blijft staan bij horizontaal scrollen. Hierin komt alles wat vastloopt:

- deadline voorbij
- staat twee dagen of langer te wachten op een check
- drie dagen of langer geen beweging bij iemand anders

Per kaartje staat de reden, bij wie het ligt, en twee knoppen: **Herinneren** (plaatst een reminder als reactie bij de taak) en **Zelf oppakken** (haalt hem naar je toe). Deze taken staan niet dubbel in de gewone kolommen.

In de balk kun je kiezen: **Als kolom** (standaard), **Als balk** bovenaan, of **Verbergen**.

Belangrijk ontwerpprincipe: de teller loopt alleen bij stilstand, niet bij drukte. Een taak die vandaag is uitgezet met een deadline volgende week geeft geen signaal. Anders staat de kolom binnen een week vol en kijkt niemand er meer naar.

### Reacties

Klik een kaartje op het bord en er schuift een paneel open met dezelfde inhoud als de taakkaart, plus een reactieveld. Overleg over een taak hoort bij de taak, niet in WhatsApp.

### Logboek en uren

Rechtsonder loopt een knop mee met je urentotaal. Klik erop, typ wat je gedaan hebt en druk op enter. Zet er `1,5u` of `45m` bij en het telt mee met je dagtotaal. Aan het eind van de dag is er een logboek én een urenstaat, zonder dat iemand een urenformulier heeft ingevuld.

---



## 4. Vormgeving

- **Donkergroene zijbalk** met witte actieve items, wit werkblad rechts. Groen komt van het merk, niet uit een template
- **Kleur heeft betekenis**: groen is werk en afgerond, amber is geld en aandacht, rood is vastgelopen, kleibruin is offertes en documenten
- **Lettertype**: Plus Jakarta Sans, bewust anders dan de website
- Kaartranden zijn duidelijk zichtbaar, elke kaart heeft een lichte kopbalk

De vormgeving is een voorstel. Als iets niet past in je componentenbibliotheek, pas het aan; de structuur en het gedrag zijn wat telt.

---



## 5. Wat vastligt

1. Taken worden nooit aangemaakt zonder bevestiging van de gebruiker
2. Vastleggen blokkeert nooit op de AI: faalt de analyse, dan wordt het gesprek gewoon opgeslagen
3. Geen opname zonder de melding vooraf
4. Opnames en transcripties vallen onder het GDPR-verwijderverzoek; audio weg zodra de transcriptie bevestigd is
5. Faalt de transcriptie, dan blijft de audio bewaard zodat het gesprek handmatig gelogd kan worden
6. Elk tabblad is deeplinkbaar (routes of hash, jouw keuze)
7. "Wacht op check" is een echte status, geen label: er hangen filters en signalering aan

De rest is bespreekbaar.

