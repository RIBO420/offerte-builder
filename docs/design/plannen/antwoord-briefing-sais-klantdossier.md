# Antwoord op briefing klantdossier — Top Tuinen OS

**Aan:** Romeo, Remon (SAIS WORKS)
**Van:** Ricardo Bos
**Datum:** 17 augustus 2026
**Betreft:** jullie briefing + prototype `toptuinen-klantdossier-v7.html` van 17 aug

Goed prototype — de indeling, de statusgekleurde tellers en de gesprekslog-flow nemen we vrijwel één-op-één over. Hieronder het technisch plan, de ureninschatting en de antwoorden op jullie hoofdstuk 5.

---

## 1. Technisch plan in het kort

Onze stack: Next.js (App Router) + Convex als backend + Clerk voor auth. Het dossier bestaat grotendeels al als losse componenten (takenlijst met composer, tijdlijn met datumgroepen/filters/zoeken, onderhoud, offertes, facturen); de herindeling is dus vooral het bouwen van het submenu, de statregel en het tabframe, en het verplaatsen van bestaande, geteste onderdelen naar de juiste tab. Nieuw zijn: de instellingen-tab met een echt bewerkformulier, een projecten-per-klant-query, en de hele gesprekslog-keten.

**Gesprekslog:** het "Vastleggen" roept server-side een analyse aan (Claude Haiku, JSON-uitvoer met per taak titel, deadline of null, en confidence; huidige datum gaat mee in de prompt zodat "volgende week dinsdag" klopt). De medewerker vinkt aan, en pas de bevestiging schrijft — in één atomaire operatie — het contactmoment plus de gekozen taken, met koppeling beide kanten op (tijdlijn-entry toont "N taken aangemaakt uit dit gesprek", taak draagt de badge "uit gesprek"). Jullie vastgelegde punten 1 en 2 zitten daarmee in de architectuur zelf: de AI kan alleen vóórstellen, en bij een fout of timeout (±8 s) wordt het gesprek gewoon vastgelegd met de melding dat er niets is herkend.

**Opnamefunctie (fase 2):** opname via de microfoon van het apparaat (MediaRecorder), upload naar onze eigen storage, transcriptie via Deepgram (Nederlands), daarna exact dezelfde analyse en hetzelfde bevestigingsmoment. De opname kan pas starten na een expliciete bevestiging dat de meldingszin is uitgesproken (punt 3). Na een bevestigde transcriptie wordt de audio verwijderd en blijft alleen tekst bewaard; mislukt de transcriptie, dan blijft de audio staan met een duidelijke status zodat het gesprek handmatig gelogd kan worden (punten 4 en 5). Alles valt onder ons bestaande GDPR-verwijderproces, dat opnames en transcripties meeneemt.

**Hoofdstuk 4 nemen we volledig over**, inclusief de typografie: Outfit voor koppen, namen en bedragen en Instrument Sans voor de interface staan app-breed aan — de halfschreef is eruit, zoals jullie voorstelden. Ook de duidelijkere kaartranden met lichte kopbalk en het functioneel-groen-principe zijn overgenomen, app-breed via onze bestaande sectie-primitief.

## 2. Ureninschatting

- **(a) Herindeling + gesprekslog met taakherkenning: 3 bouwdagen.** Fundament (submenu, statregel, opsplitsing van de huidige pagina, tests) ~1 dag; inhoudstabs + instellingen ~1 dag; gesprekslog incl. schema, analyse, bevestigings-UI en tests ~1 dag.
- **(b) Opnamefunctie: 1,5–2 bouwdagen.** Opname-UI met meldingsbevestiging ~0,5 dag; transcriptieketen, foutpaden en audio-opruiming ~1–1,5 dag.

## 3. Antwoorden op jullie hoofdstuk 5

**1. Componentstructuur en routing.** In-page tabs met de tabkeuze in de URL (`/klanten/:id?tab=tijdlijn`). Dat is deeplinkbaar — de Meldingen-module kan straks rechtstreeks naar het juiste tabblad linken — zonder dat we per tab een aparte route met eigen laadcyclus hoeven te onderhouden. We gebruiken hiervoor een hook die al elders in de app draait.

**2. Waar de AI-call hoort.** Server-side in onze Convex-backend; de key komt nooit in de client. Voor getypte gesprekken is een synchrone call met korte timeout genoeg — een queue zou hier alleen vertraging en complexiteit toevoegen. Voor lange transcripties in fase 2 draait de analyse asynchroon na de transcriptie, met een zichtbare status in de UI.

**3. De knip tussen Actueel en de rest.** Eens met jullie redenering: loggen en het resultaat ervan is één workflow, dus Actueel als landingsplek klopt. Ons datamodel bevestigt de indeling verder — taken, tijdlijn, onderhoud, offertes en facturen zijn al gescheiden domeinen bij ons. Eén toevoeging: de tellers in het submenu voeden we uit één verzamelquery in plaats van acht losse, anders flikkert het menu bij het laden.

**4. De opname- en transcriptieketen.** Simpeler dan jullie misschien verwachten: opname → upload naar eigen storage → transcriptie (Deepgram, Nederlands) → zelfde analysepad als getypte tekst. Eén statusveld op het contactmoment ("transcriptie gelukt/mislukt") dekt de foutafhandeling; retries doen we op de transcriptie-call zelf, niet met een aparte job-infrastructuur. Bewaartermijnen: audio direct weg na bevestiging (jullie punt 4), tekst valt onder het klantdossier — definitieve termijnen stemmen we af zodra jullie die hebben.

**5. Wat we zouden schrappen.**
- *Sprekerherkenning:* eens met jullie eigen inschatting — laten we helemaal weg, de tekst is het doel.
- *De klantvoorkeur "gesprekken mogen opgenomen worden":* die schrappen we. Jullie vastgelegde punt 3 eist toch een expliciete bevestiging per opname; een klantbrede toggle ernaast suggereert een toestemming die juridisch per gesprek gemeld moet worden. Eén mechanisme, geen schijnzekerheid.
- *Confidence tonen aan de gebruiker:* we gebruiken de confidence alleen om voorstellen standaard wel/niet aangevinkt te zetten, niet als zichtbaar percentage — dat leest niemand.

**6. Projecten per klant.** Projecten hangen bij ons al aan een klant (inclusief database-index); de tab kan gewoon in deze ronde mee. Alleen de lijst-query moest nog geschreven worden, dat is klein werk.

## 4. Planning

We bouwen (a) deze week; (b) plannen we als aparte ronde direct daarna, zodat het fragielste deel niet de oplevering van de herindeling ophoudt. Zodra (a) live staat krijgen jullie een link om het met echte data te bekijken.

Vragen: je weet me te vinden.

— Ricardo
