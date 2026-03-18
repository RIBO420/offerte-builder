# Offerte Builder UX Verbeterplan

> Status: Ready for execution
> Datum: 2026-03-18
> Scope: 40 verbeteringen verdeeld over 6 fasen, uitvoerbaar met parallel agent teams

---

## Fase 1: Kritieke Workflow Fixes (Security-net)

> Doel: Voorkom fouten en dataverlies in de dagelijkse offerte workflow
> Agents: 4 parallel
> Geschatte bestanden: ~8

### 1.1 Bevestigingsdialogen bij statuswijzigingen
- **Bestand:** `src/app/(dashboard)/offertes/[id]/page.tsx` (~regel 450)
- **Taak:** Voeg AlertDialog toe voor alle status transitions, met extra waarschuwing bij "verzonden" (niet terug te draaien)
- **Acceptatiecriteria:** Elke statuswijziging toont bevestiging met huidige → nieuwe status, "Verzonden" toont extra waarschuwing

### 1.2 Scopes wijzigen in stap 2-3 van wizard
- **Bestanden:** `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx`, `src/app/(dashboard)/offertes/nieuw/aanleg/components/AanlegScopeDetailsStep.tsx`
- **Taak:** Voeg floating "Scopes wijzigen" knop toe op stap 2-3 die een modal opent met scope toggles, zonder bestaande scope data te verliezen
- **Acceptatiecriteria:** Scope toevoegen/verwijderen mogelijk zonder terug te gaan naar stap 1, bestaande data behouden

### 1.3 Auto-save indicator verbeteren
- **Bestanden:** `src/app/(dashboard)/offertes/nieuw/aanleg/page.tsx`, `src/hooks/use-auto-save.ts`
- **Taak:** Vervang kleine "Auto-save aan" tekst door: (a) toast bij succesvol opslaan, (b) zichtbare "Opgeslagen om HH:MM" badge in header, (c) waarschuwing bij navigeren met unsaved changes
- **Acceptatiecriteria:** Gebruiker ziet altijd of werk is opgeslagen, krijgt waarschuwing bij weggaan

### 1.4 Handmatige vs berekende regels visueel onderscheiden
- **Bestand:** `src/components/offerte/sortable-regels-table.tsx` (~regel 50-80)
- **Taak:** Voeg icoon toe naast omschrijving: rekenmachine-icoon voor auto-berekend, pen-icoon voor handmatig. Toon tooltip met uitleg.
- **Acceptatiecriteria:** Gebruiker ziet direct welke regels handmatig zijn en welke automatisch berekend

---

## Fase 2: Prijsinzicht & Scope Forms (Kwaliteit)

> Doel: Consistent prijsfeedback en betere begeleiding in alle 7 scope formulieren
> Agents: 3 parallel
> Geschatte bestanden: ~7

### 2.1 PriceEstimateBadge toevoegen aan houtwerk + water-elektra
- **Bestanden:** `src/components/offerte/scope-forms/houtwerk-form.tsx`, `src/components/offerte/scope-forms/water-elektra-form.tsx`
- **Taak:** Voeg PriceEstimateBadge toe in CardHeader (zoals grondwerk-form regel 91-94). Houtwerk: gebruik afmeting als proxy. Water-elektra: gebruik aantalPunten + verlichting.
- **Acceptatiecriteria:** Beide forms tonen live prijsindicatie bij wijzigingen

### 2.2 Help text en tooltips uitbreiden
- **Bestanden:** `src/components/offerte/scope-forms/grondwerk-form.tsx` (regel 145-147), `src/components/offerte/scope-forms/houtwerk-form.tsx` (regel 197-201), `src/components/offerte/scope-forms/water-elektra-form.tsx` (regel 147-149)
- **Taak:** Voeg LAAG_TOOLTIPS-stijl tooltips toe (zoals bestrating-form regel 90-99). Grondwerk: diepte impact uitleg. Houtwerk: funderingstype uitleg. Water-elektra: punt-dichtheid en kabelkosten.
- **Acceptatiecriteria:** Elke technische keuze heeft een tooltip met impact-uitleg

### 2.3 Water-elektra auto-toggle feedback + conditionele animaties
- **Bestanden:** `src/components/offerte/scope-forms/water-elektra-form.tsx` (regel 77-81), `src/components/offerte/scope-forms/bestrating-form.tsx`, `src/components/offerte/scope-forms/gras-form.tsx`
- **Taak:** (a) Toon toast/badge wanneer sleuven automatisch ingeschakeld wordt: "Sleufwerk ingeschakeld (verplicht voor elektra)". (b) Voeg CSS transition (200ms) toe aan conditionele Card componenten in bestrating en gras forms.
- **Acceptatiecriteria:** Automatische veldwijzigingen zijn zichtbaar, conditionele secties schuiven soepel in/uit

---

## Fase 3: PDF & Email Professionalisering

> Doel: Professionelere offerte-uitstraling naar klanten
> Agents: 4 parallel
> Geschatte bestanden: ~8

### 3.1 PDF preview modal
- **Nieuw bestand:** `src/components/offerte/pdf-preview-modal.tsx`
- **Wijzig:** `src/components/pdf/pdf-download-button.tsx`, `src/components/offerte/send-email-dialog.tsx`
- **Taak:** Maak een modal die de PDF toont als embedded preview (via blob URL). Toon "Bekijk PDF" knop naast download. Integreer in send-email-dialog zodat gebruiker PDF ziet voor verzending.
- **Acceptatiecriteria:** PDF preview zichtbaar in modal voor downloaden EN voor email verzenden

### 3.2 Bedrijfslogo in PDF + CONCEPT watermark
- **Bestanden:** `src/components/pdf/offerte-pdf.tsx`, `src/components/pdf/pdf-styles.ts`
- **Taak:** (a) Voeg bedrijfslogo toe in PDF header (gebruik logoUrl uit bedrijfsinstellingen of fallback naar tekst). (b) Toon "CONCEPT" watermark diagonaal op PDF wanneer offerte.status !== "verzonden"/"geaccepteerd".
- **Acceptatiecriteria:** Logo zichtbaar in PDF header, drafts hebben duidelijk CONCEPT watermark

### 3.3 Persoonlijk bericht bij email + CC support
- **Bestanden:** `src/components/offerte/send-email-dialog.tsx`, `src/components/email/offerte-email.tsx`, `src/app/api/email/route.ts`
- **Taak:** (a) Voeg textarea toe: "Persoonlijk bericht (optioneel)" max 500 tekens, wordt opgenomen in email body. (b) Voeg optioneel CC veld toe voor interne medewerkers. (c) Sla custom bericht op in emailLogs.
- **Acceptatiecriteria:** Gebruiker kan persoonlijke tekst toevoegen, CC medewerker, bericht wordt opgeslagen

### 3.4 PDF download op publieke offerte pagina + vervaldatum countdown
- **Bestanden:** `src/app/(public)/offerte/[token]/page.tsx`, `convex/publicOffertes.ts`
- **Taak:** (a) Voeg PDF download knop toe op publieke pagina (met watermark "NIET GEACCEPTEERD" tot acceptatie). (b) Toon countdown badge: ">7 dagen: groen, <7: oranje, <1: rood" met exacte vervaldatum.
- **Acceptatiecriteria:** Klant kan PDF downloaden, ziet duidelijk wanneer offerte verloopt

---

## Fase 4: Lijst & Dashboard Optimalisatie

> Doel: Snellere dagelijkse workflow voor offertes beheren
> Agents: 4 parallel
> Geschatte bestanden: ~6

### 4.1 Inline status wijzigen vanuit lijst
- **Bestand:** `src/app/(dashboard)/offertes/page.tsx` (~regel 247-295)
- **Taak:** Vervang status badge in tabel door klikbare dropdown die directe statuswijziging toelaat (met bevestiging uit fase 1.1). Toon alleen geldige volgende statussen.
- **Acceptatiecriteria:** Status wijzigbaar met 2 klikken vanuit lijst, zonder offerte te openen

### 4.2 Sticky totaalprijs + totaalwaarde metrics
- **Bestand:** `src/app/(dashboard)/offertes/[id]/page.tsx` (~regel 330, 651-680)
- **Taak:** (a) Maak totaalprijs sticky in header/breadcrumb area: "€15.250 incl. BTW" altijd zichtbaar. (b) Op lijst pagina: voeg stats rij toe boven tabs met: totale waarde, gemiddelde offerte waarde, conversieratio.
- **Acceptatiecriteria:** Totaalprijs altijd zichtbaar op detail pagina, overzichtsmetrics op lijst pagina

### 4.3 Zoeken uitbreiden + tab scrolling
- **Bestanden:** `src/components/offerte/filters.tsx`, `src/hooks/use-offertes.ts`, `src/app/(dashboard)/offertes/page.tsx`
- **Taak:** (a) Breid zoeken uit naar: klant adres, plaats, email, telefoonnummer. (b) Maak tab bar horizontaal scrollbaar op mobiel met overflow-x-auto.
- **Acceptatiecriteria:** Zoeken vindt offertes op alle klantvelden, tabs scrollen op kleine schermen

### 4.4 Card view voor tablets
- **Nieuw bestand:** `src/components/offerte/offerte-card.tsx`
- **Wijzig:** `src/app/(dashboard)/offertes/page.tsx`
- **Taak:** Maak card component met: nummer + klant (groot), bedrag (groen), status badge, actie knoppen. Toon card view onder 1024px breedte, tabel view daarboven. Toggle knop voor voorkeur.
- **Acceptatiecriteria:** Op tablet zichtbaar als kaarten, op desktop als tabel, voorkeur onthouden

---

## Fase 5: Klantervaring & Conversie

> Doel: Hogere acceptatieratio door betere klantervaring
> Agents: 3 parallel
> Geschatte bestanden: ~6

### 5.1 Digitale handtekening bij acceptatie
- **Bestanden:** `src/app/(public)/offerte/[token]/page.tsx`, `convex/publicOffertes.ts`
- **Taak:** Voeg signature pad toe (canvas-based) in het acceptatie-dialoog. Sla handtekening op als base64 image in customerResponse. Toon handtekening op bevestigingspagina.
- **Acceptatiecriteria:** Klant kan digitaal tekenen bij acceptatie, handtekening opgeslagen en zichtbaar

### 5.2 Follow-up reminder automatisering
- **Bestanden:** `convex/publicOffertes.ts`, `convex/notifications.ts`, nieuw: `convex/offerteReminders.ts`
- **Taak:** Voeg followUpSchedule veld toe aan offerte schema. Automatische herinnering email na 7 dagen als niet bekeken, na 14 dagen als bekeken maar niet gereageerd. Configureerbaar per offerte.
- **Acceptatiecriteria:** Automatische herinneringen worden verstuurd volgens schema, admin kan schema aanpassen

### 5.3 Klant engagement timeline
- **Nieuw bestand:** `src/components/offerte/engagement-timeline.tsx`
- **Wijzig:** `src/app/(dashboard)/offertes/[id]/page.tsx`
- **Taak:** Toon activiteiten feed op detail pagina: "14:30 - Email verstuurd → 16:45 - Bekeken door klant → Volgende dag 09:00 - Geaccepteerd met opmerking". Combineer data uit emailLogs, publicOffertes views, en responses.
- **Acceptatiecriteria:** Volledige tijdlijn zichtbaar op offerte detail, alle interacties chronologisch

---

## Fase 6: Edit Flow & Geavanceerde Features

> Doel: Sneller bewerken voor power users
> Agents: 3 parallel
> Geschatte bestanden: ~5

### 6.1 Inline regel editing
- **Bestanden:** `src/app/(dashboard)/offertes/[id]/bewerken/page.tsx`, `src/components/offerte/sortable-regels-table.tsx`
- **Taak:** Voeg dubbelklik-to-edit toe op tabel cellen (omschrijving, hoeveelheid, prijs). Enter bevestigt, Escape annuleert. Tab navigeert naar volgende cel. Behoudt modal als fallback voor complexe edits.
- **Acceptatiecriteria:** Snelle edits mogelijk met dubbelklik, keyboard navigatie werkt, modal nog beschikbaar

### 6.2 Versiegeschiedenis zichtbaarder maken
- **Bestand:** `src/app/(dashboard)/offertes/[id]/page.tsx` (~regel 400-410)
- **Taak:** Toon "v2 · bijgewerkt 3 dagen geleden door Jan" onder offertenummer, klikbaar naar history pagina. Voeg "Laatst gewijzigd" kolom toe aan offerte lijst.
- **Acceptatiecriteria:** Versie info direct zichtbaar zonder menu, klikbaar naar volledige historie

### 6.3 Bulk actie preview + "Select by filter"
- **Bestand:** `src/app/(dashboard)/offertes/page.tsx` (~regel 973-1011)
- **Taak:** (a) Toon preview voor bulk status wijziging: "3 offertes: Concept → Verzonden". (b) Voeg "Selecteer alle zichtbare" en "Deselecteer" knoppen toe. (c) Bewaar huidige sorteer volgorde in CSV export.
- **Acceptatiecriteria:** Gebruiker ziet preview voor bulk acties, kan snel alles selecteren/deselecteren

---

## Agent Team Verdeling

| Fase | Agents | Bestandsgrenzen | Afhankelijkheden |
|------|--------|-----------------|------------------|
| 1 | 4 parallel | Geen overlap | Geen |
| 2 | 3 parallel | Scope forms (elk eigen form) | Geen |
| 3 | 4 parallel | PDF, email, public page (gescheiden) | Geen |
| 4 | 4 parallel | Lijst page, detail page, filters, nieuw card component | Fase 1.1 (bevestigingsdialoog) |
| 5 | 3 parallel | Public page, convex reminders, timeline component | Fase 3.4 (public page wijzigingen) |
| 6 | 3 parallel | Edit page, detail page, lijst page | Fase 4.1 (inline status) |

## Uitvoeringsregels

1. **Bestandsgrenzen zijn strict** — geen twee agents wijzigen hetzelfde bestand
2. **Lees eerst, schrijf dan** — elk agent leest bestaande patterns voor het wijzigen
3. **TypeScript moet compilen** — elke fase eindigt met `npm run typecheck`
4. **Nederlandse UI teksten** — alle gebruikersgerichte tekst in het Nederlands
5. **shadcn/ui componenten** — gebruik bestaande UI library, geen custom CSS
6. **Convex patterns volgen** — mutations met auth checks, queries met indexes
7. **Fase 4-6 starten pas na succesvolle typecheck van vorige fase**
