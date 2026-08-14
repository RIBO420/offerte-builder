# Een nieuwe aanleg-scope toevoegen

Een scope leeft op ~15 plekken. Volg `parkeerplaats` of `beregening` als blauwdruk
(beide zijn in één keer compleet doorgevoerd) en loop deze lijst af:

1. `convex/validators.ts` — eigen validator + opnemen in `aanlegScopeDataValidator`
2. `src/types/offerte.ts` — `AanlegScope` union + `…Data` interface
3. `src/lib/validations/aanleg-scopes.ts` — zod-schema
4. `useAanlegWizard.ts` — `ScopeData`, `DEFAULT_…`, `INITIAL_WIZARD_DATA`, `SCOPES`,
   `isScopeDataValid`, `scopeValidationErrors`, `scopeValidationHandlers`
5. `scope-forms/<scope>-form.tsx` + export in `scope-forms/index.ts`
6. `AanlegScopeDetailsStep` (case + `SCOPE_ICONS`), `AanlegKlantScopesStep`,
   `scope-change-modal` (beide ook `SCOPE_ICONS`), `AanlegReviewSection` (samenvatting)
7. `src/lib/offerte-calculator.ts` — constanten + `calculate<Scope>` + `switch`-case
8. `src/lib/voorcalculatie-calculator.ts` — uren-case (spiegelt de calculator)
9. Labelmaps (~14 bestanden): zoek op een bestaande scope-naam met
   `grep -rl "parkeerplaats" src convex` en loop die lijst af
10. `convex/normuren.ts` seed, `convex/kwaliteitsControles.ts` checklist,
    `planning-templates.ts` taken/kleur, `scopeMarges` in schema + instellingen + tarieven-tab
11. Tests in `src/lib/__tests__/offerte-calculator.test.ts`

## De normuren-val

**Val nooit terug op `if (normuur) …`.** `normuren.createDefaults` is idempotent op
"heeft deze user al normuren", dus bestaande bedrijven krijgen nieuwe seed-regels
nóóit. Gebruik `findNormuur(...)?.normuurPerEenheid ?? CONSTANTE`, anders levert de
scope stilzwijgend €0 arbeid op. De fallback-constanten in `offerte-calculator.ts`
zijn realistische schattingen, geen vastgestelde Top Tuinen-tarieven.
