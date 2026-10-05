import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Execute native hook lifecycles with one React renderer. Platform boundaries are
// mocked in each test; this deliberately does not claim an iOS/Hermes device test.
export default defineConfig({
  test: { environment: 'jsdom', include: ['mobile/__tests__/**/*.test.tsx'], globals: true },
  resolve: { alias: { react: path.resolve(__dirname, '../node_modules/react') }, dedupe: ['react'] },
});
