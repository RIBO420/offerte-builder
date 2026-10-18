"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { downloadHubExport, exportMaandVensters, type HubExportType, type HubFacturatieInhoud } from "@/lib/hub-export";

export function HubExportDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<HubExportType>("salaris");
  const vandaag = new Date().toLocaleDateString("sv-SE");
  const [van, setVan] = useState(`${vandaag.slice(0, 7)}-01`);
  const [tot, setTot] = useState(vandaag);
  const [medewerkerIds, setMedewerkerIds] = useState<string[] | null>(null);
  const [klantIds, setKlantIds] = useState<string[] | null>(null);
  const [inhoud, setInhoud] = useState<HubFacturatieInhoud>("alles");
  const [bezig, setBezig] = useState(false);
  const queryVan = type === "jaarrapportage" ? `${van.slice(0, 4)}-01-01` : van;
  const queryTot = type === "jaarrapportage" ? `${van.slice(0, 4)}-12-31` : tot;
  const geldig = /^\d{4}-\d{2}-\d{2}$/.test(queryVan) && /^\d{4}-\d{2}-\d{2}$/.test(queryTot) && queryVan <= queryTot && (Date.parse(queryTot) - Date.parse(queryVan)) / 86400000 <= 366;
  const convex = useConvex();
  const keuzes = useQuery(api.urenRapportage.getExportKeuzes, open ? {} : "skip");
  const medewerkers = (keuzes?.medewerkers ?? []).map(m => [m.id, m.naam] as const).sort((a, b) => a[1].localeCompare(b[1]));
  const klanten = (keuzes?.klanten ?? []).map(k => [k.id, k.naam] as const).sort((a, b) => a[1].localeCompare(b[1]));
  const selectieGeldig = medewerkerIds?.length !== 0 && (type === "salaris" || klantIds?.length !== 0);
  const downloaden = async () => {
    if (!geldig || !selectieGeldig) return;
    setBezig(true);
    try {
      const delen = [];
      for (const venster of exportMaandVensters(queryVan, queryTot)) {
        delen.push(await convex.query(api.urenRapportage.getPeriode, { ...venster, bereik: "organisatie" }));
      }
      const rapport = {
        registraties: [...new Map(delen.flatMap(d => d.registraties).map(r => [r.id, r])).values()],
        bezoeken: [...new Map(delen.flatMap(d => d.bezoeken).map(b => [`${b.werkitemId}|${b.datum}`, b])).values()],
        afvoer: [...new Map(delen.flatMap(d => d.afvoer).map(a => [a.id, a])).values()],
      };
      await downloadHubExport(type, rapport.registraties, {
        van: queryVan, tot: queryTot, medewerkerIds: medewerkerIds ?? undefined, klantIds: type === "salaris" ? undefined : klantIds ?? undefined,
        facturatieInhoud: type === "facturatie" ? inhoud : undefined, bezoeken: rapport.bezoeken, afvoer: rapport.afvoer,
      });
      toast.success("Excel-export gedownload");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Export mislukt"); }
    finally { setBezig(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><Download className="size-4" />Excel-sjablonen</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Uren exporteren</DialogTitle><DialogDescription>Salaris, facturatie of jaarrapportage in het vertrouwde Excel-sjabloon.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label htmlFor="hub-export-type">Export</Label><Select value={type} onValueChange={v => setType(v as HubExportType)}><SelectTrigger id="hub-export-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="salaris">Salaris</SelectItem><SelectItem value="facturatie">Facturatie</SelectItem><SelectItem value="jaarrapportage">Jaarrapportage</SelectItem></SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="hub-export-van">Vanaf</Label><Input id="hub-export-van" type="date" value={van} onChange={e => setVan(e.target.value)} /></div><div className="grid gap-2"><Label htmlFor="hub-export-tot">Tot en met</Label><Input id="hub-export-tot" type="date" disabled={type === "jaarrapportage"} value={queryTot} onChange={e => setTot(e.target.value)} /></div></div>
        {type === "jaarrapportage" && <p className="text-sm text-muted-foreground">De jaarrapportage bevat het hele jaar {van.slice(0, 4)}.</p>}
        <ExportMeerkeuze label="Medewerkers" opties={medewerkers} waarde={medewerkerIds} onChange={setMedewerkerIds} disabled={bezig || !keuzes} />
        {type !== "salaris" && <ExportMeerkeuze label="Klanten" opties={klanten} waarde={klantIds} onChange={setKlantIds} disabled={bezig || !keuzes} />}
        {type === "facturatie" && <div className="grid gap-2"><Label htmlFor="hub-export-inhoud">Wat telt mee</Label><Select value={inhoud} onValueChange={v => setInhoud(v as HubFacturatieInhoud)}><SelectTrigger id="hub-export-inhoud"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alles">Alles</SelectItem><SelectItem value="werk">Alleen werk</SelectItem><SelectItem value="werkpauze">Werk + pauze</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">{inhoud === "alles" ? "Alle registraties gaan mee. Het sjabloon rekent klantwerk als factureerbaar." : inhoud === "werk" ? "Alleen klantwerk gaat mee; reis- en pauzeregels blijven buiten deze export." : "Klantwerk en pauzes gaan mee. Een pauze bij een klant wordt direct toegerekend; overige pauzes naar rato van het werk per medewerkerdag."}</p></div>}
        <p className="text-xs text-muted-foreground">Alle vastgelegde segmenten in de selectie gaan mee, ook nog niet ingediende dagen. Controleer de periode voor verwerking.</p>
        {!geldig && <p role="alert" className="text-sm text-destructive">Kies een geldige periode van maximaal één jaar.</p>}
        {!selectieGeldig && <p role="alert" className="text-sm text-destructive">{type === "salaris" ? "Selecteer ten minste één medewerker, of kies alle medewerkers." : "Selecteer ten minste één medewerker en klant, of kies alles."}</p>}
        <Button disabled={!keuzes || !geldig || !selectieGeldig || bezig} onClick={downloaden}>{bezig ? "Export maken…" : "Excel downloaden"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

/** null means all, [] deliberately means none; a search never changes the selection. */
function ExportMeerkeuze({ label, opties, waarde, onChange, disabled }: {
  label: string; opties: ReadonlyArray<readonly [string, string]>;
  waarde: string[] | null; onChange: (ids: string[] | null) => void; disabled: boolean;
}) {
  const [zoek, setZoek] = useState("");
  const zichtbaar = opties.filter(([, naam]) => naam.toLocaleLowerCase("nl").includes(zoek.trim().toLocaleLowerCase("nl")));
  const wijzigen = (id: string, aan: boolean) => {
    const ids = new Set(waarde ?? opties.map(([optieId]) => optieId));
    if (aan) ids.add(id); else ids.delete(id);
    onChange([...ids]);
  };
  return <details className="rounded-md border px-3 py-2">
    <summary className="cursor-pointer text-sm font-medium tabular-nums">{label}: {waarde === null ? "alles" : `${waarde.length} geselecteerd`}</summary>
    <div className="mt-3 grid gap-3">
      <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(null)}>Alles kiezen</Button><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([])}>Selectie wissen</Button></div>
      <Input aria-label={`${label} zoeken`} placeholder={`${label} zoeken…`} value={zoek} onChange={e => setZoek(e.target.value)} disabled={disabled} />
      <div role="group" aria-label={label} className="grid max-h-40 gap-2 overflow-y-auto">
        {zichtbaar.map(([id, naam]) => <label key={id} className="flex min-w-0 cursor-pointer items-center gap-2 text-sm"><Checkbox disabled={disabled} checked={waarde === null || waarde.includes(id)} onCheckedChange={aan => wijzigen(id, aan === true)} /><span className="break-words">{naam}</span></label>)}
        {!zichtbaar.length && <p className="text-sm text-muted-foreground">Geen resultaten.</p>}
      </div>
    </div>
  </details>;
}

type ProjectUrenConflict = { projectId: Id<"projecten">; naam: string; legacyMinuten: number; segmentMinuten: number };

/** Eén conflictproject: kiest de bron met de minuten uit de conflictlijst, zonder eigen query. */
function ConflictRij({ conflict }: { conflict: ProjectUrenConflict }) {
  const bewaren = useMutation(api.urenRapportage.setProjectUrenBron);
  const [bezig, setBezig] = useState(false);
  const selectId = `urenbron-${conflict.projectId}`;
  const wijzigen = async (bron: "auto" | "legacy" | "segmenten") => {
    setBezig(true);
    try { await bewaren({ projectId: conflict.projectId, bron }); toast.success("Urenbron bijgewerkt"); }
    catch (e) { toast.error(getMutationErrorMessage(e)); }
    finally { setBezig(false); }
  };
  return <li className="grid gap-2 py-3">
    <Link className="text-sm font-medium underline underline-offset-4" href={`/projecten/${conflict.projectId}/nacalculatie`}>{conflict.naam}</Link>
    <Label htmlFor={selectId} className="sr-only">Urenbron voor {conflict.naam}</Label>
    {/* Een conflict heeft per definitie geen expliciete keuze: start op "auto". */}
    <Select disabled={bezig} value="auto" onValueChange={v => wijzigen(v as "auto" | "legacy" | "segmenten")}><SelectTrigger id={selectId}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Nog niet gekozen</SelectItem><SelectItem value="segmenten"><span className="tabular-nums">Dagsegmenten ({(conflict.segmentMinuten / 60).toFixed(2)} uur)</span></SelectItem><SelectItem value="legacy"><span className="tabular-nums">Projectregistraties ({(conflict.legacyMinuten / 60).toFixed(2)} uur)</span></SelectItem></SelectContent></Select>
  </li>;
}

/**
 * Independent of report queries, so ambiguous ledgers can always be resolved.
 * De lijst met keuzes staat pas in de DOM als je hem openklapt; per project
 * geen eigen query, de minuten komen uit de conflictlijst.
 */
export function ProjectUrenConflicten() {
  const conflicten = useQuery(api.urenRapportage.getProjectUrenConflicten, {});
  const [open, setOpen] = useState(false);
  if (!conflicten?.length) return null;
  return <details className="rounded-lg border border-amber-300 bg-amber-50/40 p-4 dark:border-amber-800 dark:bg-amber-950/20" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer font-medium">Kies de urenbron voor <span className="tabular-nums">{conflicten.length}</span> {conflicten.length === 1 ? "project" : "projecten"}</summary>
    <p className="mt-2 text-sm text-muted-foreground">Deze projecten bevatten zowel historische projectregistraties als dagsegmenten. Kosten en rapportages wachten op een keuze om dubbeltelling te voorkomen.</p>
    {open && <ul className="divide-y">{conflicten.map(p => <ConflictRij key={p.projectId} conflict={p} />)}</ul>}
  </details>;
}
