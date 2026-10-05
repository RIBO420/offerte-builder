"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Input } from "@/components/ui/input";
import { ExportDropdown } from "@/components/export-dropdown";
import { VeldDekkingPaneel } from "@/components/uren/veld-dekking-paneel";
import { WerkbezoekOverzicht } from "@/components/uren/werkbezoek-overzicht";
import { VeldRegistratieLijst } from "@/components/uren/veld-registratie-lijst";
import { HubExportDialog, ProjectUrenConflicten } from "@/components/uren/hub-export-dialog";

const uren = (minuten: number) => `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")}`;
const KEUZES: Record<string, string> = { geen_aanhanger: "Geen aanhanger", leeg: "Leeg", kwart: "¼ vol", half: "½ vol", driekwart: "¾ vol", vol: "Vol" };

export function VeldRapportagePaneel({ weekStart }: { weekStart: string }) {
  const [gekozenDag, setGekozenDag] = useState<string | null>(null);
  const datum = gekozenDag ?? weekStart;
  const eind = new Date(`${weekStart}T12:00:00Z`);
  eind.setUTCDate(eind.getUTCDate() + 6);
  const rapport = useQuery(api.urenRapportage.getPeriode, { van: weekStart, tot: eind.toISOString().slice(0, 10), bereik: "organisatie" });
  const retouren = useQuery(api.aanhangerRetouren.getOverzicht, { datum });
  return <div className="flex flex-col gap-4">
    <ProjectUrenConflicten />
    <VeldDekkingPaneel weekStart={weekStart} />
    <SectiePaneel titel="Velduren — dagtotalen">
      <div className="space-y-3 p-3">
        <p className="text-sm text-muted-foreground">Deze export gebruikt de dagregistraties uit de medewerkersapp. Dagspan en geregistreerde tijd blijven afzonderlijk zichtbaar.</p>
        <HubExportDialog />
        {rapport ? <>
          <p className="text-sm">Geregistreerd {uren(rapport.totalen.geregistreerd)} · Klantwerk {uren(rapport.totalen.klantwerk)} · Pauze {uren(rapport.totalen.pauze)}</p>
          <ExportDropdown
            getData={() => rapport.dagen.map(d => ({
              datum: d.datum, medewerker: d.medewerkerNaam, status: d.status,
              dagspan: d.totalen.span / 60, geregistreerd: d.totalen.geregistreerd / 60,
              klantwerk: d.totalen.klantwerk / 60, pauze: d.totalen.pauze / 60,
              betaald: d.totalen.bronBetaald / 60,
            }))}
            columns={[
              { key: "datum", header: "Datum" }, { key: "medewerker", header: "Medewerker" },
              { key: "status", header: "Status" }, { key: "dagspan", header: "Dagspan (uren)" },
              { key: "geregistreerd", header: "Geregistreerd (uren)" }, { key: "klantwerk", header: "Klantwerk (uren)" },
              { key: "pauze", header: "Pauze (uren)" }, { key: "betaald", header: "Dagspan minus pauze (uren)" },
            ]}
            filename={`velduren-${weekStart}`} buttonLabel="Velduren exporteren" disabled={!rapport.dagen.length}
          />
          {!rapport.dagen.length && <p className="text-sm text-muted-foreground">Nog geen velduren in deze week.</p>}
        </> : <p role="status" className="text-sm">Velduren laden…</p>}
      </div>
    </SectiePaneel>
    <VeldRegistratieLijst van={weekStart} tot={eind.toISOString().slice(0, 10)} />
    <WerkbezoekOverzicht datum={datum} />
    <SectiePaneel titel="Aanhangers terug">
      <div className="space-y-3 p-3">
        <label className="block max-w-48 text-sm">Dag<Input aria-label="Dag aanhangerretouren" type="date" value={datum} onChange={e => e.target.value && setGekozenDag(e.target.value)} /></label>
        {!retouren ? <p role="status" className="text-sm">Retourmeldingen laden…</p> : retouren.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen retourmeldingen voor deze dag. Dit betekent niet dat de aanhangers leeg zijn.</p> :
          <ul className="divide-y">{retouren.map(r => <li key={r._id} className="space-y-1 py-3 text-sm">
            <p className="font-medium">{r.voertuigNaam ?? "Geen aanhanger"} · {KEUZES[r.keuze]}</p>
            <p className="text-muted-foreground">{r.verantwoordelijkeNaam} · gemeld door {r.gemeldDoorNaam} · {new Date(r.waargenomenOp).toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" })}</p>
            {r.notitie && <p>{r.notitie}</p>}
            {r.revision > 1 && <p className="text-xs text-muted-foreground">Gecorrigeerd · versie {r.revision}</p>}
          </li>)}</ul>}
      </div>
    </SectiePaneel>
  </div>;
}
