"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportMaandVensters } from "@/lib/hub-export";
import { filterRegistraties, legeRegistratieFilters, type RegistratieFilters } from "@/lib/veld-registratie-filter";

type Registratie = FunctionReturnType<typeof api.urenRapportage.getPeriode>["registraties"][number];
const CATEGORIE: Record<string, string> = { werken: "Werken", pauze: "Pauze", reistijd: "Rijden", loods: "Loods", laden: "Laden/lossen", onderhoud_materiaal: "Materieel onderhouden", afvalverwerker_bes: "Afvalverwerker BES", teammeeting: "Ploegoverleg", anders: "Anders" };
const STATUS: Record<string, string> = { concept: "Concept", bevestigd: "Open", ingediend: "Ingediend" };
const duur = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const selectKlasse = "block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

export function VeldRegistratieLijst({ van, tot }: { van: string; tot: string }) {
  const { userId, orgId } = useAuth();
  if (!userId || !orgId) return null;
  return <Registraties key={`${userId}:${orgId}:${van}:${tot}`} begin={van} einde={tot} userId={userId} orgId={orgId} />;
}
function Registraties({ begin, einde, userId, orgId }: { begin: string; einde: string; userId: string; orgId: string }) {
  const convex = useConvex();
  const liveKeuzes = useQuery(api.urenRapportage.getExportKeuzes, {});
  const keuzes = liveKeuzes?.scope?.userId === userId && liveKeuzes.scope.orgId === orgId ? liveKeuzes : undefined;
  const [van, setVan] = useState(begin), [tot, setTot] = useState(einde);
  const [periode, setPeriode] = useState({ van: begin, tot: einde, versie: 0 });
  const [regels, setRegels] = useState<Registratie[] | null>(null);
  const [laden, setLaden] = useState(true), [geladenDelen, setGeladenDelen] = useState(0);
  const [fout, setFout] = useState<string | null>(null), [formulierFout, setFormulierFout] = useState<string | null>(null);
  const [filters, setFilters] = useState<RegistratieFilters>(legeRegistratieFilters);
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    let actief = true;
    const lees = async () => {
      try {
        const alles: Registratie[] = [];
        for (const venster of exportMaandVensters(periode.van, periode.tot)) {
          const result = await convex.query(api.urenRapportage.getPeriode, { ...venster, bereik: "organisatie" });
          if (!actief) return;
          if (result.scope?.userId !== userId || result.scope.orgId !== orgId) throw new Error("De organisatie is gewijzigd. Vernieuw het overzicht nadat je account is geladen.");
          alles.push(...result.registraties);
          setGeladenDelen(v => v + 1);
        }
        if (actief) setRegels(filterRegistraties(alles, legeRegistratieFilters));
      } catch (error) { if (actief) { setRegels(null); setFout(error instanceof Error ? error.message : "Registraties laden mislukt"); } }
      finally { if (actief) setLaden(false); }
    };
    void lees();
    return () => { actief = false; };
  }, [convex, periode, userId, orgId]);
  const filter = (key: keyof RegistratieFilters, value: string) => { setFilters(v => ({ ...v, [key]: value })); setPagina(0); };
  const selectie = useMemo(() => filterRegistraties(regels ?? [], filters), [regels, filters]);
  const categorien = useMemo(() => [...new Set((regels ?? []).map(r => r.categorie))].sort((a, b) => (CATEGORIE[a] ?? a).localeCompare(CATEGORIE[b] ?? b)), [regels]);
  const geregistreerdMinuten = useMemo(() => selectie.reduce((n, r) => n + r.minuten, 0), [selectie]);
  const paginaAantal = Math.max(1, Math.ceil(selectie.length / 50));
  const huidigePagina = Math.min(pagina, paginaAantal - 1);
  const zichtbaar = selectie.slice(huidigePagina * 50, huidigePagina * 50 + 50);
  const vernieuw = () => {
    try { exportMaandVensters(van, tot); }
    catch (error) { setFormulierFout(error instanceof Error ? error.message : "Kies een geldige periode"); return; }
    setFormulierFout(null); setFout(null); setRegels(null); setLaden(true); setGeladenDelen(0); setPagina(0);
    setPeriode(v => ({ van, tot, versie: v.versie + 1 }));
  };
  return <SectiePaneel titel="Urenregistraties" telling={laden ? undefined : selectie.length}>
    <div className="space-y-4 p-3">
      <p className="text-sm text-muted-foreground">Bekijk de vastgelegde dagsegmenten. Kies een periode van maximaal één jaar. De filters voor medewerkers en klanten blijven onafhankelijk beschikbaar.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); vernieuw(); }}>
        <label className="text-sm">Vanaf<Input aria-label="Registraties vanaf" type="date" value={van} onChange={e => setVan(e.target.value)} /></label>
        <label className="text-sm">Tot en met<Input aria-label="Registraties tot en met" type="date" value={tot} onChange={e => setTot(e.target.value)} /></label>
        <Button type="submit" variant="outline">{laden ? "Andere periode laden" : "Toon / vernieuw registraties"}</Button>
      </form>
      {formulierFout && <p role="alert" className="text-sm text-destructive">{formulierFout}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-sm">Medewerker<select aria-label="Filter registraties op medewerker" className={selectKlasse} value={filters.medewerker} onChange={e => filter("medewerker", e.target.value)}><option value="alle">Alle medewerkers</option>{[...(keuzes?.medewerkers ?? [])].sort((a, b) => a.naam.localeCompare(b.naam)).map(m => <option key={m.id} value={m.id}>{m.naam}</option>)}</select></label>
        <label className="min-w-0 text-sm">Klant<select aria-label="Filter registraties op klant" className={selectKlasse} value={filters.klant} onChange={e => filter("klant", e.target.value)}><option value="alle">Alle klanten</option><option value="zonder">Zonder klant</option>{[...(keuzes?.klanten ?? [])].sort((a, b) => a.naam.localeCompare(b.naam)).map(k => <option key={k.id} value={k.id}>{k.naam}</option>)}</select></label>
        <label className="min-w-0 text-sm">Categorie<select aria-label="Filter registraties op categorie" className={selectKlasse} value={filters.categorie} onChange={e => filter("categorie", e.target.value)}><option value="alle">Alle categorieën</option>{categorien.map(c => <option key={c} value={c}>{CATEGORIE[c] ?? c}</option>)}{filters.categorie !== "alle" && !categorien.includes(filters.categorie as Registratie["categorie"]) && <option value={filters.categorie}>{CATEGORIE[filters.categorie] ?? filters.categorie} (niet in periode)</option>}</select></label>
        <label className="min-w-0 text-sm">Status<select aria-label="Filter registraties op status" className={selectKlasse} value={filters.status} onChange={e => filter("status", e.target.value)}><option value="alle">Alle statussen</option>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <Button size="sm" variant="ghost" onClick={() => { setFilters(legeRegistratieFilters); setPagina(0); }}>Filters wissen</Button>
      {laden ? <p role="status" className="text-sm">Registraties laden… {geladenDelen > 0 ? `${geladenDelen} maanddelen gelezen` : ""}</p> : fout ? <div><p role="alert" className="text-sm text-destructive">{fout}</p><p className="text-xs text-muted-foreground">Er worden geen gedeeltelijke resultaten getoond. Probeer opnieuw of kies een kleinere periode.</p></div> : <>
        <p className="text-sm tabular-nums">{periode.van} t/m {periode.tot} · {selectie.length} registraties · {duur(geregistreerdMinuten)} uur geregistreerde tijd in deze selectie</p>
        {!selectie.length ? <p className="text-sm text-muted-foreground">Geen registraties voor deze filters.</p> : <ol aria-label="Gevonden urenregistraties" className="divide-y">{zichtbaar.map(r => <li key={r.id} className="space-y-2 py-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{r.medewerkerNaam} · {r.datum}</span><span className="tabular-nums">{r.beginTijd}–{r.eindTijd} · {duur(r.minuten)} uur · {STATUS[r.status] ?? r.status}</span></div>
          <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2"><p className="break-words">Klant: {r.klantNaam ?? "Zonder klant"}{r.werkitemNaam ? ` · ${r.werkitemNaam}` : ""}</p><p>Categorie: {CATEGORIE[r.categorie] ?? r.categorie} · Werksoort: {r.werksoort ?? "Niet vastgelegd"}</p><p>Ingevoerd door: {r.ingevoerdDoorNaam ?? "Niet vastgelegd"}</p></div>
          {r.notitie && <p className="whitespace-pre-wrap break-words text-sm">{r.notitie}</p>}
        </li>)}</ol>}
        {paginaAantal > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" size="sm" disabled={huidigePagina === 0} onClick={() => setPagina(v => v - 1)}>Vorige 50</Button><span className="text-sm tabular-nums">Pagina {huidigePagina + 1} van {paginaAantal}</span><Button variant="outline" size="sm" disabled={huidigePagina + 1 >= paginaAantal} onClick={() => setPagina(v => v + 1)}>Volgende 50</Button></div>}
      </>}
    </div>
  </SectiePaneel>;
}
