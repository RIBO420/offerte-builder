# Authenticatie, routing & klant-onboarding (web)

- **Single login terminal:** de app-root `/` (`src/app/page.tsx`) IS het loginformulier
  (custom Clerk `useSignIn`). Er zijn GEEN `/sign-in`- of `/sign-up`-routes. Self-service
  sign-up staat uit in Clerk — stafaccounts worden intern aangemaakt; klanten alleen via
  uitnodiging.
- **Middleware:** `src/proxy.ts` (Next.js 16 hernoemde `middleware` → `proxy`).
  Niet-ingelogde requests op beschermde routes gaan naar `/`; ingelogde **klanten**
  worden naar `/portaal/overzicht` gerouteerd, staf naar `/dashboard`.
- **Role-based home:** routing gebruikt de **Convex**-rol (direct gezet door
  `users.linkKlantAccount`), niet de Clerk-sessieclaim (die kan achterlopen vlak na
  sign-up). De loginpagina (`src/app/page.tsx`) en `src/app/(dashboard)/layout.tsx`
  sturen klanten allebei naar het portaal; de dashboard-layout blokkeert klanten ook
  op stafpagina's.

## Klant-onboarding (uitnodigingsflow)

1. Admin klikt "Verstuur uitnodiging" op de klantenpagina →
   `klanten.sendPortalInvitation` → schedult `portaalEmail.sendClerkInvitation`
   (Clerk REST `POST /v1/invitations`, `notify:true`). Clerk mailt een
   "set password"-link (NIET Resend).
2. Link → `/portaal/registreren` (Clerk `<SignUp>` via invitation-ticket — werkt ook
   met sign-up op restricted) → wachtwoord instellen → `/portaal/koppelen` koppelt de
   Clerk-user aan het klantrecord (`users.linkKlantAccount` zet `role:"klant"` en
   synct dat naar Clerk publicMetadata via `users.setClerkMetadata`).
3. Klant logt daarna gewoon in op `/` en landt op het portaal.

- `/portaal/registreren` is de enige publieke `/portaal`-route (invitation accept);
  al het andere onder `/portaal/*` vereist auth.
- **Clerk/Convex-vereisten:** Clerk sign-up mode = "Restricted" + Email aan als
  identifier; `CLERK_SECRET_KEY` in de **Convex**-env (gebruikt door
  `sendClerkInvitation` + `setClerkMetadata`). Invite-redirect-base =
  `NEXT_PUBLIC_APP_URL` / `SITE_URL` (Convex-env; prod = `https://toptuinen.app`).
