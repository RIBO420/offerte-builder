import { expect, it } from 'vitest';
import { veldFotoContentType } from '../../../../mobile/lib/veld-foto-type';

it.each([['application/octet-stream', '.jpg', 'image/jpeg'], ['', '.PNG', 'image/png'], ['application/octet-stream', '.heic', 'image/heic'], ['image/jpeg', '.jpg', 'image/jpeg']])('bewaart het fotoformaat bij %s en %s', (type, extension, verwacht) => {
  expect(veldFotoContentType(type, extension)).toBe(verwacht);
});
it('labelt een onbekend bestand nooit als afbeelding', () => {
  expect(() => veldFotoContentType('application/octet-stream', '.bin')).toThrow('fotoformaat');
});
