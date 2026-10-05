import { describe, expect, it } from 'vitest';
import { controleerVeldToken } from '../../../../mobile/lib/veld-sessie';
const token = (sub: string, org_id?: string) => `header.${Buffer.from(JSON.stringify({ sub, org_id })).toString('base64url')}.signature`;
describe('vastgezette identiteit voor native writes', () => {
  it('accepteert de vastgelegde gebruiker en organisatie', () => {
    expect(() => controleerVeldToken(token('user', 'org'), 'user', 'org')).not.toThrow();
  });
  it.each([token('ander', 'org'), token('user', 'ander'), token('user'), 'ongeldig', 'x.bm90anNvbg.x'])(
    'blokkeert afwijkende of onleesbare tokenclaims zonder tokens te tonen', waarde => {
      expect(() => controleerVeldToken(waarde, 'user', 'org')).toThrow('Je sessie is gewijzigd.');
    });
});
