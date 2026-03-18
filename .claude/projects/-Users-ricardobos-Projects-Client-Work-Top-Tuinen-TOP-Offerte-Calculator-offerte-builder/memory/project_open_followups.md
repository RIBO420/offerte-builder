---
name: Open follow-up tasks
description: Four remaining tasks from the comprehensive audit — Next.js upgrade, mega-page splits, mobile color migration, viewer role enforcement
type: project
---

Open follow-ups identified after comprehensive audit (2026-03-18):

1. **Next.js upgrade to 16.1.7+** — 1 remaining vulnerability, requires `--force` flag
   **Why:** Security vulnerability still present in current Next.js version
   **How to apply:** Run upgrade with --force, then verify build + tests pass

2. **Split mega-pages** — 7 pages with >1100 lines each, too complex for parallel agents
   **Why:** Maintainability / complexity concern
   **How to apply:** Needs manual decomposition, one page at a time

3. **Migrate #555555 hardcoded color** → `colors.inactive` in ~10 mobile files
   **Why:** Design system consistency in mobile app
   **How to apply:** Search mobile/ for #555555 and replace with theme token

4. **Viewer role enforcement** — `requireNotViewer` helper is ready, needs broad application to all write mutations
   **Why:** Security — viewer role should not be able to perform write operations
   **How to apply:** Apply requireNotViewer to all mutation functions in convex/
