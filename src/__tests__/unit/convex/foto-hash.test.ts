import { expect, it } from 'vitest';
import { fotoHashHex, fotoHashGelijk } from '../../../../convex/lib/fotoHash';
const hex = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const base64 = 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=';
it('vergelijkt SHA-256 van abc in werkelijke base64-opslagnotatie en hex-ticket', () => {
  expect(fotoHashHex(base64)).toBe(hex);
  expect(fotoHashGelijk(base64, hex)).toBe(true);
  expect(fotoHashGelijk(hex.toUpperCase(), hex)).toBe(true);
  expect(fotoHashGelijk(base64, 'a'.repeat(64))).toBe(false);
});
it.each(['', base64.slice(0, -1), base64.replace('=', 'A'), base64.replace('0=', '1='), 'a'.repeat(63), 'a'.repeat(65), ' '.repeat(44)])('weigert onvolledige of niet-canonieke hash %s', hash => {
  expect(fotoHashHex(hash)).toBeNull();
});
