# Mobile App Audit — Top Tuinen (TestFlight build)

Datum: 2026-07-31
Scope: `offerte-builder/mobile` (Expo SDK 54) + gedeelde `offerte-builder/convex` backend
Productie: Convex `impartial-dinosaur-829`, Clerk `clerk.toptuinen.app`

> **Let op:** `convex/` wordt gedeeld met de Next.js webapp in `offerte-builder/src`.
> Elke wijziging daar is gemarkeerd met **[RAAKT WEBAPP]**.

---

## 1. Samenvatting (voor de lezer met haast)

1. Er is **geen ontbrekende deploy en geen auth-probleem**. Alle 44 aangeroepen Convex-functies bestaan; de JWT-template werkt.
2. **"Mijn dag" crasht door een datastaat, niet door code**: `riboebusiness@gmail.com` heeft `role=admin` én een gekoppelde medewerker die bij een *andere* tenant hoort. `getCompanyUserId` (`convex/roles.ts:614`) kiest bij rol directie/admin de eigen `user._id` en negeert de koppeling → `convex/urenSegmenten.ts:125` gooit "Medewerker niet gevonden".
3. Het tweede account, `ricardobos43@gmail.com`, heeft **helemaal geen** `linkedMedewerkerId`. Dat account krijgt een lege/kapotte dag en laat `convex/mobile.ts:95` ("Medewerker profiel niet gevonden") vallen bij de biometrie-toggle.
4. **Chatbericht "verschijnt niet"** heeft twee bewezen oorzaken: de team/broadcast/project-lijsten voeren oplopend gesorteerde data aan een `inverted` FlatList (nieuwste bericht rendert buiten beeld), én verzenden vanaf het tabblad Project faalt 100% omdat `projectId` ontbreekt — met een `catch` die alleen `console.error` doet.
5. **Er missen echt functies**: de Foto's-tab is een 22-regelige stub, drie quick-actions op projectdetail hebben geen `onPress`, en er staat een zesde naamloze tab "notifications" in de tabbalk.
6. **Het themasysteem is omgekeerd**: `darkColors` bevat de lichte waarden en wordt toegepast bij "donker".
7. Volgorde: eerst een **datafix in productie** (geen build nodig), dan de mobile chat-fix (build), dan de dode UI, dan het thema.

---

## 2. BLOKKEREND — fix eerst

### B1. "Mijn dag" crasht: `ConvexError: "Medewerker niet gevonden"`

**Wat de gebruiker ziet**
Tab "Mijn dag" toont het foutscherm van `VeldFoutgrens` met de rauwe backend-tekst "Medewerker niet gevonden". "Opnieuw proberen" doet niets (de query gooit deterministisch opnieuw).

**Root cause**
- `convex/roles.ts:614-632` — `getCompanyUserId` beslist op **rol** in plaats van op **koppeling**:
  - `:620-621` `if (role === "directie") return user._id;` — komt vóór de koppelingstak.
  - `:625-627` `if (medewerker) return medewerker.userId;` — wordt voor directie/admin nooit bereikt.
- `role=admin` → `normalizeRole` (`convex/roles.ts:89`) → `"directie"`.
- `medewerkers.userId` is de **tenant-eigenaar**, niet het useraccount van de medewerker zelf: `convex/medewerkers.ts:418-421` (`userId: companyUserId` bij create), `convex/schema.ts:1064-1065`.
- Gevolg in `convex/urenSegmenten.ts:119-125`:
  ```ts
  const medewerker = await ctx.db.get(doelId);
  if (!medewerker || medewerker.userId.toString() !== veld.companyUserId.toString()) {
    throw new ConvexError("Medewerker niet gevonden");
  }
  ```
  `medewerker.userId` (tenant van ricardobos43) ≠ `companyUserId` (eigen `_id` van riboebusiness) → throw.

**Bewijs dat het niet de `!medewerker`-tak is**
`mobile/app/(tabs)/uren.tsx:146` roept `getVeldDag` aan **zonder** `medewerkerId`. Dan is `doelId = veld.eigenMedewerker._id` (`urenSegmenten.ts:106`), afkomstig uit `ctx.db.get(user.linkedMedewerkerId)` (`roles.ts:573`) — per constructie een bestaand document. Was het null geweest, dan had de kantoor-guard op `urenSegmenten.ts:358-360` al `null` teruggegeven. Deze fout komt dus uit de sessie van **riboebusiness@gmail.com** (het enige account met `linkedMedewerkerId`).

**De wijziging — STAP 1: datafix in productie (geen code, geen build)**

Zet in het Convex-dashboard op de `users`-rij `riboebusiness@gmail.com` (clerkId `user_3926ySda2Ts4al1J37jDe6g3Tzj`):

```
role: "admin"  →  "medewerker"      (of "voorman")
```

Dan valt `roles.ts:614` door naar de koppelingstak `:625-627` en levert `mn77…userId` = de tenant van ricardobos43 — precies wat `urenSegmenten.ts:122` verwacht. Dit is exact de eindtoestand die `convex/roles.ts:688-690` en `convex/users.ts:1305-1309` zelf produceren bij koppelen; er wordt geen nieuw gedrag geïntroduceerd.

**Doe NIET het alternatief** "patch `mn77.userId` naar `riboebusiness._id`": teams, teamBemanning, urenSegmenten en projecten zijn allemaal op de tenant van ricardobos43 gescoped (zie de `userId`-filters in `convex/urenSegmenten.ts:148-150, 166-168, 180-192`) en zouden uit beeld raken.

**Draai `getCompanyUserId` NIET om.** Dat geeft elke directie-user in één klap volledige scope over een andere tenant, en 17 bestanden in de gedeelde backend hangen aan die functie. **[RAAKT WEBAPP]**

**De wijziging — STAP 2: codefix van de bron** **[RAAKT WEBAPP]**

`convex/mobile.ts:384-419` (`adminLinkUserToMedewerker`) is het enige koppelpad dat de rol niet meebeweegt en dus deze staat kan produceren: `:416-418` patcht uitsluitend `linkedMedewerkerId`. Breng in lijn met `convex/users.ts:1303-1315`:

- bij linken: naast `linkedMedewerkerId` ook `role` naar een medewerker-rol zetten wanneer `medewerker.userId !== targetUser._id`;
- bij linken: ook `medewerker.clerkUserId` zetten (zoals `users.ts:1303`), zodat `convex/mobile.ts:88-92` (`by_clerk_id`) blijft werken;
- bij unlinken: rol terugzetten, consistent met `users.ts:1311-1315`;
- invariant: weiger een koppeling wanneer de doelgebruiker rol directie heeft **én** al eigen bedrijfsdata bezit.

**Verificatie voor oplevering**
1. Met riboebusiness op mobiel "Mijn dag" openen → moet de dag van `mn77…` tonen.
2. Met ricardobos43 op web `src/components/veld/veld-dag.tsx:107` een medewerker kiezen → moet blijven werken (bewijs dat de tenant-scope niet verschoven is).

---

### B2. `updateBiometricSetting` gooit voor accounts zonder medewerkerprofiel

**Wat de gebruiker ziet**
Biometrie aanzetten in Profiel: de schakelaar springt op AAN, de biometrische sleutel wordt lokaal opgeslagen, en daarna verschijnt "Kon biometrie instelling niet wijzigen". Bij uitzetten is de melding aantoonbaar onjuist (`disableBiometric()` is dan al gelopen).

**Root cause**
- `convex/mobile.ts:86-95` zoekt uitsluitend via index `by_clerk_id` op `medewerkers.clerkUserId` en gooit hard:
  ```ts
  if (!medewerker) { throw new ConvexError("Medewerker profiel niet gevonden"); }
  ```
  Voor `ricardobos43@gmail.com` bestaat geen medewerkers-rij met die clerkId → throw. Deze logfout komt dus uit een **andere sessie** dan B1.
- `mobile/app/(tabs)/profiel.tsx:329-348` draait `setupBiometric()` en `setBiometricEnabled(true)` **vóór** `await updateBiometric({enabled:true})`, en rolt in de catch (`:346-348`) niets terug.

**De wijziging**
1. **[RAAKT WEBAPP — alleen `convex/mobile.ts`, dat is mobile-only in gebruik, maar leeft in de gedeelde map]**
   `convex/mobile.ts:86-95`: probeer eerst `getLinkedMedewerker(ctx)` (`roles.ts:564-574`), dan pas de `by_clerk_id`-index. Bij ontbreken **geen** ConvexError maar `{ success: false, reason: "geen_medewerkerprofiel" }`. Doe hetzelfde voor de zusterfunctie rond `mobile.ts:60-73`.
   > Wijzig `roles.ts:getLinkedMedewerker` zelf **niet** — die voedt `getCompanyUserId` en daarmee de tenant-scope van de hele gedeelde backend.
2. `mobile/app/(tabs)/profiel.tsx:329-348`: draai de volgorde om (eerst `await updateBiometric(...)`, pas bij succes `setupBiometric` + `setBiometricEnabled`), rol in de catch de lokale wijziging terug, en toon `error.data` in plaats van de generieke tekst.

---

### B3. Chat: nieuw bericht rendert buiten beeld (inverted lijst met oplopende data)

**Wat de gebruiker ziet**
Bericht typen, verzenden, invoerveld leegt zich — en er verandert onderaan niets. Bij >±1 schermvulling aan historie is het nieuwe bericht buiten beeld.

**Root cause**
- `convex/chat.ts:189` `.order("desc").take(limit)`, `:200` `// Return in ascending order (oldest first)`, `:201` `return enriched.reverse();` → **oplopend** (oudste eerst).
- `mobile/app/(tabs)/chat.tsx` voedt die array één-op-één aan `inverted` FlatLists:
  - `:508` `data={messages}` + `:511` `inverted` (team)
  - `:538` + `:541` (mededelingen)
  - `:640` + `:643` (project)
- Bij `inverted` staat index 0 visueel **onderaan** en is dat de rustpositie. Dus onderaan staat het oudste bericht.
- Bewijs dat dit een omissie is en geen keuze: de DM-lijst doet het wél goed — `:571` `data={[...dmMessages].reverse()}` + `:574 inverted`, terwijl `getDirectMessages` (`convex/chat.ts:440-443`) óók oplopend teruggeeft.
- Er is nergens een `scrollToEnd`/`scrollToIndex` in `chat.tsx` (grep op `scrollTo`: 0 treffers) die dit compenseert.

**De wijziging — alleen mobile. Laat `convex/chat.ts:201` en `:443` ONGEWIJZIGD.**
De webapp rekent op oplopend: `src/app/(dashboard)/chat/page.tsx:84-96` mapt zonder omkering en `src/components/chat/chat-message-list.tsx:273` rendert in een gewone kolom. **[RAAKT WEBAPP als je hier toch aankomt — niet doen.]**

1. `mobile/app/(tabs)/chat.tsx:386-401` — memoiseer de **bron**, niet het resultaat (`getMessages()` bouwt nu elke render een nieuwe array, dus `useMemo` op `messages` is nutteloos):
   ```ts
   const invertedMessages = useMemo(() => {
     const src = activeTab === 'team' ? teamMessages
              : activeTab === 'broadcast' ? broadcastMessages
              : activeTab === 'project' ? projectMessages
              : undefined;
     const uid = currentUser?._id;
     return (src ?? []).map(m => ({ ...m, isOwn: m.senderId === uid })).reverse();
   }, [activeTab, teamMessages, broadcastMessages, projectMessages, currentUser?._id]);
   ```
2. Zet `data={invertedMessages}` op `:508`, `:538` en `:640`. Memoiseer ook de DM-lijst: `const invertedDM = useMemo(() => [...(dmMessages ?? [])].reverse(), [dmMessages])`.
3. Verwijder `getItemLayout` op `:513-517`, `:543-547`, `:645-649` — de vaste `length: 80` klopt niet bij variabele berichthoogtes (`styles` op `:995-1040`: `maxWidth: '75%'`, `padding: 12`, `lineHeight: 20`) en breekt de scrollpositie van een inverted lijst. De conversatielijst op `:600-604` mag blijven (`styles.channelItem` heeft wél vaste hoogte).
4. Gebruik aparte refs: `flatListRef` (`:155`) staat nu op zowel `:507` (team) als `:639` (project). Maak er `teamListRef` en `projectListRef` van en roep na een geslaagde mutation in `handleSend` (na `:219`) `ref.current?.scrollToOffset({ offset: 0, animated: true })` aan.

**Verificatie**: nieuw bericht in tabblad Team moet direct onderaan verschijnen zonder scrollen, bij >20 bestaande berichten. Webchat herladen om te bevestigen dat de volgorde daar ongewijzigd is.

---

### B4. Chat: verzenden op tabblad Project faalt altijd, stil

**Wat de gebruiker ziet**
Op tabblad Project: tekst typen, op verzenden drukken, er gebeurt niets. De tekst blijft in het veld staan (want `setMessage('')` op `:220` wordt door de throw overgeslagen). Geen melding.

**Root cause**
- `mobile/app/(tabs)/chat.tsx:207-212` stuurt `sendTeamMessage({ channelType: 'project', ... })` **zonder** `projectId`.
- `convex/chat.ts:68-71` gooit dan gegarandeerd `"Project ID is verplicht voor project kanaal"`.
- `mobile/app/(tabs)/chat.tsx:221-223` vangt dat af met alleen `console.error` — geen Alert, geen toast, geen UI-reactie.
- De inputbalk is op dat tabblad wél zichtbaar: `:664`.
- Bijkomend: de query op `:161` haalt project-berichten op **zonder** `projectId` → alle projecten door elkaar (`convex/chat.ts:175-179` filtert alleen als de arg is meegegeven). En `:184-186` markeert álle projectberichten van alle projecten als gelezen.

**De wijziging**
1. `mobile/app/(tabs)/chat.tsx:221-223` — vervang het stille `console.error` door zichtbare feedback:
   ```ts
   catch (error) {
     Alert.alert('Versturen mislukt', error instanceof ConvexError ? String(error.data) : 'Probeer opnieuw');
   }
   ```
   en laat `setMessage('')` alleen bij succes lopen (staat al goed op `:220`).
   > Gebruik hier **`Alert.alert`, niet `useToast`** — `ToastProvider` is nergens gemount (zie H3); `useToast()` zou het chatscherm laten crashen op `contexts/ToastContext.tsx:99`.
2. Verberg de inputbalk wanneer `activeTab === 'project'` en er geen project gekozen is (`:664`).
   > **Bouw géén projectkiezer met schrijfrechten.** De webapp behandelt `channelType: 'project'` als **read-only historie**: `src/app/(dashboard)/chat/page.tsx:445-447` en `:463`. Berichten die je daar wegschrijft komen nooit bij kantoor aan.

---

### B5. Foto's-tab is een lege stub

**Wat de gebruiker ziet**
Een van de vijf hoofdtabs (camera-icoon, label "Foto's" — `mobile/components/ui/FloatingTabBar.tsx:28`/`:36`) toont permanent de tekst "Foto's worden hier geladen…". Er komt nooit iets.

**Root cause**
- `mobile/app/(tabs)/fotos.tsx` is 22 regels; `:16-18` rendert alleen die tekst. Geen `useQuery`, geen `useMutation`, geen camera.
- De componenten bestaan wél maar zijn **puur presentational** (nul Convex-code): `components/ProjectFotoUpload.tsx` (974 regels, props `{projecten, initiaalProjectId, onUploadGestart}` op `:58-64`), `components/FotoGalerij.tsx` (906 regels), `components/ui/PhotoGrid.tsx` (`:80`, props `photos/onPhotoPress/onAddPress`). Nul render-locaties onder `app/`.
- `registerUploadHandler` (`hooks/use-offline-queue.ts:350-355`) wordt **nergens** aangeroepen; `:240-244` slaat items zonder handler over. Zonder dat is elke fotoscherm-implementatie een stille dataverliesbug met succesmelding (`ProjectFotoUpload.tsx:448-455`).
- Er bestaat **geen projectfoto-album in de backend**. `convex/fotoStorage.ts` hangt aan `configuratorAanvragen` (`:36`), niet aan projecten.

**De wijziging — kies bewust**

**Optie A (aanbevolen quick win, 1 regel per tab):** verberg de tab.
In `mobile/app/(tabs)/_layout.tsx`:
```tsx
<Tabs.Screen name="fotos" options={{ href: null }} />
```
> **Let op:** `href: null` alléén is **niet genoeg** bij deze custom tab bar — zie H1. Voer H1 en B5-A samen uit.

**Optie B (echt bouwen):** volg het patroon dat de webapp al gebruikt — géén nieuwe Convex-code:
`src/components/veld/klantblok-kaart.tsx:453-489` doet `api.fotoStorage.generateUploadUrl` → POST blob → `api.urenSegmenten.voegVeldFotoToe({ werkitemId, bijlagen })`.
- Projectlijst: `useQuery(api.projecten.listForPlanning)` (`convex/projecten.ts:757`). Map naar het `Project`-shape van `ProjectFotoUpload.tsx:51-56`.
- Registreer eerst één upload-handler op app-niveau (`mobile/app/_layout.tsx` of een `FotoUploadProvider`). **Voorwaarde:** `useOfflineQueue` houdt handlers in een `useRef` per hook-instantie (`hooks/use-offline-queue.ts:161`) — twee losse aanroepen delen de handler-map niet. Til de queue eerst naar een context/singleton.
- `voegVeldFotoToe` (`convex/urenSegmenten.ts:1083-1127`) schrijft naar de **klanttijdlijn** en gooit als `werkitem.klantId` ontbreekt (`:1105-1110`). Filter projecten zonder `klantId` uit de picker.
- Scoping-mismatch: `listForPlanning` gebruikt voor directie `user._id` (`convex/projecten.ts:767`) terwijl `voegVeldFotoToe` valideert op `getCompanyUserId` (`:1100-1104`). Test dit met een directie-account.

**Afhankelijkheid:** `voegVeldFotoToe` gaat via `veldContext` (`convex/urenSegmenten.ts:86-92`) → `getLinkedMedewerker`. Zonder B1 faalt de foto-upload net zo hard als "Mijn dag". **Doe B1 eerst.**

---

### B6. Themasysteem is omgekeerd: "donker" levert het lichte palet

**Wat de gebruiker ziet**
De app start standaard op "donker" (`mobile/theme/ThemeProvider.tsx:25`) maar de theme-aware schermen krijgen het **lichte** palet, terwijl de rest van de chrome hardcoded donker blijft. Kiest de gebruiker "Licht", dan wordt het zwart.

**Root cause**
- `mobile/theme/colors.ts:2-4` — `colors` is het **donkere** basispalet (`background: '#0A0A0A'`).
- `mobile/theme/colors.ts:74-76` — `export const darkColors: ColorScheme = {` met de comment `// Light Mode Overrides` en `background: '#FAFAF8'`, `foreground: '#1A1A1A'`, `card: '#FFFFFF'`, `primary: '#2D5A27'`. De export heet donker en bevat licht.
- `mobile/theme/ThemeProvider.tsx:57` — `const themeColors = isDark ? { ...colors, ...darkColors } : colors;` De spread wint → `isDark===true` levert `#FAFAF8`.
- `ThemeProvider.tsx:56` maakt ook "system" verkeerd om.

**De wijziging — 4 stappen, alles binnen `mobile/`**

**Stap 1 — `mobile/theme/colors.ts` opsplitsen (niet alleen hernoemen)**
- `colors` (`:2-72`) blijft het donkere basispalet.
- Hernoem `:74` `darkColors: ColorScheme` → `lightColors: Partial<ColorScheme>` (net als `buitenColors` op `:142`) en corrigeer de comment.
- **Verwijder `:106-131` (`scope`, `trend`, `chart`) uit dat blok.** Die dragen expliciete comments "for dark mode visibility" / "aligned with webapp dark mode" — het bestand is een verknoeide merge. `gras: '#7DD98C'` en `trend.positive: '#5AD070'` op `#FAFAF8` zijn onleesbaar. Laat ze weg (basiswaarden gelden) of vervang door echte lichte waarden; override dan minimaal `scope.gras` (bv. `#2D7A3E`) en `trend.positive` (bv. `#16803C`) voor WCAG AA.
- **Spread is shallow**: definieer `scope`/`trend`/`chart` in `lightColors` altijd volledig (alle 7/3/5 sleutels) of helemaal niet — een half object wist de rest naar `undefined`.

**Stap 2 — `mobile/theme/ThemeProvider.tsx` omdraaien**
- `:4` `import { colors, lightColors, ColorScheme } from './colors';`
- `:57` `const themeColors = isDark ? colors : { ...colors, ...lightColors };`
- `:25` `useState<ThemeMode>('dark')` mag blijven — die is pas ná de omkering correct.
- Bump de AsyncStorage-sleutel `@toptuinen_theme_mode` (`:6`) naar `_v2`, zodat gebruikers die 'light' als workaround hadden gezet schoon op donker starten.

**Stap 3 — hardcoded chrome theme-aware maken (zonder dit blijft licht half-donker)**
17 bestanden importeren het statische `colors`. Prioriteit:
- `components/ui/Button.tsx:70-89` — `variantContainerStyles`/`variantTextColors` met vaste hex (`'#4ADE80'`, `'#1A2E1A'`, `'#222222'`, `'#E8E8E8'`). Maak er `getVariantStyles(kleuren: ColorScheme)` van.
- `components/ui/OfflineIndicator.tsx:6` + `:158` (`online: { backgroundColor: '#1A1A1A' }`) → `kleuren.surfaceElevated`.
- Idem: `FloatingTabBar.tsx:20`, `Input.tsx:16`, `StatusBadge.tsx:5`, `Label.tsx:4`, `Tabs.tsx:5`, `ScopeTag.tsx:3`, `NotificationBanner.tsx:12`, `FotoGalerij.tsx:39`, `app/(auth)/login.tsx:20`, `app/(tabs)/fotos.tsx:4`.
- `app/project/[id].tsx:10` — verwijder `import { colors as themeColors }`; het bestand gebruikt al `useColors()` en heeft nu twee bronnen van waarheid.
> Splits stap 3 desnoods in een eigen ticket, maar plan hem samen met 1+2 in.

**Stap 4 — verificatie**
- Simulator: Profiel → ThemeSelector op Donker (`#0A0A0A`), Licht (`#FAFAF8`), Systeem (volgt OS).
- Controleer de 6 theme-aware schermen: `app/(tabs)/chat.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/profiel.tsx`, `app/admin/index.tsx`, `app/project/[id].tsx` en `app/(tabs)/uren.tsx` (die krijgt tokens via `uren.tsx:143 useBuitenModus` → `components/veld/BuitenModus.tsx:45`).
- Buiten-modus apart: `BuitenModus.tsx:76` legt `buitenColors` bovenop de theme-tokens — moet in beide modi hoog-contrast blijven.
- `cd mobile && npx tsc --noEmit`.

**Risico webapp:** nul. `darkColors` komt alleen voor in `mobile/theme/ThemeProvider.tsx:4,:57` en `mobile/theme/colors.ts:74`.

---

## 3. HOOG

### H1. Zesde, naamloze tab "notifications" in de tabbalk

**Symptoom** Een tweede Home-icoon zonder label in de tabbalk; na aantikken verschijnt de tekst "notifications" (`FloatingTabBar.tsx:93-95` toont het label alleen bij focus).

**Root cause** expo-router v6 registreert élk bestand in `(tabs)/` als route — geverifieerd in `node_modules/expo-router/build/useScreens.js:108-109` (`// Add any remaining children`) met `useOnlyUserDefinedScreens = false` vanuit `TabsClient.js`. `(tabs)/_layout.tsx:12-16` declareert alleen index/fotos/uren/chat/profiel. `FloatingTabBar.tsx:109` `state.routes.map(...)` filtert niets; `:54-55` valt terug op `Home` + `route.name`.

**Wijziging — twee delen; `href: null` alléén werkt aantoonbaar niet.**
`TabsClient.js` laat zien dat `href: null` slechts `tabBarItemStyle: {display:'none'}` en `tabBarButton: () => null` zet — options die de *standaard* React Navigation tab bar respecteert. Deze app gebruikt een custom bar (`_layout.tsx:7`) die alleen `{ state, navigation }` destructureert (`FloatingTabBar.tsx:101`; `descriptors` komt er 0× in voor).

1. `mobile/app/(tabs)/_layout.tsx`:
   ```tsx
   <Tabs.Screen name="notifications" options={{ href: null }} />
   ```
2. **Verplicht** — `mobile/components/ui/FloatingTabBar.tsx`: neem `descriptors` mee uit `BottomTabBarProps` (`:101`) en filter op `:109`:
   ```tsx
   {state.routes
     .filter((route) => descriptors[route.key]?.options.tabBarButton === undefined)
     .map((route) => {
       const index = state.routes.indexOf(route); // originele index!
       const isFocused = state.index === index;
   ```
   `isFocused` moet tegen de **originele** index in `state.routes` blijven vergelijken, anders verschuift de actieve-tab-markering.

*Alternatief:* verplaats `app/(tabs)/notifications.tsx` → `app/notifications.tsx` en pas `app/(tabs)/index.tsx:152` en `:234` aan naar `router.push('/notifications')`.

---

### H2. Projectdetail: drie snelknoppen doen niets

**Symptoom** Op `/project/{id}` reageren "Foto's", "Uren" en "Notities" visueel maar voeren niets uit. De Home-hero stuurt de foto-knop hierheen (`app/(tabs)/index.tsx:176-177` → beide naar `/project/${id}`), dus die eindigt in een dode knop.

**Root cause** `mobile/app/project/[id].tsx:149-163` — drie `<TouchableOpacity style={s.quickAction}>` (`:151` camera, `:155` clock, `:159` file-text) **zonder `onPress`**. Elke andere TouchableOpacity in hetzelfde bestand heeft er wél een (`:49, :69, :78, :105`).

**Wijziging**
- **Uren (`:155`)** — pas ná B1: `onPress={() => router.push('/(tabs)/uren')}`, consistent met `index.tsx:178`. Projectcontext gaat verloren (`uren.tsx` leest geen params). Netter: laat `uren.tsx` een optionele `projectId` via `useLocalSearchParams` lezen.
- **Notities (`:159`)** — **niet verwijderen, niet aan chat koppelen.** Er is al een NOTITIES-sectie op `:307-313`. Maak de knop een anker daarnaartoe (`onLayout` + `scrollTo`) en dim hem wanneer `!offerte?.notities`. Koppelen aan `chat.sendTeamMessage({channelType:'project'})` schrijft naar een kanaal dat de webapp als read-only historie behandelt (`src/app/(dashboard)/chat/page.tsx:445-447, :463`) — de notitie komt nooit bij kantoor aan. **[RAAKT WEBAPP-GEDRAG — niet doen]**
- **Foto's (`:151`)** — pas nadat B5 een scherm heeft. Tot dan: verberg de knop.

---

### H3. ToastProvider is nooit gemount — 44 blokkerende `Alert.alert`s

**Symptoom** Elke bevestiging is een blokkerende systeempopup die met natte handschoenen weggetikt moet worden. In chat is er juist géén feedback (zie B4).

**Root cause** `mobile/app/_layout.tsx:236-251` toont de keten UserSync → RoleProvider → PushNotificationsInitializer → Stack; `ToastProvider` ontbreekt. Ook het tweede renderpad (`:287-305`) heeft hem niet. `useToast` heeft nul consumers buiten `contexts/ToastContext.tsx:96` en `contexts/index.ts:8`. Het systeem is volledig gebouwd (`ToastContext.tsx:34-94`, `components/ui/Toast.tsx:150-209` swipe-to-dismiss).

Aantal `Alert.alert`: **44** over 10 bestanden (profiel 7, KlantblokKaart 8, ProjectFotoUpload 6, login 5, biometric-login 5, biometric 4, FotoGalerij 3, uren 2, SegmentenLijst 2, admin/index 2).

**Wijziging**
1. **Mount op rootniveau, niet in `InnerLayout`.** Plaats `ToastProvider` in `mobile/app/_layout.tsx` direct binnen `<ThemeProvider>` en om `<AppErrorBoundary>` heen, zodat **beide** renderpaden hem hebben — inclusief het Clerk-loze fallbackpad (`:271-285`) dat `(auth)/login.tsx` rendert. Hij moet binnen `SafeAreaProvider` blijven (`Toast.tsx:82` gebruikt `useSafeAreaInsets`).
2. **Houd `Alert.alert` waar het moet.** Blijft Alert: echte ja/nee-bevestigingen (`SegmentenLijst.tsx:78` verwijderen, `uren.tsx:165` dag indienen) én alles wat vanuit een modal-context vuurt (`app/admin/index.tsx:322`/`:333` — modal-presentatie op `_layout.tsx:245` — en alles binnen `components/ui/Dialog.tsx`, RN Modal op `:98`). Een root-toast rendert **onder** native modals.
3. Wordt toast: de niet-blokkerende foutmeldingen `uren.tsx:92` (`toonFout`) en `SegmentenLijst.tsx:28` (`toonFout`, aangeroepen op `:65, :73, :90, :397`). Verhoog voor variant `error` de duur boven de default van 3000 ms (`ToastContext.tsx:53`) naar ~5000 ms.
4. Corrigeer de aanname "er is geen niet-blokkerend signaal": `OfflineIndicator` (`uren.tsx:189`) en `NotificationBanner` (`(tabs)/index.tsx:215`) bestaan wél.

---

## 4. MIDDEL

### M1. "Mijn dag" werkt structureel niet voor een kantoor-account zonder koppeling
`convex/urenSegmenten.ts:355-360` geeft bewust `null` terug voor rol kantoor zonder eigen medewerker, zodat de UI een medewerker-kiezer kan tonen. `mobile/app/(tabs)/uren.tsx:146` stuurt nooit een `medewerkerId` en heeft die kiezer niet — de web-versie wel (`src/components/veld/veld-dag.tsx:107`).
**Fix:** (a) behandel `dag === null` in `uren.tsx` met een medewerker-kiezer (voed hem met `convex/mobile.ts:getMedewerkersForLinking`) en geef `medewerkerId` door. (b) **[RAAKT WEBAPP]** maak de foutmeldingen in `convex/urenSegmenten.ts:104-109` onderscheidend ("niet gekoppeld" vs. "hoort bij een ander bedrijf").

### M2. Teamchat schrijft en leest in dezelfde (verkeerde) bedrijfsscope
`convex/chat.ts` leidt de tenant op elf plaatsen af met `getCompanyUserId` (`:75, 164, 220, 262, 355, 575, 749, 822, 853, 1023`). Zolang B1 niet is opgelost, schrijft/leest riboebusiness in een scope die niet met de webapp overeenkomt en falen kanaalchecks als `:84-86`.
**Fix:** geen aparte codewijziging — B1-stap-1 herstelt dit pad. Verifieer daarna of er chat-rijen met de verkeerde `userId` in productie staan en migreer die eenmalig. **[RAAKT WEBAPP-DATA]**

### M3. `markTeamMessagesAsRead` in een useEffect op elke berichtwijziging
`mobile/app/(tabs)/chat.tsx:179-187` heeft `teamMessages`/`broadcastMessages`/`projectMessages` in de dependency-array. Server-side doet `convex/chat.ts:236-248` een volledige `.collect()` en patcht per bericht → invalideert de queries opnieuw. `getUnreadCounts` (`chat.ts:578-582`) collect't álle team_messages zonder kanaalfilter.
**Fix:** laat de useEffect afhangen van een goedkope sleutel (`messages[messages.length-1]?._id`). **[RAAKT WEBAPP]** gebruik in `convex/chat.ts:223-236` de `by_team_unread`-index + limiet, en laat `getUnreadCounts` per kanaaltype op `by_channel` tellen.

### M4. Notificatie-schakelaars in Profiel zijn placebo
`mobile/app/(tabs)/profiel.tsx:504-507, :517, :530` schrijven alleen naar AsyncStorage (`saveNotificationPrefs`, `:250-256`). `api.chat.updateNotificationPreferences` (`convex/chat.ts:656`) wordt alleen bij de eerste tokenregistratie aangeroepen (`hooks/use-push-notifications.ts:141`). "Chat meldingen" uitzetten doet niets.
**Fix:** koppel de drie `onValueChange` aan `useMutation(api.chat.updateNotificationPreferences)` en laad de begintoestand uit `useQuery(api.chat.getNotificationPreferences)` (`convex/chat.ts:625`) in plaats van uit AsyncStorage (`:232-247`).

### M5. Dialogen "Over Top Tuinen" en "Help & Support" zijn onbereikbaar
`mobile/app/(tabs)/profiel.tsx:175-176` declareert de state, maar `setShowAboutDialog`/`setShowHelpDialog` komen uitsluitend met `false` voor (`:355, :572, :604, :612, :640`). ~75 regels UI inclusief de mailto-supportknop is onbereikbaar — er is geen enkele manier om support te bereiken vanuit de app.
**Fix:** voeg in de APP-sectie (rond `:546-556`) twee aanraakbare rijen toe met `onPress={() => setShowAboutDialog(true)}` resp. `(true)`. `SettingRow` (`:123-153`) is nu een `View` en moet een optionele `onPress`/TouchableOpacity krijgen.

### M6. Notificatie-mutaties fire-and-forget
`app/(tabs)/index.tsx:223` `markAsRead({...})` en `:229` `dismissNotification({...})` zonder `await`/`.catch()`; idem `app/(tabs)/notifications.tsx:96` en `:109`. Bij falen verdwijnt de notificatie in de UI terwijl de server niets opsloeg. Ter contrast doet `chat.tsx:180-186` het wél met `.catch(console.error)`.
**Fix:** `.catch()` toevoegen met zichtbare melding en de optimistische UI-wijziging terugdraaien.

### M7. `VeldFoutgrens` kan niet herstellen en logt niets
`mobile/app/(tabs)/uren.tsx:452-457` — "Opnieuw proberen" zet alleen `fout: null`; de query gooit deterministisch opnieuw. De klasse (`:415-464`) heeft geen `componentDidCatch`. `:448` toont de rauwe backend-tekst; `:432/:443/:448` gebruiken hardcoded `'#0A0A0A'`, `'#E8E8E8'`, `'#999999'`.
**Fix:** voeg `componentDidCatch` toe voor logging; vertaal in `getDerivedStateFromError` (`:421`) bekende boodschappen naar veldtaal ("Medewerker niet gevonden" → "Je account is nog niet aan een medewerker gekoppeld. Vraag kantoor om dit te koppelen."); voeg een tweede knop toe naar Profiel/Home; vervang de hardcoded kleuren door thematokens.

### M8. Pull-to-refresh is overal een nep-spinner
`app/(tabs)/notifications.tsx:227-233` heeft `refreshing={false}` en **geen** `onRefresh`. `app/(tabs)/index.tsx:114-118` en `chat.tsx:259-264` zetten een spinner aan, wachten 1s met `setTimeout` en zetten hem uit — er wordt niets opgehaald ("// Convex queries auto-refresh, so we just wait a bit").
**Fix:** Convex-queries zijn realtime; verwijder de RefreshControls en toon in plaats daarvan de bestaande `OfflineIndicator`.

### M9. Zoekknop in de chatheader zonder handler
`mobile/app/(tabs)/chat.tsx:487-489` — `TouchableOpacity` met loep-icoon, geen `onPress`. `api.chat.searchMessages` (`convex/chat.ts:812`) bestaat en wordt nergens in mobile aangeroepen.
**Fix:** implementeer zoeken (state + `useQuery(api.chat.searchMessages, term ? { query: term } : 'skip')`) of **verwijder de knop** in plaats van een dode affordance te tonen.

### M10. Chatfuncties die de backend heeft ontbreken in de app
`convex/chat.ts` heeft `deleteTeamMessage` (`:847`), `deleteDirectMessage` (`:876`), `editTeamMessage` (`:903`), `validateFileUpload` (`:945`), `generateUploadUrl` (`:974`), `registerChatAttachment` (`:1002`), `getFileUrl` (`:1044`). Mobile roept daarvan niets aan; de inputbalk (`chat.tsx:665-689`) heeft alleen een TextInput en een verzendknop.
**Fix:** bijlage-knop naast de TextInput (`:666`) via `hooks/use-photo-capture.ts` → `generateUploadUrl` + `registerChatAttachment`; laat `renderMessage` (`:291-323`) `attachmentStorageId` renderen via `getFileUrl`; long-press op eigen bericht → edit/delete.

### M11. Dode modules: ~3500 regels afgeronde code die niemand ziet
`components/index.ts:5` `OpnameScreen` (813 r., audio + transcriptie), `:14-19` `ProjectFotoUpload` (974 r.), `:8` `FotoGalerij` (906 r., alleen door het dode ProjectFotoUpload gebruikt), `:11` `SyncStatus` (651 r.). Ook `hooks/use-auto-summary.ts`, `components/ui/PhotoGrid`, `PriceDisplay`, `TrendIndicator`, `FormSection`: nul gebruiksplaatsen. Wordt wel meegebundeld bij elke build.
**Fix:** beslis per module — aanhaken (zie B5) of verwijderen inclusief re-exports.

### M12. `RoleProvider` draait met nul consumenten
`mobile/app/_layout.tsx:15` + `:238` mounten `contexts/RoleContext.tsx` (430 regels) om de hele app; die voert o.a. `api.medewerkers.get` uit. Geen enkel scherm gebruikt de hook — alles gebruikt `hooks/use-user-role.ts`. Resultaat: een overbodige Convex-query bij elke app-start plus een tweede, afwijkende rolwaarheid.
**Fix:** kies één rolbron. Aanbeveling: verwijder `RoleContext.tsx` en de provider (`_layout.tsx:15`, `:238`).

### M13. Hele veldmodules hebben geen mobiel scherm (open scope, geen bug)
`convex/` heeft `verlof.ts`, `verzuim.ts`, `toolboxMeetings.ts`, `kilometerStanden.ts`, `brandstofRegistratie.ts`, `machineGebruik.ts`, `servicemeldingen.ts`, `kwaliteitsControles.ts` en de webapp heeft de bijbehorende pagina's onder `src/app/(dashboard)/`. Mobile roept uitsluitend aan: afronding, chat, fotoStorage, instellingen, materiaalDelta, medewerkers, meerwerk, mobile, notifications, projecten, urenSegmenten, users.
**Actie:** dit is **niet-gebouwde scope**, geen defect. Leg vast welke modules in scope zijn voor mobiel (verlof aanvragen en toolbox-bevestiging liggen het meest voor de hand) en communiceer dat zo richting de gebruiker.

---

## 5. LAAG

### L1. Misleidende "VEREISTE INSTALLATIES"-headers
`hooks/use-photo-capture.ts:6-8`, `hooks/use-offline-queue.ts:8-10`, `components/FotoGalerij.tsx:8`, `components/ProjectFotoUpload.tsx:8` claimen dat packages nog niet in `package.json` staan. Ze staan er wél (`mobile/package.json:24-35`: expo-camera ~17.0.10, expo-image-picker ~17.0.11, expo-image-manipulator ~14.0.8, expo-location ~19.0.8, expo-file-system). Leidt bij debuggen naar de verkeerde conclusie.
**Fix:** verwijder de blokken.

### L2. Altijd-groene "online"-stip in de chat
`mobile/app/(tabs)/chat.tsx:339` (gespreksregel) en `:473` (DM-header) renderen `<View style={styles.onlineIndicator} />` onvoorwaardelijk; stijl op `:902-912` (`backgroundColor: '#4ADE80'`). Er wordt nergens aanwezigheidsdata opgehaald. Misleidende status.
**Fix:** verwijder de stippen en de stijlen, of koppel ze aan echte aanwezigheidsdata.

---

## 6. UI/UX-verbeteringen, per flow

### Flow: Mijn dag / uren loggen (buiten, met handschoenen)
- **Geen enkele feedback bij bevestigen.** `components/veld/SegmentenLijst.tsx:54-67` en `:69-75` — `handleBevestigVoorstel`, `handleBevestigAlle` en `handleVerwijder` hebben een leeg succespad: geen haptiek, geen toast, geen knopstatus. De hovenier weet niet of zijn uren geregistreerd zijn en tikt nog eens. `theme/haptics.ts:7` (`hapticPatterns.success`) bestaat maar wordt in `app/` en `components/veld/` **nul keer** aangeroepen — alleen in zeven ui-componenten.
  **Fix:** roep `hapticPatterns.success()` aan na `await bevestigSegment(...)` (`:63`), `bevestigAlle(...)` (`:71`) en `verwijderSegment(...)` (`:88`), en `hapticPatterns.error()` in de catch. Voeg per rij een `bezig`-state toe zodat de knop op `:189-195` een spinner toont en niet dubbel getikt kan worden. Idem `app/(tabs)/uren.tsx:175` (`dienDagIn`).
- **Categorie-chips te klein**: `SegmentenLijst.tsx:429-430` `paddingHorizontal: 12, paddingVertical: 8` met `fontSize 13` (`:441`) ≈ 34pt. Zet `:430` en `:507` op `paddingVertical: 14` (≥44pt).
- **Foutscherm**: zie M7.

### Flow: Chat
- **Verzendknop 40x40** (`chat.tsx:1088-1094`) → `width/height: 48, borderRadius: 24`.
- **Tekst te klein**: `messageTimestamp` 8px (`:1035-1040`), `roleBadgeText` 9px (`:1025-1029`), `channelTime` 9px (`:940-943`), `headerSubtitle` 9px (`:799-804`), `messageText` 14px (`:1030-1034`). In totaal 57 voorkomens van `fontSize <= 11` in `app/` en `components/`. De schaal begint al te laag: `theme/typography.ts:10-18` `xs: 10, sm: 12, base: 13, md: 14, lg: 16`.
  **Fix:** til de schaal op naar veldniveau (xs 12, sm 14, base 16, md 17, lg 19, xl 22) en vervang de handmatige waarden in `chat.tsx` (`:800, 853, 870, 899, 934, 941, 950, 991, 1016, 1026, 1031, 1036`) door tokens — ondergrens 12 voor bijschriften, 16 voor berichttekst. `FloatingTabBar.tsx:182` van 9 → 11.
- **Geen offline-wachtrij**: `chat.tsx:208-212` roept de mutation direct aan; `hooks/use-offline-queue.ts` en `components/SyncStatus.tsx` bestaan maar worden nergens gerenderd (`<SyncStatus` in `app/`: 0 treffers). Offline verzonden berichten gaan verloren.
- **Zoekknop en online-stip**: zie M9 en L2.

### Flow: Inloggen
- **Primaire knop vrijwel onzichtbaar.** `app/(auth)/login.tsx:665-673` `submitButton: { backgroundColor: '#1A2E1A' }` op paginachtergrond `#0A0A0A` (`:574-577`) ≈ 1,35:1 — het knopvlak is als vorm niet waarneembaar, alleen de groene letters (`:677-681`) zweven. Het designsysteem doet het wél goed: `components/ui/Button.tsx:72` `primary: { backgroundColor: '#4ADE80' }` met tekst `#0A0A0A` (`:82`).
- **Designsysteem omzeild**: `login.tsx:482-497` gebruikt een kale `TextInput` in plaats van `components/ui/Input.tsx`; geen haptiek (`hapticPatterns` in `login.tsx`: 0 treffers).
- **Raakvlakken te klein**: `:692-698` `resendButton` (`paddingVertical: 8` + 13px tekst ≈ 34pt) en `:704-706` `changeEmailButton` (`paddingVertical: 6` ≈ 30pt), beide zonder `hitSlop`.
  **Fix:** vervang de TouchableOpacity's op `:509` en `:415` door `<Button variant="primary" size="lg" fullWidth loading={...} />` (brengt `min-h-11` en `hapticPatterns.tap` mee), de TextInput op `:482` door `<Input label="E-mailadres" status={...} error={...} />`, en roep na geslaagde `setActive` (`:314`, `:160`) `hapticPatterns.success()` aan.

### Flow: Alle tabs — offline-indicatie
`OfflineIndicator` wordt maar op één plek gerenderd: `uren.tsx:32` (import) + `:189`. Home, Foto's, Chat en Profiel tonen niets over de verbinding.
**Fix:** render hem één keer centraal in `mobile/app/(tabs)/_layout.tsx` boven de Stack en verwijder de losse render op `uren.tsx:189`.

---

## 7. Volgorde van uitvoeren

TestFlight-builds kosten tijd. Onderstaande volgorde zet alles wat **zonder build** kan vooraan.

| # | Stap | Wat is nodig | Raakt webapp? |
|---|------|--------------|---------------|
| **0** | **B1-stap-1: datafix** — `users.riboebusiness@gmail.com` `role: "admin"` → `"medewerker"` in het Convex-dashboard | **Niets.** Geen deploy, geen build. Direct testbaar op de huidige TestFlight-build. | Ja, indirect: verifieer daarna dat ricardobos43 op web nog steeds medewerkers ziet (`src/components/veld/veld-dag.tsx:107`) |
| **1** | **B2-deel-1** — `convex/mobile.ts:86-95` en `:60-73` niet meer laten gooien | **Alleen Convex-deploy.** Geen nieuwe build. | `convex/mobile.ts` wordt alleen door mobile aangeroepen, maar leeft in de gedeelde map — **[RAAKT WEBAPP-DEPLOY]** |
| **2** | **M1-deel-b** — onderscheidende foutmeldingen in `convex/urenSegmenten.ts:104-109` | **Alleen Convex-deploy.** | **[RAAKT WEBAPP]** — `getVeldDag` wordt door `src/components/veld/veld-dag.tsx` gebruikt. Controleer die aanroepen. |
| **3** | **B1-stap-2** — `convex/mobile.ts:384-419` rol + `clerkUserId` meepatchen | **Alleen Convex-deploy.** | **[RAAKT WEBAPP-DEPLOY]** |
| **4** | **B3 + B4** — chat sorteervolgorde, `getItemLayout` weg, aparte refs + scrollToOffset, zichtbare foutmelding, project-inputbalk verbergen | **Nieuwe build.** Alles in `mobile/app/(tabs)/chat.tsx`. | Nee — `convex/chat.ts:201`/`:443` blijven ongewijzigd |
| **5** | **H1 + B5-optie-A** — `href: null` voor `notifications` én `fotos` + `descriptors`-filter in `FloatingTabBar.tsx` | **Zelfde build als #4.** | Nee |
| **6** | **B2-deel-2 + H2 + M4 + M5 + M6 + M9** — profiel-volgorde omdraaien, quick actions, notificatievoorkeuren, dialogen bereikbaar, `.catch()`, zoekknop | **Zelfde build als #4.** Allemaal mobile-only. | Nee |
| **7** | **B6** — themasysteem omkeren (stappen 1+2), daarna stap 3 (hardcoded chrome) | **Nieuwe build.** Splits stap 3 eventueel naar een volgende build. | Nee |
| **8** | **M7 + M8 + M12 + L1 + L2** — foutgrens, nep-refresh weg, RoleProvider weg, headers opruimen, online-stip weg | **Zelfde build als #7.** | Nee |
| **9** | **H3** — ToastProvider mounten op rootniveau, selectief `Alert.alert` vervangen | **Zelfde build als #7.** | Nee |
| **10** | **UI/UX-pakket** — haptiek in `SegmentenLijst`, typografieschaal, raakvlakken, login op het designsysteem, centrale OfflineIndicator | **Nieuwe build.** | Nee |
| **11** | **M3** — read-marking optimaliseren | Mobile: build. **[RAAKT WEBAPP]** `convex/chat.ts:223-236` en `:578-582` — Convex-deploy | Ja |
| **12** | **M10 + B5-optie-B + M11** — chat-bijlagen, echte foto-tab, dode modules opruimen. Vereist eerst een gedeelde offline-queue (context/singleton) | **Nieuwe build.** Alleen bestaande Convex-functies gebruiken (`generateUploadUrl` + `voegVeldFotoToe`) | Alleen als je een projectfoto-tabel toevoegt — **[RAAKT WEBAPP-SCHEMA]**, additief houden |
| **13** | **M13** — scopebesluit veldmodules (verlof, toolbox, wagenpark) | Beslissing, geen code | n.v.t. |

### Kortste weg naar een werkende app voor de gebruiker

- **Vandaag, zonder build:** stap 0 lost "Mijn dag" op de huidige TestFlight-build op.
- **Vandaag, met Convex-deploy:** stap 1 lost de biometrie-crash op.
- **Eerste nieuwe build:** stappen 4, 5, 6 — dat dekt klacht 2 (chat) en het grootste deel van klacht 3 (dode knoppen, spooktab).
- **Tweede build:** stappen 7-10 — klacht 4 (UI/UX).

---

## 8. Wat NIET (opnieuw) onderzocht hoeft te worden

De volgende hypotheses zijn tijdens verificatie **weerlegd**; de code-citaten klopten telkens wel, de causaliteit niet:

| Hypothese | Waarom weerlegd |
|---|---|
| "Twee onverenigbare resolutiemechanismen (`by_clerk_id` vs. `linkedMedewerkerId`)" | ricardobos43 heeft **beide** leeg — geen drift, gewoon nooit gekoppeld. De voorgestelde helper lost niets op. |
| "`medewerkers.ts:getUserRole` maakt iedereen directie" | Die functie is **niet geëxporteerd** (`convex/medewerkers.ts:55`) en geen enkel bestand importeert uit `./medewerkers`. Ligt op geen van beide stacktraces. |
| "companyId-silo tussen de twee accounts is oorzaak van de chatklacht" | Binnen één sessie gebruiken `sendTeamMessage` (`chat.ts:75`) en `getTeamMessages` (`chat.ts:164`) dezelfde identiteit → dezelfde companyId. Er is geen bewijs dat de gebruiker tussen versturen en lezen van account wisselt. |
| "Ontbrekende foutfeedback in `chat.tsx:221-223` is dé oorzaak van klacht 2" | Op tabblad **Team** kan `sendTeamMessage` voor deze gebruiker niet gooien (geen `projectId`, geen attachment, rol directie passeert `requireNotViewer`), en er staat geen chat-fout in de productielogs. Reëel UX-defect (B4), geen oorzaak op Team. |
| "`isLoading = false` in `chat.tsx:402` toont 'Nog geen berichten' als dataverlies" | Zodra de query resolvet met N>0 valt de ternary hoe dan ook naar de FlatList. Cosmetische flits. De voorgestelde fix breekt bovendien de DM-takken (`:564-566`, `:594-595`). |
| "Adminscherm is onbereikbaar → oorzaak van de koppelingsfout" | Klopt als dood-code-observatie (`app/admin/index.tsx`, 662 r., nergens genavigeerd), maar `adminLinkUserToMedewerker` zet alleen `linkedMedewerkerId` — koppelen via dat scherm laat `updateBiometricSetting` even hard falen. Gebruikersbeheer bestaat al op web (`src/app/(dashboard)/gebruikers/page.tsx`). |
| "Home begroet met de naam van een collega" | Voor riboebusiness levert `medewerkers.getActive` via de lokale clerkId-lookup (`medewerkers.ts:67-79`) juist wél de eigen naam. Wat overblijft is dat `profile?.[0]?.naam` (`index.tsx:112`) een fragiele bron is — smalle bug, geen symptoomverklaring. |
| "`normalizeRole` in `use-user-role.ts:136-144` geeft klanten medewerkerrechten" | De praktisch bereikbare fout is het tegenovergestelde (privilege-**verlies** voor `directie` bij `hasAdminPrivileges`). Beide productie-accounts zijn `admin` → mapping werkt correct. Er is een derde rolsurface (`contexts/RoleContext.tsx:186-222`) die faalt-closed. |
| "`useCurrentUser` doet na 3s alsof je bent ingelogd" | De `setAuthTimedOut(true)` staat binnen `if (__DEV__)` (`hooks/use-current-user.ts:56-65`) — dode code in productie. |
| "Geen error boundaries buiten `uren.tsx` → app crasht" | "Mijn dag" wordt juist **wel** afgevangen door `VeldFoutgrens` (`uren.tsx:135-137`). Mutation-fouten bereiken per React-ontwerp nooit een boundary. Defence-in-depth, geen oorzaak. |
| "`AppErrorBoundary` is een doodlopende weg" | De fout bereikt hem nooit (geneste `VeldFoutgrens`), en hem naar binnen verplaatsen verwijdert de enige boundary boven `ClerkProvider` (`_layout.tsx:291`) — schadelijk. |
| "Offline foto-wachtrij / SyncEngine verliest data" | `ProjectFotoUpload` wordt nergens gerenderd, `useSyncQueue` wordt nergens aangeroepen → er staat niets in de queue. Dode code (M11), geen actief dataverlies. Wordt wél een echte bug zodra B5-optie-B gebouwd wordt — vandaar de handler-voorwaarde daar. |
| "Buiten-modus maakt de zonknop onzichtbaar" | Het knoplabel is `#0A0A0A` op `#4ADE80` (~10:1). Alleen het glyph vervaagt. De échte onleesbaarheid zit in `Badge.tsx:63+73` (`outline`) en `Button.tsx:74+84/:86` (`outline`/`ghost`) op de witte buiten-achtergrond. De voorgestelde `useColors()`-fix werkt niet: buiten-tokens leven alleen in `BuitenModusContext`. |
| "`StatusBar style='light'` + `userInterfaceStyle: 'light'` is fout" | De app rendert de facto altijd donker (17 bestanden hardcoden `#0A0A0A`); `style="light"` is momenteel correct. `userInterfaceStyle: "automatic"` zetten vóór B6 introduceert juist witte tekst op wit. |
| "Rauwe ConvexError-tekst in `uren.tsx:89`" | `toonFout` ligt niet op het `getVeldDag`-pad (alleen aangeroepen op `:177`). De relevante plek is `:421-427`, en de voorgestelde `/s`-regex is aantoonbaar een no-op. Zie M7 voor de juiste fix. |
