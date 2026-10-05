import { describe, expect, it } from 'vitest';
import { indienStatus } from '../../../../convex/veldDekking';
import { herinnerMoment } from '../../../../convex/veldHerinneringen';

describe('indienstatus en kantoorherinnering', () => {
  it('onderscheidt niets/open/deels/ingediend en vertrouwt niet alleen op dagstatus', () => {
    expect(indienStatus([], false)).toBe('niets');
    expect(indienStatus(['open'], false)).toBe('open');
    expect(indienStatus(['open', 'ingediend'], true)).toBe('deels');
    expect(indienStatus(['ingediend'], true)).toBe('ingediend');
    expect(indienStatus(['ingediend'], false)).toBe('deels');
  });
  it('houdt het kantooruur gelijk tijdens zomer- en wintertijd', () => {
    expect(herinnerMoment(Date.parse('2026-07-01T16:00:00Z'), 0)).toMatchObject({ datum: '2026-07-01', uur: 18, weekdag: 3 });
    expect(herinnerMoment(Date.parse('2026-01-01T17:00:00Z'), -1)).toMatchObject({ datum: '2025-12-31', uur: 18, weekdag: 4 });
    expect(herinnerMoment(Date.parse('2026-03-29T22:15:00Z'), -1)).toMatchObject({ vandaag: '2026-03-30', datum: '2026-03-29', uur: 0 });
  });
});
