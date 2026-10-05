/** Gehele minuten, expliciete betekenis. Een dagspan is geen som van werk. */
export interface UrenRegel {
  medewerkerId: string;
  datum: string;
  categorie: string;
  beginTijd: string;
  eindTijd: string;
  klantId?: string | null;
}

export interface UrenTotalen {
  span: number;
  geregistreerd: number;
  klantwerk: number;
  pauze: number;
  indirect: number;
  bronBetaald: number;
  perCategorie: Record<string, number>;
}

export function tijdMinuten(tijd: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tijd)) throw new Error("Ongeldige tijd");
  const [uur, minuut] = tijd.split(":").map(Number);
  return uur * 60 + minuut;
}

export function regelMinuten(regel: Pick<UrenRegel, "beginTijd" | "eindTijd">): number {
  const minuten = tijdMinuten(regel.eindTijd) - tijdMinuten(regel.beginTijd);
  if (minuten <= 0) throw new Error("De eindtijd moet na de begintijd liggen");
  return minuten;
}

export function berekenUrenTotalen(regels: UrenRegel[]): UrenTotalen {
  const perDag = new Map<string, { begin: number; eind: number; pauze: number }>();
  const perCategorie: Record<string, number> = {};
  for (const regel of regels) {
    const minuten = regelMinuten(regel);
    perCategorie[regel.categorie] = (perCategorie[regel.categorie] ?? 0) + minuten;
    const sleutel = `${regel.medewerkerId}|${regel.datum}`;
    const dag = perDag.get(sleutel) ?? { begin: Infinity, eind: 0, pauze: 0 };
    dag.begin = Math.min(dag.begin, tijdMinuten(regel.beginTijd));
    dag.eind = Math.max(dag.eind, tijdMinuten(regel.eindTijd));
    if (regel.categorie === "pauze") dag.pauze += minuten;
    perDag.set(sleutel, dag);
  }
  const dagen = [...perDag.values()];
  const span = dagen.reduce((n, dag) => n + dag.eind - dag.begin, 0);
  const geregistreerd = Object.values(perCategorie).reduce((a, b) => a + b, 0);
  const klantwerk = perCategorie.werken ?? 0;
  const pauze = perCategorie.pauze ?? 0;
  return {
    span, geregistreerd, klantwerk, pauze,
    indirect: geregistreerd - klantwerk - pauze,
    bronBetaald: dagen.reduce((n, dag) => n + Math.max(0, dag.eind - dag.begin - dag.pauze), 0),
    perCategorie,
  };
}

/** Eerst de hele persoon-dag verdelen, pas daarna klanten filteren. */
export function verdeelPauzeOverKlanten(regels: UrenRegel[]): Map<string, number> {
  const dagen = new Map<string, { datum: string; pauze: number; werk: Map<string, number> }>();
  const resultaat = new Map<string, number>();
  const voegToe = (datum: string, klant: string, minuten: number) => {
    const sleutel = `${datum}|${klant}`;
    resultaat.set(sleutel, (resultaat.get(sleutel) ?? 0) + minuten);
  };
  for (const regel of regels) {
    const minuten = regelMinuten(regel);
    const sleutel = `${regel.medewerkerId}|${regel.datum}`;
    const dag = dagen.get(sleutel) ?? { datum: regel.datum, pauze: 0, werk: new Map<string, number>() };
    if (regel.categorie === "pauze") {
      if (regel.klantId) voegToe(regel.datum, regel.klantId, minuten);
      else dag.pauze += minuten;
    } else if (regel.categorie === "werken" && regel.klantId) {
      dag.werk.set(regel.klantId, (dag.werk.get(regel.klantId) ?? 0) + minuten);
    }
    dagen.set(sleutel, dag);
  }
  for (const dag of dagen.values()) {
    const werk = [...dag.werk].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const totaal = werk.reduce((n, [, minuten]) => n + minuten, 0);
    if (!totaal || !dag.pauze) continue;
    const verdeling = werk.map(([klant, minuten]) => ({ klant, minuten: Math.floor(dag.pauze * minuten / totaal) }));
    verdeling[0].minuten += dag.pauze - verdeling.reduce((n, r) => n + r.minuten, 0);
    for (const rij of verdeling) voegToe(dag.datum, rij.klant, rij.minuten);
  }
  return resultaat;
}

export function valideerUrenPeriode(van: string, tot: string): void {
  const geldig = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!geldig(van) || !geldig(tot) || van > tot) throw new Error("Kies een geldige periode");
  if ((Date.parse(tot) - Date.parse(van)) / 86400000 > 366) throw new Error("Kies maximaal één jaar");
}
