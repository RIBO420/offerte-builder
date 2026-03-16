# Plan Review: Mobile UI Redesign — Premium Organic

**Reviewed:** 2026-03-16
**Verdict:** ISSUES FOUND (4 critical, 5 minor)

---

## Critical Issues

### C1: Missing dependencies — `expo-blur` and `expo-linear-gradient` not installed, not in Task 3

**Severity:** Critical
**Location:** Task 3 (Install New Dependencies), Task 4 (FloatingTabBar), Task 6 (HeroProjectCard)

Task 3 only installs `expo-haptics`. However:
- **Task 4** imports `BlurView` from `expo-blur` in `FloatingTabBar.tsx` — `expo-blur` is NOT in `mobile/package.json`.
- **Task 6** references `LinearGradient` for `HeroProjectCard` background (`#1A2E1A` to `#0D1F0D`) — `expo-linear-gradient` is NOT in `mobile/package.json`.
- **Task 5** mentions `BlurView` again in `Card.tsx` glass variant.

**Fix:** Task 3 must install both: `npx expo install expo-blur expo-linear-gradient`.

---

### C2: FotoGalerij excluded from Task 5, misattributed to Task 15 only

**Severity:** Critical
**Location:** Task 5 vs Spec Section 9

The spec lists **19 existing components to redesign**, explicitly including `FotoGalerij.tsx` (noting it is in `components/` not `components/ui/`). Task 5 only lists 18 files — all in `components/ui/`. `FotoGalerij.tsx` is deferred to Task 15 (cleanup) where it gets a one-line mention: "Apply Premium Organic colors to FotoGalerij." This is under-specified compared to the 18 components in Task 5 that each get detailed visual instructions.

**Fix:** Either add `FotoGalerij.tsx` to Task 5 with full visual specifications, or add a dedicated sub-step in Task 15 with the same level of detail as other component updates.

---

### C3: `callback.tsx` auth screen ignored

**Severity:** Critical
**Location:** Task 12 (Auth Screens Redesign)

The file `mobile/app/(auth)/callback.tsx` exists on disk but is not mentioned in Task 12. Task 12 lists `login.tsx`, `biometric-login.tsx`, `biometric.tsx`, and `_layout.tsx` — missing `callback.tsx`. If this screen has visible UI (it likely handles OAuth callback with a loading/transition state), it will remain in the old visual style after the redesign.

**Fix:** Add `callback.tsx` to Task 12's file list with at minimum a note to update its colors/styling or confirm it has no user-visible UI.

---

### C4: Scope colors in plan contradict existing codebase

**Severity:** Critical
**Location:** Task 1, Step 1

The plan specifies scope colors as:
```
grondwerk: '#8B7355', bestrating: '#A0A0A0', borders: '#2D5A27', gras: '#4ADE80', houtwerk: '#D4A574', water: '#3B82F6', specials: '#A855F7'
```

The existing `tailwind.config.js` has different scope colors:
```
grondwerk: '#B09070', bestrating: '#9A9CA0', borders: '#4D8C4D', gras: '#7DD98C', houtwerk: '#A87A50', water: '#5AA0D0', specials: '#B070D0'
```

The plan says "Keep scope colors unchanged" but then provides values that **are** different from what's currently in the codebase. This will cause visual regressions in scope-tagged elements across the app (ScopeTag, StatusBadge, etc.).

**Fix:** Decide explicitly: keep the **existing** scope colors (from `tailwind.config.js`) or adopt the **new** plan colors. Update the plan to be unambiguous. If changing, note it as a deliberate design update, not "unchanged."

---

## Minor Issues

### M1: `profiel` tab file name — plan references it correctly but no restyle of `profiel.tsx` exists yet

**Severity:** Minor
**Location:** Task 11

The file `profiel.tsx` exists and is correctly referenced. No issue here, but Task 11 mentions adding "Notificatie-instellingen section" (notification preferences). Since notifications are being removed as a tab, the plan should clarify what data source/query powers this section — is it the same query from the old `notifications.tsx`?

---

### M2: `useColors` import in Task 4 — correct but undocumented

**Severity:** Minor
**Location:** Task 4, Step 1

Task 4 imports `useColors` from `../../theme`. This function exists in `ThemeProvider.tsx` and is exported from `theme/index.ts`. This works, but the import path `../../theme` depends on the file being in `components/ui/`. The plan should note this is a runtime hook that requires ThemeProvider context — if tested in isolation, it will fail.

---

### M3: Tailwind config consolidation is incomplete

**Severity:** Minor
**Location:** Task 1, Step 7

Step 7 shows importing `colors, darkColors, scope` from `./theme/colors` using `require()`. However, the existing Tailwind config has a deeply nested structure (e.g., `background.DEFAULT`, `background.secondary`, `background.tertiary`, `primary.DEFAULT`, `primary.foreground`). The plan's flat color mapping (`background: colors.background`) doesn't match the existing nested structure. The developer will need to restructure the Tailwind color tokens or maintain backward compatibility.

**Fix:** Provide a complete mapping that preserves the nested structure, or explicitly state the flat structure is intentional and NativeWind classnames throughout the app need updating.

---

### M4: Chunk 3 parallelism caveat is buried

**Severity:** Minor
**Location:** Chunk 3 header

The plan says Tasks 7-12 can run in parallel, then immediately adds "BUT Task 7 should complete first." This contradicts the parallel claim. Task 7 creates `fotos.tsx` and changes the tab layout, which Tasks 8-12's screens depend on for proper navigation.

**Fix:** Restructure as: "Chunk 3a: Task 7 (sequential). Chunk 3b: Tasks 8-12 (parallel after 3a)." The parallel execution summary at the bottom already does this correctly — the header text should match.

---

### M5: `react-native-gesture-handler` Swipeable import may need verification

**Severity:** Minor
**Location:** Task 6, Step 2 (NotificationBanner)

The plan specifies using `Swipeable` from `react-native-gesture-handler` for swipe-to-dismiss on `NotificationBanner`. The gesture-handler package is confirmed installed, but `Swipeable` was deprecated in recent versions in favor of `ReanimatedSwipeable` from `react-native-gesture-handler/ReanimatedSwipeable`. Verify the installed version supports the intended import.

---

## Spec Coverage Summary

| Spec Item | Plan Coverage | Status |
|-----------|--------------|--------|
| Premium Organic palette | Task 1 | Covered |
| Typography updates | Task 1 Step 2 | Covered |
| Animation configs | Task 1 Step 4 | Covered |
| Haptic patterns | Task 1 Step 5 | Covered |
| Token consolidation | Task 1 Step 7 | Partial (M3) |
| Reanimated migration | Task 2 + Task 5 | Covered |
| expo-haptics install | Task 3 | Covered |
| expo-blur install | Missing | **Critical (C1)** |
| expo-linear-gradient install | Missing | **Critical (C1)** |
| FloatingTabBar | Task 4 | Covered |
| 19 component redesigns | Task 5 + Task 15 | Partial (C2) |
| 7 new components | Task 6 | Covered |
| Tab layout rewiring | Task 7 | Covered |
| New Foto's tab | Task 7 | Covered |
| Notifications tab removal | Task 7 | Covered |
| Home dashboard redesign | Task 8 | Covered |
| Uren redesign | Task 9 | Covered |
| Chat redesign | Task 10 | Covered |
| Profiel redesign | Task 11 | Covered |
| Auth screens redesign | Task 12 | Partial (C3) |
| callback.tsx redesign | Missing | **Critical (C3)** |
| Project detail redesign | Task 13 | Covered |
| Shared element transitions | Task 13 | Covered |
| Reduced motion / a11y | Task 14 | Covered |
| Remaining components cleanup | Task 15 | Covered |
| Large touch targets (44px min) | Not specified per-component | **Not enforced** |
| One-handed operation | Structural (floating tab) | Implicit |

---

## Recommendations

1. **Immediately fix C1** — add `expo-blur` and `expo-linear-gradient` to Task 3. Without these, Tasks 4, 5, and 6 will fail to compile.
2. **Resolve C4** — confirm scope colors with the designer. The plan contradicts itself ("keep unchanged" vs new values).
3. **Add `callback.tsx`** to Task 12 or explicitly document it has no visible UI.
4. **Promote FotoGalerij** — give it full visual specs, not a one-liner in cleanup.
5. **Split Chunk 3** into 3a (Task 7) and 3b (Tasks 8-12) in the header text to match the execution summary.
6. **Add a 44px touch target** checkpoint to Task 14 (accessibility audit) — the spec calls this out as essential for gloved field workers.
