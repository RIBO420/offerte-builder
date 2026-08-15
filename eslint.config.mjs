import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gegenereerde en rapportage-output — geen handgeschreven code:
    "coverage/**",
    "convex/_generated/**",
    "mobile/convex/_generated/**",
    "playwright-report/**",
    "test-results/**",
    // Mobile heeft een eigen Expo-eslint-config (mobile/eslint.config.js):
    "mobile/**",
    // Kortlevend Clerk-ticket van `npm run dev:login` (JSON, gitignored) —
    // eslint leest .gitignore niet en struikelt anders zodra iemand inlogt.
    // Bewust niet heel public/**: sw.js is handgeschreven en blijft gelint.
    "public/dev-login-ticket.js",
  ]),
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Ongebruikte imports zijn dode code en auto-fixbaar.
      "unused-imports/no-unused-imports": "warn",
      // Bewust ongebruikte functie-argumenten en catch-variabelen zijn
      // legitiem als ze met een underscore beginnen (projectconventie).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          // const { id, ...rest } = args — id weglaten via rest-destructuring
          // is een bewust patroon, geen dode variabele.
          ignoreRestSiblings: true,
        },
      ],
      // React Compiler-diagnostiek: react-hook-form staat op de lijst van
      // incompatibele libraries; de melding is informatief (compilatie wordt
      // overgeslagen) en niet oplosbaar zonder van formulierbibliotheek te
      // wisselen.
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // dnd-kit's useSortable levert bewust render-time callback-refs
    // (setNodeRef) en drag-props; react-hooks/refs (compiler-heuristiek)
    // markeert dit onterecht als ref-access tijdens render.
    files: [
      "src/components/ui/sortable-list.tsx",
      "src/components/offerte/sortable-regels-table.tsx",
      "src/components/project/taken-lijst.tsx",
    ],
    rules: {
      "react-hooks/refs": "off",
    },
  },
  {
    // useCallback met react-hook-form's `form` in de deps: de compiler kan de
    // handmatige memoization niet behouden door de incompatibele library;
    // useCallback verwijderen zou identiteitsstabiliteit (gedrag) wijzigen.
    files: ["src/components/project/uren-entry-form.tsx"],
    rules: {
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    // @react-pdf/renderer's <Image> is geen DOM-<img>; jsx-a11y/alt-text
    // (door eslint-config-next geconfigureerd voor componentnaam "Image")
    // slaat hier onterecht aan.
    files: [
      "src/components/pdf/**",
      "src/components/project/factuur-pdf.tsx",
    ],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
  {
    // Dynamische previews (Convex-storage-foto's, geüpload logo) hebben geen
    // vaste hostnames/afmetingen; next/image zou remotePatterns-config en
    // ander laadgedrag vergen — geen mechanische winst.
    files: [
      "src/components/leads/lead-detail-modal.tsx",
      "src/components/project/werklocatie-card.tsx",
      "src/app/(dashboard)/instellingen/components/huisstijl-tab.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
