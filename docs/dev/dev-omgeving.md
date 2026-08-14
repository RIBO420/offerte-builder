# Dev-omgeving: server, inloggen, demodata, cache-valkuilen

## Dev-server & poorten

De dev-server draait niet standaard en heeft geen vaste poortclaim: poort 3000 is bij
deze gebruiker soms Timeline-ERP en 3002 Vitamientje-agent. Start hem expliciet
(`npm run dev:all`) en controleer wélke app antwoordt (`/` moet "Top Tuinen" bevatten)
voordat je een poortnummer doorgeeft.

## Ingelogd in de browser komen (ook als agent) — `npm run dev:login`

Vrijwel elk scherm zit achter Clerk. Bouw géén tijdelijke publieke "meetpagina";
log echt in met een **Clerk sign-in token** (geen wachtwoord, geen extra route in de
app). Werkt alleen lokaal: het script weigert als de Clerk-sleutels geen
`sk_test_`/`pk_test_` zijn of de app-origin geen localhost is.

```bash
npm run dev:all      # next dev + convex dev samen (Convex moet draaien, anders hangen queries)
npm run dev:login    # laat draaien; ruimt zichzelf na 120s op
```

**Let op: de preview-manager van Claude Code start alleen `next dev`,** ook al wijst
`.claude/launch.json` naar `npm run dev:all` — `convex dev` draait dan dus NIET mee
(empirisch vastgesteld 14 aug 2026: geen convex-proces, geen convex-regels in de
logs). De app blijft werken omdat hij rechtstreeks met de cloud-dev-deployment
praat, maar wijzigingen onder `convex/` bereiken die deployment pas na een sync:
draai na elke convex-wijziging `npx convex dev --once` (eenmalig, geen server).

`dev:login` legt een kortlevend ticket in `public/dev-login-ticket.js` (gitignored)
en print een snippet. Draai dat **in de browserconsole op `http://localhost:3000/`**
(bij Claude Code: `javascript_tool` op de tab), daarna navigeren naar `/dashboard`:

```js
(async () => { const r = await fetch('/dev-login-ticket.js', { cache: 'no-store' }); const { ticket } = await r.json(); await window.Clerk.load(); const s = await window.Clerk.client.signIn.create({ strategy: 'ticket', ticket }); if (s.status !== 'complete') return 'status=' + s.status; await window.Clerk.setActive({ session: s.createdSessionId }); return 'ok'; })()
```

Verwacht: `"ok"`, daarna zijn `/dashboard`, `/klanten` enz. zichtbaar als
`E2E_CLERK_USER_EMAIL`. De sessie blijft staan nadat het ticket is opgeruimd, en
geldt voor álle tabs van het browserpaneel.

Twee valkuilen die je anders opnieuw ontdekt:
- **Geen eigen hulpserver op een andere poort.** De CSP zet `connect-src 'self'`,
  dus een fetch naar bv. `127.0.0.1:4599` wordt geblokkeerd. Daarom staat het ticket
  same-origin onder `public/`.
- **Extensie `.js`, niet `.json`.** De matcher in `src/proxy.ts` sluit statische
  bestanden uit op extensie, maar `js(?!on)` laat `.json` er juist wél door: een
  `.json` in `public/` wordt door clerkMiddleware afgeschermd (307 naar `/`).

Ander account: `npm run dev:login -- --email iemand@toptuinen.nl`.
Achtergebleven ticket: `npm run dev:login -- --clean`.

## Demodata in de dev-deployment — `seed:demo` / `seed:clear`

Een leeg scherm zegt niets over de UI. `convex/demoSeed.ts` vult daarom dezelfde
dev-deployment die jij én een agent voor je hebben (bewust geen aparte database,
anders kijken jullie naar verschillende schermen):

```bash
npm run seed:demo    # ~365 records: 25 klanten, 15 leads over alle kanban-kolommen,
                     # 20 offertes in alle statussen, 12 werkitems, uren, facturen, meldingen
npm run seed:clear   # ongedaan maken
```

- **Clear verwijdert alleen wat de seed heeft aangemaakt.** Elke insert wordt
  geregistreerd in de tabel `demoSeed` (tabelnaam + document-id); opruimen loopt
  uitsluitend die registratie af. Nooit "alles in tabel X" en nooit een naampatroon —
  in deze deployment staat ook echte geïmporteerde klantdata. Handmatig verwijderde
  documenten worden overgeslagen. Seeden met bestaande registratie weigert.
- **Productie-guard.** De mutation leest `process.env.CONVEX_CLOUD_URL` en draait
  alleen op `affable-rook-669`. Op `impartial-dinosaur-829` (productie) of onbekend
  weigert hij hard; zonder vaststelbare deployment is `bevestigDeployment` verplicht
  (de npm-scripts geven die mee). De guard faalt dus dicht.
- **Contactgegevens zijn met opzet niet routeerbaar:** e-mail op `.test`,
  telefoonnummers in het niet-uitgegeven blok `06-9…`. Niet "realistischer" maken —
  de app heeft mailtriggers en een concept-mail-wachtrij.
- Twee dingen die de seed-inhoud sturen: `users.initializeDefaults` archiveert bij het
  laden van de app elk werkitem + offerte met een betaalde project-factuur (dus hangt
  maar één factuur aan een project); en klanten met `pipelineStatus: "lead"` vallen
  uit /klanten (`hoortInKlantenLijst`).

## Zie je je wijziging niet? — vaste diagnosevolgorde

Vooraf: de grootste bron van dit probleem is gedicht. `next.config.ts` zette
`cache-control: immutable` op `/_next/static` — óók in dev, waar Turbopack-
chunknamen (bv. `_35b5f087._.js`) níét content-gehasht zijn. Browsers die de
app eerder laadden hergebruikten daardoor eindeloos verouderde chunks, met
hydration-mismatches, oude UI naast nieuwe server-HTML en spook-404's tot
gevolg. Sinds commit `7a74f89` staan die cacheblokken achter een
`NODE_ENV === "production"`-guard; in dev serveren chunks nu
`no-store, must-revalidate` (geverifieerd). Zie je tóch iets ouds:

1. **Merkteken eerst.** Zet een uniek woord (bv. `ZZTEST`) in de JSX, grep `.next/`
   om te zien of het in de build zit, kijk of het in de browser staat. Ruim het
   merkteken daarna op.
2. Zit het wél in de build maar níét in beeld → **HTTP-cache van het browserpaneel**
   (kan nog voorkomen bij tabs die vóór de headerfix laadden). Ctrl-Shift-R helpt
   daar niet; alleen `navigate` met `force: true` (of een andere echte cache-bypass).
3. Zit het níét in de build → **stale dev-server**. Tailwind v4 + Turbopack serveert
   soms een verouderde stylesheet: classes staan in de DOM maar de CSS-regel ontbreekt
   (herken: `grid-cols-[…]` in de DOM, computed `grid-template-columns` één kolom).
   Herstart de dev-server.
4. **Nooit `npm run build` naast een draaiende `next dev`.** Ze delen `.next/`; de
   dev-server serveert daarna oude modules en je meet code die niet meer bestaat.
   Stop de dev-server, bouw, start opnieuw.

Elk van deze valkuilen heeft al minstens een half uur gekost; de volgorde hierboven
voorkomt dat je servers herstart of `.next/` weggooit terwijl je naar een cache kijkt.

## Turbopack-chunkbug: dode code verwijderen kan de app slopen

Valt ná het verwijderen van ogenschijnlijk dode code élke pagina van een segment in
de errorboundary met "Module […]/node_modules/… might have been deleted in an HMR
update" — terwijl typecheck, lint en alle tests groen zijn — dan kan dat een
Turbopack-bug zijn (gezien op Next 16.1.7): de client-chunkgraph verliest een module
die de servergraph nog refereert, ook na een kóúde build met verse `.next/`.
Concreet geval: het verwijderen van de ongebruikte `projectSubItems`-const uit
`app-sidebar.tsx` liet een lucide-clientmodule uit de graph vallen (commit
`3564dcd`). Aanpak: bisect met HMR-stappen, bevestig met een koude build, en laat
desnoods de dode declaratie staan met een `void`-referentie en een commentaar dat
naar deze sectie wijst.

## E2E-auth (pre-existing stuk)

De diagnose "selectors kloppen niet" was onjuist: `src/app/page.tsx` heeft wél
`<Label htmlFor="email">E-mailadres</Label>` en `Wachtwoord`. De echte oorzaak is nog
niet gevonden (denk aan bot-protection/Turnstile of `clerkSetup()`). Wie dit oppakt:
overweeg `login()` in `e2e/helpers/auth.ts` te laten inloggen via een sign-in token
(zelfde ticket-strategie als `scripts/dev-login.mjs`) — dan is er geen wachtwoord en
geen bot-detectie meer nodig.
