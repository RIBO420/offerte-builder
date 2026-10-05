"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExportDropdown } from "@/components/export-dropdown";
import { Input } from "@/components/ui/input";
import { SectiePaneel } from "@/components/ui/sectie-paneel";

/** Self-scoped server query; never downloads a full staff report to filter locally. */
export function EigenUrenExport({ weekStart }: { weekStart: string }) {
  const einde = new Date(`${weekStart}T12:00:00Z`); einde.setUTCDate(einde.getUTCDate() + 6);
  const [periode, setPeriode] = useState<{ van: string; tot: string } | null>(null);
  const van = periode?.van ?? weekStart, tot = periode?.tot ?? einde.toISOString().slice(0, 10);
  const geldig = /^\d{4}-\d{2}-\d{2}$/.test(van) && /^\d{4}-\d{2}-\d{2}$/.test(tot) && van <= tot && Date.parse(tot) - Date.parse(van) <= 366 * 86400000;
  const rapport = useQuery(api.urenRapportage.getPeriode, geldig ? { van, tot, bereik: "eigen" } : "skip");
  return <SectiePaneel titel="Mijn uren downloaden">
    <div className="grid gap-3 p-3">
      <p className="text-sm text-muted-foreground">Je eigen registraties en dagtotalen als CSV of Excel. Dagspan, gewerkte tijd en pauze blijven afzonderlijk zichtbaar.</p>
      <div className="grid max-w-md grid-cols-2 gap-3"><label className="text-sm">Vanaf<Input type="date" value={van} onChange={e => setPeriode({ van: e.target.value, tot })} /></label><label className="text-sm">Tot en met<Input type="date" value={tot} onChange={e => setPeriode({ van, tot: e.target.value })} /></label></div>
      {!geldig && <p role="alert" className="text-sm text-destructive">Kies een geldige periode van maximaal één jaar.</p>}
      <div className="flex flex-wrap gap-2">
        <ExportDropdown disabled={!geldig || !rapport?.registraties.length} buttonSize="sm" buttonLabel="Mijn registraties" filename={`mijn-uren-${van}-${tot}`} getData={() => (rapport?.registraties ?? []).map(r => ({ datum: r.datum, categorie: r.categorie, werksoort: r.werksoort ?? "", klant: r.klantNaam ?? "", begin: r.beginTijd, einde: r.eindTijd, minuten: r.minuten, status: r.status, notitie: r.notitie ?? "" }))} columns={[
          { key: "datum", header: "Datum" }, { key: "categorie", header: "Categorie" }, { key: "werksoort", header: "Werksoort" }, { key: "klant", header: "Klant" }, { key: "begin", header: "Begin" }, { key: "einde", header: "Einde" }, { key: "minuten", header: "Minuten" }, { key: "status", header: "Status" }, { key: "notitie", header: "Eigen notitie" },
        ]} />
        <ExportDropdown disabled={!geldig || !rapport?.dagen.length} buttonSize="sm" buttonLabel="Mijn dagtotalen" filename={`mijn-dagtotalen-${van}-${tot}`} getData={() => (rapport?.dagen ?? []).map(d => ({ datum: d.datum, status: d.status, dagspan: d.totalen.span, geregistreerd: d.totalen.geregistreerd, klantwerk: d.totalen.klantwerk, indirect: d.totalen.indirect, pauze: d.totalen.pauze, betaald: d.totalen.bronBetaald }))} columns={[
          { key: "datum", header: "Datum" }, { key: "status", header: "Dagstatus" }, { key: "dagspan", header: "Dagspan (minuten)" }, { key: "geregistreerd", header: "Geregistreerd (minuten)" }, { key: "klantwerk", header: "Klantwerk (minuten)" }, { key: "indirect", header: "Indirect (minuten)" }, { key: "pauze", header: "Pauze (minuten)" }, { key: "betaald", header: "Dagspan minus pauze (minuten)" },
        ]} />
      </div>
    </div>
  </SectiePaneel>;
}
