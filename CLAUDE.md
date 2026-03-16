# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Top Tuinen Offerte Calculator — a monorepo for a Dutch landscaping company (Top Tuinen) containing a web app for quote/project management and a mobile app for field workers. All UI text is in Dutch.

## Architecture

```
/src/          → Next.js 16 web app (App Router, React 19, Tailwind CSS 4, shadcn/ui)
/mobile/       → React Native Expo 54 app (NativeWind, Expo Router)
/convex/       → Shared serverless backend (65+ function files, schema, auth)
/public/       → Static assets for web
```

- **Convex** is the single backend for both web and mobile — all data, mutations, queries, and business logic live here
- **Clerk** handles auth for both platforms (same project, different SDKs: `@clerk/nextjs` for web, `@clerk/clerk-expo` for mobile)
- Web and mobile do NOT share UI components (different frameworks), but share the Convex backend

## Commands

### Web App
```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npm run test:coverage
```

### Mobile App
```bash
cd mobile
npx expo start --ios          # Start Expo dev server + iOS simulator
npx expo start --ios --clear  # Start with Metro cache cleared
npm install --legacy-peer-deps # Required flag due to Clerk peer dep conflicts
```

### Convex Backend
```bash
npx convex dev       # Start Convex dev server (syncs schema + functions)
npx convex deploy    # Deploy to production
```

## Key Domain Concepts

- **Offerte** = Quote/proposal with status workflow: concept → voorcalculatie → verzonden → geaccepteerd → geweigerd
- **Klant** = Customer
- **Medewerker** = Employee/staff member
- **Aanleg** = New garden installation (scopes: grondwerk, bestrating, borders, gras, houtwerk, water_elektra, specials)
- **Onderhoud** = Maintenance contracts
- **Regels** = Line items (type: materiaal/arbeid/machine) with hoeveelheid × prijsPerEenheid
- **Nacalculatie** = Post-calculation (comparing estimated vs actual costs)
- **Uren** = Hours/time tracking by field workers

## Web App Structure

- Forms: React Hook Form + Zod validation
- Wizards: Custom hooks (e.g., `useAanlegWizard`) in `src/components/offerte/`
- Scope forms: `src/components/offerte/scope-forms/` — one form per scope type
- Calculator: `src/lib/offerte-calculator.ts` — pricing logic
- PDF generation: React PDF (`@react-pdf/renderer`)
- UI components: shadcn/ui (Radix primitives + Tailwind)

## Mobile App Structure

- **Design system:** Premium Organic theme — dark mode with nature-green accents (#4ADE80 primary)
- **Theme tokens:** `mobile/theme/` — colors, typography, spacing, shadows, animations, haptics (single source of truth; tailwind.config.js imports from here)
- **UI components:** `mobile/components/ui/` — 25+ components with CVA variants, Reanimated animations, haptic feedback
- **Navigation:** Expo Router with custom FloatingTabBar (blur, spring animations, Lucide icons — NO emojis as icons)
- **Tabs:** Home (hero project + notifications), Foto's, Uren, Chat, Profiel
- **Hooks:** `mobile/hooks/` — auth, offline sync, photo capture, audio recording, push notifications, Reanimated animation hooks
- **Offline-first:** SQLite local DB + Convex sync engine (`mobile/lib/storage/`)
- **Auth:** Clerk Expo + biometric login (Face ID/Touch ID)

## Convex Patterns

- Schema defined in `convex/schema.ts` with Zod-like validators
- Functions organized by domain: `convex/offertes.ts`, `convex/klanten.ts`, `convex/projecten.ts`, etc.
- Auth via `convex/auth.config.ts` using Clerk provider
- Role-based access: admin, medewerker, viewer (checked via `convex/users.ts`)

## Important Notes

- All npm installs in `/mobile` require `--legacy-peer-deps` flag
- Mobile uses `react-native-reanimated` v4.1.1 (not legacy Animated API)
- The web app uses Tailwind CSS v4 (not v3) — different config format than mobile
- Mobile uses NativeWind (Tailwind for RN) with `tailwind.config.js` v3 syntax
