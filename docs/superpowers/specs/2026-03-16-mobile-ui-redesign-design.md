# Mobile UI Redesign — Premium Organic

**Date:** 2026-03-16
**Status:** Approved
**Approach:** Component-first redesign with parallel agent team

## Summary

Complete visual redesign of the Top Tuinen mobile app (Expo/React Native) from a generic dark-mode UI to a Premium Organic design language — dark, refined, nature-inspired. The app serves field workers (tuinmannen) who need fast, one-handed operation with gloves on.

**Scope note:** This is primarily a visual redesign. All existing hooks, business logic, and backend integrations remain untouched. However, two structural changes are included:
1. **New Foto's tab** — promotes existing photo functionality (currently buried in project details) to a top-level tab. Uses existing `use-photo-capture` hook and `ProjectFotoUpload`/`FotoGalerij` components. No new backend endpoints needed — photos already flow through Convex.
2. **Notifications tab removed** — notification content is merged into the Home dashboard. The existing notifications query and data remain; only the UI location changes.

## Design Decisions

### 1. Visual Identity: Premium Organic

- **Dark base:** #0A0A0A background, #111111 surfaces
- **Nature accents:** Deep forest greens (#1A2E1A, #2D5A27), vibrant green (#4ADE80), muted sage (#6B8F6B)
- **Earth tones:** Brown (#8B7355) for grondwerk/earth-related elements
- **Scope colors retained:** grondwerk brown, gras green, water blue, borders forest green
- **Gradients:** Subtle nature-inspired gradients on hero cards (135deg, #1a2e1a → #0d1f0d)
- **Borders:** Very subtle (#222, #2d5a2740) — not prominent

### 2. Typography

- **iOS:** SF Pro Display for headings, SF Pro Text for body
- **Android:** Roboto for all text (system default)
- Heading sizes: 24px bold, 18px semibold, 14px semibold
- Body: 13px regular, Labels: 10px medium uppercase (letter-spacing 1.5px)
- Tight letter-spacing on large headings (-0.5px)
- Use platform-specific font families already defined in `theme/typography.ts`

### 3. Target User: Field Worker (Veldwerker)

- One-handed operation is essential
- Large touch targets (min 44px)
- Minimal taps to complete primary tasks
- Works with dirty hands and gloves
- Speed over aesthetics — but both are achievable

### 4. Feature Priority (high → low)

1. Project details — progress, tasks, planning
2. Notifications — messages from office/project leader
3. Photo upload — work photos per project
4. Hour registration — manual or start/stop
5. Chat — team communication
6. Reports — daily report, material usage (least important)

### 5. Navigation: Floating Tab Bar

- Floating bar at bottom with blur/transparency effect
- 5 tabs: Home, Foto's, Uren, Chat, Profiel
- Active tab highlighted with primary green
- Icons: Lucide React Native (NO emojis — use Home, Camera, Clock, MessageCircle, User)
- Spring animation on tab switch
- Safe area aware

### 6. Dashboard Layout: Hero + Sections

- **Header:** Greeting + notification bell with badge
- **Hero card:** "Vandaag op locatie" — today's primary project with quick actions (photo upload, start hours)
- **Notifications section:** Recent notifications with unread indicator dots, inline below hero
- **Other projects:** Horizontal scroll of compact project cards
- Notifications tab removed — integrated into Home dashboard

### 7. Tab Structure

| Tab | Icon (Lucide) | Content |
|-----|---------------|---------|
| Home | `Home` | Hero project, notifications, other projects |
| Foto's | `Camera` | Photo upload, gallery per project |
| Uren | `Clock` | Hour registration, scope selection, week overview |
| Chat | `MessageCircle` | Team chat, project channels, DMs |
| Profiel | `User` | Settings, biometrics, notification preferences |

### 8. Animations & Transitions (Extensive)

**Screen transitions:**
- Shared element transition: project card on Home → project detail screen
- Smooth cross-fade tab switching
- Sheet modals (bottom sheets) for quick actions (register hours, take photo)
- Parallax header on project detail screen

**Micro-interactions:**
- Spring animations on all interactive elements (buttons, cards, switches)
- Haptic feedback on primary actions (Expo Haptics)
- Pull-to-refresh with nature-themed animation
- Swipe-to-dismiss on notifications
- Skeleton loading with shimmer effect
- Animated number transitions (hours, percentages)

**Technical:**
- Migrate legacy `Animated` API call sites to `react-native-reanimated` (v4.1.1 already installed)
- `react-native-gesture-handler` already installed — use for swipe gestures
- **New dependency needed:** `expo-haptics` — install via `npx expo install expo-haptics`
- Respect `useReducedMotion()` for accessibility
- Spring configs: `damping: 15, stiffness: 150` as default

### 9. Component Updates

**Existing components to redesign (19 files in `components/ui/`):**
- Button.tsx — keep CVA variants, update colors to Premium Organic palette
- Card.tsx — update glass variant to use theme tokens, add nature-gradient variant
- Input.tsx — softer validation animation, update colors
- Dialog.tsx — update backdrop and surface colors
- Switch.tsx — update track colors to green palette
- Tabs.tsx — redesign for floating tab bar pattern
- Badge.tsx — add nature-themed variants
- Skeleton.tsx — update shimmer colors
- StatusBadge.tsx — use theme tokens instead of hardcoded colors
- AnimatedNumber.tsx — update colors
- Checkbox.tsx — update colors to green palette
- FormSection.tsx — update spacing and colors
- Label.tsx — update typography
- OfflineIndicator.tsx — update styling
- PriceDisplay.tsx — update colors
- ScopeTag.tsx — update to Premium Organic palette
- TrendIndicator.tsx — update colors
- Toast.tsx — update styling
- FotoGalerij.tsx — update styling (in `components/` not `components/ui/`)

**New components needed:**
- FloatingTabBar — custom tab bar with blur, spring animations, Lucide icons
- HeroProjectCard — large card with gradient, quick actions, progress bar
- NotificationBanner — inline notification with icon, swipe-to-dismiss
- ProjectListItem — compact project card with progress indicator
- BottomSheet — reusable sheet modal for quick actions
- ParallaxHeader — scrollable header with parallax effect
- PhotoGrid — grid layout for project photo gallery

### 10. Design Token Consolidation

**Problem:** Colors defined in both `theme/colors.ts` AND `tailwind.config.js`
**Solution:** Single source of truth in `theme/colors.ts`, Tailwind config imports from there

**Updated token structure:**
```
theme/
  colors.ts      — all color definitions (single source of truth)
  typography.ts   — font sizes, weights, line heights
  spacing.ts      — spacing scale (keep 4px base)
  radius.ts       — border radius scale
  shadows.ts      — shadow definitions
  animations.ts   — NEW: spring configs, duration presets, easing curves
  haptics.ts      — NEW: haptic feedback patterns
```

## Implementation Approach: Component-First

### Phase 1: Design System Foundation (parallel agents)
- **Design System Agent:** Update tokens (colors, typography, spacing, shadows), consolidate Tailwind config, add animation and haptics configs
- **Component Agent:** Redesign all 22 existing UI components + build new ones (FloatingTabBar, HeroProjectCard, NotificationBanner, BottomSheet, ParallaxHeader, PhotoGrid)
- **Animation Agent:** Set up Reanimated, create shared transition utilities, spring config presets, gesture handlers, reduced-motion support

### Phase 2: Screen Updates (parallel agents, after Phase 1)
- **Home Agent:** New dashboard with hero project, notifications, other projects
- **Foto's Agent:** New photo tab with upload flow and project gallery
- **Uren Agent:** Redesign hour registration with updated components
- **Chat Agent:** Redesign chat screens with updated components
- **Profiel Agent:** Redesign profile with updated components
- **Auth Agent:** Update login and biometric screens

### Phase 3: Polish & Integration
- Tab bar navigation integration
- Cross-screen shared element transitions
- End-to-end testing of all flows
- Performance optimization
- Accessibility audit (reduced motion, screen readers)

## Constraints

- All existing hooks and business logic remain untouched
- Convex backend integration unchanged
- Clerk authentication flow unchanged
- Offline sync architecture unchanged
- Must work on iOS (primary) and Android (secondary)
- No emojis as UI icons — Lucide React Native only

## New Dependencies

| Package | Purpose | Install command |
|---------|---------|-----------------|
| `expo-haptics` | Haptic feedback on actions | `npx expo install expo-haptics` |

**Already installed (no action needed):**
- `react-native-reanimated` v4.1.1
- `react-native-gesture-handler`
- `lucide-react-native`
- `expo-local-authentication`
