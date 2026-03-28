# Sidebar Redesign — Design Spec

## Problem

The current sidebar has 6 sections (Primary, Offertes & Facturen, Inkoop, Organisatie/Bedrijf, Beheer, Project Tools) with items mixed across categories inconsistently. Machinepark lives under Beheer while Wagenpark lives under Organisatie. Rapportages (analytics) sits next to HR items. The collapsible sections add visual noise and hide frequently-used items.

## Solution

Restructure navigation into two clear surfaces:

1. **Sidebar** — Daily operational work, always visible, no collapsibles
2. **Profile menu** — Administration and settings, accessible via avatar popover

## Sidebar

Two groups, always expanded (no collapsible sections):

### Werk (operational)

| Item | Route | Visible to |
|------|-------|-----------|
| Dashboard | `/dashboard` | All roles |
| Klanten | `/klanten` | Directie, Projectleider |
| Projecten | `/projecten` | Directie, Projectleider, Voorman |
| Planning | `/planning` | Directie, Projectleider, Voorman, Onderaannemer_zzp |
| Uren | `/uren` | Directie, Projectleider, Voorman, Onderaannemer_zzp, Medewerker |
| Rapportages | `/rapportages` | Directie, Projectleider |
| Chat | `/chat` | All roles |

### Financieel

| Item | Route | Visible to |
|------|-------|-----------|
| Offertes | `/offertes` | Directie, Projectleider |
| Contracten | `/contracten` | Directie, Projectleider |
| Facturen | `/facturen` | Directie, Projectleider |
| Inkoop | `/inkoop` | Directie, Projectleider, Materiaalman |
| Archief | `/archief` | Directie, Projectleider |

### Footer

- User avatar + name + role
- Click opens profile menu (popover)

### Project Tools (context-sensitive, unchanged)

- Kosten tracking → `/projecten/[id]/kosten`
- Kwaliteit → `/projecten/[id]/kwaliteit`
- Only visible when viewing a specific project

## Profile Menu

Popover triggered by clicking the user avatar in the sidebar footer. Each item is a direct navigation link (no sub-menus, no intermediate pages).

### Persoonlijk (all roles)

| Item | Route |
|------|-------|
| Profiel | `/profiel` |
| Instellingen | `/instellingen` |

### Personeel (Directie, Admin only)

| Item | Route | Notes |
|------|-------|-------|
| Medewerkers | `/medewerkers` | Main entry |
| — Verlof | `/verlof` | Indented sub-item |
| — Verzuim | `/verzuim` | Indented sub-item |
| Gebruikersbeheer | `/gebruikers` | |

### Assets & Data (Directie, Admin only)

| Item | Route |
|------|-------|
| Wagenparkbeheer | `/wagenpark` |
| Machinebeheer | `/instellingen/machines` |
| Prijsboek | `/prijsboek` |
| Garanties | `/garanties` |
| Servicemeldingen | `/servicemeldingen` |
| Toolbox | `/toolbox` |

### Footer

| Item | Notes |
|------|-------|
| Thema | Toggle dark/light mode |
| Uitloggen | Sign out |

## Key Decisions

1. **"Organisatie" section removed** — Items redistributed between sidebar (Rapportages) and profile menu (Medewerkers, Verlof, Verzuim, Wagenpark)
2. **"Beheer" section removed** — Items moved to profile menu under "Assets & Data" and "Personeel" groups
3. **Inkoop consolidated** — Was 3 sidebar items (Leveranciers, Inkooporders, Voorraad), now 1 item. The `/inkoop` page uses tabs for sub-navigation
4. **Quick actions removed from sidebar** — "Nieuwe Aanleg" and "Nieuwe Onderhoud" shortcuts live on the Offertes page itself
5. **No collapsible sections** — Both sidebar groups are always expanded
6. **Profile menu is a popover** — Click an item, navigate to that route, popover closes
7. **Role-based filtering retained** — Both sidebar items and profile menu groups are role-filtered
8. **Servicemeldingen moved to profile menu** — Under "Assets & Data", between Garanties and Toolbox

## Role Visibility Summary

| Role | Sidebar items | Profile menu |
|------|--------------|-------------|
| Directie/Admin | All 12 | All groups |
| Projectleider | All except some role-specific | Personeel, Assets & Data (no Gebruikersbeheer) |
| Voorman | Dashboard, Projecten, Planning, Uren, Chat | Profiel, Instellingen only |
| Materiaalman | Dashboard, Chat, Inkoop | Profiel, Instellingen only |
| Onderaannemer_zzp | Dashboard, Planning, Uren, Chat | Profiel, Instellingen only |
| Medewerker | Dashboard, Uren, Chat | Profiel, Instellingen only |
| Klant/Viewer | Dashboard | Profiel only |

## Components Affected

- `src/components/app-sidebar.tsx` — Main refactor: remove collapsible sections, restructure into Werk + Financieel groups, update role filtering
- `src/app/(dashboard)/layout.tsx` — No changes expected (sidebar wrapper stays the same)
- `src/components/ui/sidebar.tsx` — No changes (generic sidebar primitives)
- Profile menu — Extend existing user dropdown in sidebar footer with grouped navigation items

## Routes Affected

No routes are added or removed. All existing routes stay at their current paths. The only change is how they are accessed (sidebar vs profile menu).

The `/inkoop` page needs internal tab navigation to replace the 3 separate sidebar links:
- Tab: Leveranciers (content from `/leveranciers`)
- Tab: Inkooporders (content from `/inkoop` current)
- Tab: Voorraad (content from `/voorraad`)
