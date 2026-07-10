// Expo-standaard eslint-config (SDK 54, flat config).
// De root-eslint-config (Next.js) negeert mobile/**; deze config lint de
// React Native-code met de juiste Expo-regels.
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'convex/_generated/**', '.expo/**'],
  },
  {
    // Metro/Tailwind/Babel-configs zijn CommonJS; require() is daar het
    // standaardformaat — no-require-imports slaat er onterecht op aan.
    files: ['*.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
