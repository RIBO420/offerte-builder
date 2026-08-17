# Mobile App Review

**Reviewed:** 2026-03-26
**Scope:** /mobile/ -- Expo 54, React Native 0.81, Expo Router 6, NativeWind 4, Clerk Expo, Convex
**Reviewer:** Claude Code Review Agent

## Summary
- Critical: 3
- Warning: 12
- Info: 8

---

## Findings

### [CRITICAL] Hardcoded Clerk Secret Key in Source Code
**Location:** mobile/app/(auth)/login.tsx:99
**Issue:** The `handleDevLogin` function contains a hardcoded Clerk Backend API secret key (`sk_test_PP1Q0U9UqF9XKsdwOdE8GaFusRYBkmqpEg5dBm2xLv`) and a hardcoded `user_id`. This is a Clerk *secret* key (not a publishable key) -- it grants full backend access to the Clerk account and must never appear in client-side code. Even though it is gated behind `__DEV__`, React Native bundles include all code; the secret can be extracted from any development build artifact.
**Recommendation:** Remove the secret key immediately. Rotate the compromised key in the Clerk dashboard. If a dev login shortcut is needed, create a server-side endpoint (e.g., a Convex action) that generates sign-in tokens, and call that from the client instead.

### [CRITICAL] Biometric Login Does Not Actually Restore a Clerk Session
**Location:** mobile/app/(auth)/biometric-login.tsx:71-143, mobile/lib/auth/biometric.ts:97-128
**Issue:** The biometric flow stores a Clerk session token at the time of initial login and retrieves it after Face ID / Touch ID succeeds. However, this stored token is never used to restore the Clerk session. `handleBiometricLogin` checks `isSignedIn` (which is false since no session was restored) and then shows a "Sessie Verlopen" alert, disabling biometric and sending the user to the normal login. In practice, biometric login never works after the initial Clerk session expires (which can be as short as 1 hour). The feature gives users the illusion of quick re-login but always falls through to the failure path.
**Recommendation:** Implement a proper token refresh flow. Options: (1) Store a long-lived Clerk session ID and use `clerk.signIn.create({ strategy: 'ticket' })` with a server-generated token after biometric verification; (2) Use Clerk's `getToken()` with a forced refresh; (3) Store and use a Clerk session JWT alongside `setActive()`. The current approach of storing a snapshot token is fundamentally broken for session restoration.

### [CRITICAL] SQL Injection via Unsanitized Table Names in Sync Engine
**Location:** mobile/lib/storage/sync-engine.ts:419-433
**Issue:** The `processSyncQueue` method constructs SQL queries using string interpolation with `item.table_name` directly from the sync queue database: `UPDATE ${item.table_name} SET server_id = ...`. If an attacker (or a bug) writes a malicious table name into the sync queue, arbitrary SQL can be executed. While the data comes from a local SQLite database, this is still a defense-in-depth concern, especially since the sync queue could be populated from various sources.
**Recommendation:** Validate `item.table_name` against a whitelist of known table names (e.g., `uren_registraties`, `location_cache`) before using it in SQL. Create a `VALID_TABLES` constant and check membership before constructing the query.

---

### [WARNING] Notifications Tab Listed but Is Just a Redirect
**Location:** mobile/app/(tabs)/_layout.tsx:16, mobile/app/(tabs)/notifications.tsx:1-5
**Issue:** The tab layout registers a `notifications` screen, but the file simply redirects to `/(tabs)` (the home screen). The notifications tab is not visible in the FloatingTabBar (which only shows 5 tabs: index, fotos, uren, chat, profiel), but Expo Router still registers the route. Navigating to `/(tabs)/notifications` from the dashboard (line 242 in index.tsx and line 316) redirects back to home, creating a confusing loop.
**Recommendation:** Either implement a proper notifications screen at this route (a full list view), or remove the redirect file and change the dashboard notification bell to navigate to a modal/separate route outside the tab group.

### [WARNING] FlatList Inside ScrollView on Dashboard
**Location:** mobile/app/(tabs)/index.tsx:334-361
**Issue:** A horizontal `FlatList` for "other projects" is nested inside the main `ScrollView`. While a horizontal FlatList inside a vertical ScrollView works in React Native (unlike nested vertical lists), this specific pattern can cause rendering issues on Android and defeats the purpose of FlatList's virtualization since the ScrollView renders all its children eagerly. Additionally, the parent `ScrollView` already has `contentContainerStyle={{ paddingBottom: 100 }}` plus a redundant `<View style={{ height: 100 }} />` spacer at the bottom (line 365).
**Recommendation:** Consider using a `SectionList` or a single `FlatList` with `ListHeaderComponent` for the entire dashboard to get proper virtualization. Remove the duplicate 100px bottom spacer.

### [WARNING] Mock/Hardcoded Data in Dashboard
**Location:** mobile/app/(tabs)/index.tsx:152-207
**Issue:** The dashboard contains extensive mock state for clock-in/out functionality (`isClockedIn`, `sessionStartTime`, `handleClockIn`, `handleClockOut`) with `setTimeout`-based fake operations, hardcoded `weeklyHours = [8.5, 7.0, 6.5, 0, 0, 0, 0]`, and unused variables (`currentTime`, `todayHours`, `totalWeekHours`, `formatTime`, `formatHoursMinutes`, `formatCurrency`, `getGreeting`). These mock implementations exist alongside real Convex queries, creating confusion about what is real vs. placeholder.
**Recommendation:** Remove or clearly isolate mock implementations. The Uren tab already has real clock-in/out via Convex mutations -- consolidate the clock-in widget to use the same real backend calls.

### [WARNING] `useEffect` Dependency Warnings in Login and Callback Screens
**Location:** mobile/app/(auth)/login.tsx:54, mobile/app/(auth)/biometric-login.tsx:46-53, mobile/app/(auth)/callback.tsx:136-138
**Issue:** Multiple `useEffect` hooks have incomplete dependency arrays. For example, `login.tsx:54` depends on `isSignedIn` but omits `router` from the deps. `biometric-login.tsx:46` calls `initializeBiometric` (which references `handleBiometricLogin`) but the function is defined later and neither is in deps. `callback.tsx:137` calls `handleCallback` which closes over `signIn`, `signUp`, `status`, and other reactive values but has `[]` deps.
**Recommendation:** Fix dependency arrays or use `useCallback` / extract stable references. For `callback.tsx`, the stale closure over `status` (line 96) means the timeout check will always see `'verifying'`, which happens to be correct but is fragile.

### [WARNING] Theme darkColors Object Naming Is Inverted
**Location:** mobile/theme/colors.ts:74, mobile/theme/ThemeProvider.tsx:71
**Issue:** The export named `darkColors` actually contains *light mode* overrides (background: '#FAFAF8', foreground: '#1A1A1A', card: '#FFFFFF'). The ThemeProvider applies them as: `isDark ? { ...colors, ...darkColors } : colors`, meaning dark mode gets the "light" overrides merged on top. This is semantically inverted. The base `colors` object is the actual dark theme, and `darkColors` holds light-mode values but is applied when `isDark` is true.
**Recommendation:** Rename `darkColors` to `lightColors` and fix the ThemeProvider logic to: `isDark ? colors : { ...colors, ...lightColors }`. Currently the theme system only works correctly because the app defaults to dark mode and most users never switch themes, but it is actively broken for theme switching.

### [WARNING] `expo-notifications` Plugin Missing from app.json
**Location:** mobile/app.json:36-44
**Issue:** The `plugins` array includes `expo-router`, `expo-secure-store`, and `expo-local-authentication`, but does not include `expo-notifications`. While push notifications work in Expo Go (to some extent), a development or production build requires the expo-notifications plugin for proper native configuration (APNs entitlements on iOS, Firebase setup on Android).
**Recommendation:** Add `"expo-notifications"` to the plugins array in app.json. For Android, also consider adding the `expo-notifications` plugin with Firebase configuration.

### [WARNING] No Deep Link Configuration for Android
**Location:** mobile/app.json:5, mobile/app/(auth)/login.tsx:185-187
**Issue:** The `scheme: "toptuinen"` is defined at the top level of the Expo config, and deep links are generated with `Linking.createURL('callback', { scheme: 'toptuinen' })`. However, Android requires `intentFilters` in app.json for deep links to work, and no `intentFilters` are configured. Magic link login via deep link will silently fail on Android devices.
**Recommendation:** Add `intentFilters` under `expo.android` in app.json to handle the `toptuinen://` scheme. Also consider adding universal links (associated domains) for both platforms for a more reliable deep link experience.

### [WARNING] Stale Interval Leak in Callback Screen
**Location:** mobile/app/(auth)/callback.tsx:84-102
**Issue:** The `handleCallback` function creates a `setInterval` (line 84) and a `setTimeout` (line 93) without storing references that can be cleaned up when the component unmounts. If the user navigates away before the 30-second timeout, the interval continues running in the background and the timeout will fire, potentially calling `setStatus` on an unmounted component.
**Recommendation:** Store the interval and timeout IDs in refs and clear them in a useEffect cleanup function.

### [WARNING] Multiple SyncEngine State Listeners Overwrite Each Other
**Location:** mobile/hooks/use-offline-sync.ts:98, 196, 267
**Issue:** The `SyncEngine.setOnStateChange` method only stores a single callback. When multiple hooks (`useSyncStatus`, `usePendingCount`, `useFailedSyncItems`) are active simultaneously, each one calls `setOnStateChange`, and only the last registered callback will receive updates. The earlier listeners are silently overwritten.
**Recommendation:** Refactor `SyncEngine` to support multiple listeners (use an array or event emitter pattern). Alternatively, create a single React context that subscribes once and distributes state to all consumers.

### [WARNING] Loading Screen Background Mismatch
**Location:** mobile/app/index.tsx:40, mobile/app/index.tsx:63
**Issue:** The index.tsx loading screen uses `backgroundColor: '#fff'` (white) while the rest of the app uses `backgroundColor: '#0A0A0A'` (near-black). When the app launches, users see a white flash before the dark theme loads, creating a jarring visual experience.
**Recommendation:** Change the loading screen background to `'#0A0A0A'` and the ActivityIndicator color to `'#4ADE80'` to match the app's dark theme.

### [WARNING] `Feather` Icons Mixed with Lucide Icons
**Location:** mobile/app/_layout.tsx:16, mobile/app/(tabs)/index.tsx:5+10, mobile/app/(auth)/login.tsx:14, multiple other files
**Issue:** The app uses two different icon libraries: `@expo/vector-icons/Feather` and `lucide-react-native`. The CLAUDE.md explicitly states "NO emojis as icons" and the design system specifies Lucide icons. However, many screens still use `Feather` from `@expo/vector-icons`. This creates inconsistency in icon styling (Feather uses filled styles differently, different default sizing, and slightly different glyphs) and increases bundle size with two icon font sets.
**Recommendation:** Migrate all `Feather` icon usage to `lucide-react-native` equivalents. Both libraries have near-identical icon names. This will unify the design language and allow removing `@expo/vector-icons` from dependencies.

### [WARNING] Profiel Screen Uses Excessive Inline Styles
**Location:** mobile/app/(tabs)/profiel.tsx:386-652
**Issue:** The profile screen has over 250 lines of inline style objects (`style={{ flexDirection: 'row', ... }}`), unlike other screens that properly use `StyleSheet.create()`. This hurts readability, performance (new objects created on each render), and makes design changes tedious.
**Recommendation:** Extract inline styles to a `StyleSheet.create()` block at the bottom of the file, following the pattern used in other tab screens.

---

### [INFO] Robust Offline-First Architecture
**Location:** mobile/lib/storage/
**Issue:** The SQLite-based offline storage with outbox-pattern sync engine, WAL mode, proper migrations, UUID v7 idempotency keys, exponential backoff, and conflict detection is well-architected. The separation into database.ts, migrations.ts, and sync-engine.ts follows a clean module pattern.
**Recommendation:** No changes needed. This is production-quality infrastructure.

### [INFO] Proper FlatList Usage in Chat and Uren Screens
**Location:** mobile/app/(tabs)/chat.tsx:456-476, mobile/app/(tabs)/uren.tsx
**Issue:** Chat and Uren screens correctly use `FlatList` with `getItemLayout`, `keyExtractor`, `inverted` (for chat), and `showsVerticalScrollIndicator={false}`. This ensures virtualized rendering for potentially long lists.
**Recommendation:** No changes needed.

### [INFO] Well-Structured Theme Token System
**Location:** mobile/theme/
**Issue:** The theme system provides a comprehensive single source of truth with colors, typography, spacing, radius, shadows, animations, and haptics. Tailwind config imports from theme tokens. The `useColors()` and `useTheme()` hooks make it easy to access themed values.
**Recommendation:** No changes needed. Consider documenting the inverted darkColors naming as noted in the WARNING above.

### [INFO] Good Accessibility Practices in FloatingTabBar
**Location:** mobile/components/ui/FloatingTabBar.tsx:84-85
**Issue:** The FloatingTabBar correctly sets `accessibilityRole="tab"`, `accessibilityState={{ selected: isFocused }}`, and `accessibilityLabel` on each tab button. Haptic feedback is provided on selection.
**Recommendation:** No changes needed.

### [INFO] Proper Reanimated v4 Usage
**Location:** mobile/hooks/use-spring-animation.ts, mobile/components/ui/FloatingTabBar.tsx
**Issue:** The codebase correctly uses Reanimated v4 with `useSharedValue`, `useAnimatedStyle`, `withSpring`, and `withTiming` (not the legacy Animated API). The `useReducedMotion` hook from Reanimated is properly used to respect accessibility preferences. Spring configs are centralized in theme tokens.
**Recommendation:** No changes needed.

### [INFO] Fotos Tab Is a Placeholder
**Location:** mobile/app/(tabs)/fotos.tsx
**Issue:** The Foto's tab only renders a static placeholder text "Foto's worden hier geladen..." with no actual photo functionality, despite having substantial photo-related components in `mobile/components/` (FotoGalerij.tsx, ProjectFotoUpload.tsx, OpnameScreen.tsx) and hooks (use-photo-capture.ts).
**Recommendation:** This appears to be intentional work-in-progress. When ready, integrate the existing photo components into this tab screen.

### [INFO] Push Notification Setup Is Thorough
**Location:** mobile/lib/notifications/push.ts, mobile/hooks/use-push-notifications.ts
**Issue:** Push notification implementation handles permission requests, Expo push token registration, foreground notification display, notification tap navigation (with deep link into chat channels and project details), Android notification channels, Expo Go detection, and simulator detection. The hook properly waits for authentication before registering.
**Recommendation:** No changes needed beyond adding the expo-notifications plugin to app.json (see WARNING above).

### [INFO] ClerkProviderWrapper in lib/auth/clerk.tsx Is Unused
**Location:** mobile/lib/auth/clerk.tsx:77-94
**Issue:** The `ClerkProviderWrapper` component and custom `tokenCache` in this file are never imported. The root layout (`app/_layout.tsx`) directly uses `ClerkProvider` from `@clerk/clerk-expo` with `tokenCache` from `@clerk/clerk-expo/token-cache`. This file is dead code.
**Recommendation:** Remove `mobile/lib/auth/clerk.tsx` or consolidate the Clerk setup to use this wrapper. The custom tokenCache has useful logging that could be beneficial for debugging.

---

## Architecture Summary

### Strengths
- Clean Expo Router file-based navigation with proper route groups ((auth), (tabs))
- Convex integration is solid -- real-time queries with proper skip conditions
- Role-based access control is thorough (RoleContext, useUserRole, RoleGate components)
- Offline sync engine with outbox pattern is production-quality
- Theme token system is well-organized with single source of truth
- Proper use of Reanimated v4 with reduced motion support
- Good haptic feedback integration
- 25+ reusable UI components with CVA variants

### Areas for Improvement
- Security: Remove hardcoded secret key immediately
- Auth: Fix biometric login to actually restore sessions
- Consistency: Standardize on Lucide icons, remove Feather
- Theme: Fix inverted darkColors naming
- Code quality: Extract inline styles in profiel.tsx
- Testing: No test files found in mobile/ -- consider adding at minimum unit tests for the sync engine and auth helpers
- Error boundaries: App-level error boundary exists but no route-level error boundaries
- TypeScript: Several `as any` casts in uren.tsx for Convex type workarounds
