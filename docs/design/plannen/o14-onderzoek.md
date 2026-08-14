# O14-onderzoek — providers per route-groep (alleen onderzoek, niets gewijzigd)

*WS8, 14 aug 2026. Vraag uit optimize.md/masterplan keuzepunt 6: kan de publieke
configurator zonder Clerk JS, door de providers uit de root-layout naar
route-groep-layouts te verhuizen? Besluit masterplan: alléén onderzoeken.*

## Huidige situatie

`src/app/layout.tsx` wikkelt de héle app in `ClerkProvider` →
`ConvexClientProvider` (= `ConvexProviderWithClerk` + één module-globale
`ConvexReactClient`, zie `src/components/providers/convex-client-provider.tsx`).
Daardoor laadt óók `/configurator/*` (publiek, klantgericht, vaak mobiel) de
Clerk-runtime, terwijl er niets in te loggen valt (bevinding B9: Clerk-dev-
warning in de console op /configurator/gazon).

Routekaart (relevant):

| Groep | Clerk nodig? | Convex nodig? |
|---|---|---|
| `/` = `src/app/page.tsx` (login) | **ja** (signIn-flow, `window.Clerk` voor dev-login) | ja |
| `(auth)` (sso-callback) | **ja** | nee |
| `(dashboard)` | **ja** | ja (geauthenticeerd) |
| `portaal/(auth)` + `portaal/(portal)` | **ja** | ja (geauthenticeerd) |
| `(public)/configurator` | **nee** | **ja, maar publiek** (aanvraag-mutations + status-query, rate-limited; geverifieerd: geen `useAuth`/`useUser`/Clerk-component onder `(public)/`) |

## Doelarchitectuur (als het ooit uitgevoerd wordt)

1. Nieuwe `AuthProviders`-clientcomponent (ClerkProvider + ConvexProviderWithClerk)
   gemount in: een layout om de login-pagina, `(auth)/layout.tsx`,
   `(dashboard)`-tak en `portaal`-tak. De login-pagina moet daarvoor van
   `src/app/page.tsx` naar bijv. `src/app/(login)/page.tsx` met eigen layout
   (URL blijft `/`; `src/proxy.ts` matcht op paden, niet op groepen — geen wijziging).
2. `(public)/configurator/layout.tsx` krijgt een kale `ConvexProvider` met een
   **eigen** `ConvexReactClient`-instantie. Niet de bestaande module-const
   hergebruiken: daarop doet `ConvexProviderWithClerk` elders `setAuth`, en een
   gedeelde client zou auth-state (token, WebSocket-heridentificatie) het
   publieke deel in trekken.
3. Root-layout houdt alleen Clerk-vrije providers (Theme, Motion, LiveRegion,
   ErrorBoundary, Toaster, ChunkReloadHandler) + fonts/metadata.

## Risico's en obstakels (waarom dit géén quick win is)

- **De ConvexProviderWithClerk-koppeling is precies de valkuil uit het
  masterplan**: de configurator gebruikt wél Convex. Hij kan dus niet simpelweg
  "buiten de providers" — hij heeft een eigen, ongeauthenticeerde provider
  nodig, en dat betekent twee ConvexReactClient-instanties in de codebase.
- **Twee WebSocket-verbindingen** wanneer staf vanuit de app de configurator
  opent (of andersom); client-side navigatie tussen groepen unmount/remount de
  providers, waardoor Clerk zich opnieuw initialiseert en Convex-subscripties
  herstarten. Voor de echte doelgroep (anonieme funnel-bezoeker) irrelevant.
- **Login-verhuizing raakt gevoelige flows**: dev-login-script
  (`scripts/dev-login.mjs` verwacht `window.Clerk` op `/`), klant-
  uitnodigingsflow (docs/dev/auth-en-klantonboarding.md), sso-callback en de
  kapotte auth-E2E. Alles blijft functioneel gelijk, maar moet wél hertest.
- **Sentry + CSP**: ongewijzigd; de CSP-hosts voor Clerk blijven nodig voor de
  rest van de app (headers zijn app-breed in next.config.ts).
- **Meetbaarheid**: de Clerk-browserruntime (clerk-js) laadt grotendeels als
  extern script vanaf het Clerk-domein — de winst zit vooral in netwerk/parse
  op het kritieke pad van de funnel en in het schrappen van de handshake, en is
  dus in een productiemeting van de configurator-route te zien, niet per se in
  de First-Load-JS-getallen van `next build`.

## FOUC / licht-flits (meeliftende onderzoeksvraag uit critique)

- `next-themes` (`ThemeProvider attribute="class"`, `defaultTheme="system"`,
  `suppressHydrationWarning`) injecteert zijn theme-script vóór de eerste
  paint; het klassieke dark-FOUC-mechanisme is dus afgedekt.
- De waargenomen "flits" bij harde loads was in de praktijk het zwarte
  laadgat van de auth-gate (spinner op leeg vlak) — dat is in WS8-O11
  vervangen door een statisch shell-silhouet dat al in de server-HTML zit.
  Advies: na O11 in productie opnieuw kijken; pas als er dán nog een flits
  is, verder graven (audit noemde het deels een dev-server-artefact).

## Advies

Uitvoerbaar en veilig te maken, maar middelgroot (login-verhuizing + tweede
Convex-client + hertest van login/portaal/configurator-E2E): ± een dagdeel
plus regressie. Waarde is het grootst zodra de configurator echt als
marketing-funnel wordt ingezet (WS9 is nu net af). Aanbeveling: als eigen
werkstroompje inplannen ná een productiemeting van de configurator-route,
niet in WS8 meenemen.
