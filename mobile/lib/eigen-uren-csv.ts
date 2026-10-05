/** Persoonlijk exportbestand: serverminuten blijven leidend, tekst wordt nooit Excel-formule. */
export interface EigenUrenCsvRegel {
  id: string; datum: string; medewerkerNaam?: string; klantNaam: string | null;
  categorie: string; werksoort?: string | null; beginTijd: string; eindTijd: string;
  minuten: number; status?: string; notitie: string | null;
}
function csvCel(waarde: string | number | null | undefined): string {
  let tekst = waarde == null ? '' : String(waarde);
  // Ook witruimte vóór een formule mag niet als uitvoerbare spreadsheetinhoud openen.
  if (typeof waarde !== 'number' && /^[\s\uFEFF]*[=+@-]/.test(tekst)) tekst = `'${tekst}`;
  return `"${tekst.replace(/"/g, '""')}"`;
}
export function eigenUrenCsv(regels: EigenUrenCsvRegel[]): string {
  const kop = ['Registratie-ID', 'Datum', 'Medewerker', 'Klant', 'Categorie', 'Werksoort', 'Begin', 'Einde', 'Minuten', 'Uren', 'Status', 'Notitie'];
  const rijen = regels.map(r => {
    if (!Number.isFinite(r.minuten) || r.minuten < 0) throw new Error('De uren bevatten een ongeldige duur. Vernieuw het overzicht voordat je exporteert.');
    return [r.id, r.datum, r.medewerkerNaam, r.klantNaam, r.categorie, r.werksoort, r.beginTijd, r.eindTijd, r.minuten, (r.minuten / 60).toFixed(2).replace('.', ','), r.status, r.notitie];
  });
  return '\uFEFF' + [kop, ...rijen].map(r => r.map(csvCel).join(';')).join('\r\n') + '\r\n';
}
