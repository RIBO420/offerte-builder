/* global __dirname */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const babel = require('@babel/core');

const mobile = path.resolve(__dirname, '..');
const hermes = path.join(mobile, 'node_modules/react-native/sdks/hermesc/osx-bin/hermes');
if (process.platform !== 'darwin' || !fs.existsSync(hermes)) {
  throw new Error('Deze check vereist de meegeleverde macOS Hermes-runtime. Dit is geen device-test.');
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toptuinen-hermes-'));
try {
  const output = buildSync({
    entryPoints: [path.join(mobile, '__tests__/hermes-outbox-smoke.js')],
    bundle: true, write: false, platform: 'neutral', mainFields: ['main'], target: 'es2015',
  }).outputFiles[0].text;
  // Metro also lowers classes for this Hermes release.
  const code = babel.transformSync(output, {
    configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-classes')],
  }).code;
  const file = path.join(directory, 'outbox.js');
  fs.writeFileSync(file, code);
  process.stdout.write(execFileSync(hermes, [file], { encoding: 'utf8' }));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
