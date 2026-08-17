# Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the sidebar navigation into two surfaces — a clean sidebar for daily work (Werk + Financieel groups) and a profile popover menu for admin/beheer items.

**Architecture:** Refactor `app-sidebar.tsx` to replace 5 collapsible sections with 2 always-open groups. Extend the existing DropdownMenu in the footer with grouped admin navigation items. Update role-filtering logic to match the new structure. Consolidate Inkoop into a single sidebar item.

**Tech Stack:** Next.js App Router, React, shadcn/ui (Sidebar, DropdownMenu), Lucide icons, Clerk auth

**Spec:** `docs/superpowers/specs/2026-03-28-sidebar-redesign.md`

---

### Task 1: Update navigation item definitions

**Files:**
- Modify: `src/components/app-sidebar.tsx:78-133`

- [ ] **Step 1: Replace the navigation item arrays**

Replace the current 7 item arrays (lines 78-133) with the new structure. Remove `organizationItems`, `beheerItems`, `nieuweOfferteItems`, and `inkoopItems` (3 separate items). Add `financieelItems` and `profileMenuItems` groups.

```typescript
// Sidebar: Werk group - daily operational items
const werkItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Klanten", url: "/klanten", icon: Users },
  { title: "Projecten", url: "/projecten", icon: FolderKanban },
  { title: "Planning", url: "/planning", icon: Calendar },
  { title: "Uren", url: "/uren", icon: Clock },
  { title: "Rapportages", url: "/rapportages", icon: BarChart3 },
  { title: "Chat", url: "/chat", icon: MessageSquare },
];

// Sidebar: Financieel group
const financieelItems = [
  { title: "Offertes", url: "/offertes", icon: FileText },
  { title: "Contracten", url: "/contracten", icon: ScrollText },
  { title: "Facturen", url: "/facturen", icon: Receipt },
  { title: "Inkoop", url: "/inkoop", icon: ShoppingCart },
  { title: "Archief", url: "/archief", icon: Archive },
];

// Profile menu: Personeel group (admin/directie only)
const personeelMenuItems = [
  { title: "Medewerkers", url: "/medewerkers", icon: UsersRound },
  { title: "Verlof", url: "/verlof", icon: CalendarDays, indent: true },
  { title: "Verzuim", url: "/verzuim", icon: Thermometer, indent: true },
  { title: "Gebruikersbeheer", url: "/gebruikers", icon: Shield },
];

// Profile menu: Assets & Data group (admin/directie only)
const assetsMenuItems = [
  { title: "Wagenparkbeheer", url: "/wagenpark", icon: Truck },
  { title: "Machinebeheer", url: "/instellingen/machines", icon: Wrench },
  { title: "Prijsboek", url: "/prijsboek", icon: BookOpen },
  { title: "Garanties", url: "/garanties", icon: ShieldCheck },
  { title: "Servicemeldingen", url: "/servicemeldingen", icon: Wrench },
  { title: "Toolbox", url: "/toolbox", icon: ClipboardList },
];

// Project sub-items (shown within project context) - unchanged
const projectSubItems = [
  { title: "Kosten tracking", urlSuffix: "/kosten", icon: DollarSign },
  { title: "Kwaliteit", urlSuffix: "/kwaliteit", icon: CheckSquare },
];
```

- [ ] **Step 2: Clean up unused icon imports**

Replace the icon imports (lines 34-69) with only what's needed. Remove: `Plus`, `Shovel`, `Trees` (quick actions removed), `Building2` (Leveranciers separate link removed), `Package` (Voorraad separate link removed). Keep all others.

```typescript
import {
  Archive,
  FileText,
  Home,
  BookOpen,
  Settings,
  Moon,
  Sun,
  Users,
  UsersRound,
  Clock,
  BarChart3,
  LogOut,
  User,
  FolderKanban,
  Wrench,
  Receipt,
  Truck,
  Shield,
  ShieldCheck,
  Calendar,
  CalendarDays,
  Thermometer,
  ClipboardList,
  ShoppingCart,
  DollarSign,
  CheckSquare,
  MessageSquare,
  ScrollText,
} from "lucide-react";
```

- [ ] **Step 3: Verify the file has no TypeScript errors**

Run: `npm run typecheck`
Expected: Errors about missing references to deleted arrays (`primaryNavItems`, `offertesItems`, `organizationItems`, `beheerItems`, `nieuweOfferteItems`, `inkoopItems`) — these will be fixed in Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "refactor(sidebar): replace nav item definitions with new Werk/Financieel/profile structure"
```

---

### Task 2: Update role-filtering logic

**Files:**
- Modify: `src/components/app-sidebar.tsx` (role filtering section, roughly lines 145-237)

- [ ] **Step 1: Replace role-filtering with new structure**

Remove `filteredPrimaryNavItems` and `filteredOrganizationItems` useMemos. Replace with `filteredWerkItems` and `filteredFinancieelItems`. The profile menu items don't need filtering — they're only rendered when `isDirectieOrAdmin` is true.

Replace the two existing `useMemo` blocks (lines 176-237) with:

```typescript
// Filter Werk items based on 7-role model
const filteredWerkItems = useMemo(() => {
  if (isDirectieOrAdmin || role === "projectleider") {
    return werkItems;
  }
  if (role === "voorman") {
    return werkItems.filter((item) =>
      ["Dashboard", "Projecten", "Planning", "Uren", "Chat"].includes(item.title)
    );
  }
  if (role === "materiaalman") {
    return werkItems.filter((item) =>
      ["Dashboard", "Chat"].includes(item.title)
    );
  }
  if (role === "onderaannemer_zzp") {
    return werkItems.filter((item) =>
      ["Dashboard", "Planning", "Uren", "Chat"].includes(item.title)
    );
  }
  if (role === "medewerker") {
    return werkItems.filter((item) =>
      ["Dashboard", "Uren", "Chat"].includes(item.title)
    );
  }
  // klant/viewer
  return werkItems.filter((item) => item.title === "Dashboard");
}, [role, isDirectieOrAdmin]);

// Filter Financieel items based on role
const filteredFinancieelItems = useMemo(() => {
  if (isDirectieOrAdmin || role === "projectleider") {
    return financieelItems;
  }
  if (role === "materiaalman") {
    return financieelItems.filter((item) => item.title === "Inkoop");
  }
  return [];
}, [role, isDirectieOrAdmin]);
```

- [ ] **Step 2: Remove collapsible section state management**

Remove these sections that are no longer needed (accordion/collapsible state):
- `isOfferteSectionActive` useMemo
- `isOrganizationSectionActive` useMemo
- `isInkoopSectionActive` useMemo
- `isBeheerSectionActive` useMemo
- `activeSectionFromPath` useMemo
- `openSection` useState
- The `useEffect` that syncs `openSection`
- `toggleSection` useCallback

Keep only:
- `currentProjectId` useMemo (still needed for project tools)
- `isProjectSubSectionActive` useMemo (still needed for project tools)

- [ ] **Step 3: Remove Collapsible imports**

Remove the Collapsible import (lines 22-26) and the `ChevronRight` icon import since collapsible sections are removed:

```typescript
// DELETE these lines:
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@/components/ui/collapsible";
```

Remove `ChevronRight` from the lucide-react imports.

- [ ] **Step 4: Verify no TypeScript errors from role logic changes**

Run: `npm run typecheck`
Expected: Errors about JSX still referencing old arrays — will be fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "refactor(sidebar): update role filtering for Werk/Financieel groups, remove collapsible state"
```

---

### Task 3: Rewrite sidebar JSX (SidebarContent)

**Files:**
- Modify: `src/components/app-sidebar.tsx` (the JSX return, roughly lines 319-577)

- [ ] **Step 1: Replace the SidebarContent section**

Replace everything inside `<SidebarContent>` (lines 341-576) with the new flat structure. Two always-open groups, plus the project tools collapsible (which stays).

Note: Project Tools still uses Collapsible — keep the Collapsible import for this section. Actually, let's simplify Project Tools to also be always-open when on a project page (no collapsible needed).

```tsx
<SidebarContent>
  {/* Werk - daily operational items */}
  <SidebarGroup>
    <SidebarGroupLabel>Werk</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        {filteredWerkItems.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
              tooltip={item.title}
            >
              <Link href={item.url}>
                <item.icon />
                <span>{item.title}</span>
                {item.title === "Klanten" && aantalNieuweAanvragen !== undefined && aantalNieuweAanvragen > 0 && (
                  <Badge
                    variant="default"
                    className="ml-auto text-xs h-5 min-w-5 px-1 bg-blue-600 hover:bg-blue-600"
                  >
                    {aantalNieuweAanvragen}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  {/* Financieel - quotes, invoices, procurement */}
  {filteredFinancieelItems.length > 0 && (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Financieel</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filteredFinancieelItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                  tooltip={item.title}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )}

  {/* Project Tools - context-sensitive, only on project pages */}
  {currentProjectId && (
    <>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Project Tools</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {projectSubItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === `/projecten/${currentProjectId}${item.urlSuffix}`}
                  tooltip={item.title}
                >
                  <Link href={`/projecten/${currentProjectId}${item.urlSuffix}`}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )}
</SidebarContent>
```

- [ ] **Step 2: Now fully remove the Collapsible import**

Since Project Tools is also no longer collapsible, remove the Collapsible import entirely:

```typescript
// DELETE:
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@/components/ui/collapsible";
```

Also remove `isProjectSubSectionActive` useMemo since it's no longer needed (the section is always open when `currentProjectId` exists).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: Should pass or only have errors in the footer section (Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "refactor(sidebar): replace collapsible sections with flat Werk/Financieel groups"
```

---

### Task 4: Expand the profile dropdown menu

**Files:**
- Modify: `src/components/app-sidebar.tsx` (SidebarFooter section, roughly lines 579-654)

- [ ] **Step 1: Add DropdownMenuGroup and DropdownMenuLabel imports**

Add to the existing dropdown-menu import:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

- [ ] **Step 2: Replace the DropdownMenuContent**

Replace the DropdownMenuContent (lines 614-636) with the expanded profile menu. Keep the user info header and add the grouped navigation items. Move the theme toggle inside the dropdown. Move NotificationCenter to be next to the avatar trigger (outside the dropdown).

```tsx
<DropdownMenuContent align="start" side="top" className="w-64">
  {/* User info header */}
  <div className="px-3 py-2">
    <p className="text-sm font-medium">{userDisplayName}</p>
    {userEmail && (
      <p className="text-xs text-muted-foreground">{userEmail}</p>
    )}
  </div>
  <DropdownMenuSeparator />

  {/* Persoonlijk */}
  <DropdownMenuGroup>
    <DropdownMenuItem asChild>
      <Link href="/profiel" className="cursor-pointer">
        <User className="mr-2 h-4 w-4" aria-hidden="true" />
        Profiel
      </Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link href="/instellingen" className="cursor-pointer">
        <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
        Instellingen
      </Link>
    </DropdownMenuItem>
  </DropdownMenuGroup>

  {/* Personeel - admin/directie only */}
  {isDirectieOrAdmin && (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Personeel</DropdownMenuLabel>
        {personeelMenuItems.map((item) => (
          <DropdownMenuItem key={item.title} asChild>
            <Link
              href={item.url}
              className={`cursor-pointer ${item.indent ? "pl-8" : ""}`}
            >
              <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
              {item.title}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </>
  )}

  {/* Assets & Data - admin/directie only */}
  {isDirectieOrAdmin && (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Assets & Data</DropdownMenuLabel>
        {assetsMenuItems.map((item) => (
          <DropdownMenuItem key={item.title} asChild>
            <Link href={item.url} className="cursor-pointer">
              <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
              {item.title}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </>
  )}

  {/* Theme + Logout */}
  <DropdownMenuSeparator />
  <DropdownMenuGroup>
    <DropdownMenuItem
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="cursor-pointer"
    >
      {mounted && theme === "dark" ? (
        <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      {mounted ? (theme === "dark" ? "Lichte modus" : "Donkere modus") : "Thema"}
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={handleSignOut}
      className="cursor-pointer text-destructive focus:text-destructive"
    >
      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
      Uitloggen
    </DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>
```

- [ ] **Step 3: Update the footer layout**

Move the theme toggle button out of the separate `div` (it's now inside the dropdown). Keep NotificationCenter outside the dropdown. The footer should look like:

```tsx
<SidebarFooter>
  <SidebarMenu>
    <SidebarMenuItem>
      <div className="flex items-center justify-between px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="flex-1 cursor-pointer">
              {mounted && isUserLoaded ? (
                user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={userDisplayName}
                    width={32}
                    height={32}
                    className="size-8 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {userInitials}
                  </div>
                )
              ) : (
                <div className="size-8 rounded-full bg-muted animate-pulse" />
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium" title={mounted && isUserLoaded ? userDisplayName : undefined}>
                  {mounted && isUserLoaded ? userDisplayName : "Laden..."}
                </span>
                <span className="truncate text-xs text-muted-foreground" title={mounted && isUserLoaded && userEmail ? userEmail : undefined}>
                  {mounted && isUserLoaded && userEmail ? userEmail : ""}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {/* DropdownMenuContent from Step 2 goes here */}
        </DropdownMenu>
        <NotificationCenter />
      </div>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarFooter>
```

- [ ] **Step 4: Remove the standalone theme toggle Button**

The theme toggle is now inside the dropdown menu. Remove the separate `<Button>` that had the Sun/Moon icons (lines 640-649). The `Button` import from `@/components/ui/button` can also be removed if it's not used elsewhere in the file.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS — all references should resolve correctly now.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(sidebar): add grouped profile popover menu with Personeel and Assets sections"
```

---

### Task 5: Verify and test the full sidebar

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run the full type check**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: PASS or only pre-existing warnings.

- [ ] **Step 3: Start dev server and verify visually**

Run: `npm run dev`

Verify in browser:
1. Sidebar shows two groups: "Werk" (7 items) and "Financieel" (5 items)
2. No collapsible chevrons — both groups are always open
3. Click user avatar in footer → popover opens with:
   - User info (name, email)
   - Profiel, Instellingen
   - Personeel group (Medewerkers, Verlof indented, Verzuim indented, Gebruikersbeheer)
   - Assets & Data group (Wagenparkbeheer, Machinebeheer, Prijsboek, Garanties, Servicemeldingen, Toolbox)
   - Theme toggle, Uitloggen
4. Clicking any popover item navigates to correct route and closes popover
5. Theme toggle works from within the popover
6. Navigate to a project page → "Project Tools" group appears
7. NotificationCenter icon still visible next to the avatar
8. Mobile: sidebar still works as sheet/drawer

- [ ] **Step 4: Test role-based visibility**

If possible, test with different roles or verify by reading the role filtering logic:
- Directie/Admin: sees all sidebar items + all profile menu groups
- Medewerker: sees only Dashboard, Uren, Chat in sidebar. No Financieel group. Profile menu has only Profiel + Instellingen (no Personeel/Assets groups)
- Klant: sees only Dashboard. Profile menu minimal.

- [ ] **Step 5: Final commit with any fixes**

If any visual or functional issues were found, fix and commit:

```bash
git add src/components/app-sidebar.tsx
git commit -m "fix(sidebar): address visual/functional issues from testing"
```

---

### Task 6: Update Inkoop page with tab navigation

**Files:**
- Modify: `src/app/(dashboard)/inkoop/page.tsx`

This is a follow-up task. The sidebar now has a single "Inkoop" link pointing to `/inkoop`. The `/inkoop` page should provide tab navigation to Leveranciers, Inkooporders, and Voorraad content. The existing separate routes (`/leveranciers`, `/voorraad`) remain functional for direct access and backwards compatibility.

- [ ] **Step 1: Read the current inkoop page**

Read `src/app/(dashboard)/inkoop/page.tsx` to understand the current structure.

- [ ] **Step 2: Add tab navigation to the inkoop page**

Add a `Tabs` component at the top of the inkoop page with three tabs: Inkooporders (default, current content), Leveranciers, and Voorraad. Each tab links to the respective route using Next.js `Link` components, styled as tabs.

This is a lightweight approach — the tabs act as navigation links to the existing pages rather than embedding all three views in one page:

```tsx
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// At the top of the page component, before the existing content:
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold">Inkoop</h1>
</div>
<Tabs defaultValue="inkooporders" className="mb-6">
  <TabsList>
    <TabsTrigger value="inkooporders" asChild>
      <Link href="/inkoop">Inkooporders</Link>
    </TabsTrigger>
    <TabsTrigger value="leveranciers" asChild>
      <Link href="/leveranciers">Leveranciers</Link>
    </TabsTrigger>
    <TabsTrigger value="voorraad" asChild>
      <Link href="/voorraad">Voorraad</Link>
    </TabsTrigger>
  </TabsList>
</Tabs>
// ... existing page content below
```

- [ ] **Step 3: Add the same tab bar to leveranciers and voorraad pages**

Add the same tab navigation to `src/app/(dashboard)/leveranciers/page.tsx` and `src/app/(dashboard)/voorraad/page.tsx`, with the appropriate `defaultValue` set to mark the active tab.

For leveranciers: `defaultValue="leveranciers"`
For voorraad: `defaultValue="voorraad"`

- [ ] **Step 4: Verify tab navigation works**

Run dev server and test:
1. Click "Inkoop" in sidebar → `/inkoop` loads with tabs, "Inkooporders" tab active
2. Click "Leveranciers" tab → navigates to `/leveranciers`, shows leveranciers content with "Leveranciers" tab active
3. Click "Voorraad" tab → navigates to `/voorraad`, shows voorraad content with "Voorraad" tab active
4. Back/forward browser navigation works correctly

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/inkoop/page.tsx src/app/(dashboard)/leveranciers/page.tsx src/app/(dashboard)/voorraad/page.tsx
git commit -m "feat(inkoop): add tab navigation linking Inkooporders, Leveranciers, and Voorraad"
```
