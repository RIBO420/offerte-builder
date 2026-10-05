const tijdFormatter = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function amsterdamTijd(timestamp: number): string {
  return tijdFormatter().format(timestamp);
}

/** Convert an explicit Dutch observation date/time, independent of device timezone. */
export function retourTijdstip(datum: string, tijd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(tijd)) return null;
  const basis = Date.parse(`${datum}T${tijd}:00Z`);
  if (!Number.isFinite(basis) || new Date(basis).toISOString().slice(0, 10) !== datum) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const alsUtc = (timestamp: number) => {
    const p = Object.fromEntries(parts.formatToParts(timestamp).map(part => [part.type, part.value]));
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  };
  let resultaat = basis - (alsUtc(basis) - basis);
  // A second pass handles a changed offset around daylight-saving transitions.
  resultaat -= alsUtc(resultaat) - basis;
  return alsUtc(resultaat) === basis ? resultaat : null;
}
