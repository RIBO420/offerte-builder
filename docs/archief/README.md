# Archief

Afgeronde plannen, audits en rapporten. Niets hier is nog leidend — het staat er om
terug te kunnen kijken waarom iets zo gebouwd is. Actuele documentatie staat in
`docs/dev/` (harde regels en werkwijzen) en `docs/design/plannen/` (lopend
designprogramma). Opgeruimd op 17 augustus 2026.

## root-documenten/

Kwamen uit de projectroot, die geen git-historie had. Hier staan ze wél in de repo.

| Bestand | Wat het is |
|---|---|
| `MODULE-GAP-ANALYSE.md` | Codebase-audit tegen PRD v1, 10 juli 2026 |
| `SCHEMA-MAPPING.md` | PRD §7.4-velden gemapt op het Convex-schema |
| `B1-WERKITEM-BESLUIT.md` | Besluit werkitem-modellering — genomen en uitgevoerd |
| `FASE1-RAPPORT-juli-rootversie.md` | Oudere kopie van het QA-eindrapport; de volledige versie staat in `fases/` |
| `offerte-builder-prd.md` | PRD v1.0 van de calculator, januari 2026 — achterhaald door v1.2.1 |
| `ADDONPRD.md` | Add-on PRD calculatie/planning/nacalculatie, januari 2026 |

De drie levende documenten zijn níét gearchiveerd en staan nog in de projectroot:
`prd-toptuinen-app-v1.md` (leidende PRD), `TOP_TUINEN_SCOPE_DOCUMENT.md` (scope, 16
modules) en `PLAN-PRD-V1.md` (plan van aanpak).

## audits/

| Bestand | Wat het is |
|---|---|
| `AUDIT-2026-08-12.md` | Code- en UI-audit van 12 augustus |
| `AUDIT-2026-08-12-RESULTAAT.md` | Herstelronde daarop, 22 agents in 7 fasen |
| `AUDIT-RAPPORT-2026-03-18.md` | Eerste brede audit, maart |
| `frontend-audit-2026-03-28.md` + `frontend-audit-featurelist.json` | Frontend-audit met featurelijst |

## fases/

QA-eindrapport fase 1, plus plan en overdrachtsrapport van fase 2 (PRD §3).
`FASE2-PLAN.md` verwijst naar `FASE1-RAPPORT.md` — beide liggen hier naast elkaar.

## plannen/

`PLAN-UX-2026-03-18.md` (40 UX-verbeteringen in 6 fasen) en `superpowers/` met de
plannen en specs van de redesigns uit maart/april: klantenportaal, projectoverzicht,
dashboard, sidebar, PDF-templatesysteem. Allemaal gebouwd.

## reviews/planning/

Het reviewprogramma van juli: 16 reviewrapporten (schema, security, typescript, react,
convex, ui/ux, error-handling, performance, test-coverage, dead code, mobile,
scope-compliance), drie moduleplannen (garantie, boekhouding, onderhoud),
`feature_list.json`, de voortgangsbestanden en de shellscripts
`claim-feature.sh` / `next-feature.sh` / `release-feature.sh`. Die scripts staan niet
in `package.json` en worden nergens aangeroepen.
