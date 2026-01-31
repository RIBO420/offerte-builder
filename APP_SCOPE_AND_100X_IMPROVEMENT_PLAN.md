# TOP Offerte Calculator - Complete App Scope & 100x Improvement Plan

## Executive Summary

The TOP Offerte Calculator is a sophisticated Dutch landscaping quotation and project management system built for hoveniersbedrijven (landscaping companies). It transforms garden specifications into detailed cost estimates, tracks project execution, and provides post-project analysis to continuously improve estimates.

---

# PART 1: CURRENT APP SCOPE

## 1. Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js + React | 16.1.6 / 19.2.3 |
| Backend | Convex (BaaS) | 1.31.6 |
| Authentication | Clerk | 6.37.0 |
| Styling | Tailwind CSS | 4.x |
| UI Components | Radix UI + shadcn/ui | Latest |
| Animation | Framer Motion | 12.29.2 |
| Forms | React Hook Form + Zod | 7.71.1 / 4.3.6 |
| Charts | Recharts | 3.7.0 |
| PDF Generation | @react-pdf/renderer | 4.3.2 |
| Email | Resend | 6.9.1 |
| Monitoring | Sentry | 10.38.0 |

---

## 2. Core Features

### 2.1 Offerte (Quote) Builder

**Quote Types:**
- **Aanleg (Construction)**: New garden installations
- **Onderhoud (Maintenance)**: Recurring garden maintenance

**Aanleg Scopes (7):**
| Scope | Description | Key Calculations |
|-------|-------------|------------------|
| Grondwerk | Excavation & earth moving | Depth-based (licht/standaard/zwaar), disposal |
| Bestrating | Paving & hard surfaces | Material type, cutting work, underbody |
| Borders | Planting beds | Intensity (weinig/gemiddeld/veel), soil prep |
| Gras | Lawns | Seeding vs sod, drainage |
| Houtwerk | Wooden structures | Fencing, decking, pergolas, foundations |
| Water & Elektra | Utilities | Lighting points, cable trenching |
| Specials | Special items | Jacuzzi, sauna, prefab elements |

**Onderhoud Scopes (5):**
| Scope | Description |
|-------|-------------|
| Gras Onderhoud | Mowing, edging, verticuting |
| Borders Onderhoud | Weeding, pruning |
| Heggen | Hedge trimming (volume-based) |
| Bomen | Tree maintenance |
| Overig | Leaf clearing, patio cleaning |

**Calculation Engine:**
```
Final Price = (Material Costs + Labor Hours × Hourly Rate) × (1 + Margin%) × (1 + VAT%)
```
- Labor hours adjusted by correction factors (accessibility, complexity, backlog)
- Per-scope margin overrides supported
- Real-time client-side calculations

### 2.2 Customer Management (Klanten)

- Full customer database with contact details
- Address management (street, postcode, city)
- Notes and communication history
- Quote history per customer
- Full-text search on customer names

### 2.3 Project Management

**5-Phase Workflow:**
```
Voorcalculatie → Gepland → In Uitvoering → Afgerond → Nacalculatie Compleet
```

**Features:**
- Auto-generate planning tasks from quote scopes
- Team size configuration (2-4 persons)
- Task sequencing and status tracking
- Time registration (manual + CSV import)
- Machine/equipment usage tracking
- Progress visualization with real-time updates

### 2.4 Nacalculatie (Post-Calculation)

**Analysis Capabilities:**
- Planned vs actual hours comparison
- Per-scope deviation analysis
- Machine cost variance
- Status classification (good/warning/critical)
- AI-like insights generation
- Learning feedback system for normuur adjustments

### 2.5 Settings & Configuration

**User Customization:**
- Hourly rate (uurtarief)
- Default margin percentage
- Per-scope margin overrides
- VAT percentage
- Company information
- Quote numbering format

**Master Data:**
- 40+ normuren (standard hours) across all scopes
- 37 default products with pricing
- 20+ correction factors
- 6 default machines

### 2.6 PDF & Email

- Client-side PDF generation with company branding
- Email sending via Resend API
- Quote sharing via secure links (30-day expiry)
- Customer signature capture for acceptances
- Email delivery tracking

### 2.7 Analytics Dashboard

- KPI cards with sparklines
- Revenue trends (monthly/quarterly)
- Quote pipeline visualization
- Scope profitability analysis
- Top customer rankings

---

## 3. Database Schema (20 Tables)

| Table | Purpose | Records |
|-------|---------|---------|
| users | User accounts | Per tenant |
| klanten | Customers | Per user |
| offertes | Quotes | Per user |
| offerte_versions | Audit trail | Per quote |
| offerte_messages | Customer chat | Infrastructure ready |
| producten | Material catalog | 37+ defaults |
| normuren | Standard hours | 40+ defaults |
| correctiefactoren | Adjustment factors | 20+ system |
| instellingen | User settings | 1 per user |
| projecten | Active projects | Per user |
| voorcalculaties | Pre-calculations | Per project |
| planningTaken | Scheduled tasks | Per project |
| urenRegistraties | Time tracking | Per project |
| machines | Equipment | Per user |
| machineGebruik | Equipment usage | Per project |
| nacalculaties | Post-analysis | Per project |
| leerfeedback_historie | Learning audit | Per adjustment |
| email_logs | Email tracking | Per email |
| standaardtuinen | Templates | Per user + system |

---

## 4. UI/UX Highlights

**Component Library:** 80+ components including:
- Multi-step wizard with auto-save
- Scope-specific forms with validation
- Animated number displays
- Glassmorphic KPI cards
- Responsive tables (card view on mobile)
- Command palette (Cmd+K)
- Toast notifications

**Accessibility:**
- WCAG-compliant color contrast
- 44px touch targets on mobile
- Reduced motion support
- Keyboard navigation
- ARIA labels throughout

**Mobile-First:**
- Collapsible sidebar
- Swipeable row actions
- Bottom sheets for dialogs
- Responsive typography

---

## 5. Current Limitations

### Technical Gaps
- No offline support
- Limited bulk operations
- No pagination on large lists
- No file upload for attachments
- Single-region deployment

### Feature Gaps
- No Gantt chart/calendar view
- No resource leveling
- No approval workflows
- No risk management
- No change order tracking
- No multi-currency support
- Limited reporting/export

### Business Gaps
- No crew/team management
- No supplier integrations
- No inventory tracking
- No accounting integration
- No mobile app

---

# PART 2: 100x IMPROVEMENT PLAN

## Vision: From Quote Builder to Complete Landscaping Business Platform

Transform TOP Offerte Calculator from a single-user quote tool into a comprehensive landscaping business management platform serving the entire Dutch hoveniers market.

---

## Phase 1: Foundation (0-3 months)

### 1.1 Multi-Tenant Organization Support
**Impact: 10x user capacity**

```
Current: Single user per account
Target: Teams with roles (Owner, Admin, Medewerker, Viewer)
```

**Features:**
- Organization/company accounts
- Role-based access control (RBAC)
- Team member invitations
- Per-user permissions per feature
- Activity audit logs

### 1.2 Mobile App (React Native)
**Impact: 5x engagement**

**Features:**
- Time registration on job site
- Photo capture and attachment
- Offline-first with sync
- Push notifications
- GPS location for job sites
- Voice-to-text notes

### 1.3 API & Integrations Platform
**Impact: 3x productivity**

**Integrations:**
- Exact Online / Moneybird (accounting)
- Twinfield / e-Boekhouden
- Google Calendar / Outlook
- WhatsApp Business
- Supplier catalogs (Jongeneel, de Beijer)

### 1.4 Advanced Reporting
**Impact: 2x insights**

**Reports:**
- Profitability by customer/scope/period
- Employee productivity
- Quote conversion rates
- Revenue forecasting
- Custom report builder
- PDF/Excel export

---

## Phase 2: Intelligence (3-6 months)

### 2.1 AI-Powered Estimation
**Impact: 10x accuracy**

**Features:**
- Photo-to-quote: Upload garden photo → AI estimates scope
- Historical accuracy analysis per scope
- Automatic correction factor suggestions
- Weather-adjusted planning
- Seasonal pricing adjustments

### 2.2 Smart Planning & Scheduling
**Impact: 5x efficiency**

**Features:**
- Gantt chart with drag-drop scheduling
- Resource optimization (crews, equipment)
- Travel time optimization (route planning)
- Conflict detection
- Capacity forecasting
- Automated crew assignment

### 2.3 Customer Portal
**Impact: 3x customer satisfaction**

**Features:**
- White-label customer login
- Real-time project progress
- Two-way messaging
- Digital approvals
- Payment processing
- Review/testimonial collection

### 2.4 Inventory & Procurement
**Impact: 2x cost savings**

**Features:**
- Material stock tracking
- Reorder alerts
- Supplier price comparison
- Purchase order generation
- Delivery tracking
- Cost variance analysis

---

## Phase 3: Scale (6-12 months)

### 3.1 Marketplace
**Impact: 100x reach**

**Features:**
- Subcontractor network
- Equipment rental marketplace
- Material supplier marketplace
- Quote request distribution
- Lead generation
- Partner ratings/reviews

### 3.2 Financial Suite
**Impact: 10x business value**

**Features:**
- Invoicing with auto-follow-up
- Payment tracking
- Cash flow forecasting
- Cost center accounting
- Multi-currency support
- Tax reporting (BTW aangifte)

### 3.3 Field Service Management
**Impact: 5x operational efficiency**

**Features:**
- Real-time crew tracking
- Job dispatch system
- Service ticket management
- Equipment maintenance scheduling
- Safety checklists
- Compliance documentation

### 3.4 Business Intelligence
**Impact: 3x strategic decisions**

**Features:**
- Predictive analytics
- Market benchmarking
- Customer lifetime value
- Churn prediction
- Pricing optimization
- Competitor analysis

---

## Phase 4: Platform (12-24 months)

### 4.1 White-Label Solution
**Impact: 50x market reach**

**Features:**
- Reseller/partner program
- Custom branding per organization
- Custom domain support
- API for third-party apps
- Plugin/extension system
- Multi-language support (NL, DE, BE, UK)

### 4.2 Industry Templates
**Impact: 10x market segments**

**Verticals:**
- Tuincentra (garden centers)
- Gemeenten (municipalities)
- VvE's (homeowner associations)
- Vastgoedbeheerders (property managers)
- Groenvoorziening bedrijven (green maintenance)

### 4.3 Training & Certification
**Impact: 5x user adoption**

**Features:**
- In-app onboarding flows
- Video tutorials
- Knowledge base
- Certification program
- Community forum
- Partner support portal

### 4.4 Ecosystem
**Impact: 3x stickiness**

**Integrations:**
- Weather services (KNMI)
- Plant databases
- Material databases
- Equipment manufacturers
- Insurance providers
- Banking services

---

## Technical Roadmap

### Infrastructure Upgrades

| Component | Current | Target |
|-----------|---------|--------|
| Database | Convex | Convex + PostgreSQL for analytics |
| Hosting | Vercel | Multi-region (NL, DE, UK) |
| CDN | Vercel Edge | Cloudflare R2 + Edge |
| Mobile | None | React Native + Expo |
| API | Internal only | Public REST + GraphQL |
| Auth | Clerk | Clerk + SSO (Azure AD, Google Workspace) |
| Search | Basic index | Algolia / Typesense |
| File Storage | None | Cloudflare R2 / S3 |
| Queue | None | Inngest / Trigger.dev |
| Analytics | Basic | PostHog + Custom |

### Performance Targets

| Metric | Current | Target |
|--------|---------|--------|
| Page Load | ~2s | <1s |
| Quote Calculation | ~500ms | <100ms |
| PDF Generation | ~3s | <1s |
| Search | ~300ms | <50ms |
| Uptime | 99% | 99.99% |

### Security Enhancements

- SOC 2 Type II compliance
- GDPR compliance dashboard
- Data residency (EU)
- Audit logging
- Encryption at rest
- Penetration testing

---

## Business Model Evolution

### Current
- Free/Trial model
- Single pricing tier

### Target Tiers

| Tier | Price | Users | Features |
|------|-------|-------|----------|
| Starter | €29/mo | 1 | Basic quotes, 50 quotes/mo |
| Professional | €79/mo | 5 | Full features, unlimited quotes |
| Business | €199/mo | 15 | + Project management, planning |
| Enterprise | Custom | Unlimited | + API, integrations, SSO |

### Revenue Streams

1. **Subscriptions** (Primary)
2. **Transaction fees** (Marketplace, payments)
3. **Premium integrations**
4. **Training/certification**
5. **White-label licensing**

---

## Success Metrics

### User Growth
| Metric | Current | 1 Year | 3 Years |
|--------|---------|--------|---------|
| Active Users | 10 | 500 | 5,000 |
| Organizations | 1 | 100 | 1,000 |
| Quotes/Month | 50 | 5,000 | 100,000 |

### Revenue
| Metric | Current | 1 Year | 3 Years |
|--------|---------|--------|---------|
| MRR | €0 | €25K | €500K |
| ARR | €0 | €300K | €6M |

### Engagement
| Metric | Current | Target |
|--------|---------|--------|
| DAU/MAU | - | 60% |
| Quote → Project | - | 40% |
| Churn | - | <5% |
| NPS | - | 50+ |

---

## Immediate Action Items (Next 30 Days)

### Week 1-2: Foundation
- [ ] Implement organization/team support
- [ ] Add file upload for photos/documents
- [ ] Create customer portal MVP
- [ ] Add pagination to all lists

### Week 3-4: Intelligence
- [ ] Implement Leerfeedback UI for normuur suggestions
- [ ] Add comparison view for quote versions
- [ ] Create profitability dashboard
- [ ] Build quote template library

### Ongoing
- [ ] Mobile app POC (React Native)
- [ ] Exact Online integration research
- [ ] User interviews (10+ hoveniers)
- [ ] Competitive analysis

---

## Conclusion

The TOP Offerte Calculator has a solid foundation as a sophisticated quote builder with real-time calculations, project tracking, and learning feedback. To achieve 100x improvement, the focus should be:

1. **Expand horizontally**: Teams, mobile, integrations
2. **Add intelligence**: AI estimation, smart scheduling
3. **Build ecosystem**: Customer portal, marketplace
4. **Scale the platform**: White-label, multi-vertical

The Dutch landscaping market has ~15,000 businesses. Capturing 10% with an average €100/mo subscription = €18M ARR potential.

---

*Document generated: January 2026*
*Version: 1.0*
