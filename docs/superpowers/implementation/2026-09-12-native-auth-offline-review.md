# Native authenticatie en offline levenscyclus

## Authenticatiebesluit

De eigen werknemersapp behoudt de bestaande Clerk-toegang met e-mailcode, Google en wachtwoord. De e-mailcode is de bewuste functionele equivalent van wachtwoordloos aanmelden uit de bronapp. De bronervaring met een klikbare e-maillink wordt niet nagebouwd; bestaande accounts, organisatietoegang en onze login blijven leidend. Dit is expliciet afgestemd met de hoofdimplementatie op 12 september 2026. Er zijn geen echte mails verzonden en geen externe Clerk-instellingen gewijzigd.

Geïnstalleerd is `@clerk/clerk-expo` 2.19.21. Het lokale pakket exporteert geen `hosted-auth`; zijn `useSSO` ondersteunt OAuth en enterprise SSO en verwerkt een rotating-token nonce. Een algemene Account Portal-URL openen levert in deze versie geen gekoppelde native sessie op. Daarom is geen halfwerkende browserknop toegevoegd.

Clerk heeft inmiddels een officiële hosted-auth route in `@clerk/expo/hosted-auth` (Core 3). Deze opent Account Portal en draagt de sessie over aan de app. De productiecallback moet bij een geregistreerde native app horen; de Native API en Expo-plugin moeten passend zijn ingericht. Dat is een afzonderlijke SDK-/authmigratie als de exacte linkervaring later alsnog gewenst is. [Hosted-auth handleiding](https://clerk.com/docs/expo/guides/account-portal/hosted-auth), [API](https://clerk.com/docs/reference/expo/native-hooks/use-hosted-auth), [Core 3 migratie](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3), geraadpleegd 12 september 2026.

## Review en tests

`SessieConvexProvider` maakt een nieuwe Convex-client en componentboom per Clerk-session/user/org. De oude client sluit na unmount. Het uitgestelde sluiten voorkomt dat StrictMode's effectproef de actieve client sluit. `use-veld-server-actie` en de outbox zetten per HTTP-verzoek het token vast en controleren scope vóór en na het ophalen. Een oude websocketopdracht kan daarmee niet later onder een nieuw account worden verstuurd.

De nieuwe tests voeren de daadwerkelijke React-hooks uit met gemockte Clerk, NetInfo, opslag en HTTP-grenzen. Zeven scenario's zijn groen:

1. Offline eerst duurzaam opslaan, meerdere gemounte formulieren zien dezelfde wachtrij, heropenen en weer online gaan verstuurt eenmaal.
2. Unmount tijdens een geslaagde serveraanroep bewaart de opdracht; de nieuwe mount hervat via de 30-secondenretry met exact dezelfde sleutel en payload. De serverreceipt voorkomt dubbel boeken.
3. Een organisatiewissel tijdens tokenawait verstuurt geen oude opdracht en toont de oude wachtrij niet in het nieuwe account.
4. Netwerkfouten blijven pending; een inhoudelijke afwijzing blokkeert FIFO zichtbaar; expliciet opnieuw proberen bewaart sleutel/payload.
5. Organisatie- en sessiewissels vervangen client én formulierstaat; alleen de oude client sluit.
6. StrictMode-effectherhaling sluit de actieve client niet; echte unmount wel.
7. Een trage HTTP-aanroep geeft het formulier na 2,5 seconden duurzaam pending terug; het latere succes ruimt dezelfde opdracht op.

Een extra smokecheck draait op de meegeleverde Hermes-runtime voor React Native 0.81.5: geen Node Buffer, Clerk's eigen base64-polyfill, scopecontrole, Unicode JSON-persistentie, offline pending, opnieuw laden en identieke retry. De native AsyncStorage-bridge is daarbij vervangen door een JSON-opslagadapter; dit is nadrukkelijk geen fysieke device-/opslagtest. De iOS Expo Crypto-/fotobrug wordt apart door de hoofdimplementatie getest.

## Reproduceren

Vanuit `offerte-builder`:

```sh
npx vitest run --config mobile/vitest.config.ts
node mobile/scripts/test-hermes-outbox.cjs
npx vitest run src/__tests__/unit/mobile-role-retour.test.ts src/__tests__/unit/mobile-dagvoorstel.test.ts src/__tests__/unit/mobile-eigen-uren-csv.test.ts src/__tests__/unit/mobile-uren-concept.test.ts src/__tests__/unit/convex/veld-outbox.test.ts src/__tests__/unit/convex/veld-sessie.test.ts src/__tests__/unit/convex/veld-foto-proces.test.ts
npx tsc --noEmit
```

Daarnaast vanuit `mobile`: `npx tsc --noEmit`. Op 12 september 2026: beide typechecks groen, zeven native lifecycle-tests en 62 gerichte kern-/regressietests groen, Hermes-check groen. Native UI/uren is in deze review niet gewijzigd. Process-kill op een echt toestel, native opslagstoringen en echte Clerk provider-login blijven distributieacceptatie; de tests hierboven bewijzen die platformgrenzen niet.
