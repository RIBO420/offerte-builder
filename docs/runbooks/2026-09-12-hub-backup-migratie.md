# Top Tuinen OS: eigen back-up en herstelcontrole

Bijgestelde opdracht, 12 september 2026: gebruik onze eigen medewerkers, klanten, projecten en planning. HERO en historische gegevensimport uit de andere app zijn niet nodig voor testen of oplevering. De nieuwe connector en bronspecifieke importer zijn uit de actieve app verwijderd. Dit runbook vervangt de eerdere bronimportinstructies; die procedures en API's zijn niet meer beschikbaar.

Er is in deze opruimactie geen back-up, restore, gegevensimport, gegevensverwijdering of productiedeployment uitgevoerd. Bestaande OS-urenbronnen, uitvoeringshistorie, dossiers en bestanden blijven behouden. Een back-up/herstelproef is gewone operationele controle van onze omgeving, geen verplichting om gegevens uit de andere app te migreren.

## Data veilig behouden bij code-sync

De vijf importtabellen (`heroImportRijen`, `heroImportRuns`, `heroKoppelingen`, `hubHistorieBronnen`, `hubHistorieRuns`) zijn op 5 oktober 2026 uit het schema verwijderd. Ze bestonden alleen op de dev-deployment, waren daar aantoonbaar leeg (`npx convex data`) en hebben nooit op productie gestaan.

Code-sync trekt uitsluitend de verwijderde functies/cron in. Wis geen tabellen om de nieuwe app te gebruiken. Een toekomstige expliciete opruimactie kan pas na bewezen leegte of afzonderlijke gecontroleerde archivering. Eigen `urenRegistraties` en `urenSegmenten` blijven beide bestaan; de projecturenbronkeuze voorkomt dubbeltelling.

## Eigen back-up en herstelproef

De lokaal gecontroleerde Convex CLI ondersteunt ZIP-export met `--include-file-storage`; `--env-file` kiest de deployment expliciet. Onderstaande commando's zijn een runbook, geen bewijs van uitvoering. Houd credentials en back-upbestanden buiten Git en gedeelde logs.

1. Leg de toegestane deployment, organisatie, schema/revisie, tijdstip en bevoegde beoordelaar vast. Selecteer de concrete doelomgeving; gebruik een nieuw leeg back-uppad.
2. Maak een snapshot inclusief opslagbestanden en bewaar deze toegangsbeperkt:

```sh
npx convex export --env-file /secure/dev-export.env --path /secure/backups/top-tuinen-os-dev.zip --include-file-storage
shasum -a 256 /secure/backups/top-tuinen-os-dev.zip
```

3. Gebruik voor een herstelproef een afzonderlijke lege tijdelijke ontwikkeldeployment met passende schema/revisie. Controleer dat het restore-envbestand niet naar bestaande dev/productie verwijst:

```sh
npx convex import --env-file /secure/temporary-restore.env /secure/backups/top-tuinen-os-dev.zip
```

Gebruik geen `--replace`, `--replace-all`, `--prod` of `--yes` voor de lege herstelproef. Een vraag om gegevens te overschrijven betekent dat de bestemming opnieuw gecontroleerd moet worden.

4. Vergelijk tabelcounts per organisatie, oorspronkelijke record-ID's en relaties, aantal/bytes/hash van foto's, Clerk-orgscope en representatieve planning-, uren-, dossier- en rapportlezingen. Een subset van JSON-tabellen is geen volledige back-up.
5. Test nieuwe medewerkerflows met eigen geautoriseerde OS-gegevens of afgebakende ontwikkeltestgegevens. Er zijn geen externe profiel-, klant-, planning- of fotomappings nodig.
6. Bij herstelproblemen blijft de bestaande omgeving ongemoeid. Bewaar exportmanifest en foutbewijs; controleer in een nieuwe lege herstelomgeving. Geen generieke rollback/wipe van gedeelde dev of productie.

## Controlebewijs

De actieve eigen domeinregressies omvatten organisatiegrenzen, geselecteerde urenbronnen, archiefbescherming, dagrevisies en idempotentie. De verwijderde HERO- en historische bronimporttests zijn geen oplevergate meer. De huidige testoverdracht en auditmatrix bevatten het actuele code- en toestelbewijs. Deze documentatie claimt geen uitgevoerde productieherstelproef.
