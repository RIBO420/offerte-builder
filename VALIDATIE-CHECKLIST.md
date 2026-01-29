# Offerte Builder Validatie Checklist

## Phase 6: Testing & Launch

### Systeemvalidatie

#### Build & Types
- [x] TypeScript compilatie zonder fouten
- [x] Next.js build succesvol
- [x] Convex functies gedeployed

---

### Functionele Requirements (uit PRD)

#### FR-01: Scope-selectie met automatische vraagactivering
- [ ] Aanleg: alle 7 scopes selecteerbaar
- [ ] Onderhoud: alle 5 scopes selecteerbaar
- [ ] Bij selectie worden juiste formulieren getoond

#### FR-02: Verplichte afhankelijkheden afdwingen
- [ ] Bestrating → onderbouw verplicht (oranje markering)
- [ ] Houtwerk → fundering verplicht (oranje markering)
- [ ] Elektra → sleuven verplicht wanneer elektra geselecteerd
- [ ] Borders onderhoud → intensiteit verplicht
- [ ] Heggen onderhoud → L×H×B alle drie verplicht

#### FR-03: CSV/XLS import voor prijsdata
- [ ] Prijsboek pagina aanwezig
- [ ] Import functionaliteit (indien geïmplementeerd)

#### FR-04: Verliespercentages, onderlagen, marge doorrekenen
- [ ] Verliespercentage in berekeningen
- [ ] Onderlagen automatisch meegenomen
- [ ] Marge percentage configureerbaar

#### FR-05: Normuren met correctiefactoren
- [ ] Bereikbaarheidsfactor: goed (1.0) / beperkt (1.2) / slecht (1.5)
- [ ] Achterstalligheid: laag (1.0) / gemiddeld (1.3) / hoog (1.6)
- [ ] Snijwerkfactor: laag (1.0) / gemiddeld (1.2) / hoog (1.4)
- [ ] Intensiteitsfactor: weinig (0.8) / gemiddeld (1.0) / veel (1.3)
- [ ] Hoogtecorrectie: >2m = toeslag

#### FR-06: PDF-offertes genereren
- [ ] PDF download knop werkt
- [ ] PDF bevat klantgegevens
- [ ] PDF bevat alle regels
- [ ] PDF bevat totalen met BTW
- [ ] PDF heeft professionele layout

#### FR-07: Standaardtuinen als template
- [ ] Template selector in wizard
- [ ] Systeem templates (aanleg: 3, onderhoud: 3)
- [ ] Pre-fill van scopes en waarden bij selectie
- [ ] Optie "Zelf samenstellen"

#### FR-08: Volume-berekening heggen (L×H×B)
- [ ] Alle drie dimensies verplicht
- [ ] Volume wordt berekend
- [ ] Waarschuwing bij hoogte >2m

#### FR-09: Authenticatie via Clerk
- [ ] Login werkt
- [ ] Registratie werkt
- [ ] User context beschikbaar

#### FR-10: Convex database met realtime sync
- [ ] Offertes worden opgeslagen
- [ ] Data wordt realtime gesynchroniseerd

---

### Testscenario's Aanleg Offertes

#### Test 1: Kleine stadstuin (template)
- [ ] Template selectie werkt
- [ ] Klantgegevens invullen
- [ ] Scopes pre-filled: grondwerk, bestrating, borders, gras
- [ ] Scope details invullen
- [ ] Offerte aanmaken
- [ ] PDF downloaden

#### Test 2: Luxe tuin met alle scopes
- [ ] Alle 7 scopes selecteren
- [ ] Verplichte onderdelen validatie
- [ ] Bestrating met onderbouw
- [ ] Houtwerk met fundering
- [ ] Water/elektra met sleuven
- [ ] Specials toevoegen
- [ ] Offerte aanmaken
- [ ] Totalen correct berekend

#### Test 3: Zelf samenstellen minimaal
- [ ] "Zelf samenstellen" optie
- [ ] Alleen grondwerk selecteren
- [ ] Formulier invullen
- [ ] Offerte aanmaken

---

### Testscenario's Onderhoud Offertes

#### Test 4: Basis onderhoud (template)
- [ ] Template selectie werkt
- [ ] Scopes pre-filled: gras, borders
- [ ] Gras onderhoud formulier
- [ ] Borders onderhoud met intensiteit
- [ ] Offerte aanmaken

#### Test 5: Compleet onderhoud alle scopes
- [ ] Alle 5 scopes selecteren
- [ ] Gras met alle opties
- [ ] Borders met verplichte intensiteit
- [ ] Heggen met L×H×B (validatie)
- [ ] Bomen met hoogteklasse
- [ ] Overige werkzaamheden
- [ ] Achterstalligheid factor toepassen

#### Test 6: Heggen validatie
- [ ] Alleen lengte invullen → onvolledig
- [ ] Lengte + hoogte → onvolledig
- [ ] Lengte + hoogte + breedte → volledig
- [ ] Hoogte >2m → waarschuwing

---

### UI/UX Validatie

- [ ] 4-staps wizard flow (aanleg & onderhoud)
- [ ] Progress indicator werkt
- [ ] Terug navigatie werkt
- [ ] Validatie feedback duidelijk
- [ ] Verplichte velden gemarkeerd (oranje)
- [ ] Mobile responsive

---

### Edge Cases

- [ ] Lege offerte niet mogelijk (minimaal 1 scope)
- [ ] Ongeldige postcode formaat
- [ ] Negatieve waarden
- [ ] Zeer grote waarden

---

## Status

**Datum:** _________________

**Getest door:** _________________

**Resultaat:** [ ] PASSED / [ ] FAILED

**Opmerkingen:**
