// Bundle with esbuild and run using react-native/sdks/hermesc/osx-bin/hermes.
// Real Hermes JS, JSON persistence adapter; NOT the native AsyncStorage bridge.
import base64 from 'base-64';
import { VeldOutbox, outboxSleutel } from '../lib/veld-outbox-core';
import { controleerVeldToken } from '../lib/veld-sessie';

globalThis.atob = base64.decode; // Same polyfill installed by @clerk/clerk-expo.
function assert(value, message) { if (!value) throw new Error(message); }
async function main() {
  assert(typeof HermesInternal !== 'undefined', 'Run this check with Hermes');
  assert(typeof Buffer === 'undefined', 'This check must not depend on Node Buffer');
  const token = `x.${base64.encode(JSON.stringify({ sub: 'user', org_id: 'org' })).replace(/=/g, '')}.x`;
  controleerVeldToken(token, 'user', 'org');
  let rejected = false;
  try { controleerVeldToken(token, 'other', 'org'); } catch { rejected = true; }
  assert(rejected, 'Wrong identity accepted');
  const data = {};
  const storage = {
    getItem: async key => data[key] ?? null,
    setItem: async (key, value) => { data[key] = value; },
  };
  const key = outboxSleutel('org', 'user');
  const box = new VeldOutbox(storage, key);
  await box.voegToe({ id: 'stable-key', type: 'segmentToevoegen', payload: { sleutel: 'stable-key', notitie: 'Heg vóór 12:00', minuten: 35 }, status: 'wacht', aangemaaktOp: 1 });
  await box.verwerk({ online: () => false, juisteSessie: () => true, uitvoeren: async () => { throw new Error('Sent while offline'); }, isNetwerkFout: () => false });
  const restored = new VeldOutbox(storage, key);
  assert((await restored.lees())[0].payload.notitie === 'Heg vóór 12:00', 'Persisted data changed');
  let calls = 0;
  await restored.verwerk({ online: () => true, juisteSessie: () => true, uitvoeren: async row => { calls++; assert(row.payload.sleutel === 'stable-key', 'Retry key changed'); }, isNetwerkFout: () => false });
  assert(calls === 1 && (await restored.lees()).length === 0, 'Queue did not drain');
  assert((await new VeldOutbox(storage, outboxSleutel('other', 'user')).lees()).length === 0, 'Organisation isolation failed');
  print('PASS Hermes: scoped JWT, no Buffer, durable Unicode pending, restart, identical retry and org isolation');
}
main().catch(error => { print(`FAIL: ${error.message}`); throw error; });
