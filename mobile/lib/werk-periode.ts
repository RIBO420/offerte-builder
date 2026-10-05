export function vandaagAmsterdam(): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function geldigeDag(datum: unknown): datum is string {
  return typeof datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datum) && Number.isFinite(Date.parse(datum)) && new Date(datum).toISOString().slice(0, 10) === datum;
}
export function schuifDag(datum: string, aantal: number): string {
  const date = new Date(`${datum}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + aantal); return date.toISOString().slice(0, 10);
}
export function werkPeriode(datum: string, mode: 'week' | 'maand') {
  const date = new Date(`${datum}T12:00:00Z`);
  if (mode === 'week') { const van = schuifDag(datum, -((date.getUTCDay() + 6) % 7)); return { van, tot: schuifDag(van, 6) }; }
  return { van: `${datum.slice(0, 7)}-01`, tot: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10) };
}
export function schuifPeriode(datum: string, mode: 'week' | 'maand', richting: number) {
  if (mode === 'week') return schuifDag(datum, 7 * richting);
  const date = new Date(`${datum.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + richting); return date.toISOString().slice(0, 10);
}
export const urenLabel = (minuten: number) => `${Math.floor(minuten / 60)}u ${Math.round(minuten % 60).toString().padStart(2, '0')}m`;
