# Archief

Afgeronde plannen, audits en rapporten. Niets hier is nog leidend — het staat er om
terug te kunnen kijken waarom iets zo gebouwd is. Actuele documentatie staat in
`docs/dev/` (harde regels en werkwijzen) en `docs/design/plannen/` (lopend
designprogramma). Opgeruimd op 17 augustus 2026.

## root-documenten/

Kwamen uit de projectroot, die geen git-historie had. Hier staan ze wél in de repo.
De projectroot is nu leeg op `.claude/` en `graphify-out/` na.

De eerste drie zijn niet dood — er staat werk in dat nog moet gebeuren. Ze liggen hier
omdat losse documenten in de werkmap de aandacht van agents wegtrekken, niet omdat ze
afgehandeld zijn. Pak ze er expliciet bij als je aan fase 3 of aan modules 7–16 begint.

| Bestand | Wat het is |
|---|---|
| `prd-toptuinen-app-v1.md` | **Nog levend.** Bouwopdracht v1.2.1, Romeo/Sais, 8 juli 2026. Fase 0/1/2 gebouwd. Open: §4 fase 3 (AI-intake, HR, Gmail, planbord-AI), §5 quick fixes, §7 vragen richting Romeo/Yannick/Hans. §8 zijn de acceptatietests, bijlage C de nulmeting van de uren-app. Verwijst naar een losse gap-spec die nooit is aangeleverd. |
| `TOP_TUINEN_SCOPE_DOCUMENT.md` | **Nog levend.** Scopedocument LOQIC, maart 2026. De statuskolom in §4 is achterhaald. Enige bron die modules 7–16 functioneel beschrijft (HR, wagenpark, garantie, interne communicatie, boekhouding, smart operations), plus de rollen- en permissiematrix. |
| `PLAN-PRD-V1.md` | Beoordeling van de PRD, 10 juli 2026: vertaalslag Supabase→Convex, beslispunten, fasering. Uitgevoerd. Legt vast waarom het Convex-schema afwijkt van de PRD-veldnamen. |
| `MODULE-GAP-ANALYSE.md` | Codebase-audit tegen PRD v1, 10 juli 2026 |
| `SCHEMA-MAPPING.md` | PRD §7.4-velden gemapt op het Convex-schema |
| `B1-WERKITEM-BESLUIT.md` | Besluit werkitem-modellering — genomen en uitgevoerd |
| `FASE1-RAPPORT-juli-rootversie.md` | Oudere kopie van het QA-eindrapport; de volledige versie staat in `fases/` |
| `offerte-builder-prd.md` | PRD v1.0 van de calculator, januari 2026 — achterhaald door v1.2.1 |
| `ADDONPRD.md` | Add-on PRD calculatie/planning/nacalculatie, januari 2026 |

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
