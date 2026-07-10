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
    },
  },
]);

export default eslintConfig;
