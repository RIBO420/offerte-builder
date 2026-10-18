import { describe, expect, it } from 'vitest';
import { MAX_TIJDELIJKE_POGINGEN, backoffMs, classificeerVeldFout } from '../lib/veld-foutsoort';

const metStatus = (bericht: string, httpStatus: number) => Object.assign(new Error(bericht), { httpStatus });
class ConvexError extends Error { name = 'ConvexError'; data = 'x'; }

describe('classificeerVeldFout', () => {
  it('ziet domeinfouten van de server als conflict', () => {
    expect(classificeerVeldFout(new ConvexError('De revisie is gewijzigd'))).toBe('conflict');
    expect(classificeerVeldFout(metStatus('ArgumentValidationError: Value does not match validator', 560))).toBe('conflict');
    expect(classificeerVeldFout(new Error('ArgumentValidationError: Object is missing the required field `datum`'))).toBe('conflict');
    // Status 560: de functie draaide en gooide — herhalen geeft hetzelfde resultaat.
    expect(classificeerVeldFout(metStatus('[Request ID: 1] Server Error', 560))).toBe('conflict');
  });

  it('ziet overbelasting, gateway- en authfouten als tijdelijk', () => {
    for (const status of [429, 500, 502, 503, 504, 401, 404]) {
      expect(classificeerVeldFout(metStatus('<html>Service Unavailable</html>', status))).toBe('tijdelijk');
    }
    expect(classificeerVeldFout(new Error('Foto-upload mislukt (503).'))).toBe('tijdelijk');
    expect(classificeerVeldFout(new Error('Foto-upload mislukt (429).'))).toBe('tijdelijk');
    // Onbekende fout zonder HTTP-status: liever opnieuw proberen dan blijvend weigeren.
    expect(classificeerVeldFout(new Error('Something odd'))).toBe('tijdelijk');
  });

  it('wacht stil bij netwerk- en sessiefouten', () => {
    expect(classificeerVeldFout(new Error('Network request failed'))).toBe('netwerk');
    expect(classificeerVeldFout(new Error('The operation was aborted'))).toBe('netwerk');
    expect(classificeerVeldFout(new Error('Sessie niet beschikbaar; log opnieuw in'))).toBe('netwerk');
    expect(classificeerVeldFout(new Error('Je sessie is gewijzigd. Open de dag opnieuw om te synchroniseren.'))).toBe('netwerk');
    expect(classificeerVeldFout(metStatus('Service Unavailable', 503), false)).toBe('netwerk');
  });

  it('weigert lokale fouten die niet vanzelf verdwijnen', () => {
    expect(classificeerVeldFout(new Error('De lokale foto ontbreekt. Kies de foto opnieuw.'))).toBe('conflict');
    expect(classificeerVeldFout(new Error('Foto-upload mislukt (413).'))).toBe('conflict');
  });

  it('bouwt de wachttijd op tot een plafond en geeft na het maximum op', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
    expect(MAX_TIJDELIJKE_POGINGEN).toBe(8);
  });
});
