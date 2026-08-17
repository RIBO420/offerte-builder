# ADD-ON PRD — Calculatie, Planning & Nacalculatie

**Project:** Top Tuinen  
**Module:** Add-on bovenop Offertebuilder  
**Status:** Losse uitbreiding (niet kern V1 offertebuilder)

---

## DOEL VAN DEZE ADD-ON

Deze add-on breidt de offertebuilder uit met:
- voorcalculatie (uren, teams, middelen)
- automatische projectplanning
- uitvoering (koppeling met urenregistratie)
- nacalculatie
- leerfeedback voor toekomstige offertes

De add-on sluit aan op bestaande aanleg- en onderhoudsoffertes.

---

## 1. VOORCALCULATIE

### 1.1 Input voor voorcalculatie

De voorcalculatie gebruikt:
- scopes uit de offerte
- hoeveelheden (m², volumes, aantallen)
- normuren per scope
- correctiefactoren (bereikbaarheid, complexiteit, snijwerk, hoogte)

**Output:**
- totaal normuren project
- normuren per scope

### 1.2 Team-inzet

Bij voorcalculatie kan gekozen worden:
- aantal mensen op het project:
  - 2 man
  - 3 man
  - 4 man
- optioneel: namen van medewerkers (bijv. Michel, Quint)

In deze fase:
- geen persoonsafhankelijke efficiëntie
- werken met vaste aannames:
  - 1 persoon = X effectieve uren per dag
  - teamuren = personen × uren per dag

### 1.3 Efficiëntie per dag

De software gaat uit van:
- effectieve werkuren per dag per persoon
- vaste correctie voor:
  - opstart
  - opruimen
  - verplaatsen

**Resultaat:**
- realistische dagproductie
- geen te optimistische planning

---

## 2. PLANNING (AUTOMATISCH UIT VOORCALCULATIE)

### 2.1 Taken per scope

Elke scope wordt automatisch vertaald naar taken, bijvoorbeeld:

| Scope | Taken |
|-------|-------|
| **Grondwerk** | ontgraven, afvoeren, voorbereiden onderbouw |
| **Bestrating** | fundering, bestraten, aftrillen |
| **Verlichting** | sleuven, bekabeling, plaatsen armaturen |
| **Houtwerk** | fundering, montage |
| **Afwerking** | oplevering |

### 2.2 Tijdsduur per taak

Per taak:
- normuren
- omgerekend naar aantal werkdagen
- op basis van gekozen teamgrootte

**Voorbeeld:**
| Parameter | Waarde |
|-----------|--------|
| Taak | 24 uur |
| Team | 2 man |
| Dagproductie | 16 uur |
| **Resultaat** | **1,5 dag** |

### 2.3 Projectplanning (output)

De planning toont:
- totale duur project (in werkdagen)
- globale volgorde van werkzaamheden
- indicatie per fase (bijv. grondwerk 2 dagen, bestrating 3 dagen)

> ⚠️ Dit is geen kalenderplanning, maar een realistische projectduur.

---

## 3. MACHINEPARK & MIDDELEN

### 3.1 Machinepark

Het systeem bevat een overzicht van:
- interne machines (minikraan, trilplaat, etc.)
- externe huur (hoogwerker, speciale machines)

Per machine:
- intern uurtarief of dagtarief
- of externe huurprijs

### 3.2 Koppeling machines aan scopes

Bepaalde scopes activeren automatisch machines:

| Scope | Machine |
|-------|---------|
| Grondwerk | minikraan |
| Bestrating | trilplaat |

Machines tellen mee in:
- kosten
- planning
- nacalculatie

---

## 4. UITVOERING & URENREGISTRATIE

### 4.1 Urenregistratie

- Uren worden geregistreerd in een externe urenregistratie-app
- Per persoon
- Per dag
- Per project

> ℹ️ Deze add-on importeert of koppelt die uren — registreert ze niet zelf.

---

## 5. NACALCULATIE

### 5.1 Vergelijking

Per project wordt vergeleken:
- voorgecalculeerde uren vs werkelijke uren
- geplande duur vs werkelijke duur
- geplande machines vs werkelijk gebruik
- geplande kosten vs werkelijke kosten

### 5.2 Resultaten

De nacalculatie toont:
- afwijkingen per scope
- waar projecten uitlopen
- waar structureel onderschat wordt
- totale werkelijke projectkosten

---

## 6. LEERFEEDBACK (GEEN AUTOMATISCHE AI)

### 6.1 Gebruik van data

Nacalculatie-data wordt gebruikt om:
- normuren bij te stellen
- realistischere planningen te maken
- betere keuzes te maken in teamgrootte

### 6.2 Belangrijke regel

> ⚠️ **Geen automatische optimalisatie — Geen AI-beslissingen**  
> Aanpassingen gebeuren bewust en handmatig.

---

## 7. KOPPELING MET OFFERTES & FACTUREN

- Voorcalculatie is gekoppeld aan offerte
- Nacalculatie kan worden vergeleken met:
  - offertebedrag
  - factuurbedrag
- Inzicht in marge per project

---

## 8. KERNREGEL

Deze add-on mag **nooit**:
- de offerte aanpassen zonder expliciete actie
- aannames verbergen
- automatische conclusies trekken zonder inzicht

> ✅ **Alles moet inzichtelijk en controleerbaar blijven.**

---

*EINDE ADD-ON PRD*
