# Product Requirements Document (PRD)
# Top Tuinen Medewerkers App

**Versie:** 1.0
**Datum:** 2026-02-01
**Status:** Draft

---

## 1. Executive Summary

### 1.1 Product Visie
Een mobiele applicatie voor medewerkers van Top Tuinen die urenregistratie, GPS-tracking en interne communicatie combineert in één gebruiksvriendelijke app. De app werkt hybride (offline basis-functionaliteit, online voor GPS en chat) en integreert naadloos met het bestaande offerte-builder systeem.

### 1.2 Doelgroep
- **Primair:** Hoveniers en buitendienstmedewerkers van Top Tuinen
- **Secundair:** Voormannen en projectleiders
- **Tertiair:** Bedrijfseigenaar/management (voor monitoring)

### 1.3 Kernwaarden
- **Eenvoud:** Minimale handelingen voor dagelijkse taken
- **Betrouwbaarheid:** Werkt altijd, ook zonder internet
- **Privacy-first:** GDPR-compliant GPS-tracking met expliciete toestemming

---

## 2. Probleemstelling

### 2.1 Huidige Situatie
- Urenregistratie gebeurt handmatig via papier of achteraf in kantoor
- Geen real-time inzicht in wie waar werkt
- Communicatie via WhatsApp (geen scheiding werk/privé)
- Reistijd wordt geschat, niet gemeten
- Nacalculatie is arbeidsintensief

### 2.2 Gewenste Situatie
- Medewerkers loggen uren direct op locatie via smartphone
- GPS verifieert aanwezigheid op projectlocatie
- Interne chat voor werkgerelateerde communicatie
- Automatische reistijdberekening
- Real-time data voor nacalculatie

---

## 3. Functionele Requirements

### 3.1 Urenregistratie (Prioriteit: MUST HAVE)

| ID | Requirement | Beschrijving |
|----|-------------|--------------|
| UR-01 | Uren invoeren | Medewerker kan start/stop tijd registreren per project |
| UR-02 | Project selectie | Dropdown met toegewezen projecten |
| UR-03 | Taak koppeling | Optioneel: uren koppelen aan planning-taak |
| UR-04 | Notities | Vrij tekstveld voor opmerkingen |
| UR-05 | Offline opslag | Uren worden lokaal opgeslagen bij geen internet |
| UR-06 | Automatische sync | Synchronisatie zodra verbinding beschikbaar |
| UR-07 | Dagelijks overzicht | Samenvatting van gewerkte uren per dag |
| UR-08 | Weekoverzicht | Totaal uren per week met project-breakdown |

### 3.2 GPS Tracking (Prioriteit: MUST HAVE)

| ID | Requirement | Beschrijving |
|----|-------------|--------------|
| GPS-01 | Locatie toestemming | Expliciete consent flow (GDPR-compliant) |
| GPS-02 | Tracking tijdens werkuren | GPS alleen actief tijdens ingeklokte uren |
| GPS-03 | Geofencing | Automatische detectie aankomst/vertrek op projectlocatie |
| GPS-04 | Auto clock-in/out | Optionele automatische registratie bij geofence |
| GPS-05 | Reistijd berekening | Tracking van reistijd tussen projecten |
| GPS-06 | Battery optimization | Adaptieve sampling om batterij te sparen |
| GPS-07 | Privacy levels | Keuze: volledig/geaggregeerd/minimaal tracking |
| GPS-08 | Locatie historie | 90 dagen retentie, daarna automatisch verwijderd |

### 3.3 Interne Chat (Prioriteit: SHOULD HAVE)

| ID | Requirement | Beschrijving |
|----|-------------|--------------|
| CHAT-01 | Team chat | Algemeen kanaal voor alle medewerkers |
| CHAT-02 | Project chat | Kanaal per actief project |
| CHAT-03 | Direct messages | Één-op-één berichten |
| CHAT-04 | Foto's delen | Afbeeldingen uploaden en bekijken |
| CHAT-05 | Push notifications | Melding bij nieuwe berichten |
| CHAT-06 | Ongelezen teller | Badge met aantal ongelezen berichten |
| CHAT-07 | Aankondigingen | Manager kan broadcast sturen |
| CHAT-08 | Zoeken | Full-text zoeken in berichtgeschiedenis |

### 3.4 Authenticatie (Prioriteit: MUST HAVE)

| ID | Requirement | Beschrijving |
|----|-------------|--------------|
| AUTH-01 | Uitnodiging flow | Werkgever nodigt medewerker uit via email |
| AUTH-02 | Magic link login | Eerste login via email link |
| AUTH-03 | Biometrische login | Face ID / Touch ID na eerste login |
| AUTH-04 | Sessie beheer | Automatische token refresh, max 7 dagen |
| AUTH-05 | Rol-based access | Manager vs medewerker permissies |
| AUTH-06 | Offline access | Beperkte toegang zonder internet |

---

## 4. Non-Functionele Requirements

### 4.1 Performance

| Requirement | Target |
|-------------|--------|
| App startup tijd | < 2 seconden |
| Sync latency (online) | < 500ms |
| Offline queue capacity | 500+ registraties |
| Battery impact (tracking) | < 10% per werkdag |

### 4.2 Beschikbaarheid

| Requirement | Target |
|-------------|--------|
| Uptime backend | 99.9% |
| Offline functionaliteit | 100% voor urenregistratie |
| Sync reliability | 99.99% (geen data verlies) |

### 4.3 Beveiliging

| Requirement | Implementatie |
|-------------|---------------|
| Data in transit | TLS 1.3 |
| Token storage | iOS Keychain / Android Keystore |
| Biometric data | Secure Enclave / StrongBox |
| Session timeout | 7 dagen maximum |
| GDPR compliance | Data export, verwijdering, consent |

### 4.4 Compatibiliteit

| Platform | Minimum Versie |
|----------|----------------|
| iOS | 15.0+ |
| Android | 10 (API 29)+ |
| Schermgrootte | 4.7" - 6.7" |

---

## 5. Technische Architectuur

### 5.1 Tech Stack

| Component | Technologie | Reden |
|-----------|-------------|-------|
| Framework | React Native + Expo | Code sharing met web, React expertise |
| Backend | Convex | Bestaande integratie, real-time sync |
| Auth | Clerk Organizations | Bestaande setup, teams support |
| Offline DB | Expo SQLite | Robuuste lokale opslag |
| Push | Firebase Cloud Messaging | Cross-platform, gratis |

### 5.2 Integratie met Bestaand Systeem

```
┌─────────────────────────────────────────────────────────────┐
│                    BESTAANDE WEBAPP                          │
│              (Next.js + Convex + Clerk)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │Projecten│ │Offertes │ │Planning │ │Facturen │            │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
└───────┼──────────┼──────────┼──────────┼────────────────────┘
        │          │          │          │
        ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│                      CONVEX DATABASE                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ medewerkers │ │urenRegistr. │ │team_messages│            │
│  │ + clerkIds  │ │ + sync_stat │ │ + channels  │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
└─────────┼───────────────┼───────────────┼───────────────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                   MEDEWERKERS APP                            │
│              (React Native + Expo)                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │  Uren   │ │   GPS   │ │  Chat   │ │  Auth   │            │
│  │ Module  │ │ Module  │ │ Module  │ │ Module  │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│                      │                                       │
│              ┌───────┴───────┐                               │
│              │  SQLite Local │                               │
│              │   (Offline)   │                               │
│              └───────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow

**Offline-First Sync Pattern:**
```
1. Medewerker registreert uren
2. Data opgeslagen in lokale SQLite (sync_status: pending)
3. UI toont direct resultaat (optimistic update)
4. Background sync service detecteert online status
5. Sync naar Convex met idempotency key
6. Conflict check (timestamp vergelijking)
7. Update sync_status naar 'synced'
8. Real-time update naar alle clients
```

---

## 6. User Experience

### 6.1 User Flows

**Flow 1: Dagelijkse Urenregistratie**
```
Open App → Biometric Login → Dashboard
                              ↓
                    Tap "Start Werkdag"
                              ↓
                    Selecteer Project
                              ↓
                    GPS detecteert locatie
                              ↓
                    [Werken...]
                              ↓
                    Tap "Pauze" of "Stop"
                              ↓
                    Overzicht + Notities
                              ↓
                    Automatische Sync
```

**Flow 2: Eerste Login (Onboarding)**
```
Ontvang Email → Klik Magic Link → App Opent
                                     ↓
                              Welkom Scherm
                                     ↓
                              Vul Profiel In
                                     ↓
                              GPS Toestemming
                                     ↓
                              Biometric Setup
                                     ↓
                              Klaar!
```

### 6.2 Scherm Overzicht

| Scherm | Doel | Prioriteit |
|--------|------|------------|
| Dashboard | Huidige status, snelle acties | P0 |
| Uren Entry | Start/stop registratie | P0 |
| Project Overzicht | Lijst actieve projecten | P0 |
| Dag Overzicht | Samenvatting werktijd | P0 |
| Week Overzicht | Totalen per week | P1 |
| Team Chat | Algemene communicatie | P1 |
| Project Chat | Per-project berichten | P1 |
| Direct Messages | Één-op-één chat | P2 |
| Profiel/Settings | Persoonlijke instellingen | P1 |
| GPS Consent | Privacy instellingen | P0 |

---

## 7. Privacy & Compliance

### 7.1 GDPR Vereisten

| Vereiste | Implementatie |
|----------|---------------|
| Expliciete toestemming | Consent dialog bij eerste GPS activatie |
| Recht op inzage | Export functie in app |
| Recht op verwijdering | Verwijder knop in profiel |
| Data minimalisatie | Alleen noodzakelijke locatie data |
| Bewaartermijn | 90 dagen voor locatie data |
| Audit trail | Logging van data access |

### 7.2 Nederlands Arbeidsrecht

| Aspect | Implementatie |
|--------|---------------|
| Werkuren tracking | Alleen tijdens ingeklokte tijd |
| Opt-out mogelijkheid | Medewerker kan GPS weigeren |
| Transparantie | Duidelijke uitleg wat wordt getracked |
| OR instemming | Documentatie voor >35 medewerkers |

### 7.3 Consent Flow (Nederlands)

```
┌────────────────────────────────────────────────────────────┐
│                 GPS Locatietracking                         │
│                                                              │
│  Als onderdeel van het projectmanagement volgen wij uw      │
│  locatie tijdens werkuren. Dit helpt ons:                   │
│                                                              │
│  • Verifiëren dat u op de werklocatie bent                  │
│  • Reistijd nauwkeurig berekenen                            │
│  • Projectplanning optimaliseren                            │
│                                                              │
│  Kies uw privacy niveau:                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ○ Volledig Tracking                                   │  │
│  │   Continu GPS tijdens werkuren                        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ○ Geaggregeerd                                        │  │
│  │   Alleen dagelijkse samenvatting                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ○ Minimaal                                            │  │
│  │   Alleen aankomst/vertrek                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Uw rechten:                                                │
│  • U kunt tracking op elk moment uitschakelen               │
│  • U kunt uw gegevens inzien en exporteren                  │
│  • Gegevens worden verwijderd na 90 dagen                   │
│                                                              │
│           [Akkoord]              [Weigeren]                 │
└────────────────────────────────────────────────────────────┘
```

---

## 8. Success Metrics

### 8.1 Key Performance Indicators

| KPI | Target | Meetmethode |
|-----|--------|-------------|
| Adoptie rate | 95% binnen 2 weken | Actieve users / totaal medewerkers |
| Dagelijks gebruik | 90%+ | Daily active users |
| Sync success rate | 99.99% | Failed syncs / total syncs |
| Urenregistratie compleetheid | 98%+ | Geregistreerde dagen / werkdagen |
| GPS consent rate | 80%+ | Consented / total employees |
| App store rating | 4.5+ | iOS App Store, Google Play |

### 8.2 Business Impact

| Metric | Verwachte Verbetering |
|--------|----------------------|
| Administratietijd | -50% (uren invoer) |
| Nacalculatie nauwkeurigheid | +30% |
| Reistijd transparantie | Van 0% naar 100% |
| Communicatie efficiëntie | -20% WhatsApp berichten |

---

## 9. Risico's & Mitigatie

| Risico | Impact | Kans | Mitigatie |
|--------|--------|------|-----------|
| Lage adoptie | Hoog | Medium | Training, eenvoudige UX, incentives |
| GPS weerstand | Medium | Hoog | Privacy-first design, keuze niveaus |
| Offline sync issues | Hoog | Laag | Idempotency, conflict resolution |
| Battery drain | Medium | Medium | Adaptive sampling, battery monitoring |
| iOS/Android verschillen | Medium | Medium | Expo abstraheert, device testing |

---

## 10. Timeline & Milestones

### Phase 1: Foundation (Week 1-4)
- Expo project setup
- Clerk Organizations integratie
- Convex schema uitbreidingen
- Basic authentication flow

### Phase 2: Core Features (Week 5-8)
- Urenregistratie module
- Offline sync engine
- SQLite lokale database
- Project selectie

### Phase 3: GPS Module (Week 9-12)
- Location tracking
- Geofencing
- Privacy consent flow
- Battery optimization

### Phase 4: Chat Module (Week 13-16)
- Team messages
- Direct messages
- Push notifications
- Image upload

### Phase 5: Polish & Launch (Week 17-20)
- UI/UX refinement
- Performance optimization
- Beta testing
- App Store submission

**Totale doorlooptijd: 20 weken (~5 maanden)**

---

## 11. Out of Scope (v1.0)

De volgende features zijn bewust uitgesloten van de eerste release:

- Foto's toevoegen aan urenregistraties
- Materiaaldeclaraties
- Verlofaanvragen
- Expense tracking
- Video berichten
- Voice messages
- Integratie met externe systemen (Exact, Twinfield)
- Apple Watch / Wear OS app
- Widget voor homescreen

Deze kunnen in latere versies worden toegevoegd.

---

## 12. Goedkeuring

| Rol | Naam | Datum | Handtekening |
|-----|------|-------|--------------|
| Product Owner | | | |
| Technical Lead | | | |
| Privacy Officer | | | |
| Management | | | |

---

*Document versie 1.0 - Gegenereerd op 2026-02-01*
