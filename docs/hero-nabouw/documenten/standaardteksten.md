# Standaardteksten: eenmalig vaststellen

> **Uitgangspunten:** zie `../README.md`. toptuinen.app bestaat al en staat gedeeltelijk; misschien zitten er in het offerte- of factuurprogramma al teksten. De huidige stack van toptuinen.app is leidend; Ricardo beslist alles.
> **Doel:** elke documentsoort krijgt één vaste inleiding en één vaste afsluiting. Die komen er automatisch in te staan en kloppen altijd, omdat bedragen, data, termijnen, IBAN en contactgegevens uit de instellingen komen en niet in de tekst zijn getypt.

De teksten hieronder zijn een **voorstel**. Ricardo beslist welke versie in de app komt. Waar **[KEUZE]** staat, moet eerst een beslissing worden genomen (zie deel A).

**Over de notatie:**
- `{{...}}` is een placeholder in de notatie van HERO. Ricardo mag de notatie van de app aanhouden.
- Placeholders met **(nieuw)** bestaan niet in HERO en moeten erbij komen.

---

## A. Eerst beslissen (één keer)

| # | Keuze | Nu in HERO | Voorstel |
|---|---|---|---|
| K1 | Hoe lang is een offerte geldig? | **Tegenstrijdig in dezelfde tekst:** "vier weken" en "één maand na offertedatum" | Eén instelling (bijvoorbeeld 30 dagen) → `{{CustomerDocument.valid_until}}` (nieuw) |
| K2 | Betaaltermijn van een factuur | "binnen 5 dagen", in 4 teksten getypt | Eén instelling → `{{CustomerDocument.due_date}}` |
| K3 | Aanhef: "Beste" of "Geachte" | Wisselend: "Geachte mevrouw/heer {achternaam}", "Beste relatie", "Beste," en "{volledige begroeting}" | Overal `{{Customer.title_full_name}},`; de stijl ("Beste" of "Geachte") is één instelling |
| K4 | "u" of "je" | Gemengd ("Je vindt het nieuwe rekeningnummer…") | Overal **u** |
| K5 | Ondertekening | Wisselend: `{{Partner.full_name}}`, "Team Top Tuinen" en een getypte naam | Overal "Met groene groet," + `{{Partner.full_name}}` |
| K6 | De mededeling "nieuw bankrekeningnummer" | Staat in de factuurafsluiting sinds november 2025 | Weghalen. Het IBAN staat in de voettekst en komt uit `{{Company.iban}}` (nieuw) |
| K7 | Algemene voorwaarden | De tekst zegt "als aparte bijlage meegestuurd" | De app voegt de AV **automatisch** toe bij het versturen van een offerte; anders klopt de tekst niet |
| K8 | Termijnen bij aanleg (50/30/20) | Getypt in de offertetekst; termijnfacturen deels met de hand via een artikel | Het termijnschema hoort bij de offerte; de tekst laat het schema zien en de termijnfacturen volgen eruit (zie `DOCUMENTEN-MODULE.md`) |
| K9 | Bestelformulier: bestellen of een prijs aanvragen? | De tekst doet allebei ("…bestellen. Kunt u … een offerte toesturen") | Kies er één, of maak twee aparte teksten |
| K10 | Welke offerte-inleiding? | Er zijn er twee: "Offerte- Inleiding" en "Offerte - Inleiding 2" | Eén houden |

**Nieuwe placeholders die nodig zijn:**

- `{{Company.email}}`: het e-mailadres van het bedrijf. Dat bestaat niet in HERO, daarom is het nu overal getypt.
- `{{Company.iban}}`
- `{{CustomerDocument.valid_until}}`
- `{{Company.payment_term_days}}`: de betaaltermijn in dagen, voor in de offertetekst
- Termijnfacturen: `{{Termijn.omschrijving}}` en `{{Termijn.percentage}}`, en eventueel `{{Offerte.termijnschema}}`

---

## B. Wat er nu mis is

| # | Tekst / type | Probleem | Soort |
|---|---|---|---|
| P1 | Offerte - Afsluiting (aanleg + onderhoud) | Geldigheid tegenstrijdig: "vier weken" en "één maand" | **Fout, kan tot discussie leiden** |
| P2 | Factuur BTW-verlegd (type) | Er hangt **geen standaardtekst** aan, terwijl de tekst "Factuur BTW Verleggen - Afsluiting" wel bestaat. De vermelding moet je dus elke keer zelf toevoegen. | **Risico: een factuur die niet aan de regels voldoet** |
| P3 | Factuur BTW Verleggen - Afsluiting | De woorden "Btw verlegd" en het btw-nummer van de afnemer ontbreken | **Risico (laat de boekhouder dit bevestigen)** |
| P4 | Intracommunautaire levering | Een eenmalige tekst met het btw-nummer van één specifieke klant, getypt; "Totaalbedrag: €" is leeg; de oude IBAN-mededeling staat er ook in. Of deze wettekst klopt voor tuinwerk in België (een dienst bij onroerend goed, geen levering van goederen), weet ik niet zeker. | **Fout + laten checken** |
| P5 | 1e Herinnering (type) | Voorvoegsel van het onderwerp is "**Mahnung Nr.**" (Duits); de herinneringsteksten hangen niet als standaard aan het type | Fout |
| P6 | Factuur - Afsluiting + de tekst "Wij verzoeken u…" | IBAN, telefoonnummer en naam zijn getypt; de mededeling "nieuw rekeningnummer" is verouderd; "je" en "u" door elkaar | Te repareren |
| P7 | Offerte-afsluitingen | Ontbrekende witregel: "…gemeld.Vragen of opmerkingen?" en "betalingstermijnenVoor tuinaanleg" | Te repareren |
| P8 | Orderbevestiging - Afsluiting | Een los aanhalingsteken aan het eind: `Uw handtekening"` | Te repareren |
| P9 | Bestelformulier - Inleiding | Bestellen en een offerte aanvragen in één tekst | Te repareren (K9) |
| P10 | Aanbetaling, Jaarlijkse offerte (types) | Geen standaardteksten | Te repareren |
| P11 | Aanbetaling, Factuur - Onderhoud, BTW-verlegd, Jaarlijkse offerte | Opmaak Klassiek/Arial, terwijl de rest Modern/Calibri is → facturen zien er verschillend uit | Te repareren |
| P12 | Herinnering - "aflsuiting" | Typfout in de titel | Smaak |
| P13 | Offerte-onderhoud (type) | Basistype is "Reparatieopdracht" in plaats van "Offerte" | Te controleren |
| P14 | Aanhef | Vier verschillende stijlen (K3) | Smaak, maar het valt op |
| P15 | Losse teksten | Reparatieorder-afsluiting, Onderhoudsopdracht-inleiding en -afsluiting, "Offerte - Inleiding 2" en "Wij verzoeken u…" hangen aan geen enkel type | Opruimen |

---

## C. Voorstel: de vaste set per documentsoort

### C1. Offerte (aanleg)
**Inleiding**
```
{{Customer.title_full_name}},

Hartelijk dank voor uw offerteaanvraag. Hieronder vindt u onze vrijblijvende offerte en meer informatie over hoe wij te werk gaan.
```
**Afsluiting**
```
Bovenstaande prijzen zijn geldig tot {{CustomerDocument.valid_until}}. Wij hebben er alles aan gedaan om uw wensen en verwachtingen zo goed mogelijk in deze offerte te verwerken. Neem gerust de tijd om alles door te nemen. Schiet u later nog iets te binnen, dan passen wij de offerte graag voor u aan, zodat het voorstel helemaal aansluit bij uw wensen.

Wij hopen dat deze offerte een duidelijk beeld geeft van wat wij voor u kunnen betekenen en kijken ernaar uit om samen aan de slag te gaan.

Met groene groet,

{{Partner.full_name}}

Belangrijke informatie

Neem dit even rustig door. Deze informatie is belangrijk om goed op de hoogte te zijn van onze werkwijze, betaling en planning. Zo zijn er geen verrassingen en is alles duidelijk vóór de start van het project.

Let op: dit is een beknopt overzicht van onze werkwijze. Onze algemene voorwaarden zijn als bijlage meegestuurd en maken deel uit van onze samenwerking.

Offerte en geldigheid
- Deze offerte is geldig tot {{CustomerDocument.valid_until}}.
- Gaat u akkoord? Bevestig dit dan schriftelijk of per e-mail via {{Company.email}}.

Prijsafspraken
- Staan er in de offerte geen uurtarieven vermeld, dan voeren wij de werkzaamheden uit tegen vaste prijzen.
- Deze prijzen blijven ongewijzigd, ook als de uitvoering langer of korter duurt dan ingeschat.
- Facturen worden per e-mail verzonden en dienen binnen {{Company.payment_term_days}} dagen na factuurdatum te worden voldaan, tenzij schriftelijk een andere termijn is afgesproken.

Aanbetaling en betalingstermijnen
Voor tuinaanleg hanteren wij de volgende betalingstermijnen:
{{Offerte.termijnschema}}          ← standaard: 50% na gunning · 30% bij de start · 20% bij oplevering [KEUZE K8]

Planning en weersomstandigheden
- De werkzaamheden worden ingepland onder voorbehoud van gunstige weersomstandigheden.
- Bij onwerkbaar weer behouden wij ons het recht voor de werkzaamheden te verplaatsen naar een later, passend moment.

Bereikbaarheid en voorzieningen op locatie
- Wij vragen u te zorgen voor parkeergelegenheid direct bij de woning en een plek om materialen te lossen en tijdelijk op te slaan. Is dat niet mogelijk, neem dan vooraf contact met ons op.
- Wij gaan ervan uit dat de locatie goed bereikbaar is voor personeel en machines, en dat er water, elektriciteit en sanitaire voorzieningen beschikbaar zijn. Is dat niet zo, stem dit dan vooraf met ons af, zodat we samen een oplossing vinden.

Aansprakelijkheid
- Top Tuinen is verzekerd voor aansprakelijkheid volgens de geldende richtlijnen in de hoveniersbranche.
- Schadeclaims kunnen alleen in behandeling worden genomen als ze binnen 48 uur na oplevering schriftelijk bij ons zijn gemeld.

Vragen of opmerkingen?
Neem gerust contact met ons op via {{Company.default_mobile}} of {{Company.email}}. Wij staan u graag te woord.
```

### C2. Offerte (onderhoud) en Jaarlijkse offerte
**Inleiding:** gelijk aan C1.
**Afsluiting:** gelijk aan C1, met twee verschillen:
- het blok "Aanbetaling en betalingstermijnen" valt weg
- onder Prijsafspraken komt de regel: `Voor onderhoudswerkzaamheden en kleinere opdrachten is geen aanbetaling vereist, tenzij dit vooraf anders met u is afgesproken.`

### C3. Orderbevestiging
**Inleiding**
```
{{Customer.title_full_name}},

Hartelijk dank voor uw opdracht en het vertrouwen dat u in ons stelt. Conform onze offerte {{ReferenceDocument.nr}} leveren wij de volgende diensten en/of producten:
```
**Afsluiting**
```
Wij zorgen voor een zorgvuldige afhandeling en kijken ernaar uit om samen aan de slag te gaan. Gaat u akkoord met deze orderbevestiging? Onderteken deze dan en stuur hem per e-mail of post aan ons terug.

Met groene groet,

{{Partner.full_name}}

________________________        ___________________________
Plaats / datum                  Uw handtekening
```

### C4. Aanbetaling / termijnfactuur (nieuw; nu zonder tekst)
**Inleiding**
```
{{Customer.title_full_name}},

Zoals afgesproken in onze offerte {{ReferenceDocument.nr}} van {{ReferenceDocument.date}} ontvangt u hierbij de factuur voor de termijn "{{Termijn.omschrijving}}" ({{Termijn.percentage}}% van het offertebedrag).
```
**Afsluiting:** gelijk aan C5.

### C5. Factuur (aanleg) en eindfactuur
**Inleiding (factuur)**
```
{{Customer.title_full_name}},

Hartelijk dank voor uw vertrouwen en uw opdracht. Wij hebben met plezier de onderstaande werkzaamheden uitgevoerd en, waar nodig zoals in de offerte aangegeven, machines of materialen geleverd. Hiervoor ontvangt u hierbij de factuur.
```
**Inleiding (eindfactuur)**
```
{{Customer.title_full_name}},

Hartelijk dank voor uw opdracht. Hierbij ontvangt u de eindfactuur voor de werkzaamheden uit offerte {{ReferenceDocument.nr}}. De eerder gefactureerde termijnen zijn hierop in mindering gebracht.
```
**Afsluiting**
```
Wij verzoeken u het factuurbedrag van {{CustomerDocument.brutto}} uiterlijk {{CustomerDocument.due_date}} over te maken op {{Company.iban}} t.n.v. {{Company.name}}, onder vermelding van factuurnummer {{CustomerDocument.nr}}.

Hartelijk dank voor uw opdracht en het vertrouwen.

Vragen of opmerkingen? Neem gerust contact met ons op via {{Company.default_mobile}} of {{Company.email}}.

Met groene groet,

{{Partner.full_name}}
```

### C6. Factuur (onderhoud)
**Inleiding**
```
{{Customer.title_full_name}},

Hartelijk dank voor uw vertrouwen en uw opdracht. Wij hebben met plezier de onderstaande onderhoudswerkzaamheden voor u uitgevoerd. Hiervoor ontvangt u hierbij de factuur.
```
**Afsluiting:** gelijk aan C5.

### C7. Factuur btw verlegd (nu zonder standaardtekst ⚠️)
**Inleiding:** gelijk aan C5 of C6.
**Afsluiting:** eerst de onderstaande regels, daarna de afsluiting van C5.
```
Btw verlegd.
Btw-nummer afnemer: {{Customer.accounting.ust_id_number}}
De btw over deze factuur wordt verlegd naar de afnemer.
```
> Laat de boekhouder de exacte vermelding één keer bevestigen. De app moet bij dit type een **btw-nummer van de klant verplicht** stellen.

### C8. Creditfactuur
**Inleiding**
```
{{Customer.title_full_name}},

Zoals afgesproken ontvangt u hierbij de creditfactuur voor onze factuur {{ReferenceDocument.nr}} van {{ReferenceDocument.date}}.
```
**Afsluiting** [KEUZE: terugbetalen of verrekenen]
```
Het bedrag van {{CustomerDocument.brutto}} wordt binnen {{Company.payment_term_days}} dagen aan u terugbetaald / verrekend met uw openstaande factuur.

Met groene groet,

{{Partner.full_name}}
```

### C9. Herinnering
**Onderwerp:** `Herinnering nr. {{CustomerDocument.nr}}` (nu "Mahnung Nr.")
**Inleiding**
```
{{Customer.title_full_name}},

Onze factuur nr. {{ReferenceDocument.nr}} van {{ReferenceDocument.date}}, ter hoogte van {{ReferenceDocument.brutto}}, had als vervaldatum {{ReferenceDocument.due_date}}. Helaas hebben wij uw betaling nog niet ontvangen.

Wij verzoeken u het openstaande bedrag uiterlijk {{CustomerDocument.current_reminder_interval_end}} over te maken op {{Company.iban}} t.n.v. {{Company.name}}, onder vermelding van het factuurnummer.
```
**Afsluiting**
```
Heeft u inmiddels betaald? Dan kunt u deze herinnering als niet verzonden beschouwen.

Met groene groet,

{{Partner.full_name}}
```

### C10. Bestelformulier (aan de leverancier) [KEUZE K9]
**Inleiding (bestellen)**
```
Geachte heer/mevrouw,

Graag bestellen wij bij u de onderstaande artikelen. Wilt u de bestelling en de leverdatum aan ons bevestigen via {{Company.email}}?
```
**Inleiding (prijsaanvraag), als aparte tekst**
```
Geachte heer/mevrouw,

Graag ontvangen wij van u een vrijblijvende prijsopgave voor de onderstaande artikelen.
```
**Afsluiting**
```
Met vriendelijke groet,

{{Partner.full_name}}
{{Company.name}}
```

### C11. Leveringsbon
**Inleiding**
```
{{Customer.title_full_name}},

Zoals afgesproken leveren wij de volgende goederen bij u af:
```
**Afsluiting**
```
Hierbij bevestig ik dat de goederen correct zijn ontvangen.

__________________________________________________
Datum, naam en handtekening
```

### C12. Werkrapport (nu inactief)
**Inleiding**
```
{{Customer.title_full_name}},

Hieronder vindt u een overzicht van de uitgevoerde werkzaamheden en het gebruikte materiaal:
```
**Afsluiting**
```
Met mijn handtekening bevestig ik de correcte uitvoering van het bovenstaande werk.

__________________________________________________
Datum, naam en handtekening
```

### C13. Bouwplaatsrapport
Advies: maak er **geen tekst** van, maar een formulier waarin de app de velden zelf invult vanuit de planning. Nu staan er lege regels: "Datum: / Locatie: / Team: / Aantal medewerkers: / Uitgevoerde werkzaamheden:". Datum, locatie, team en aantal medewerkers weet het planbord al (zie `../planning/PLANNING-MODULE.md`).

### C14. Meetdocument
**Inleiding:** `{{Customer.title_full_name}},`
**Afsluiting**
```
Voor verdere informatie sta ik graag tot uw beschikking.

Met groene groet,

{{Partner.full_name}}
{{Company.name}}
{{Company.address.full_address}}
```

### C15. Brief en Algemeen
**Inleiding:** `{{Customer.title_full_name}},`
**Afsluiting**
```
Met groene groet,

{{Partner.full_name}}
{{Company.name}}
```

### C16. Wat vervalt of apart moet
- **Intracommunautaire levering:** dit is geen standaardtekst. Het wordt een **wettelijke vermelding die de app automatisch toevoegt** als de klant een bedrijf in een ander EU-land is, met `{{Customer.accounting.ust_id_number}}` en `{{CustomerDocument.brutto}}`. De juiste wettekst stelt de boekhouder vast.
- **Opruimen:** "Offerte - Inleiding 2", "Reparatieorder - afsluiting", "Onderhoudsopdracht - inleiding/afsluiting" (alleen houden als er een onderhoudscontract-document komt) en de losse tekst "Wij verzoeken u vriendelijk…".

---

## D. Huidige teksten in HERO (ter referentie, 20-10-2026)

Opgeslagen voor de migratie. Getypte gegevens heb ik vervangen:

| In HERO staat | Hier vervangen door |
|---|---|
| het telefoonnummer | `<TELEFOON>` |
| het e-mailadres | `<E-MAIL>` |
| het IBAN | `<IBAN>` |
| het btw-nummer van de klant | `<BTW-NR KLANT>` |
| de getypte naam | `<NAAM>` |

De volgorde is die van de lijst in HERO (nieuwste eerst).

**1. Offerte - Afsluiting Top Tuinen - Onderhoud** (gekoppeld aan: Offerte-onderhoud)
Gelijk aan nr. 17, maar zonder het blok "Aanbetaling en betalingstermijnen". Onder Prijsafspraken staat de extra regel: "Voor onderhoudswerkzaamheden en kleinere opdrachten is geen aanbetaling vereist, tenzij dit vooraf anders met u is afgesproken."

**2. Intracommunautaire levering conform Tabel 2** (niet gekoppeld)
> Intracommunautaire levering conform Tabel 2, onderdeel a, post 6, Wet op de Omzetbelasting 1968 ('68') / Artikel 138, lid 1, Richtlijn 2006/112. BTW-nummer vennootschap: `<BTW-NR KLANT>`. BTW-tarief: 0%. Totaalbedrag: €
> Maak het factuurbedrag binnen 5 dagen over naar de hieronder vermelde rekening, onder vermelding van het factuurnummer in de omschrijving van uw betaling.
> Belangrijke mededeling! Vanaf heden maken wij gebruik van een nieuw bankrekeningnummer. Je vindt het nieuwe rekeningnummer onderaan de factuur vermeld. Graag hier voortaan gebruik van maken bij betalingen. IBAN `<IBAN>`
> Bedankt voor uw opdracht & het vertrouwen! Vragen? Opmerkingen? Neem contact met ons op via `<TELEFOON>` of via het bovenstaande e-mailadres. Wij staan u dan met veel plezier te woord.

**3. "Wij verzoeken u vriendelijk het factuurbedrag…"** (niet gekoppeld)
> Wij verzoeken u vriendelijk het factuurbedrag binnen 5 dagen over te maken op onderstaande rekening, onder vermelding van het factuurnummer.
> Hartelijk dank voor het vertrouwen en de fijne samenwerking. We hopen ook in de toekomst weer met plezier voor u aan de slag te mogen.
> Met groene groet, `<NAAM>` | Y. Top Tuinen B.V.

**4. Factuur - Onderhoud - Inleiding Top Tuinen** (gekoppeld aan: Factuur - Onderhoud)
> Geachte mevrouw/heer {{Customer.last_name}},
> Hartelijk dank voor uw vertrouwen en uw opdracht.
> Wij hebben met plezier de onderstaande onderhoudswerkzaamheden voor u uitgevoerd. Hiervoor sturen wij u hierbij de bijbehorende factuur.

**5. Herinnering - Inleiding Top Tuinen** (niet als standaard gekoppeld)
> {{Customer.title_full_name}},
> Onze factuur nr. {{ReferenceDocument.nr}} van {{ReferenceDocument.date}}, ter hoogte van {{ReferenceDocument.brutto}}, had als vervaldatum {{ReferenceDocument.due_date}}. Helaas hebben wij uw betaling nog niet ontvangen.
> De betalingstermijn is inmiddels verstreken. Wij verzoeken u het openstaande bedrag uiterlijk {{CustomerDocument.current_reminder_interval_end}} over te maken naar de hieronder vermelde rekening.

**6. Herinnering - aflsuiting Top Tuinen** (niet als standaard gekoppeld)
> Mocht uw betaling met deze herinnering kruisen, beschouw deze mail dan als niet verzonden.
> Met groene groet, {{Partner.full_name}}

**7. Werkrapport - afsluiting Top Tuinen** (gekoppeld aan: Werkrapport)
> Met mijn handtekening bevestig ik de correcte uitvoering van het bovenstaande werk.

**8. Werkrapport - Inleiding Top Tuinen** (gekoppeld aan: Werkrapport)
> {{Customer.title_full_name}}
> Hieronder vindt u een overzicht van de uitgevoerde werkzaamheden en het gebruikte materiaal:

**9. Factuur BTW Verleggen - Afsluiting - Top Tuinen** (niet gekoppeld ⚠️)
> De ontvanger van de dienst of goederen is verantwoordelijk voor het aangeven en afdragen van de BTW.

**10. Meting - Afsluiting** (gekoppeld aan: Meetdocument)
> Voor verdere informatie sta ik graag tot uw beschikking.
> Met groene groet, {{Partner.full_name}} {{Company.name}} {{Company.address.full_address}}

**11. Meting - inleiding** (gekoppeld aan: Meetdocument)
> {{Customer.title_full_name}},

**12. Inleiding tot creditfactuur** (gekoppeld aan: Creditfactuur)
> {{Customer.title_full_name}},
> Zoals afgesproken ontvangt u hierbij de creditfactuur voor onze factuur {{ReferenceDocument.nr}} van {{ReferenceDocument.date}}.

**13. Leveringsbon - afsluiting Top Tuinen** (gekoppeld aan: Leveringsbon)
> Hierbij bevestig ik dat de goederen correct zijn ontvangen:
> __________________________________________________
> Datum, handtekening

**14. Leveringsbon - Inleiding Top Tuinen** (gekoppeld aan: Leveringsbon)
> {{Customer.title_full_name}}
> Zoals afgesproken leveren wij de volgende goederen bij u af:

**15. Factuur - Afsluiting Top Tuinen** (gekoppeld aan: Factuur - Aanleg, Factuur - Onderhoud)
> Maak het factuurbedrag binnen 5 dagen over naar de hieronder vermelde rekening, onder vermelding van het factuurnummer in de omschrijving van uw betaling.
> Belangrijke mededeling! Vanaf heden maken wij gebruik van een nieuw bankrekeningnummer. Je vindt het nieuwe rekeningnummer onderaan de factuur vermeld. Graag hier voortaan gebruik van maken bij betalingen. IBAN `<IBAN>`
> Bedankt voor uw opdracht & het vertrouwen!
> Vragen? Opmerkingen? Neem contact met ons op via `<TELEFOON>` of via het bovenstaande e-mailadres. Wij staan u dan met veel plezier te woord.

**16. Orderbevestiging - Afsluiting van Top Tuinen** (gekoppeld aan: Orderbevestiging)
> Wij verzekeren u van een zorgvuldige afhandeling en kijken ernaar uit om samen aan de slag te gaan. Als u akkoord bent met deze orderbevestiging, verzoeken wij u deze te ondertekenen en per e-mail of post aan ons te retourneren.
> Hartelijk dank voor uw vertrouwen.
> Met groene groet, {{Partner.full_name}}
> ________________________ ___________________________
> Plaats/datum Uw handtekening"

**17. Offerte - Afsluiting Top Tuinen** (gekoppeld aan: Offerte-aanleg, Calculatie)
> Bovenstaande prijzen zijn geldig tot vier weken na het tot stand komen van deze offerte. Wij hebben er alles aan gedaan om uw wensen en verwachtingen zo goed mogelijk in deze offerte te verwerken. Neem gerust de tijd om alles rustig door te nemen. Mocht u later nog iets te binnen schieten, dan passen wij de offerte uiteraard graag voor u aan, zodat het voorstel helemaal aansluit bij uw wensen.
> Daarnaast hopen wij dat deze offerte goed aansluit bij wat u voor ogen heeft en een duidelijk beeld geeft van wat wij voor u kunnen betekenen. We kijken ernaar uit om samen aan de slag te gaan en uw plannen werkelijkheid te maken.
> Met groene groet, {{Partner.full_name}}
> **Belangrijke Informatie:** Neem dit even rustig door. Deze informatie is belangrijk om goed op de hoogte te zijn van onze werkwijze, betaling en planning. We merken dat veel klanten het prettig vinden om dit vooraf te weten. Want het voorkomt verrassingen en maakt alles duidelijk nog vóór de start van het project. Let op: dit is slechts een beknopt overzicht van onze werkwijze. De volledige algemene voorwaarden zijn als aparte bijlage meegestuurd en maken onderdeel uit van onze samenwerking.
> **Offerte en geldigheid:** – Deze offerte is geldig tot één maand na offertedatum. – Wanneer u akkoord gaat met deze offerte, verzoeken wij u vriendelijk dit schriftelijk of per e-mail te bevestigen via `<E-MAIL>`
> **Prijsafspraken** – Indien in de offerte geen uurtarieven zijn vermeld, voeren wij de werkzaamheden uit tegen vaste prijzen – Deze prijzen blijven ongewijzigd, ongeacht of de uitvoering langer of korter duurt dan vooraf ingeschat. – De facturen worden per e-mail verzonden en dienen binnen 5 dagen na factuurdatum te worden voldaan, tenzij schriftelijk een andere termijn is overeengekomen. – Voor onderhoudswerkzaamheden en kleinere opdrachten is geen aanbetaling vereist, tenzij dit vooraf anders met u is afgesproken.
> **Aanbetaling en betalingstermijnen**Voor tuinaanleg projecten hanteren wij de volgende betalingscondities: – 50% bij aanbetaling na gunning van de werkzaamheden – 30% bij de start van de werkzaamheden – 20% bij oplevering van de werkzaamheden
> **Planning en weersomstandigheden** – De werkzaamheden worden ingepland onder voorbehoud van gunstige weersomstandigheden. – Bij onwerkbaar weer behouden wij ons het recht voor om de werkzaamheden te verplaatsen naar een later, passend moment.
> **Bereikbaarheid en voorzieningen op locatie** – Wij vragen u te zorgen voor parkeergelegenheid direct voor de woning, evenals een plek voor het lossen en tijdelijk opslaan van materialen. – Is dit niet mogelijk, neem dan vooraf even contact met ons op om samen te overleggen. – Wij gaan ervan uit dat de locatie goed bereikbaar is voor personeel en machines. Daarnaast vragen wij de opdrachtgever te zorgen voor basale voorzieningen zoals water, elektriciteit en sanitaire voorzieningen. – Mocht dit niet aanwezig zijn, stem dit dan vooraf met ons af, zodat wij samen naar een passende oplossing kunnen kijken.
> **Aansprakelijkheid** – Top Tuinen is verzekerd voor aansprakelijkheid volgens de geldende richtlijnen binnen de hoveniersbranche. – Eventuele schadeclaims kunnen alleen in behandeling worden genomen indien deze schriftelijk binnen 48 uur na oplevering bij ons worden gemeld.Vragen of opmerkingen? Neem gerust contact met ons op via `<TELEFOON>` of `<E-MAIL>` – wij staan u graag te woord.

**18. Offerte- Inleiding Top Tuinen** (gekoppeld aan: Offerte-aanleg, Offerte-onderhoud, Calculatie)
> Geachte mevrouw/heer {{Customer.last_name}},
> Wij willen u hartelijk bedanken voor uw offerteaanvraag. Hieronder vindt u onze vrijblijvende offerte en natuurlijk ook meer informatie over hoe wij te werk gaan.

**19. Reparatieorder - afsluiting Top Tuinen** (niet gekoppeld)
> Hartelijk dank voor uw opdracht en het vertrouwen dat u in ons stelt. Mocht u nog vragen hebben, dan kunt u natuurlijk altijd contact met ons opnemen. Met groene groet, {{Partner.full_name}}

**20. Bestelformulier - Inleiding Top Tuinen** (gekoppeld aan: Bestelformulier)
> Beste,
> Wij willen graag de volgende artikelen bij u bestellen. Kunt u ons een vrijblijvend prijsoverzicht en een offerte toesturen voor de genoemde artikelen?

**21. Bouwplaatsrapport Top Tuinen** (gekoppeld aan: Bouwplaatsrapport)
> Datum: / Locatie: / Team: / Aantal medewerkers: / Uitgevoerde werkzaamheden:

**22. Onderhoudsopdracht - afsluiting Top Tuinen** (niet gekoppeld)
> Hartelijk dank voor uw opdracht en het vertrouwen dat u in ons stelt. Heeft u vragen over het onderhoud of de verzorging van uw tuin, neem dan gerust contact met ons op. Wij denken graag met u mee. Met groene groet, Team Top Tuinen

**23. Onderhoudsopdracht - Inleiding Top Tuinen** (niet gekoppeld)
> Beste relatie,
> Hartelijk dank voor uw onderhoudsopdracht. Volgens het contract tussen u en {{Company.name}} bieden wij de volgende service: {{Company.name}} verzorgt het onderhoud op de hierboven genoemde locatie. Dit resulteert in de volgende posten:

**24. Factuur - Inleiding Top Tuinen** (gekoppeld aan: Factuur - Aanleg)
> Geachte mevrouw/heer {{Customer.last_name}},
> Hartelijk dank voor uw vertrouwen en uw opdracht.
> Wij hebben met plezier de onderstaande werkzaamheden uitgevoerd en, waar nodig zoals aangegeven in de offerte, machines of materialen geleverd om tot het beste resultaat te komen. Hiervoor sturen wij u hierbij de bijbehorende factuur.

**25. Orderbevestiging - Inleiding Top Tuinen** (gekoppeld aan: Orderbevestiging)
> {{Customer.title_full_name}}
> Hartelijk dank voor uw opdracht en het vertrouwen dat u in ons stelt.
> Conform onze offerte leveren wij de volgende diensten en/of producten:

**26. Introductie - generiek Top Tuinen** (gekoppeld aan: Brief)
> {{Customer.title_full_name}}

**27. Offerte - Inleiding Top Tuinen 2** (niet gekoppeld)
> {{Customer.title_full_name}}
> Hartelijk dank voor uw aanvraag en het vertrouwen in Top Tuinen.
> Wij hebben met zorg een vrijblijvende offerte voor u samengesteld, afgestemd op uw wensen en situatie.
> Hieronder vindt u ons voorstel:

**Titels:** er is 1 titeltemplate, "Tussentitels".
