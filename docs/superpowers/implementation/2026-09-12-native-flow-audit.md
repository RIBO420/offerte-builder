# Native bereikbaarheid en acceptatie — volledige bronflow

Datum: 12 september 2026. Dit is een code-audit van de Expo-app, geen verklaring dat iedere flow op een toestel is geaccepteerd. De worker-app houdt Home, Uren, Chat en Profiel. Kantoorbeheer en exports blijven in de bestaande webomgeving, met beperkte mobiele kantoorinzage. Canonieke Convex-types worden via `mobile/convex/_generated` uit de root-backend hergebruikt.

| Bron-ID | Native ingang / verwerking | Stand en concrete acceptatie |
|---|---|---|
| F01 | Login: inlogcode, Google, wachtwoord; bestaande Clerk/OrgGate | Wachtwoord toegevoegd; geen publieke registratie. Bewuste auth-equivalent: onze e-mailcode dekt wachtwoordloze toegang; bron-e-maillink wordt niet overgenomen. Eigen Clerk-accounts en UI blijven leidend; geen SDK-migratie alleen voor bronidentieke login. Zie native auth/offline-review. |
| F02 | Eerste interne toegang → introductie; Profiel → Uitleg / Wachtwoord | Eenmalig, overslaan en heropenen gekoppeld aan org+user servervoorkeur en outbox. Wachtwoord instellen/wijzigen via Clerk. HTTP/live-queryrace afgevangen met bevestigde scoped marker. |
| F03 | Profiel en buitenmodus op Uren/werkschermen | Bestaande thema's behouden. Dagvoorkeuren behouden; dark/light/outdoor op toestel controleren. |
| F04 | Profiel → Uitloggen | Bij pending werk waarschuwing, Eerst synchroniseren of uitloggen met behouden outbox. Cache en outbox gebonden aan account+organisatie; niets wordt onder ander account verzonden. Onverzonden werk wordt bewust niet gewist. |
| F05 | Versie in Profiel, VeldScherm foutgrens, native shell | Fout → opnieuw proberen; Profiel → Installeren en bijwerken geeft het bestaande distributiepad en wachtrijcontrole. Geen onbewezen OTA-updater toegevoegd. |
| F06 | Directie → admin; overige beheer web | Alle zeven rollen canoniek, onbekend faalt dicht, klant krijgt geen workerqueries. Activeren/medewerker-ploegbeheer blijft web. |
| F07 | Home/Uren → Planning | Eigen week/dag, vorige/volgende, crew, adres, instructie, taken en werkdag/route openen. Home gebruikt dezelfde eigen dagdata. |
| F08 | Planning → geselecteerde dag; kantoorcontrole dekking | Per gepland werkitem eigen gewerkt-segment → gelogd; eerdere dag zonder eigen werk → gemist; toekomst/vandaag → wachtend. Gemist opent juiste dag om aan te vullen. |
| F09 | Bestaand webplanbord; kantoor Uren → Klusmeldingen → Klus bewerken | Naam/categorie/instructie plus eigen orgklant en uitvoerlocatie. Klantwisseling wist oud adres; concurrency en voor/na-audit. Uitvoeringshistorie/financiële koppelingen beschermen eerdere registraties; afwijkende klant krijgt een nieuwe klus. Geen nieuw native kantoorbewerkingsscherm. |
| F10 | Bestaand webplanbord | Drag/drop en fallback vallen onder webacceptatie. |
| F11 | Bestaand web ploeg/planbordbeheer; dag toont crew | Expliciete bezoektoewijzing en eigen dagbemanning door backend beschermd. |
| F12 | Klus → Route → Check je bus eerst | Suggesties expliciet toevoegen; handmatig machine/materiaal toevoegen. Server bepaalt suggesties en verwijdercapability. Geen voorraadboeking. |
| F13 | Uren → Segment toevoegen / Dagvoorstel → Kluskeuze | Gepland eerst, andere actieve klant zoeken, geplande klus direct kiezen, inline nieuwe klant + echte ongeplande klus met werktype/omschrijving. Online create met stabiele receipt, daarna normale eigen urensegmentoutbox. Archiveren/herstellen blijft kantoor. |
| F14 | Vervallen op gebruikersverzoek | Geen HERO; eigen OS-klanten gebruiken. Toegevoegde connector en review verwijderd. |
| F15 | Vervallen op gebruikersverzoek | Eigen OS-medewerkers/projecten/planning gebruiken; geen externe sync of historische bronimport nodig. |
| F16 | Uren | Dagkiezer, werkblokken, totalen, handmatige registratie. |
| F17 | Uren → Dagvoorstel aanpassen | Alle regels bewerkbaar; atomaire opslag met verwachte dagrevisie en idempotentiesleutel. |
| F18 | Dagvoorstel en handmatige categorieën | Loods/laden/reis/pauze/werk aanwezig, bedrijfstijden blijven leidend. |
| F19 | Dagvoorstel tijdvelden | Begin/eind typen en ±5; begin houdt duur vast; optioneel volgende blokken schuiven. Overlap en daggrenzen blokkeren de wijziging. |
| F20 | Segment toevoegen / dagvoorstel | Indirect zonder fictieve klant; vaste anders-werksoortchips, automatische Tuinaanleg/Tuinonderhoud door server. |
| F21 | Dagvoorstel pauze / segment invoer | Gekozen pauzestart en duur binnen werkblok; werk splitst rond pauze, eindtijd blijft gelijk. Niet genomen pauze kan worden overgeslagen, pauzes verwijderd. Extra blok hierna schuift latere concepten. |
| F22 | Formulier → outbox → server | Dubbele tik, stabiele sleutel, conflictbehoud, accountscope, overlapvalidatie. Bewerkte dagvoorstellen worden met dagrevisie per org+user+datum lokaal bewaard en op heropenen hersteld; Ook de handmatige nieuw/correctie/notitie-sheet bewaart alle invoervelden per org+user+datum+segment. Exacte aanvraag+sleutel worden vóór enqueue bewaard; herstelcontrole via eigen serverreceipt of outbox ruimt bevestigde/pending drafts op en voorkomt dubbele registratie. |
| F23 | Afwijkingsreden in dagvoorstel | Geplande versus werkelijke duur >15 min: reden of expliciete overslag; server controleert. |
| F24 | Uren → segment aanpassen/verwijderen/notitie | Open tijd correctie via outbox+revisie; ingediend alleen notitie; pending waarde expliciet zichtbaar. Losse/alle voorstelbevestiging gebruikt nu dezelfde atomaire outbox. Verwijderen vraagt verbinding en frozen HTTP-auth. |
| F25 | Uren → Dag indienen | Servercheck, eigen queue leeg en live dag+bezoekstatus vereist; expliciete verbindingcheck en frozen HTTP-auth voorkomt uitgestelde indiening onder ander account. Gedeelde antwoorden en persoonlijke delegaties zichtbaar. |
| F26 | Kantoorcontrole mobiel; web daginspector | Mobiele inzage, heropenen/correctie via webkantoor. |
| F27 | Home/Uren → Mijn uren | Week/maand, dagen openklappen, totalen per definitie en werk per klant, laatst geladen periode offline beschikbaar. |
| F28 | Uren → Controle voor je vertrekt → Werk terugmelden | Ja/nee, nee vereist reden; resterende minuten. Los van bestaande complete werkitem/facturatieflow. |
| F29 | Uren → ontbrekend onderdeel → door collega | Persoonlijke delegatie foto/afronding/afvoer/aanhanger, intrekken, shared antwoord blijft zichtbaar. |
| F30 | Uren → Afval meegenomen bij deze klus | Geen/¼/½/¾/vol; aparte afvoerregistratie, geen prijzen op worker UI. |
| F31 | Uren → Terug naar de loods | Geen/leeg/¼/½/¾/vol, fysieke aanhanger en tijd, crew-shared, correctiereden+revisie, meerdere retours, offline. |
| F32 | Klus of bezoek → Foto maken/kiezen | Voor/na, meerdere foto's, duurzame lokale bestandkopie, hash/ticket/upload/checkpoint/link, gedeelde thumbnails, volledige foto en toegestane verwijdering. |
| F33 | Profiel → Foto’s van mijn klussen; Home-fotoactie | Kantoor alle klussen, worker eigen klussen; werkdatum, klant-/kluszoeker, reset, uploader/tijd, volledig openen. |
| F34 | Home → Losse krachten (voorman/kantoor) | Naam/platform, accountloos medewerkerrecord; geen credentials. |
| F35 | Losse krachten → persoon/dag → uren invoeren | Eigen beheerde personen voor voorman; dagrevisie+idempotentie, overlapservercontrole. Deze invoer vraagt nu verbinding. |
| F36 | Kantoorcontrole mobiel + web rapportage | Mobiel datum/status/dekking; vrije perioden/klant/type-filter/exports via web. |
| F37 | Kantoorcontrole / notificatie naar controledatum | Bronstatus en gepland-zonder-uren worden apart getoond. |
| F38 | Kantoorcontrole / web dekkingspaneel | Bezoekdekking niet verward met indienstatus. |
| F39 | Bezoek terugmelding → backend en web planning | Reden/resttijd zichtbaar; bestaande taak-restopdrachtflow behouden. |
| F40 | Meldingen + pushvoorkeuren + serverherinnering | Root-agent beheert notificatiehook en datum-doorklik; geen mobiele cron. |
| F41 | Web Controlekamer export | Salariswerkboek hoort bij kantoor. |
| F42 | Web Controlekamer export | Facturatiewerkboek hoort bij kantoor. |
| F43 | Web exportkeuzes / gedeelde berekening | Geen prijs- of loonbeleid in worker UI. |
| F44 | Web jaarexport | Geen tweede native exportcentrum. |
| F45 | Web exporttemplate validatie | Golden files/capaciteit onder web/backendacceptatie. |
| F46 | Operationele backend runbook/tests | Geen beheerderstransacties of backupdata in native app. |
| F47 | Nood → Protocollen en contacten; Home/Uren → Protocollen | Aanleiding, waarschuwing, stappen, telefoonacties, spoedcontacten, vaste112 fallback behouden. |
| F48 | Web protocol/contactbeheer | Native consumeert gepubliceerde doelgroepen, geen editrechten voor worker. |
| F49 | Protocollen cache + noodfallback | Server filtert actieve doelgroep; laatst geladen cache org+user, live terugtrekking vervangt cache. Offline getoond als opgeslagen versie. |
| F50 | Route → Check je bus eerst | Werkende delta behouden; aangevinkte naam/actor; route pas na verplichte checks. |
| F51 | Mijn uren → Mijn uren delen als CSV | Werkelijke CSV via native deelmenu, gekozen eigen week/maand, klant/werksoort/status/notities en serverminuten. Cache-export expliciet herkenbaar. Kantoor-XLSX blijft bestaande web-exportlaag. |

## Verificatie die al is uitgevoerd

- Native TypeScript met de **canonieke actuele backendtypes**: alle blootgelegde mobile-consumer mismatchen gecorrigeerd (notificatie-ID, Home-projectshape, ontbrekend projecturenobject, projectdatums, optionele teamleden).
- Pure tests: zeven rollen, fail-closed onbekend, Amsterdam-tijden en DST; scoped intro-queryrace; periodegrenzen; draft-duurbehoud, cascade, overlap, gekozen pauze en geen nulduur; CSV Unicode, quoting, minuten en formule-injectie; urenconceptscopecorrectheid en write/delete-races. 46 tests groen op 12 september 2026.
- ESLint op alle nieuw gemaakte native schermen/componenten en gewijzigde auth/roles; afwijkingen in gelijktijdige root-notificatiecode worden door eigenaar opgelost.
- Parent-agent voert Expo-smoke uit. Een geslaagde compile is geen bewijs voor camera/upload, andere rollen, offline herstart of echte OAuth op device.

## Device-acceptatie die expliciet nodig blijft

1. Twee crewleden: één retour invullen, ander ziet zelfde antwoord; tegelijk corrigeren geeft zichtbaar conflict.
2. Offline: voorstel, tijdcorrectie en foto bewaren; kill/restart; juiste account terug; reconnect → precies eenmaal. Wissel organisatie/account voor reconnect → geen cross-account write/read.
3. Drie antwoorden+foto, persoonlijke delegatie en ontbrekende afvoer/retour: dagindienen accepteert/blokkeert dezelfde combinatie als backend.
4. Clerk wachtwoord/code/Google op echte iOS/Android-configuratie, introductie overslaan/afronden/opnieuw, biometrisch uitloggen.
5. Voorman accountloze kracht versus normale accountmedewerker; medewerker kan geen kantooractie uitvoeren.
6. Mijn uren → CSV delen als echt bestand op iOS én Android; gecachte selectie en app/account verlaten tijdens voorbereiding.
7. Andere klant kiezen en nieuwe klant+ongeplande klus maken; retry na onbekende netwerkuitkomst maakt geen duplicate, geselecteerde klus accepteert eigen uren.
8. Kantoor versus worker fotogalerij en ingetrokken protocolcache; geautoriseerde foto verwijderen en upload na onbekende netwerkuitkomst.

Clerk-platformbron: https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options (geraadpleegd 12 september 2026): JavaScript-only custom native email-link flows worden niet ondersteund; native AuthView vereist een development-build.
