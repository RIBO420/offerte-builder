# Mobile UI Redesign — Premium Organic Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Top Tuinen mobile app from generic dark-mode to Premium Organic — a dark, refined, nature-inspired design language optimized for field workers.

**Architecture:** Component-first approach. Phase 1 updates the design system foundation (tokens, animation utilities, new dependency). Phase 2 redesigns all UI components + builds new ones. Phase 3 rewires screens to use the new components and layout. Phase 4 polishes with shared transitions and accessibility.

**Tech Stack:** Expo 54 / React Native 0.81 / NativeWind 4 / Tailwind 3 / Reanimated 4.1 / Lucide React Native / Convex

**Spec:** `docs/superpowers/specs/2026-03-16-mobile-ui-redesign-design.md`

---

## Chunk 1: Foundation (Tasks 1-3) — Run in Parallel

These three tasks have NO dependencies on each other. Run all three agents simultaneously.

---

### Task 1: Design Tokens Update

**Files:**
- Modify: `mobile/theme/colors.ts`
- Modify: `mobile/theme/typography.ts`
- Modify: `mobile/theme/shadows.ts`
- Modify: `mobile/theme/spacing.ts`
- Modify: `mobile/theme/radius.ts`
- Create: `mobile/theme/animations.ts`
- Create: `mobile/theme/haptics.ts`
- Modify: `mobile/theme/index.ts`
- Modify: `mobile/tailwind.config.js`

**Context:** Colors are currently defined in BOTH `theme/colors.ts` AND `tailwind.config.js`. This task consolidates to a single source of truth in `theme/colors.ts` and makes `tailwind.config.js` import from it.

- [ ] **Step 1: Update `mobile/theme/colors.ts` with Premium Organic palette**

Replace the existing color definitions. Keep the same export structure (`colors`, `darkColors`, `scope`, `trend`, `chart`, `ColorScheme`). The dark palette becomes the primary palette since the app defaults to dark mode.

Key color changes:
```typescript
// Primary nature-inspired palette
background: '#0A0A0A',
foreground: '#FAFAFA',
card: '#111111',
cardForeground: '#E8E8E8',
primary: '#4ADE80',        // Vibrant green (was indigo #6366F1)
primaryForeground: '#0A0A0A',
secondary: '#1A2E1A',      // Deep forest green
secondaryForeground: '#6B8F6B', // Muted sage
muted: '#1A1A1A',
mutedForeground: '#888888',
accent: '#2D5A27',         // Deep green accent
accentForeground: '#4ADE80',
border: '#222222',
input: '#1A1A1A',
ring: '#4ADE80',

// Nature surface colors (NEW)
surface: '#111111',
surfaceElevated: '#1A1A1A',
surfaceOverlay: '#1A1A1AEE',

// Nature gradient endpoints (NEW)
natureDark: '#1A2E1A',
natureLight: '#0D1F0D',
```

**Scope colors:** Read the CURRENT values from `mobile/theme/colors.ts` (light mode) and `mobile/theme/colors.ts` dark mode section. Keep them exactly as-is — do NOT change scope colors. Note: light and dark mode have different scope values (e.g., grondwerk is `#8B7355` in light, `#B09070` in dark). Preserve both.

Update `darkColors` to match (since dark is primary, light mode becomes the override):
```typescript
// Light mode overrides
background: '#FAFAF8',
foreground: '#1A1A1A',
card: '#FFFFFF',
cardForeground: '#2D2D2D',
primary: '#2D5A27',
primaryForeground: '#FFFFFF',
secondary: '#F0EDE4',
secondaryForeground: '#6B8F6B',
muted: '#F5F5F5',
mutedForeground: '#666666',
accent: '#1A2E1A',
accentForeground: '#2D5A27',
border: '#E8E4DC',
input: '#F5F5F5',
ring: '#2D5A27',
```

- [ ] **Step 2: Update `mobile/theme/typography.ts`**

Add platform-aware font families and tighten the scale:
```typescript
fontFamily: {
  sans: Platform.OS === 'ios' ? 'System' : 'Roboto',
  display: Platform.OS === 'ios' ? 'System' : 'Roboto',  // NEW
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
},
fontSize: {
  xs: 10,    // was 12 — used for labels
  sm: 12,    // was 14 — used for captions
  base: 13,  // was 16 — body text
  md: 14,    // NEW — secondary text
  lg: 16,    // was 18
  xl: 18,    // was 20
  '2xl': 22, // was 24
  '3xl': 28, // was 30
  '4xl': 34, // was 36
},
letterSpacing: {  // NEW
  tight: -0.5,
  normal: 0,
  wide: 1,
  wider: 1.5,
},
```

- [ ] **Step 3: Update `mobile/theme/shadows.ts`**

Update shadow colors to use green tint instead of pure black:
```typescript
// For nature-themed elevated elements
natureGlow: {
  shadowColor: '#4ADE80',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 20,
  elevation: 8,
},
```

- [ ] **Step 4: Create `mobile/theme/animations.ts`**

```typescript
import { Platform } from 'react-native';

export const springConfigs = {
  default: { damping: 15, stiffness: 150 },
  gentle: { damping: 20, stiffness: 120 },
  bouncy: { damping: 10, stiffness: 180 },
  snappy: { damping: 20, stiffness: 300 },
  slow: { damping: 25, stiffness: 80 },
} as const;

export const durations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  xslow: 800,
} as const;

export const easings = {
  easeOut: [0.25, 0.1, 0.25, 1] as const,
  easeInOut: [0.42, 0, 0.58, 1] as const,
  spring: [0.175, 0.885, 0.32, 1.275] as const,
} as const;

export type SpringConfig = keyof typeof springConfigs;
export type Duration = keyof typeof durations;
```

- [ ] **Step 5: Create `mobile/theme/haptics.ts`**

```typescript
import * as Haptics from 'expo-haptics';

export const hapticPatterns = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => Haptics.selectionAsync(),
} as const;

export type HapticPattern = keyof typeof hapticPatterns;
```

- [ ] **Step 6: Update `mobile/theme/index.ts` to export new modules**

Add exports for `animations` and `haptics`.

- [ ] **Step 7: Update `mobile/tailwind.config.js` to import from theme**

Replace hardcoded color values with imports from `./theme/colors`. The tailwind config should import and spread the colors object so there's one source of truth.

```javascript
const { colors, darkColors, scope } = require('./theme/colors');

module.exports = {
  // ... existing config
  theme: {
    extend: {
      colors: {
        background: colors.background,
        foreground: colors.foreground,
        // ... map all colors from the theme
        scope: { ...scope },
      },
    },
  },
};
```

- [ ] **Step 8: Verify the app still compiles**

Run: `cd mobile && npx expo start --ios --no-dev` (or check Metro bundler for errors)
Expected: No TypeScript or bundler errors. Colors may look different — that's expected.

- [ ] **Step 9: Commit**

```bash
git add mobile/theme/ mobile/tailwind.config.js
git commit -m "feat(mobile): update design tokens to Premium Organic palette"
```

---

### Task 2: Animation Utilities & Hooks

**Files:**
- Create: `mobile/hooks/use-spring-animation.ts`
- Create: `mobile/hooks/use-reduced-motion.ts`
- Create: `mobile/hooks/use-haptic.ts`
- Modify: `mobile/hooks/index.ts`

**Context:** The app currently uses React Native's legacy `Animated` API. This task creates Reanimated-based animation hooks that all components will use. `react-native-reanimated` v4.1.1 is already installed.

- [ ] **Step 1: Create `mobile/hooks/use-reduced-motion.ts`**

```typescript
import { useReducedMotion } from 'react-native-reanimated';

export { useReducedMotion };

/**
 * Returns animation duration — 0 if user prefers reduced motion.
 */
export function useAnimationDuration(ms: number): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : ms;
}
```

- [ ] **Step 2: Create `mobile/hooks/use-spring-animation.ts`**

```typescript
import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';
import { springConfigs, type SpringConfig } from '../theme/animations';

export function usePressAnimation(config: SpringConfig = 'default') {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reduced) return;
    scale.value = withSpring(0.96, springConfigs[config]);
  }, [config, reduced]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
    scale.value = withSpring(1, springConfigs[config]);
  }, [config, reduced]);

  return { animatedStyle, onPressIn, onPressOut };
}

export function useScaleAnimation(config: SpringConfig = 'default') {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const enter = useCallback(() => {
    if (reduced) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withSpring(1, springConfigs[config]);
    opacity.value = withTiming(1, { duration: 200 });
  }, [config, reduced]);

  const exit = useCallback(() => {
    if (reduced) {
      scale.value = 0;
      opacity.value = 0;
      return;
    }
    scale.value = withSpring(0.9, springConfigs[config]);
    opacity.value = withTiming(0, { duration: 150 });
  }, [config, reduced]);

  return { animatedStyle, enter, exit };
}
```

- [ ] **Step 3: Create `mobile/hooks/use-haptic.ts`**

```typescript
import { useCallback } from 'react';
import { hapticPatterns, type HapticPattern } from '../theme/haptics';

export function useHaptic(pattern: HapticPattern = 'tap') {
  return useCallback(() => {
    hapticPatterns[pattern]();
  }, [pattern]);
}
```

- [ ] **Step 4: Update `mobile/hooks/index.ts`**

Add exports for the three new hooks.

- [ ] **Step 5: Verify hooks compile**

Run Metro bundler, check for import errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/hooks/
git commit -m "feat(mobile): add Reanimated animation hooks and haptic utilities"
```

---

### Task 3: Install New Dependencies

**Files:**
- Modify: `mobile/package.json` (via npm)

- [ ] **Step 1: Install expo-haptics, expo-blur, and expo-linear-gradient**

```bash
cd mobile && npx expo install expo-haptics expo-blur expo-linear-gradient
```

All three are Expo-managed native packages required by the redesign:
- `expo-haptics`: haptic feedback on interactions
- `expo-blur`: blur backdrop for FloatingTabBar and glass Card variant
- `expo-linear-gradient`: gradient backgrounds on HeroProjectCard, nature Card variant, auth screens

- [ ] **Step 2: Verify installation**

Check `mobile/package.json` contains all three packages.
Run: `cd mobile && npx expo start --ios` — verify no native module errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): add expo-haptics, expo-blur, expo-linear-gradient dependencies"
```

---

## Chunk 2: Core Components (Tasks 4-6) — Run in Parallel After Chunk 1

These tasks depend on Chunk 1 (tokens + animation hooks must exist). Tasks 4, 5, and 6 can run in parallel with each other.

---

### Task 4: Floating Tab Bar Component

**Files:**
- Create: `mobile/components/ui/FloatingTabBar.tsx`
- Modify: `mobile/components/ui/index.ts`

**Context:** This replaces the default Expo Router bottom tab bar. It's a floating bar with blur effect, Lucide icons, and spring animations. Will be wired into the tab layout in Phase 3.

- [ ] **Step 1: Create `mobile/components/ui/FloatingTabBar.tsx`**

Build a custom tab bar component that receives the standard `BottomTabBarProps` from `@react-navigation/bottom-tabs`. Requirements:

```typescript
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Camera, Clock, MessageCircle, User } from 'lucide-react-native';
import { useColors } from '../../theme';
import { springConfigs } from '../../theme/animations';
import { hapticPatterns } from '../../theme/haptics';

const TAB_ICONS = {
  index: Home,
  fotos: Camera,
  uren: Clock,
  chat: MessageCircle,
  profiel: User,
} as const;

const TAB_LABELS = {
  index: 'Home',
  fotos: "Foto's",
  uren: 'Uren',
  chat: 'Chat',
  profiel: 'Profiel',
} as const;
```

The component should:
- Use `BlurView` with `intensity={40}` and `tint="dark"` as background
- Position absolute at bottom with `bottom: 12, left: 12, right: 12`
- Border radius 20, border 1px `#222`
- Each tab icon: 22px, active color `#4ADE80`, inactive `#555`
- Active tab label: 9px, shown below icon
- Inactive: icon only, no label
- Spring animation on tab press (scale icon)
- Haptic feedback on tab press (`selection`)
- Safe area padding via `useSafeAreaInsets()`

- [ ] **Step 2: Export from `mobile/components/ui/index.ts`**

Add `FloatingTabBar` to the exports.

- [ ] **Step 3: Verify it compiles**

Import it in a test file or check Metro bundler.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/ui/FloatingTabBar.tsx mobile/components/ui/index.ts
git commit -m "feat(mobile): add FloatingTabBar component with blur and spring animations"
```

---

### Task 5: Redesign Existing UI Components

**Files:**
- Modify: `mobile/components/ui/Button.tsx`
- Modify: `mobile/components/ui/Card.tsx`
- Modify: `mobile/components/ui/Input.tsx`
- Modify: `mobile/components/ui/Dialog.tsx`
- Modify: `mobile/components/ui/Switch.tsx`
- Modify: `mobile/components/ui/Badge.tsx`
- Modify: `mobile/components/ui/Skeleton.tsx`
- Modify: `mobile/components/ui/StatusBadge.tsx`
- Modify: `mobile/components/ui/Tabs.tsx`
- Modify: `mobile/components/ui/Toast.tsx`
- Modify: `mobile/components/ui/Checkbox.tsx`
- Modify: `mobile/components/ui/Label.tsx`
- Modify: `mobile/components/ui/FormSection.tsx`
- Modify: `mobile/components/ui/AnimatedNumber.tsx`
- Modify: `mobile/components/ui/PriceDisplay.tsx`
- Modify: `mobile/components/ui/ScopeTag.tsx`
- Modify: `mobile/components/ui/TrendIndicator.tsx`
- Modify: `mobile/components/ui/OfflineIndicator.tsx`

**Context:** Update ALL 19 existing components to use the new Premium Organic tokens. Keep the same component APIs (props, variants) — only update visuals. Replace legacy `Animated` with Reanimated where applicable.

- [ ] **Step 1: Update `Button.tsx`**

Changes needed:
- Import `usePressAnimation` from hooks and `hapticPatterns` from theme
- Replace legacy `Animated.Value` press animation with Reanimated `usePressAnimation`
- Update CVA color variants to use new green palette:
  - `default`: bg `#4ADE80`, text `#0A0A0A`
  - `secondary`: bg `#1A2E1A`, text `#6B8F6B`
  - `outline`: border `#222`, text `#E8E8E8`
  - `ghost`: transparent, text `#E8E8E8`
  - `destructive`: keep red
  - `nature` (NEW variant): gradient bg `#1A2E1A → #2D5A27`, text `#4ADE80`
- Add haptic feedback on press (`tap`)
- Wrap in `Animated.View` with `usePressAnimation` style

- [ ] **Step 2: Update `Card.tsx`**

Changes:
- Update `default` variant: bg `#111`, border `#222`
- Update `subtle`: bg `#0A0A0A`, no border
- Update `elevated`: bg `#1A1A1A`, nature-glow shadow
- Update `glass`: bg `rgba(17,17,17,0.8)`, blur backdrop (use `BlurView` if possible)
- Add `nature` variant: bg gradient `#1A2E1A → #0D1F0D`, border `#2D5A2730`
- Ensure compound components (CardHeader, CardTitle, etc.) inherit theme colors

- [ ] **Step 3: Update `Input.tsx`**

Changes:
- Background: `#1A1A1A`, border `#222`
- Focus border: `#4ADE80` (was likely indigo)
- Valid state: border `#4ADE80`
- Invalid state: keep red
- Replace shake animation with softer Reanimated version (2 iterations, 80ms, less displacement)
- Icon colors: `#555` default, `#4ADE80` on focus
- Placeholder color: `#555`

- [ ] **Step 4: Update `Dialog.tsx`**

Changes:
- Backdrop: `rgba(0,0,0,0.7)`
- Content bg: `#111`, border `#222`
- Replace legacy `Animated` scale/opacity with Reanimated `useScaleAnimation`
- Title color: `#E8E8E8`
- Description color: `#888`

- [ ] **Step 5: Update `Switch.tsx`**

Changes:
- Track off: `#222`
- Track on: `#4ADE80`
- Thumb: `#FAFAFA`
- Replace legacy `Animated` with Reanimated `interpolateColor` and `withSpring`
- Add haptic on toggle (`selection`)

- [ ] **Step 6: Update remaining components**

Apply Premium Organic colors to each. For each component:
- `Badge.tsx`: green variants, dark backgrounds
- `Skeleton.tsx`: shimmer from `#1A1A1A` to `#222` to `#1A1A1A`
- `StatusBadge.tsx`: replace hardcoded colors with theme token imports from `colors.ts`
- `Tabs.tsx`: active indicator `#4ADE80`, bg `#1A1A1A`
- `Toast.tsx`: bg `#1A1A1A`, border `#222`, success green `#4ADE80`
- `Checkbox.tsx`: checked bg `#4ADE80`, border `#333`
- `Label.tsx`: color `#888`, uppercase `letter-spacing: 1.5`
- `FormSection.tsx`: divider `#1A1A1A`, section bg transparent
- `AnimatedNumber.tsx`: inherit parent color
- `PriceDisplay.tsx`: default `#E8E8E8`, success `#4ADE80`
- `ScopeTag.tsx`: use scope colors from theme, bg as color with 15% opacity
- `TrendIndicator.tsx`: positive `#4ADE80`, negative keep red
- `OfflineIndicator.tsx`: warning bg `#8B735520`, text `#8B7355`

- [ ] **Step 7: Update `mobile/components/FotoGalerij.tsx`**

This is a non-ui component (in `components/` not `components/ui/`) but is listed in the spec's 19 components to redesign. Apply Premium Organic styling:
- Image container borders: `#222`
- Caption text: `#888`
- Empty state: `#1A1A1A` bg, Camera icon from Lucide in `#555`
- Selection indicator: `#4ADE80` checkmark
- Background: transparent (inherits screen bg)

- [ ] **Step 8: Verify all components compile**

Run Metro bundler, check for TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add mobile/components/ui/ mobile/components/FotoGalerij.tsx
git commit -m "feat(mobile): redesign all UI components with Premium Organic palette"
```

---

### Task 6: New Components

**Files:**
- Create: `mobile/components/ui/HeroProjectCard.tsx`
- Create: `mobile/components/ui/NotificationBanner.tsx`
- Create: `mobile/components/ui/ProjectListItem.tsx`
- Create: `mobile/components/ui/BottomSheet.tsx`
- Create: `mobile/components/ui/ParallaxHeader.tsx`
- Create: `mobile/components/ui/PhotoGrid.tsx`
- Modify: `mobile/components/ui/index.ts`

- [ ] **Step 1: Create `HeroProjectCard.tsx`**

Large gradient card for the dashboard hero section:
```typescript
interface HeroProjectCardProps {
  projectName: string;
  description: string;       // e.g. "Bestrating + borders"
  progress: number;          // 0-100
  onPress: () => void;
  onPhotoPress: () => void;
  onHoursPress: () => void;
}
```

Design:
- Background: `LinearGradient` from `#1A2E1A` to `#0D1F0D`
- Border radius 16, border `#2D5A2730`
- Top: label "VANDAAG OP LOCATIE" in `#4ADE80`, 9px uppercase
- Project name: 16px semibold `#E8E8E8`
- Description: 11px `#6B8F6B`
- Quick action pills: "Foto's" (Camera icon) and "Start uren" (Clock icon)
- Bottom: progress bar with gradient fill `#2D5A27 → #4ADE80`
- Press animation with `usePressAnimation`
- Haptic on press

- [ ] **Step 2: Create `NotificationBanner.tsx`**

Inline notification item with swipe-to-dismiss:
```typescript
interface NotificationBannerProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  time: string;
  isUnread?: boolean;
  onPress: () => void;
  onDismiss: () => void;
}
```

Design:
- Background: `#1A1A1A`, border `#222`, radius 12
- Unread: left dot indicator in `#EF4444`
- Swipe right to dismiss with Gesture Handler `Swipeable`
- Fade out on dismiss with Reanimated

- [ ] **Step 3: Create `ProjectListItem.tsx`**

Compact project card for "other projects" section:
```typescript
interface ProjectListItemProps {
  name: string;
  scope: string;
  progress: number;
  icon: React.ReactNode;
  onPress: () => void;
}
```

Design:
- Background: `#1A1A1A`, radius 14, border `#222`
- Left: 36x36 icon container with scope-colored gradient background
- Middle: name (12px semibold) + scope (9px muted)
- Right: progress percentage in green
- Bottom: thin progress bar
- Press animation

- [ ] **Step 4: Create `BottomSheet.tsx`**

Reusable modal bottom sheet:
```typescript
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  snapPoints?: number[];  // percentages, e.g. [50, 90]
  children: React.ReactNode;
}
```

Design:
- Backdrop: `rgba(0,0,0,0.5)` with fade animation
- Sheet bg: `#111`, top radius 20
- Drag handle: centered pill `#333`, 36x4px
- Gesture-driven drag to dismiss
- Spring animation for snap points

- [ ] **Step 5: Create `ParallaxHeader.tsx`**

Scrollable header with parallax effect for project detail:
```typescript
interface ParallaxHeaderProps {
  title: string;
  subtitle?: string;
  backgroundGradient?: [string, string];
  height?: number;  // default 200
  children: React.ReactNode;  // scrollable content
}
```

Design:
- Header scales down and fades as user scrolls
- Background gradient visible behind header
- Title transitions from large (24px) to navbar size (16px)
- Uses Reanimated `useAnimatedScrollHandler`

- [ ] **Step 6: Create `PhotoGrid.tsx`**

Grid layout for project photos:
```typescript
interface PhotoGridProps {
  photos: { uri: string; caption?: string }[];
  columns?: number;  // default 3
  onPhotoPress: (index: number) => void;
  onAddPress: () => void;
}
```

Design:
- Grid with gap 2px (Instagram-style)
- First item (add button): dashed border `#333`, Camera icon, "Voeg toe"
- Photos: rounded corners 4px, press to view
- Shimmer loading state while images load

- [ ] **Step 7: Export all new components from `index.ts`**

- [ ] **Step 8: Verify all compile**

- [ ] **Step 9: Commit**

```bash
git add mobile/components/ui/
git commit -m "feat(mobile): add HeroProjectCard, NotificationBanner, BottomSheet, ParallaxHeader, PhotoGrid components"
```

---

## Chunk 3: Screen Updates (Tasks 7-12) — Run in Parallel After Chunk 2

All screen tasks depend on Chunks 1+2. Tasks 7-12 can run in parallel with each other, BUT Task 7 (Tab Layout) should complete first as it defines the navigation structure that other screens plug into.

**Recommended order:** Task 7 first, then Tasks 8-12 in parallel.

---

### Task 7: Tab Layout + Navigation Wiring

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/fotos.tsx` (new tab)
- Delete content: `mobile/app/(tabs)/notifications.tsx` (redirect to home or remove)

**Context:** Currently 5 tabs: index, chat, uren, notifications, profiel. New structure: index (Home), fotos (NEW), uren, chat, profiel. Notifications tab is removed — content merged into Home.

- [ ] **Step 1: Update `mobile/app/(tabs)/_layout.tsx`**

Replace the default tab bar with `FloatingTabBar`:

```typescript
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../components/ui';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="fotos" />
      <Tabs.Screen name="uren" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profiel" />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create `mobile/app/(tabs)/fotos.tsx`**

New Foto's tab — aggregates photo functionality that was previously inside project details:

```typescript
// Scaffold the screen structure:
// - Header: "Foto's" title
// - Project selector (horizontal scroll of project pills)
// - PhotoGrid for selected project
// - FAB for quick camera capture
// Uses existing hooks: usePhotoCapture
// Uses existing components: ProjectFotoUpload, FotoGalerij (restyled)
```

- [ ] **Step 3: Handle notifications tab removal**

Remove or redirect `notifications.tsx`. If Expo Router requires the file to exist for backwards compatibility, keep it as a redirect:

```typescript
import { Redirect } from 'expo-router';
export default () => <Redirect href="/(tabs)" />;
```

- [ ] **Step 4: Verify navigation works**

Run app, check all 5 tabs render, FloatingTabBar shows correct icons and active states.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/
git commit -m "feat(mobile): wire FloatingTabBar navigation with new Foto's tab"
```

---

### Task 8: Home Dashboard Screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

**Context:** Currently a basic dashboard. Redesign to Hero + Sections layout: header with greeting + bell, hero project card, notifications section, other projects horizontal scroll.

- [ ] **Step 1: Rewrite `mobile/app/(tabs)/index.tsx`**

Structure:
```
ScrollView (bg #0A0A0A)
├── SafeAreaView
├── Header
│   ├── Left: "TOP TUINEN" label (9px, #6B8F6B) + "Hoi {name}" (16px, #E8E8E8)
│   └── Right: Bell icon (Lucide Bell) with unread badge dot
├── HeroProjectCard (today's project with quick actions)
├── Section: "Meldingen" with unread count
│   ├── NotificationBanner × N (latest 3-5 notifications)
│   └── "Bekijk alles →" link
├── Section: "Andere projecten"
│   └── Horizontal FlatList of ProjectListItem cards
└── Bottom padding (for FloatingTabBar clearance, ~100px)
```

- Use existing data queries from Convex (check current `index.tsx` for which queries are used)
- Keep all existing hooks and data fetching logic
- Only rewrite the JSX/view layer
- Add pull-to-refresh
- Add skeleton loading state while data loads

- [ ] **Step 2: Verify dashboard renders with real data**

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/index.tsx
git commit -m "feat(mobile): redesign Home dashboard with Hero + Sections layout"
```

---

### Task 9: Uren Screen Redesign

**Files:**
- Modify: `mobile/app/(tabs)/uren.tsx`

**Context:** Hour registration screen. Keep all existing logic (scope selection, date picker, hour input). Update visual layer to Premium Organic.

- [ ] **Step 1: Update `mobile/app/(tabs)/uren.tsx`**

Visual changes:
- Background: `#0A0A0A`
- Header: "Uren" in 22px semibold
- Week overview: horizontal day selector with active day highlighted in `#4ADE80`
- Scope selector: use redesigned `ScopeTag` components in a wrapping grid
- Hour input: large centered number (34px bold), + / - buttons with spring animation
- Submit button: `nature` variant Button
- Recent entries list: `Card` components with scope color indicators
- Bottom padding for tab bar clearance

- [ ] **Step 2: Verify uren registration still works end-to-end**

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/uren.tsx
git commit -m "feat(mobile): redesign Uren screen with Premium Organic theme"
```

---

### Task 10: Chat Screen Redesign

**Files:**
- Modify: `mobile/app/(tabs)/chat.tsx`

**Context:** Team chat with channels and DMs. Keep all messaging logic. Update visuals.

- [ ] **Step 1: Update `mobile/app/(tabs)/chat.tsx`**

Visual changes:
- Background: `#0A0A0A`
- Channel/DM list: dark cards with subtle borders
- Unread indicator: `#4ADE80` dot
- Message bubbles: sent `#1A2E1A`, received `#1A1A1A`
- Input bar: `#111` bg, `#222` border, green send button
- Tabs (team/dm/project): use redesigned `Tabs` component with pill variant
- Online indicator: `#4ADE80` dot on avatars
- Timestamp color: `#555`

- [ ] **Step 2: Verify chat still works**

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/chat.tsx
git commit -m "feat(mobile): redesign Chat screen with Premium Organic theme"
```

---

### Task 11: Profiel Screen Redesign

**Files:**
- Modify: `mobile/app/(tabs)/profiel.tsx`

**Context:** Profile and settings screen. Update visuals, add notification preferences section (moved from notifications tab).

- [ ] **Step 1: Update `mobile/app/(tabs)/profiel.tsx`**

Visual changes:
- Background: `#0A0A0A`
- Avatar: gradient ring `#2D5A27 → #4ADE80`
- Name: 22px semibold, role badge below
- Settings sections: grouped `Card` components
- Section headers: 10px uppercase `#555` labels
- Switch items: redesigned Switch with green track
- Add "Notificatie-instellingen" section (push prefs)
- Biometric toggle section
- Sign out button: `destructive` variant at bottom

- [ ] **Step 2: Verify profile settings still work**

- [ ] **Step 3: Commit**

```bash
git add mobile/app/(tabs)/profiel.tsx
git commit -m "feat(mobile): redesign Profiel screen with Premium Organic theme"
```

---

### Task 12: Auth Screens Redesign

**Files:**
- Modify: `mobile/app/(auth)/login.tsx`
- Modify: `mobile/app/(auth)/biometric-login.tsx`
- Modify: `mobile/app/(auth)/biometric.tsx`
- Modify: `mobile/app/(auth)/callback.tsx`
- Modify: `mobile/app/(auth)/_layout.tsx`

- [ ] **Step 1: Update login screen**

Visual changes:
- Full dark background `#0A0A0A`
- "TOP TUINEN" logo text: 11px uppercase, letter-spacing 3px, `#6B8F6B`
- Or use an actual logo image if available in `assets/images/`
- Tagline: "Welkom terug" in 28px semibold
- Email input: redesigned Input component
- Verification code input: large spaced digit boxes (OTP style)
- Submit button: `nature` variant, full width
- Nature-themed subtle background gradient at bottom

- [ ] **Step 2: Update biometric screens**

- Fingerprint/Face ID icon: large, centered, `#4ADE80`
- "Gebruik Face ID" button: `nature` variant
- Success animation: green checkmark with spring scale

- [ ] **Step 3: Update `callback.tsx`**

Apply Premium Organic background (`#0A0A0A`) and loading indicator colors to the OAuth callback screen. This is typically a loading/redirect screen — keep it minimal.

- [ ] **Step 4: Verify auth flow works end-to-end**

Test: login → code → dashboard, and biometric login.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/(auth)/
git commit -m "feat(mobile): redesign auth screens with Premium Organic theme"
```

---

## Chunk 4: Polish & Integration (Tasks 13-15) — Sequential After Chunk 3

---

### Task 13: Project Detail Screen + Shared Transitions

**Files:**
- Modify: `mobile/app/project/[id].tsx`

- [ ] **Step 1: Update project detail screen**

Visual changes:
- `ParallaxHeader` with project name and nature gradient
- Tabs for: Overzicht, Foto's, Uren, Notities
- Progress section: large percentage with `AnimatedNumber`
- Scope tags row
- Team members section
- Activity timeline

- [ ] **Step 2: Add shared element transition**

Connect `HeroProjectCard` on Home to `project/[id].tsx`:
- Use Expo Router's `sharedTransitionTag` or React Navigation's shared element transition
- Card image/title smoothly transitions to detail header
- Fall back to standard push transition if shared elements aren't supported

- [ ] **Step 3: Verify project detail renders correctly**

- [ ] **Step 4: Commit**

```bash
git add mobile/app/project/
git commit -m "feat(mobile): redesign project detail with ParallaxHeader and shared transitions"
```

---

### Task 14: Accessibility & Reduced Motion

**Files:**
- Modify: All component files that use animations

- [ ] **Step 1: Audit all animated components**

Check every component that uses Reanimated or Animated:
- Button, Switch, Dialog, Input, FloatingTabBar, HeroProjectCard, NotificationBanner, BottomSheet, ParallaxHeader
- Ensure all use `useReducedMotion()` check
- When reduced motion is on: skip spring/timing animations, use instant state changes

- [ ] **Step 2: Add accessibility labels**

Check all interactive components have:
- `accessibilityRole` (button, tab, switch, link, image)
- `accessibilityLabel` (descriptive text for screen readers)
- `accessibilityState` (selected, disabled, checked)

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ mobile/app/
git commit -m "feat(mobile): add reduced motion support and accessibility labels"
```

---

### Task 15: Final Integration & Cleanup

**Files:**
- Modify: `mobile/components/ProjectFotoUpload.tsx` (restyle)
- Modify: `mobile/components/SyncStatus.tsx` (restyle)
- Modify: `mobile/components/OpnameScreen.tsx` (restyle)
- Modify: `mobile/app/admin/index.tsx` (restyle)

- [ ] **Step 1: Restyle remaining non-UI components**

Apply Premium Organic colors to ProjectFotoUpload, SyncStatus, OpnameScreen. (FotoGalerij already done in Task 5.)

- [ ] **Step 2: Restyle admin screen**

Update admin panel with Premium Organic colors.

- [ ] **Step 3: Full app walkthrough**

Test every screen and flow:
- [ ] Login → biometric → dashboard
- [ ] Home: hero card, notifications, other projects
- [ ] Tap project → project detail (shared transition)
- [ ] Foto's tab: select project, view gallery, take photo
- [ ] Uren tab: register hours with scope
- [ ] Chat tab: open channel, send message
- [ ] Profiel tab: toggle settings
- [ ] Pull-to-refresh on Home
- [ ] Swipe-to-dismiss notification
- [ ] Offline indicator shows correctly
- [ ] Dark mode is consistent throughout

- [ ] **Step 4: Remove any dead code**

- Old notification tab references
- Unused color variables from old palette
- Any leftover legacy Animated imports that were migrated

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(mobile): complete Premium Organic redesign — polish and cleanup"
```

---

## Parallel Execution Summary

```
Chunk 1 (parallel):
  ├── Agent A: Task 1 (Design Tokens)
  ├── Agent B: Task 2 (Animation Hooks)
  └── Agent C: Task 3 (Dependencies)

Chunk 2 (parallel, after Chunk 1):
  ├── Agent D: Task 4 (FloatingTabBar)
  ├── Agent E: Task 5 (Redesign 19 Components)
  └── Agent F: Task 6 (7 New Components)

Chunk 3 (parallel, after Chunk 2):
  ├── Agent G: Task 7 (Tab Layout) — run FIRST
  ├── Agent H: Task 8 (Home Dashboard)     ─┐
  ├── Agent I: Task 9 (Uren Screen)         │ after Task 7
  ├── Agent J: Task 10 (Chat Screen)        │
  ├── Agent K: Task 11 (Profiel Screen)     │
  └── Agent L: Task 12 (Auth Screens)      ─┘

Chunk 4 (sequential, after Chunk 3):
  └── Agent M: Tasks 13-15 (Polish)
```
