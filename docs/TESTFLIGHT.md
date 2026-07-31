# TestFlight — Top Tuinen medewerkers-app op je eigen iPhone

Draaiboek voor het bouwen en distribueren van de Expo-app (`mobile/`) via TestFlight.

- **EAS project:** `@ricardobos/toptuinen` (`b353b3f3-5b5a-456d-9176-0cbcc08719c7`)
- **Bundle ID:** `nl.toptuinen.medewerkers`
- **App Store Connect App ID:** `6796370115` → [TestFlight](https://appstoreconnect.apple.com/apps/6796370115/testflight/ios)
- **Apple Team:** Ricardo Bos (`4DNN2ZQY39`) — individueel account, geen organisatie
- **Backend (production profile):** Convex `impartial-dinosaur-829` + Clerk production (`clerk.toptuinen.app`)
- **TestFlight groep:** `Team (Expo)` — automatisch aangemaakt door `eas submit`

## Inloggen in de app

Log in met **`riboebusiness@gmail.com`**. Dat is de enige account in de production Clerk
instance met een `linkedMedewerkerId` in Convex, en daar hangt de medewerkers-functionaliteit
(projecten, uren) aan vast. `ricardobos43@gmail.com` bestaat ook en is admin, maar mist die
koppeling.

Op beide accounts staat **geen wachtwoord** (`password_enabled: false`), dus kies in het
loginscherm de **e-mail magic link**, niet wachtwoord-login.

---

## Wat al geregeld is

| Item | Status |
|---|---|
| EAS project gekoppeld (`extra.eas.projectId` in `app.json`) | ✅ |
| Productie env vars in `eas.json` (`build.production.env`) | ✅ |
| Clerk production publishable key geverifieerd tegen live instance | ✅ |
| iOS Info.plist permissie-strings (camera, microfoon, foto's, locatie, Face ID) | ✅ |
| `ITSAppUsesNonExemptEncryption: false` — anders blijft de build hangen op *Missing Compliance* | ✅ |
| App-icoon 1024×1024 zonder alpha-kanaal | ✅ |
| Productie-bundle bouwt foutloos (`expo export`, 8.26 MB) | ✅ |

## Wat jij zelf moet doen

Alles hieronder vraagt om je Apple ID + 2FA. Voer dit in je eigen terminal uit.

### 1. Bouwen

```bash
cd "offerte-builder/mobile" && npx eas-cli build --platform ios --profile production
```

EAS vraagt je om in te loggen bij Apple en genereert dan automatisch:
distributiecertificaat, provisioning profile, en de APNs-key voor push notifications.
Bouwtijd: ± 15–25 min. Kies bij twijfel steeds "Yes, let EAS handle it".

### 2. Naar TestFlight sturen

```bash
cd "offerte-builder/mobile" && npx eas-cli submit --platform ios --latest
```

Bestaat er nog geen app-record in App Store Connect voor `nl.toptuinen.medewerkers`,
dan biedt `eas submit` aan om die aan te maken — accepteer dat.

### 3. Jezelf als tester toevoegen

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → Top Tuinen → **TestFlight**
2. Wacht tot de build van *Processing* naar *Ready to Test* gaat (± 5–15 min)
3. **Internal Testing** → groep aanmaken → jezelf toevoegen als tester
   (interne tests hebben **geen** Apple review nodig — direct beschikbaar)
4. Installeer **TestFlight** uit de App Store op je iPhone, log in met dezelfde Apple ID,
   accepteer de uitnodiging → app verschijnt

### Volgende builds

Herhaal stap 1 en 2. `autoIncrement: true` + `appVersionSource: remote` regelen het
buildnummer automatisch, dus je hoeft niets handmatig op te hogen.

---

## Troubleshooting

### `Failed to register bundle identifier` / `App Store Connect has agreement updates`

Geen code- of configprobleem. Apple blokkeert het registreren van bundle identifiers zolang er
openstaande overeenkomsten zijn:

1. https://developer.apple.com/account → banner bovenaan → **Apple Developer Program License
   Agreement** bekijken en accepteren (moet door de Account Holder).
2. https://appstoreconnect.apple.com/agreements → eventuele tweede openstaande overeenkomst.
3. **Trader status (EU DSA)** invullen in App Store Connect — verplicht sinds de Digital Services
   Act, anders worden apps uit de EU App Store verwijderd. Vul Top Tuinen in als *trader*
   met KvK-gegevens.

Daarna gewoon hetzelfde buildcommando opnieuw draaien.

### `Do you want to log in to your Apple account?`

Antwoord **y**. Het wachtwoord wordt in de lokale macOS Keychain bewaard, niet op EAS-servers,
dus dit hoeft maar één keer.

### Waarschuwing "your app uses Expo Go for development"

Onschuldig. Verschijnt omdat `expo-dev-client` niet geïnstalleerd is — precies wat je wilt voor
een productie/TestFlight-build. Onderdrukken kan met `EAS_BUILD_NO_EXPO_GO_WARNING=true`.

---

## Nog te verifiëren bij de eerste run

### Clerk native redirect — gecontroleerd, geen actie nodig

De login gebruikt SSO/magic-link met `Linking.createURL('callback', { scheme: 'toptuinen' })`
(`app/(auth)/login.tsx`). Zowel de dev- als de production-instance heeft **nul** geregistreerde
redirect-URLs (`GET /v1/redirect_urls` → lege lijst). Omdat de flow in dev werkt, handelt
`@clerk/clerk-expo` het custom scheme zelf af en speelt de allowlist hier geen rol.
De production JWKS op `clerk.toptuinen.app` is bereikbaar en geldig.

### Push notifications

`aps-environment` staat lokaal op `development`; EAS zet dit bij een production build om naar
`production`. Test na installatie of `getExpoPushTokenAsync()` een token teruggeeft
(`lib/notifications/push.ts`).

### Productie-data

Deze build praat met de **live** Convex database (`impartial-dinosaur-829`) — dezelfde data als
toptuinen.app. Wat je in de app aanmaakt of wijzigt is echt.

Wil je later tegen dev testen, voeg dan een apart profiel toe aan `eas.json` met de
dev-waarden uit `mobile/.env.local`.

---

## Waarom niet Expo Go?

Expo Go draait op het `exp://` scheme, dus de Clerk SSO/magic-link redirect naar
`toptuinen://callback` breekt. Daarnaast werken Face ID-login en remote push notifications
niet betrouwbaar in Expo Go sinds SDK 53. Een echte build (TestFlight of dev build) is nodig.
