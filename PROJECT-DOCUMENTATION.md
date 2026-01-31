# Offerte Builder - Project Documentation

> Comprehensive documentation for the Offerte Builder application. This document contains all information needed to continue development in future sessions.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run Convex backend
npx convex dev
```

**URLs:**
- Local: http://localhost:3000
- Convex Dashboard: https://dashboard.convex.dev

---

## Project Overview

**What is it?**
A professional quote/estimate (offerte) management system for Dutch landscaping companies (hoveniers). It handles both new garden installations (aanleg) and ongoing maintenance contracts (onderhoud).

**Key Features:**
- Multi-step wizard for creating detailed offertes
- Automatic calculation of materials, labor hours, and pricing
- Customer management (klanten)
- Price book management (prijsboek)
- PDF generation and email sending
- Public sharing links for customers
- Version history and rollback
- Analytics and reporting
- Dark/light mode

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | latest |
| Database | Convex | 1.31.6 |
| Authentication | Clerk | 6.37.0 |
| Forms | React Hook Form | 7.71.1 |
| Validation | Zod | 4.3.6 |
| PDF | @react-pdf/renderer | latest |
| Email | Resend + React Email | 6.9.1 |
| Charts | Recharts | 3.7.0 |
| Icons | Lucide React | latest |
| Error Tracking | Sentry | latest |

---

## Directory Structure

```
offerte-builder/
├── convex/                    # Backend (Convex)
│   ├── schema.ts              # Database schema
│   ├── offertes.ts            # Offerte CRUD & queries
│   ├── klanten.ts             # Customer operations
│   ├── producten.ts           # Price book
│   ├── normuren.ts            # Standard labor hours
│   ├── instellingen.ts        # User settings
│   ├── correctiefactoren.ts   # Correction factors
│   ├── standaardtuinen.ts     # Templates
│   ├── offerteVersions.ts     # Version history
│   ├── offerte_messages.ts    # Customer chat
│   ├── emailLogs.ts           # Email tracking
│   ├── publicOffertes.ts      # Public sharing
│   ├── analytics.ts           # Business analytics
│   └── validators.ts          # Zod schemas
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth pages (sign-in, sign-up)
│   │   ├── (dashboard)/       # Main app routes
│   │   │   ├── page.tsx                    # Dashboard
│   │   │   ├── offertes/                   # Offerte pages
│   │   │   │   ├── page.tsx                # List
│   │   │   │   ├── [id]/page.tsx           # View
│   │   │   │   ├── [id]/bewerken/page.tsx  # Edit
│   │   │   │   ├── [id]/history/page.tsx   # Versions
│   │   │   │   └── nieuw/                  # Create
│   │   │   │       ├── aanleg/page.tsx     # New aanleg
│   │   │   │       └── onderhoud/page.tsx  # New onderhoud
│   │   │   ├── klanten/                    # Customer pages
│   │   │   ├── prijsboek/                  # Price book
│   │   │   ├── instellingen/               # Settings
│   │   │   ├── rapportages/                # Analytics
│   │   │   └── profiel/                    # User profile
│   │   ├── (public)/          # Public routes
│   │   │   └── offerte/[token]/page.tsx    # Customer view
│   │   └── api/
│   │       └── email/route.ts              # Email endpoint
│   │
│   ├── components/
│   │   ├── ui/                # 74 UI components (shadcn/ui)
│   │   ├── offerte/           # Offerte-specific components
│   │   │   ├── scope-forms/   # Aanleg scope forms (7)
│   │   │   └── onderhoud-forms/# Onderhoud forms (5)
│   │   ├── pdf/               # PDF generation
│   │   ├── email/             # Email templates
│   │   ├── analytics/         # Dashboard charts
│   │   ├── providers/         # React context providers
│   │   └── skeletons/         # Loading states
│   │
│   ├── hooks/                 # 24 custom React hooks
│   │   ├── use-offertes.ts    # Offerte data
│   │   ├── use-klanten.ts     # Customer data
│   │   ├── use-producten.ts   # Product data
│   │   ├── use-instellingen.ts# Settings
│   │   ├── use-current-user.ts# Auth sync
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── offerte-calculator.ts  # Main calculation engine
│   │   ├── utils.ts               # cn() helper
│   │   ├── validations/           # Zod schemas
│   │   └── constants/             # App constants
│   │
│   └── types/
│       └── offerte.ts         # TypeScript definitions
│
├── public/                    # Static assets
└── Configuration files
```

---

## Database Schema (Convex)

### Core Tables

#### `offertes` - Main business document
```typescript
{
  userId: Id<"users">
  klantId?: Id<"klanten">
  type: "aanleg" | "onderhoud"
  status: "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen"
  offerteNummer: string

  // Customer info (denormalized)
  klantNaam: string
  klantAdres: string
  klantPostcode: string
  klantPlaats: string
  klantEmail?: string
  klantTelefoon?: string

  // General parameters
  algemeenParams: {
    tuinOppervlakte: number
    bereikbaarheid: "goed" | "beperkt" | "slecht"
    achterstalligheid?: "laag" | "gemiddeld" | "hoog"
    complexiteit?: "laag" | "gemiddeld" | "hoog"
    afstandTotWater?: number
    uurtarief?: number
    standaardMargePercentage?: number
    btwPercentage?: number
  }

  // Scopes (which parts of the offerte)
  scopes: string[]  // e.g., ["grondwerk", "bestrating", "gras"]
  scopeData: object // Detailed data per scope

  // Calculated values
  totalen: {
    subtotaalExBtw: number
    btwBedrag: number
    totaalInclBtw: number
    totaalUren: number
    totaalMarge: number
    margePercentage: number
  }
  regels: OfferteRegel[]  // Line items

  // Public sharing
  shareToken?: string
  shareExpiresAt?: number
  customerResponse?: {
    status: "geaccepteerd" | "afgewezen"
    signature?: string
    remarks?: string
    respondedAt: number
  }

  // Meta
  opmerkingen?: string
  createdAt: number
  updatedAt: number
}
```

#### `klanten` - Customers
```typescript
{
  userId: Id<"users">
  naam: string
  adres: string
  postcode: string
  plaats: string
  email?: string
  telefoon?: string
  notities?: string
}
```

#### `producten` - Price book items
```typescript
{
  userId: Id<"users">
  productnaam: string
  categorie: string  // e.g., "grondwerk", "bestrating"
  inkoopprijs: number
  verkoopprijs: number
  eenheid: string    // "m²", "stuk", "m³", etc.
  leverancier?: string
  verliespercentage?: number
  isActief: boolean
}
```

#### `normuren` - Standard labor hours
```typescript
{
  userId?: Id<"users">  // null = system default
  activiteit: string    // e.g., "Grond afgraven"
  scope: string         // e.g., "grondwerk"
  normuurPerEenheid: number
  eenheid: string
  omschrijving?: string
}
```

#### `instellingen` - User settings
```typescript
{
  userId: Id<"users">
  uurtarief: number           // Default: 55
  standaardMargePercentage: number  // Default: 25
  scopeMarges?: {
    grondwerk?: number
    bestrating?: number
    // ... per scope
  }
  btwPercentage: number       // Default: 21
  bedrijfsgegevens?: {
    bedrijfsnaam: string
    adres: string
    postcode: string
    plaats: string
    telefoon: string
    email: string
    kvkNummer?: string
    btwNummer?: string
    iban?: string
    logo?: string
  }
  offerteNummerPrefix: string
  laatsteOfferteNummer: number
}
```

---

## Key Business Logic

### Offerte Types

**Aanleg (Installation)** - New garden construction with 7 scopes:
1. **Grondwerk** - Earthwork (excavation, soil, sand)
2. **Bestrating** - Paving (tiles, stones, edging)
3. **Borders** - Plant beds (plants, mulch)
4. **Gras** - Grass (turf or seeding)
5. **Houtwerk** - Woodwork (fencing, pergolas)
6. **Water & Elektra** - Water features, lighting
7. **Specials** - Special items (jacuzzi, sauna, outdoor kitchen)

**Onderhoud (Maintenance)** - Ongoing garden care with 5 scopes:
1. **Gras onderhoud** - Grass maintenance (mowing frequency)
2. **Borders onderhoud** - Plant bed maintenance
3. **Heggen** - Hedge trimming
4. **Bomen** - Tree maintenance
5. **Overig** - Other tasks

### Calculation Flow

```
1. User inputs scope data (m², quantities, options)
         ↓
2. offerte-calculator.ts processes each scope
         ↓
3. Generates line items (regels) with:
   - Description
   - Quantity & unit
   - Material cost (from producten)
   - Labor hours (from normuren)
   - Unit price
   - Total price
         ↓
4. Applies correction factors:
   - Bereikbaarheid (accessibility): goed=1.0, beperkt=1.15, slecht=1.3
   - Achterstalligheid (neglect): laag=1.0, gemiddeld=1.2, hoog=1.5
   - Complexiteit (complexity): laag=1.0, gemiddeld=1.15, hoog=1.3
         ↓
5. Applies margin percentage (per scope or default)
         ↓
6. Calculates VAT (BTW)
         ↓
7. Stores totals in offerte.totalen
```

### Calculator Constants (offerte-calculator.ts)

```typescript
// Grondwerk depths
const DIEPTE_METERS = {
  licht: 0.2,
  standaard: 0.4,
  zwaar: 0.6,
}

// Material quantities per m²
const ZAND_M3_PER_M2 = 0.05
const SCHORS_M3_PER_M2 = 0.05
const GRASZAAD_KG_PER_M2 = 0.035
const GRASZODEN_M2_PER_M2 = 1.1  // 10% overlap
const SPLIT_M3_PER_M2 = 0.04

// Installation hours
const GRASZODEN_UREN_PER_M2 = 0.15
const GRASZAAD_UREN_PER_M2 = 0.1
const SCHUTTING_UREN_PER_M = 0.75
const PERGOLA_UREN_PER_M2 = 2
const VIJVER_UREN_PER_M2 = 3
const VIJVER_UREN_PER_M3 = 4
```

---

## Authentication Flow

```
1. User visits app → Clerk middleware checks auth
         ↓
2. Not logged in → Redirect to /sign-in
         ↓
3. User signs in via Clerk
         ↓
4. useCurrentUser() hook:
   - Gets Clerk user data
   - Calls Convex upsertUser mutation
   - Creates user record in Convex if new
   - Initializes default settings & normuren
         ↓
5. All queries use Convex auth context
   - No manual userId passing needed
   - Queries return undefined if not authenticated
```

---

## Key Hooks

### Data Hooks
```typescript
// Offertes
const { offertes, stats, recentOffertes, createOfferte, updateOfferte } = useOffertes()
const { offerte, isLoading } = useOfferte(id)

// Klanten
const { klanten, createKlant, updateKlant, deleteKlant } = useKlanten()
const { klant, offertes } = useKlantWithOffertes(id)

// Products
const { producten, createProduct, updateProduct } = useProducten()

// Settings
const { instellingen, updateInstellingen } = useInstellingen()
```

### UI Hooks
```typescript
// Keyboard shortcuts
useKeyboardShortcuts([
  { key: ".", meta: true, action: () => setOpen(true) }
])

// Mobile detection
const isMobile = useIsMobile()

// PDF generation
const { generatePDF, isGenerating, progress } = usePDFGeneration()

// Autosave
useWizardAutosave({ data, onSave, debounceMs: 2000 })
```

---

## API Routes

### POST /api/email
Sends offerte emails via Resend.

**Request:**
```typescript
{
  type: "offerte_verzonden"
  to: string           // Customer email
  klantNaam: string
  offerteNummer: string
  totaalInclBtw: number
  bedrijfsnaam: string
  bedrijfsEmail: string
  bedrijfsTelefoon: string
  offerteType: "aanleg" | "onderhoud"
  scopes: string[]
}
```

**Response:**
```typescript
{ success: true, resendId: string }
// or
{ error: string }
```

---

## Styling System

### CSS Tokens (globals.css)

```css
/* Scope colors (OKLCH) */
--scope-grondwerk: oklch(0.55 0.12 85);
--scope-bestrating: oklch(0.55 0.02 250);
--scope-borders: oklch(0.45 0.15 145);
--scope-gras: oklch(0.65 0.2 130);
--scope-houtwerk: oklch(0.5 0.12 55);
--scope-water: oklch(0.55 0.15 230);
--scope-specials: oklch(0.55 0.2 300);

/* Animation tokens */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);

/* Shadow tokens */
--shadow-card: 0 1px 3px oklch(0 0 0 / 0.1);
--shadow-card-hover: 0 8px 25px -5px oklch(0 0 0 / 0.1);
```

### Component Patterns

```typescript
// All components use forwardRef and displayName
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn("...", className)} {...props} />
  )
)
Button.displayName = "Button"
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+.` | Open command palette |
| `Cmd+/` | Open shortcuts help |
| `Shift+?` | Open shortcuts help |
| `Esc` | Close dialogs |
| `↑↓` | Navigate lists |
| `Enter` | Select item |

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_xxx
CLERK_SECRET_KEY=sk_xxx
RESEND_API_KEY=re_xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx.sentry.io
SENTRY_AUTH_TOKEN=xxx
```

---

## Common Development Tasks

### Adding a New Scope

1. **Define types** in `src/types/offerte.ts`
2. **Add form component** in `src/components/offerte/scope-forms/`
3. **Add calculation logic** in `src/lib/offerte-calculator.ts`
4. **Update validation** in `src/lib/validations/`
5. **Add to wizard** in the appropriate create page

### Adding a New Page

1. Create file in `src/app/(dashboard)/[route]/page.tsx`
2. Add navigation item to `src/components/app-sidebar.tsx`
3. Add to command palette in `src/components/command-palette.tsx`

### Adding a New Convex Function

1. Create/edit file in `convex/`
2. Define query/mutation with proper auth
3. Create hook in `src/hooks/`
4. Use in components

---

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

Tests are located in `src/__tests__/`.

---

## Deployment

The app is deployed on Vercel with automatic deployments from the main branch.

```bash
# Manual deploy
npx vercel

# Production deploy
npx vercel --prod
```

---

## Known Issues / TODOs

1. Email sending uses `onboarding@resend.dev` - needs verified domain for production
2. Sentry proxy errors (ECONNRESET) appear in dev but don't affect functionality
3. Some Fast Refresh warnings when editing provider files

---

## Related Documentation

- `UI-UX-IMPROVEMENTS.md` - Recent UI/UX improvements
- `VALIDATIE-CHECKLIST.md` - Validation requirements
- `convex/README.md` - Convex-specific docs
- `docs/` - Additional documentation

---

## Contact & Resources

- **Convex Docs**: https://docs.convex.dev
- **Clerk Docs**: https://clerk.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com

---

*Last updated: January 2026*
