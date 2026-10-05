import { describe, expect, it } from 'vitest';
import { eigenUrenCsv, type EigenUrenCsvRegel } from '../../../mobile/lib/eigen-uren-csv';
const regel: EigenUrenCsvRegel = { id: 'segment-1', datum: '2026-09-12', medewerkerNaam: 'Hoveniër', klantNaam: 'De Tuin', categorie: 'werken', werksoort: 'Tuinaanleg', beginTijd: '08:00', eindTijd: '09:30', minuten: 90, status: 'ingediend', notitie: 'Geplant werk' };
describe('native personal CSV export', () => {
  it('retains server minutes, work kind, status, Unicode and Dutch decimals', () => {
    const csv = eigenUrenCsv([regel]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Hoveniër"');
    expect(csv).toContain('"Tuinaanleg";"08:00";"09:30";"90";"1,50";"ingediend"');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
  it('quotes separators, quotes and multiline notes without extra columns', () => {
    expect(eigenUrenCsv([{ ...regel, notitie: 'Tuin; "voor"\nna' }])).toContain('"Tuin; ""voor""\nna"');
  });
  it.each(['=SUM(A1)', ' +SUM(A1)', '\t@SUM(A1)', '-1+2'])('neutralises formula input %s', notitie => {
    expect(eigenUrenCsv([{ ...regel, notitie }])).toContain(`"'${notitie}"`);
  });
  it('rejects invalid numeric totals instead of silently exporting them', () => {
    expect(() => eigenUrenCsv([{ ...regel, minuten: NaN }])).toThrow();
    expect(() => eigenUrenCsv([{ ...regel, minuten: -1 }])).toThrow();
  });
});
