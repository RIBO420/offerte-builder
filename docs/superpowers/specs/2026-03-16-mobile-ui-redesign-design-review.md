# Spec Review: Mobile UI Redesign — Premium Organic

**Reviewed:** 2026-03-16
**Spec:** `2026-03-16-mobile-ui-redesign-design.md`
**Verdict:** ISSUES FOUND (4 critical, 6 minor)

---

## Critical Issues

### C1. Component count mismatch (spec says 22, codebase has 19)
**Severity:** Critical
**Section:** 9 — Component Updates
**Detail:** The spec says "Existing components to redesign (22)" but the actual `mobile/components/ui/` directory contains 19 component files: Button, Card, Input, Dialog, Switch, Tabs, Badge, Skeleton, StatusBadge, Label, AnimatedNumber, PriceDisplay, ScopeTag, TrendIndicator, OfflineIndicator, Checkbox, Toast, FormSection, and the barrel index.ts. The spec only names 9 of these explicitly and says "All others — color and spacing refresh" for the remainder. This will cause confusion about scope — implementers won't know exactly which 22 components are meant. **Fix:** List all components explicitly with the intended treatment for each.

### C2. Reanimated version reference is wrong
**Severity:** Critical
**Section:** 8 — Animations & Transitions (Technical)
**Detail:** The spec says "Migrate from React Native Animated to React Native Reanimated 2/3." The project already has `react-native-reanimated ~4.1.1` installed. Reanimated v4 has a different API surface from v2/3 in some areas. This instruction is misleading — it should say "Migrate usages of the legacy `Animated` API to Reanimated (already installed at v4)" and reference v4 APIs. **Fix:** Update the version reference and clarify this is about migrating call sites, not installing the library.

### C3. Missing dependency installation requirements
**Severity:** Critical
**Section:** 8 & 10
**Detail:** The spec references `react-native-gesture-handler` and `expo-haptics`, but neither is currently installed in the project. The spec does not call out that these are new dependencies to install. For a "purely visual, no backend changes" redesign, adding native dependencies can trigger Expo prebuild/config changes and affect the native build. **Fix:** Add an explicit "New Dependencies" section listing: `react-native-gesture-handler`, `expo-haptics`, and any other new packages. Note any Expo config plugin requirements.

### C4. Foto's tab is entirely new functionality, not just visual
**Severity:** Critical
**Section:** 5, 6, 7
**Detail:** The spec frames this as a purely visual redesign ("no backend changes"), but the Foto's tab does not exist today. The current tab structure is: Home, Notifications, Uren, Chat, Profiel. Creating a new Foto's tab with "upload flow and project gallery" is new feature work, not a visual refresh. This needs either: (a) a separate scope/spec for the Foto's feature, or (b) an explicit acknowledgment that this tab is new functionality with its own data requirements (photo storage, per-project association, gallery queries). Similarly, removing the Notifications tab and merging its content into Home is a structural change, not purely cosmetic. **Fix:** Clarify which parts are visual-only vs. structural/functional changes. Define data requirements for the photo gallery (Convex storage? External CDN? File size limits?).

---

## Minor Issues

### M1. No "Foto's" screen file exists
**Severity:** Minor
**Section:** 7
**Detail:** The spec assigns a "Foto's Agent" in Phase 2 but there is no `mobile/app/(tabs)/fotos.tsx` file. The implementation plan should note this file needs to be created and the tab layout restructured.

### M2. SF Pro is iOS-only
**Severity:** Minor
**Section:** 2 — Typography
**Detail:** The spec mandates SF Pro Display / SF Pro Text but says the app "must work on iOS (primary) and Android (secondary)." SF Pro is not available on Android. The spec should define a fallback font for Android (e.g., Roboto or Inter) or specify that a custom font will be bundled. **Fix:** Add Android font fallback.

### M3. No accessibility detail beyond reduced motion
**Severity:** Minor
**Section:** 8, Phase 3
**Detail:** The spec mentions `useReducedMotion()` and a Phase 3 "accessibility audit" but provides no concrete accessibility requirements: color contrast ratios (WCAG), minimum text sizes, screen reader labels, focus order for the floating tab bar. For a dark theme with subtle borders (#222, #2d5a2740 at 25% opacity), contrast could be an issue. **Fix:** Add minimum contrast ratios and note that all interactive elements need `accessibilityLabel` props.

### M4. No performance budget or targets
**Severity:** Minor
**Section:** Phase 3
**Detail:** Phase 3 mentions "performance optimization" but sets no targets. With Reanimated animations, shared element transitions, parallax scrolling, and shimmer effects all running, there's risk of frame drops on lower-end devices. **Fix:** Define targets (e.g., 60fps on iPhone 12+, <100ms interaction response, bundle size delta).

### M5. ProjectListItem missing from component list
**Severity:** Minor
**Section:** 9
**Detail:** The "New components needed" list includes ProjectListItem, but Section 6 says "Other projects" uses "Horizontal scroll or compact grid." The spec is undecided on the layout pattern. **Fix:** Pick one (horizontal scroll is better for one-handed use) and update the component name/description accordingly.

### M6. No error/empty state designs specified
**Severity:** Minor
**Section:** 6, 7
**Detail:** The spec defines happy-path layouts but says nothing about: no projects assigned, no notifications, offline state UI (beyond OfflineIndicator which already exists), failed photo uploads, or empty chat channels. **Fix:** Add empty state descriptions for each tab.

---

## Summary

The spec is well-structured and makes clear visual design decisions. The Premium Organic design language is well-defined with specific color tokens, typography, and animation parameters. However, there are scope integrity issues: the Foto's tab and the Notifications-to-Home merge are functional changes disguised as visual ones. The Reanimated version reference is incorrect and could mislead implementers. The component inventory doesn't match reality.

**Recommendation:** Address the 4 critical issues before implementation begins. The minor issues can be resolved during Phase 1.
