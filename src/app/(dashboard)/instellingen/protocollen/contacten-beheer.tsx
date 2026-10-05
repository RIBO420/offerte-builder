"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export function ContactenBeheer() {
  const rijen = useQuery(api.protocollen.listContacten, {});
  const opslaan = useMutation(api.protocollen.opslaanContact);
  const archiveer = useMutation(api.protocollen.archiveerContact);
  const [bestaand, setBestaand] = useState<Doc<"protocolContacten"> | null>(null);
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [spoed, setSpoed] = useState(false);
  const [volgorde, setVolgorde] = useState("0");
  const [bezig, setBezig] = useState(false);
  const bewerk = (r: Doc<"protocolContacten"> | null) => {
    setBestaand(r); setNaam(r?.naam ?? ""); setTelefoon(r?.telefoon ?? ""); setSpoed(r?.spoed ?? false); setVolgorde(String(r?.volgorde ?? 0)); setOpen(true);
  };
  return <SectiePaneel titel="Belangrijke telefoonnummers" telling={rijen?.length}>
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted-foreground">Deze nummers zijn rechtstreeks bereikbaar vanuit de protocolbibliotheek, ook zonder een gekoppeld stappenplan.</p>
      <Button variant="outline" onClick={() => bewerk(null)}>Telefoonnummer toevoegen</Button>
      {open && <form className="space-y-3 rounded-lg border p-3" onSubmit={async e => {
        e.preventDefault(); if (bezig) return; setBezig(true);
        try { await opslaan({ ...(bestaand ? { id: bestaand._id, expectedRevision: bestaand.revision } : {}), naam, telefoon, spoed, volgorde: Number(volgorde), actief: true }); setOpen(false); toast.success("Telefoonnummer gepubliceerd"); }
        catch (fout) { toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt"); }
        finally { setBezig(false); }
      }}>
        <label className="block text-sm">Naam<Input value={naam} onChange={e => setNaam(e.target.value)} maxLength={120} required /></label>
        <label className="block text-sm">Telefoon<Input type="tel" value={telefoon} onChange={e => setTelefoon(e.target.value)} maxLength={40} required /></label>
        <label className="block max-w-32 text-sm">Volgorde<Input type="number" value={volgorde} onChange={e => setVolgorde(e.target.value)} min={-10000} max={10000} step={1} required /></label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={spoed} onCheckedChange={v => setSpoed(v === true)} />Noodnummer</label>
        <div className="flex gap-2"><Button disabled={bezig} type="submit">Publiceren</Button><Button variant="ghost" type="button" onClick={() => setOpen(false)}>Annuleren</Button></div>
      </form>}
      {rijen === undefined ? <p role="status">Nummers laden…</p> : !rijen.length ? <p className="text-sm text-muted-foreground">Nog geen telefoonnummers toegevoegd.</p> : <ul className="divide-y">{rijen.map(r => <li key={r._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="font-medium">{r.naam}{r.spoed ? " · noodnummer" : ""}{!r.actief ? " · gearchiveerd" : ""}</p><a className="text-sm underline" href={`tel:${r.telefoon.replace(/[^+\d]/g, "")}`}>{r.telefoon}</a></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => bewerk(r)}>Bewerken</Button>{r.actief && <Button size="sm" variant="ghost" onClick={async () => {
          try { await archiveer({ id: r._id, expectedRevision: r.revision }); toast.success("Telefoonnummer gearchiveerd"); }
          catch (fout) { toast.error(fout instanceof Error ? fout.message : "Archiveren mislukt"); }
        }}>Archiveren</Button>}</div>
      </li>)}</ul>}
    </div>
  </SectiePaneel>;
}
