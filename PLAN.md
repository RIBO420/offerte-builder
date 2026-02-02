# TOP Offerte Calculator - AI & Feature Roadmap

> **Gegenereerd door 12 AI-agents** die elk een specifiek aspect van de applicatie hebben geanalyseerd.
> Datum: 2026-02-02

---

## Executive Summary

De TOP Offerte Calculator is een **functioneel complete applicatie** voor hoveniersbedrijven met sterke fundamenten in offerte management, project tracking, en resource management. Na uitgebreide analyse door 12 gespecialiseerde AI-agents zijn de volgende **kritieke verbetergebieden** geïdentificeerd:

### Top 5 Strategische Prioriteiten

| # | Gebied | Impact | ROI Schatting |
|---|--------|--------|---------------|
| 1 | **AI-Powered Offerte Automatisering** | 40% tijdsbesparing per offerte | 3-6 maanden |
| 2 | **Intelligente Planning & Resource Optimalisatie** | 30% efficiënter | 4-8 maanden |
| 3 | **Customer Intelligence & Churn Prevention** | 15-20% meer retention | 2-4 maanden |
| 4 | **Ontbrekende Kernfuncties** (Inkoop, Voorraad) | Operationele completeness | 3-6 maanden |
| 5 | **Predictieve Analytics & Forecasting** | Data-driven besluitvorming | 6-12 maanden |

---

## Deel 1: AI-Kansen per Domein

### 1.1 Offerte Calculatie AI

**Huidige Staat**: Solide berekeningsengine met deterministische normuren en correctiefactoren.

**AI-Kansen** (Prioriteit: HOOG):

#### Quick Wins (1-2 weken)
| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Intelligente Scope Defaults** | Suggereer typische waarden op basis van projectgrootte | 40% minder invoer |
| **Bereikbaarheid Prediction** | Voorspel bereikbaarheid op basis van postcode/locatie | Nauwkeurigere offertes |
| **Smart Normuur Adjustment** | Adaptieve normuren op basis van projectgrootte | Betere marges |

#### Medium Term (2-4 weken)
| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Margin Optimization** | Analyseer accepted vs rejected offertes voor optimale pricing | +10% winstmarge |
| **Anomaly Detection** | Waarschuw bij onrealistische prijzen | Minder fouten |
| **Linked Scope Suggestions** | Suggereer gerelateerde scopes (borders → borders_onderhoud) | Hogere orderwaarde |

#### Advanced (4-8 weken)
| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Photo-Based Measurement** | Upload tuinfoto → AI schat oppervlaktes | 70% snellere inschatting |
| **Template Matching** | Vind vergelijkbare historische projecten | Snellere offerte creatie |
| **Conversational AI Interface** | Natuurlijke taal → complete offerte | 5 min vs 45 min |

**Implementatie Locaties**:
- `src/lib/offerte-calculator.ts` - Kernberekeningen
- `convex/offertes.ts` - Backend queries
- `convex/ai-suggestions.ts` (nieuw) - AI module

---

### 1.2 Project Planning & Resource AI

**Huidige Staat**: 100% handmatige planning, geen resource allocatie of workload balancing.

**Kritieke Gap**: Planning taken worden NOOIT aan medewerkers gekoppeld.

**AI-Kansen** (Prioriteit: HOOG):

#### Phase 1: Foundation (2-3 weken)
| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Smart Team Composition Suggester** | Optimale teamsamenstelling op basis van skills & beschikbaarheid | 30% minder scheduling tijd |
| **Fix Database Schema** | Normaliseer teamleden (ID refs ipv strings) | Foundation voor AI |

```typescript
// Voorgesteld nieuw data model
interface TaskAssignment {
  taskId: Id<"planningTaken">;
  assignedTo: Id<"medewerkers">[];
  estimatedStart: Date;
  estimatedEnd: Date;
  utilization: number;
}
```

#### Phase 2: Intelligence (4-6 weken)
| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Intelligent Task Scheduling** | Automatische taken verdeling met load balancing | Even workload |
| **Capacity Planning Dashboard** | Real-time workload visualisatie per medewerker | Proactieve planning |
| **Conflict Detection** | Detecteer dubbele boekingen en resource conflicten | Minder fouten |

#### Phase 3: Predictive (6+ weken)
| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Predictive Project Duration** | ML-based duratie voorspelling | Realistischere deadlines |
| **Skill Gap Detection** | Identificeer trainingsbehoeften voor toekomstige projecten | Betere voorbereiding |

---

### 1.3 Customer Intelligence AI

**Huidige Staat**: Basis klantbeheer met onderbenut data potentieel.

**AI-Kansen** (Prioriteit: HOOG):

#### Customer Health & Segmentation
```typescript
// Voorgestelde Customer Health Score
interface CustomerHealthScore {
  recencyScore: number;      // Dagen sinds laatste contact
  frequencyScore: number;    // Acceptatie frequentie
  monetaryScore: number;     // Totale omzet
  engagementScore: number;   // Email opens, responses
  healthScore: number;       // Composite 0-100
  segment: "premium" | "loyal" | "growth" | "at-risk" | "dormant";
}
```

| Feature | Beschrijving | Impact | Timeline |
|---------|-------------|--------|----------|
| **Customer Health Score** | RFM-scoring en composite health metric | Prioriteer accounts | 1 week |
| **Churn Prediction** | Detecteer at-risk klanten voor ze churnen | +15% retention | 2 weken |
| **Automated Follow-ups** | Intelligente email sequences per klant segment | Meer conversies | 2-3 weken |
| **Offer Recommendations** | Suggereer volgende offerte op basis van history | Hogere orderwaarde | 2 weken |
| **Smart Pricing per Klant** | Pricing suggestions op basis van klanthistorie | Optimale marges | 2 weken |

**Dashboard Widgets** (Nieuw):
- "At-Risk Customers" alert card
- Customer segment distribution chart
- Predicted next purchase dates
- Communication health monitor

---

### 1.4 Financial Analytics AI

**Huidige Staat**: Goede basis rapportages, maar reactief (pas na project afloop).

**AI-Kansen** (Prioriteit: MEDIUM-HOOG):

| Feature | Beschrijving | Impact | Effort |
|---------|-------------|--------|--------|
| **Cashflow Forecasting** | 90-dagen cashflow voorspelling | Betere liquiditeit | 5 dagen |
| **Margin Analysis & Alerts** | Real-time marge tracking per project/scope | +10% profit | 4 dagen |
| **Hours Anomaly Detection** | Detecteer onverwachte urenafwijkingen | Vroege waarschuwing | 3 dagen |
| **Invoice Anomaly Detection** | Flag potentieel foutieve facturen | Minder fouten | 2 dagen |
| **Profitability Prediction** | Voorspel project winstgevendheid bij offerte | Betere selectie | 3 dagen |

**Implementatie**:
```typescript
// convex/financialAI.ts (nieuw)
export const getCashflowForecast = query({
  args: { months: v.number() },
  handler: async (ctx, args) => {
    // Analyseer historisch betaalgedrag
    // Time series forecasting (ARIMA/Prophet)
    // Return weekly/monthly predictions
  }
});
```

---

### 1.5 Document Generation AI

**Huidige Staat**: React-PDF voor offertes, statische email templates.

**AI-Kansen** (Prioriteit: MEDIUM):

| Feature | Beschrijving | Impact | Cost/Offerte |
|---------|-------------|--------|--------------|
| **Intelligente Scope Omschrijvingen** | AI-generated klant-vriendelijke beschrijvingen | Professionelere offertes | ~€0.10 |
| **Dynamic Email Subjects** | Gepersonaliseerde subjects voor hogere open rates | +15% open rate | ~€0.02 |
| **Personalized Greetings** | Tone en inhoud op basis van klantrelatie | Betere engagement | ~€0.05 |
| **Auto-Generated Factuur Narratives** | Professionele werkbeschrijvingen op facturen | Minder vragen | ~€0.10 |
| **Follow-up Email Sequences** | Automatische herinneringen en nurturing | Meer acceptaties | ~€0.20/sequence |

**Estimated Monthly Cost** (100 offertes): ~€57

---

### 1.6 Uren & Time Tracking AI

**Huidige Staat**: Solide handmatige registratie met post-hoc leerfeedback.

**AI-Kansen** (Prioriteit: MEDIUM):

| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Real-time Afwijking Alerts** | Monitor uren entries > 2σ van verwacht | Vroege interventie |
| **Medewerker Productivity Dashboard** | Trends, scope velocity, skill classificatie | Performance insights |
| **Predictive Voorcalculatie** | Voorspel uren pre-project op basis van history | Betere schattingen |
| **Weather/Seasonal Adjustment** | Automatische seizoenfactoren in estimates | Nauwkeuriger |

```typescript
// Nieuw: Real-time anomaly detection
interface UrenAnomalyAlert {
  type: "significant_deviation" | "outlier_entry" | "team_velocity_change";
  severity: "info" | "warning" | "critical";
  projectId: Id<"projecten">;
  detected_value: number;
  expected_range: [min, max];
  suggestion: string;
}
```

---

### 1.7 Workflow Automation AI

**Huidige Staat**: Goed gedefinieerde statussen maar 100% handmatige transities.

**AI-Kansen** (Prioriteit: MEDIUM):

| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Automatic Status Transitions** | Event-driven status updates | Minder handwerk |
| **Bottleneck Detection** | Real-time alerting voor "stuck" items | Proactieve actie |
| **Next-Step Suggestions** | Intelligente "volgende actie" aanbevelingen | Snellere workflow |
| **Workflow Completion Analytics** | Time-to-completion per stap | Process optimization |

**Database Updates Nodig**:
```typescript
// Nieuw: Workflow events tracking
workflowEvents: defineTable({
  projectId: v.id("projecten"),
  previousStatus: v.string(),
  newStatus: v.string(),
  reason: v.optional(v.string()),
  changedAt: v.number(),
  durationInStatus: v.optional(v.number()),
});
```

---

### 1.8 Wagenpark/Fleet AI

**Huidige Staat**: Goed voertuigbeheer met FleetGo integratie voorbereid.

**AI-Kansen** (Prioriteit: MEDIUM):

| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Predictive Maintenance** | Voorspel onderhoud op basis van km/history | 25-30% minder kosten |
| **Fuel Anomaly Detection** | Detecteer diefstal of motor degradatie | 15-20% fuel savings |
| **Route Optimization** | Optimaliseer dagelijkse routes | 10-15% efficiency |
| **Vehicle Efficiency Scoring** | Per-voertuig performance metrics | Data-driven fleet renewal |

---

### 1.9 Search & Navigation AI

**Huidige Staat**: Fuse.js fuzzy search met command palette.

**AI-Kansen** (Prioriteit: MEDIUM-LAAG):

| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Semantic Search** | Vector embeddings voor contextueel zoeken | Betere resultaten |
| **Natural Language Queries** | "Toon actieve projecten deze maand" | Intuïtiever |
| **Smart Command Suggestions** | Context-aware suggestions | Snellere navigatie |
| **Full-Text Search Expansion** | Search indices voor offertes, projecten, medewerkers | Breder bereik |

---

### 1.10 Medewerker/HR AI

**Huidige Staat**: Goede basis met specialisaties en certificaten.

**AI-Kansen** (Prioriteit: MEDIUM):

| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Intelligent Project Staffing** | Ranked team suggestions op basis van skills | Betere matches |
| **Predictive Capacity Planning** | 4-week forecast per medewerker | Proactieve planning |
| **Performance Insights** | Personalized dashboards met trends | Targeted coaching |
| **Skill Gap Analysis** | Identificeer trainingsbehoeften | Betere voorbereiding |

---

### 1.11 Data Quality AI

**Huidige Staat**: Uitstekende Zod validatie, maar geen intelligente checks.

**AI-Kansen** (Prioriteit: MEDIUM):

| Feature | Beschrijving | Impact |
|---------|-------------|--------|
| **Address Validation** | PostNL/Google Maps API verificatie | 0% adresfouten |
| **Klant Deduplication** | Fuzzy matching voor duplicaat detectie | Schonere CRM |
| **Data Anomaly Detection** | Outlier detection op scopes en prijzen | Vroege foutdetectie |
| **Smart Autocomplete** | Suggestions op basis van history | 20-30% snellere invoer |

---

## Deel 2: Ontbrekende Kernfuncties

### 2.1 KRITIEK: Leverancier & Inkoopbeheer

**Status**: NIET GEÏMPLEMENTEERD

**Impact**: Bedrijf kan niet efficiënt met leveranciers werken.

**Benodigde Functies**:
- Leveranciersdatabase (contacten, betalingstermen, beoordelingen)
- Inkooporders (create, receive, match)
- Materiaal voorraadbeheer (stock levels, alerts)
- Inkoopprijzen historie

**Geschatte Effort**: 80-100 uur

---

### 2.2 KRITIEK: Materiaal Voorraadbeheer

**Status**: NIET GEÏMPLEMENTEERD

**Impact**: Geen zicht op beschikbare materialen.

**Benodigde Functies**:
- Stock tracking per materiaal
- Voorraad waarschuwingen (reorder points)
- Materiaal allocatie per project
- Picking lists

**Geschatte Effort**: 100 uur

---

### 2.3 HOOG: Jobsite Information Management

**Status**: MINIMAAL (alleen klantadressen)

**Benodigde Functies**:
- Site profiles met foto's
- Access instructies, parking info
- Utility locaties (water, elektra)
- Safety notes

**Geschatte Effort**: 50 uur

---

### 2.4 HOOG: Real-time Project Cost Tracking

**Status**: ALLEEN POST-PROJECT (nacalculatie)

**Benodigde Functies**:
- Daily cost logging tijdens uitvoering
- Budget variance alerts
- In-execution cost visibility
- Early warning voor overschrijdingen

**Geschatte Effort**: 70 uur

---

### 2.5 MEDIUM: Quality & Compliance

**Benodigde Functies**:
- Before/after foto requirements
- QC checklists per scope
- Project completion sign-off
- Compliance documenten repository

**Geschatte Effort**: 60 uur

---

## Deel 3: Implementatie Roadmap

### Phase 1: Foundation (Weken 1-4)

**Focus**: Quick wins en kritieke gaps

| Week | Features | Team | Dependencies |
|------|----------|------|--------------|
| 1 | Customer Health Score, At-Risk Alerts | 1 dev | - |
| 2 | Intelligente Scope Defaults, Bereikbaarheid Prediction | 1 dev | - |
| 3 | Fix Planning Database Schema, Team Suggester MVP | 1 dev | Week 2 |
| 4 | Address Validation, Klant Deduplication | 1 dev | - |

**Deliverables**:
- Customer Health Dashboard widget
- Smart offerte suggestions
- Basic team recommendations
- Cleaner CRM data

---

### Phase 2: Intelligence (Weken 5-8)

**Focus**: AI-powered automation

| Week | Features | Team | Dependencies |
|------|----------|------|--------------|
| 5 | Margin Optimization, Price Anomaly Detection | 1 dev | Historical data |
| 6 | Task Scheduling, Capacity Dashboard | 1 dev | Phase 1 schema |
| 7 | Document AI (Scope Descriptions, Email Subjects) | 1 dev | Claude API |
| 8 | Churn Prediction, Communication Sequences | 1 dev | Week 1 |

**Deliverables**:
- AI-assisted pricing
- Automated scheduling
- Smart document generation
- Proactive customer retention

---

### Phase 3: Operations (Weken 9-12)

**Focus**: Ontbrekende kernfuncties

| Week | Features | Team | Dependencies |
|------|----------|------|--------------|
| 9-10 | Leverancier & Inkoopbeheer | 2 devs | - |
| 11 | Materiaal Voorraadbeheer | 1 dev | Week 9-10 |
| 12 | Real-time Project Cost Tracking | 1 dev | - |

**Deliverables**:
- Complete supplier management
- Stock tracking
- Live cost visibility

---

### Phase 4: Advanced (Weken 13-16)

**Focus**: Predictive analytics en optimization

| Week | Features | Team | Dependencies |
|------|----------|------|--------------|
| 13 | Cashflow Forecasting, Financial Analytics | 1 dev | Historical data |
| 14 | Predictive Project Duration, Skill Gap Analysis | 1 dev | Phase 2 |
| 15 | Fleet AI (Predictive Maintenance, Fuel Anomaly) | 1 dev | FleetGo API |
| 16 | Semantic Search, Workflow Analytics | 1 dev | - |

**Deliverables**:
- Financial forecasting dashboard
- ML-based project estimates
- Fleet optimization
- Intelligent search

---

## Deel 4: Technische Architectuur

### 4.1 AI Infrastructure

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐  │
│  │ AI      │  │ Smart   │  │ Prediction          │  │
│  │ Suggest │  │ Forms   │  │ Dashboards          │  │
│  └────┬────┘  └────┬────┘  └──────────┬──────────┘  │
└───────┼────────────┼─────────────────┼──────────────┘
        │            │                 │
        ▼            ▼                 ▼
┌─────────────────────────────────────────────────────┐
│                    Convex Backend                    │
│  ┌─────────────────────────────────────────────┐    │
│  │              AI Module Layer                 │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐│    │
│  │  │ Predict  │ │ Suggest  │ │ Anomaly      ││    │
│  │  │ Engine   │ │ Engine   │ │ Detection    ││    │
│  │  └────┬─────┘ └────┬─────┘ └──────┬───────┘│    │
│  └───────┼────────────┼──────────────┼────────┘    │
│          │            │              │              │
│  ┌───────▼────────────▼──────────────▼───────┐     │
│  │              Core Data Layer               │     │
│  │  offertes │ projecten │ klanten │ etc.    │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│              External AI Services                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Claude   │  │ Google   │  │ PostNL   │          │
│  │ API      │  │ Maps API │  │ API      │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────┘
```

### 4.2 Nieuwe Database Tabellen

```typescript
// convex/schema.ts - Uitbreidingen

// Customer Intelligence
klant_metrics: defineTable({
  klantId: v.id("klanten"),
  userId: v.id("users"),
  totalRevenue: v.number(),
  healthScore: v.number(),
  segment: v.string(),
  riskScore: v.number(),
  lastCalculated: v.number(),
}).index("by_user_health", ["userId", "healthScore"]),

// Task Assignments (Planning)
taskAssignments: defineTable({
  taskId: v.id("planningTaken"),
  medewerkerIds: v.array(v.id("medewerkers")),
  estimatedStart: v.optional(v.number()),
  estimatedEnd: v.optional(v.number()),
  status: v.string(),
}).index("by_task", ["taskId"]),

// Workflow Events (Audit)
workflowEvents: defineTable({
  projectId: v.id("projecten"),
  previousStatus: v.string(),
  newStatus: v.string(),
  changedAt: v.number(),
  durationInStatus: v.optional(v.number()),
}).index("by_project", ["projectId"]),

// Communication Campaigns
communicationCampaigns: defineTable({
  klantId: v.id("klanten"),
  userId: v.id("users"),
  type: v.string(),
  status: v.string(),
  steps: v.array(v.object({...})),
  createdAt: v.number(),
}).index("by_user_active", ["userId", "status"]),

// Leveranciers (Nieuw)
leveranciers: defineTable({
  userId: v.id("users"),
  naam: v.string(),
  contactpersoon: v.optional(v.string()),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
  betalingstermijn: v.optional(v.number()),
  rating: v.optional(v.number()),
}).index("by_user", ["userId"]),

// Inkooporders (Nieuw)
inkooporders: defineTable({
  userId: v.id("users"),
  leverancierId: v.id("leveranciers"),
  projectId: v.optional(v.id("projecten")),
  status: v.string(),
  regels: v.array(v.object({...})),
  totaal: v.number(),
  createdAt: v.number(),
}).index("by_user_status", ["userId", "status"]),

// Voorraad (Nieuw)
voorraad: defineTable({
  userId: v.id("users"),
  productId: v.id("producten"),
  hoeveelheid: v.number(),
  minVoorraad: v.optional(v.number()),
  locatie: v.optional(v.string()),
  lastUpdated: v.number(),
}).index("by_user_product", ["userId", "productId"]),
```

### 4.3 API Keys & Integraties

```env
# .env.local toevoegingen

# AI Services
ANTHROPIC_API_KEY=xxx          # Claude voor tekst generatie
OPENAI_API_KEY=xxx             # Embeddings voor semantic search

# Address Validation
GOOGLE_MAPS_API_KEY=xxx        # Geocoding & address validation
POSTNL_API_KEY=xxx             # Dutch postal validation

# Fleet Management
FLEETGO_API_KEY=xxx            # Voertuig tracking
FLEETGO_API_SECRET=xxx
```

---

## Deel 5: Success Metrics

### 5.1 Efficiency Metrics

| Metric | Huidige Baseline | Target (6 maanden) |
|--------|------------------|---------------------|
| Tijd per offerte | ~45 min | ~15 min (-67%) |
| Scheduling tijd | ~2 uur/week | ~30 min (-75%) |
| Data entry fouten | Onbekend | -80% |
| Handmatige status updates | 100% | <20% |

### 5.2 Business Metrics

| Metric | Huidige Baseline | Target (6 maanden) |
|--------|------------------|---------------------|
| Offerte acceptance rate | ~40% | ~55% (+38%) |
| Customer retention | Onbekend | +20% |
| Project margin accuracy | ±25% | ±10% |
| On-time project delivery | Onbekend | >90% |

### 5.3 Quality Metrics

| Metric | Huidige Baseline | Target (6 maanden) |
|--------|------------------|---------------------|
| Duplicate klanten | Onbekend | <1% |
| Address validation errors | Onbekend | 0% |
| Price anomalies caught | 0 | 100% |
| Churn predicted | 0 | >80% |

---

## Deel 6: Estimated Costs

### 6.1 Development Effort

| Phase | Weken | FTE | Uren |
|-------|-------|-----|------|
| Phase 1: Foundation | 4 | 1 | 160 |
| Phase 2: Intelligence | 4 | 1 | 160 |
| Phase 3: Operations | 4 | 1.5 | 240 |
| Phase 4: Advanced | 4 | 1 | 160 |
| **Totaal** | **16** | - | **720** |

### 6.2 External Services (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| Claude API | ~500K tokens | €30-50 |
| Google Maps API | ~1000 requests | €5-10 |
| PostNL API | ~200 validations | €10-20 |
| FleetGo API | Existing contract | - |
| **Totaal** | | **~€50-80/maand** |

### 6.3 ROI Analysis

**Investment**: 720 uur development + ~€1000/jaar services

**Expected Returns**:
- 67% tijdsbesparing per offerte → ~€15.000/jaar
- 38% hogere acceptance rate → ~€25.000/jaar
- 20% betere retention → ~€10.000/jaar
- 25% minder cost overruns → ~€20.000/jaar

**Estimated Annual ROI**: €70.000+ / ~€40.000 investment = **175%+ ROI**

---

## Conclusie

De TOP Offerte Calculator heeft een **solide fundament** maar significante AI-mogelijkheden om van een goede tool naar een **competitief voordeel** te transformeren.

### Aanbevolen Eerste Stappen

1. **Week 1**: Start met Customer Health Score (quick win, high visibility)
2. **Week 2**: Implementeer Intelligente Scope Defaults (direct user value)
3. **Week 3**: Fix planning database schema (foundation voor AI)
4. **Week 4**: Begin met address validation en deduplicatie

### Kritieke Succesfactoren

- Executive buy-in voor AI roadmap
- Voldoende historische data voor ML
- User feedback loops
- Iteratieve development approach

---

*Gegenereerd door 12 AI-agents, elk gespecialiseerd in een specifiek domein van de applicatie.*
