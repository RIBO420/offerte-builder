import { describe, expect, it } from 'vitest';
import { wijzigVoorstelTijd, splitsVoorPauze } from '../../../mobile/lib/dagvoorstel-tijden';
import { werkPeriode, schuifPeriode, schuifDag, geldigeDag } from '../../../mobile/lib/werk-periode';
const regels = [
  { categorie: 'werken', beginTijd: '08:00', eindTijd: '12:00', werkitemId: 'klus-1' },
  { categorie: 'terugreis', beginTijd: '12:00', eindTijd: '12:30', werkitemId: 'klus-1' },
];
describe('native draft time operations', () => {
  it('preserves duration when start moves and optionally cascades following blocks', () => {
    const next = wijzigVoorstelTijd(regels, 0, 'beginTijd', '08:05', true);
    expect(next[0]).toMatchObject({ beginTijd: '08:05', eindTijd: '12:05', werkitemId: 'klus-1' });
    expect(next[1]).toMatchObject({ beginTijd: '12:05', eindTijd: '12:35' });
    expect(regels[0].beginTijd).toBe('08:00');
  });
  it('rejects uncascaded overlaps and leaving the day', () => {
    expect(() => wijzigVoorstelTijd(regels, 0, 'beginTijd', '08:05', false)).toThrow(/overlap/);
    expect(() => wijzigVoorstelTijd(regels, 0, 'eindTijd', '23:50', true)).toThrow(/dag/);
  });
  it('splits customer work around an explicit break without inventing more time', () => {
    const next = splitsVoorPauze(regels, 0, '10:00', 20, (r, beginTijd, eindTijd) => ({ ...r, categorie: 'pauze', beginTijd, eindTijd }));
    expect(next.map(r => [r.categorie, r.beginTijd, r.eindTijd])).toEqual([
      ['werken', '08:00', '10:00'], ['pauze', '10:00', '10:20'], ['werken', '10:20', '12:00'], ['terugreis', '12:00', '12:30'],
    ]);
    expect(next.every(r => r.werkitemId === 'klus-1')).toBe(true);
  });
  it('does not emit zero-length work when a break begins at the block boundary', () => {
    const next = splitsVoorPauze(regels, 0, '08:00', 20, (r, beginTijd, eindTijd) => ({ ...r, categorie: 'pauze', beginTijd, eindTijd }));
    expect(next).toHaveLength(3);
  });
  it.each([['07:59', 20], ['11:50', 20], ['10:00', 0], ['bad', 20]])('rejects break outside valid work %s %s', (tijd, duur) => {
    expect(() => splitsVoorPauze(regels, 0, tijd as string, duur as number, r => r)).toThrow();
  });
});
describe('native period navigation', () => {
  it('uses Monday to Sunday across year boundaries', () => expect(werkPeriode('2026-01-01', 'week')).toEqual({ van: '2025-12-29', tot: '2026-01-04' }));
  it('handles leap years, month lengths and year navigation', () => {
    expect(werkPeriode('2024-02-17', 'maand')).toEqual({ van: '2024-02-01', tot: '2024-02-29' });
    expect(schuifPeriode('2026-12-31', 'maand', 1)).toBe('2027-01-01');
    expect(schuifDag('2026-03-29', 1)).toBe('2026-03-30');
    expect(geldigeDag('2026-02-29')).toBe(false);
  });
});
