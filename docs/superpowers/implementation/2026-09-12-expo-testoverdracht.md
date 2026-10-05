# Top Tuinen Hub — Expo-testoverdracht

Datum: 12 september 2026. Definitieve scope: eigen medewerkers, projecten, klanten en planning; HERO en import uit de bronapp zijn op verzoek uitgesloten. Implementatie in de bestaande Top Tuinen-app, met behoud van de native Home/Uren/Chat/Profiel-navigatie en de bestaande kantoorcomponenten. Uitgevoerd met vier gelijktijdige agents in opeenvolgende werkpakketten: native flows, backend/autorisatie, bronpariteit/exports en integratie/acceptatie.

## Starten en openen

- Expo Go SDK 54: `exp://172.20.10.2:8081` zolang deze ontwikkelserver draait. Telefoon en Mac moeten hetzelfde netwerk gebruiken. Het LAN-adres kan veranderen.
- Kantoor tijdens deze test: <http://localhost:3011/uren>.
- Backend: uitsluitend `dev:affable-rook-669`. Productie is niet gedeployed.
- De iPhone 17 Pro-simulator is ingelogd als Ricardo Bos met medewerkerrol. Het bestaande browseraccount heeft kantoorinzage.

Start vanuit `offerte-builder/mobile`:

```sh
npx expo start --go --lan --port 8081
```

Start kantoor vanuit `offerte-builder`:

```sh
npm run dev -- --port 3011
```

Niet naast een al actieve Next-devserver een tweede server of productiebuild in dezelfde `.next`-map starten.

## Wat is aangesloten

| Onderdeel | Ingang en verwerking |
|---|---|
| Toegang en rollen | Clerk-login, zeven canonieke rollen, eenmalige introductie, profiel en wachtwoordbeheer. |
| Planning en klanten | Eigen dag/weekplanning, gemiste/gelogde bezoeken, bestaande klanten zoeken, inline klant plus echte ongeplande uitvoeringsklus. |
| Uren | Bewerkbaar dagvoorstel, duurbehoud en ±5 minuten, opvolgende blokken meeschuiven, gekozen pauzes splitsen, laden/loods/reis/werk/anders met werksoorten. |
| Concepten en correcties | Dagvoorstel en handmatige urenconcepten per gebruiker/organisatie/datum, revisies, blijvende outbox, idempotente verwerking en zichtbare conflicten. |
| Vertrekcontrole | Foto, werk af/niet af met reden/resttijd, afval per klus, persoonlijke overdracht aan collega en gedeelde antwoorden. |
| Aanhanger | Fysieke aanhanger, geen/leeg/¼/½/¾/vol, vooraf gekozen gereserveerde aanhanger, tijdstip, correctie met reden en meerdere retours. |
| Foto's | Camera/systeempicker, voor/na, duurzame lokale kopie, uploadcheckpoint, gedeelde galerie, zoeken en toegestane verwijdering. |
| Materialen | Suggesties uit 33 bronregels plus beheerbare regels, handmatige benodigdheden, checklist en bestaande bus-/routecontrole. Geen automatische voorraadboeking. |
| Losse krachten | Accountloze persoon, naam/platform, eigen ureninvoer door bevoegde voorman/kantoor. |
| Overzichten | Eigen week/maand en klanttotalen, CSV via native deelmenu, CSV/XLSX op web. |
| Kantoor | Indiening afzonderlijk van klusdekking, vrije periode en medewerker/klant/categorie/statusfilters, daginspectie, klusmeldingen/foto's/retours, ploegbeheer en klant-/locatie-/instructiebewerking met historiebescherming. |
| Excel | Salaris-, facturatie- en jaarsjablonen, willekeurige meerkeuze van medewerkers/klanten, inhoudskeuzes, klantgebonden pauzeverdeling en afvoer per klus. Originele formules/opmaak behouden. |
| Urenbron | Eén expliciete bron per project; gemengde historische en nieuwe registratie wordt als conflict behandeld. Kosten-, dashboard- en exportconsumenten gebruiken dezelfde keuze. |
| Protocollen | Doelgroepen, versies, contactnummers, spoedcontacten en beschikbare offline versie. Kantoor beheert inhoud. |
| Herinneringen | Kantoor stelt dagen, Amsterdam-tijd en ontvangers in; één in-app samenvatting bij open/deels ingediende uren, optioneel e-mail achter bestaande verzendbeveiliging. Default inactief. |

Aanhangervulling bij terugkomst en afval dat bij een klant is meegenomen zijn twee verschillende registraties. Een fysieke retour verandert geen voorraad, nacalculatie of factuur. Afvoerbedragen vragen een bewust ingesteld tarief of kantoorcorrectie; er is geen ongeverifieerd brontarief als standaard overgenomen.

## Herkenbare testgegevens

Alleen in de ontwikkelomgeving aangemaakt via de idempotente interne `hubTestSeed:maak`:

- Werkdag: **12 september 2026**.
- Klant: **Expo testtuin**, Teststraat 1, Testdorp.
- Klus: **Expo integratietest · 2026-09-12**.
- Ploeg: **Expo testploeg**.
- Aanhanger: **Test Aanhanger · EXPO-TEST**.
- Protocol: **Expo — app gebruiken**.
- Foto: het bestaande groene Top Tuinen-appicoon is als testbestand aan de simulator toegevoegd.

De fixture wijzigt geen accountrollen of bestaande medewerkers. De aangemaakte fixture-records staan in `demoSeed` met `geseedOp = 1789218072654`; later via de UI gemaakte registraties zijn afzonderlijke devgegevens. Gebruik niet de algemene `seed:clear` om alleen deze test op te ruimen: die raakt ook andere demo-invoer. De interne helper `hubTestSeed:controle` kan de dag van het gekoppelde testaccount uitlezen zonder auth-tokens te tonen.

## Reeds zichtbaar gecontroleerd

1. Expo bundelt en opent in de iPhone-simulator met bestaande Clerk-medewerkerlogin.
2. Introductie overslaan werkt en keert niet bij elke realtime-queryupdate terug.
3. Home en Uren tonen de toegewezen testklus.
4. Gereserveerde testaanhanger wordt vooraf gekozen. **½ vol** is opgeslagen, zichtbaar met melder/tijd, en de gedeelde aanhangercontrole herkent de melding.
5. +5 op werkbegin verandert 08:00–10:00 in 08:05–10:05; terugreis schuift naar 10:05–10:25.
6. Gekozen pauze 09:00–09:15 splitst werk in 08:05–09:00 en 09:15–10:05. Het voorstel met vijf segmenten is via de outbox opgeslagen.
7. Kantoor toont dezelfde dagtotalen: **2:40 geregistreerd, 1:45 klantwerk en 0:15 pauze**. De klusdekking verandert van één ontbrekende registratie naar nul; de dag blijft open tot indienen.
8. Werkterugmelding **af** is opgeslagen als bezoekantwoord. Dit start geen offerte-/facturatieproces.
9. De galerijkeuze opent de beperkte iOS-systeempicker met “Private Access to Photos”; vooraf volledige galerijtoegang vragen is verwijderd.
10. Kantoor toont dezelfde retour **Test Aanhanger (EXPO-TEST) · ½ vol**, melder en tijd. De bezoekcontrole toont exact de nog ontbrekende foto/afvoer.
11. Kantoorfilter **Werken** geeft twee registraties met samen **1:45**. De salarisexport verwerkt de devdata en toont de succesmelding; de daadwerkelijke bestanddownload kon niet door de browserbediening worden bevestigd en blijft een acceptatiepunt.

12. Na de echte iOS-uploadproef zijn twee fouten hersteld: de native hashfunctie krijgt nu bytes in een TypedArray; de server vergelijkt het waargenomen base64-opslagdigest correct met het hex-uploadticket. Exacte bestandsbinding blijft verplicht. Dezelfde bewaarde nafoto is daarna succesvol gekoppeld, zonder opnieuw kiezen of verlies van het checkpoint.
13. De wachtende afvalmelding **Geen** is daarna automatisch verwerkt. De wachtrij is leeg en het bezoek toont **Bezoekmelding compleet**.
14. Een nieuwe **voorfoto** is met de definitieve uploadcode succesvol opgeslagen. Beide foto's openen op de iPhone en zijn bij kantoor zichtbaar met fase, melder en tijd. De sluitknop is visueel gecontroleerd buiten de iPhone-statusbalk.
15. **Dag indienen → Dien in** dient vijf segmenten in. Native toont **Ingediend**, verbergt tijdwijzigen/verwijderen/opnieuw-indienen en laat de bedoelde notitiecorrectie staan. Kantoor toont dezelfde vijf ingediende registraties.
16. Gedeelde bezoekmeldingen en aanhangerretours blijven aanvulbaar na urenindiening, overeenkomstig de bron. De tekst is verduidelijkt: de **uren** staan op slot. Correcties blijven geautoriseerd en gelogd.
17. **Mijn uren delen als CSV** opent het echte iOS-deelmenu met een bestand van **770 bytes**. Het bestand is uitgelezen: vijf registraties, 160 minuten, juiste klant/werk/pauze/reis en geen dubbelen.
18. Kantoor **Klus bewerken** toont eigen klant en eigen uitvoerlocatie. Bij deze uitgevoerde testklus zijn beide correct geblokkeerd met uitleg over het behouden van historie. Wijzigingen vóór uitvoering, andere organisatie, revisies en financiële koppelingen zijn automatisch getest.
19. Kantoor biedt nu zoekbare meerkeuze voor medewerkers en klanten. Salaris heeft alleen medewerkerselectie; facturatie en jaar ondersteunen beide. De echte sjabloonregressies controleren deelverzamelingen en volledige dagtoerekening vóór klantfiltering.

## Eindcontrole

- Volledige Vitest-suite: **194 testbestanden, 4.653 tests geslaagd** (`/private/tmp/toptuinen-final-suite-v2.log`).
- Native React lifecycle-suite: **7 tests geslaagd**, waaronder meerdere mounts, herstart/retry en account-/organisatiewissel (`/private/tmp/toptuinen-final-native-lifecycle.log`).
- Hermes-runtimecontrole: geslaagd, zonder Node Buffer; Unicode, JWT, blijvende queue, herstart en identieke retry. De native opslagbrug is hier gemockt (`/private/tmp/toptuinen-final-hermes.log`).
- Web/backend en native TypeScript: geslaagd (`/private/tmp/toptuinen-final-root-types.log`, `/private/tmp/toptuinen-final-native-types.log`).
- Volledige web- en native ESLint: **0 fouten**, één bestaande webwaarschuwing in `bestanden-tab.tsx` over een `<img>`.
- `git diff --check`: geslaagd.
- Definitieve Expo iOS-export: geslaagd; Hermes-bundle **8,51 MB** plus assets in `/private/tmp/toptuinen-expo-ios-final` (`/private/tmp/toptuinen-expo-ios-final.log`). Dit is geen ondertekende distributiebuild.
- Eindversie gesynchroniseerd naar Convex **development**, 12 september 2026 om **16:23:35 Amsterdam**.

## Aanvullende acceptatie vóór brede ingebruikname

- Twee ingelogde crewleden: antwoord delen en gelijktijdige correctie met zichtbaar revisieconflict.
- Offline bewaren → app sluiten/heropenen → opnieuw verbinden; precies één registratie/foto. Account/organisatie wisselen vóór reconnect mag nooit oude data onder de nieuwe identiteit tonen of versturen.
- Persoonlijke CSV en deelmenu op Android; de iOS-simulatorproef is geslaagd.
- Een gegenereerd kantoor-XLSX-bestand daadwerkelijk openen in Excel en de devtotalen controleren. Sjabloonformules en behouden ZIP-onderdelen zijn al automatisch getest.
- Camera op een echt toestel; Google/code/wachtwoord, notificatievoorkeuren, buitenmodus en routeactie.

Deze aanvullende proeven betreffen echte apparaten, meerdere live sessies en operationele providers. De functie-implementatie en Expo-testversie zijn gereed; dit is geen verklaring dat alle toestellen of productie-inrichting al zijn gecertificeerd.

## Inrichting en ingebruikname

- **Eigen gegevens:** de bestaande medewerkers, projecten, klanten en planning zijn leidend. HERO-functies, instellingen, cron en bronappimport zijn verwijderd. De vijf importtabellen zijn op 5 oktober 2026 ook uit het schema verwijderd.
- **Bestaande uren:** de eigen legacyregistraties en expliciete urenbron per project blijven beschermd tegen dubbel tellen. Er is geen import uit de andere app nodig of uitgevoerd.
- **Push:** remote push vraagt een eigen development-/releasebuild; Expo Go is daarvoor niet de acceptatieomgeving.
- **Eigen authenticatie:** Clerk-code, Google en wachtwoord behouden. Dit vervult de toegang zonder de magic-linktechniek van de bronapp over te nemen; geen auth-SDK-migratie of andere werknemersadministratie nodig.
- **E-mailherinnering:** opt-in per organisatie; provider/geverifieerde afzender en bestaande `EMAIL_VERZENDEN_ACTIEF`-beveiliging zijn vereist. Tijdens deze uitvoering is geen mail verzonden.

## Onderliggende scope en bewijs

- [Definitieve status van alle 51 flows](2026-09-12-hub-eindstatus-f01-f51.md).

- [Volledig integratieplan en broninventaris F01–F51](../plans/2026-09-12-toptuinen-hub-integratieplan.md).
- [Native bereikbaarheid en flow-audit](2026-09-12-native-flow-audit.md).
- [Urenbron-, materiaal- en exportmatrix](2026-09-12-hub-urenbron-en-export-matrix.md).
- [Eigen backup- en herstelrunbook](../../runbooks/2026-09-12-hub-backup-migratie.md).

Geen commit, push of productiedeployment uitgevoerd. Bestaande gebruikerswijzigingen, waaronder `next.config.ts`, zijn behouden.
