"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
const DAGEN = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
export function VeldDekkingPaneel({ weekStart }: { weekStart: string }) {
  const [maandKeuze, setMaandKeuze] = useState<string | null>(null);
  const maand = maandKeuze ?? weekStart.slice(0, 7);
  const van = `${maand}-01`;
  const tot = new Date(Date.UTC(Number(maand.slice(0, 4)), Number(maand.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const rijen = useQuery(api.veldDekking.getPeriode, { van, tot });
  const [zoek, setZoek] = useState("");
  const [alleenOpen, setAlleenOpen] = useState(true);
  const selectie = rijen?.filter(r => r.medewerkerNaam.toLowerCase().includes(zoek.toLowerCase()) && (!alleenOpen || r.ontbrekendeBezoeken > 0 || r.status === "open" || r.status === "deels"));
  return <SectiePaneel titel="Indiening en klusdekking">
    <div className="space-y-3 p-3">
      <p className="text-sm text-muted-foreground">Een ingediende dag bewijst niet dat elke geplande klus is geregistreerd. Afwezigheid telt apart; een verdwenen planning overschrijft geen geboekte uren.</p>
      <div className="flex flex-wrap gap-3"><label className="text-sm">Maand<Input type="month" value={maand} onChange={e => e.target.value && setMaandKeuze(e.target.value)} /></label><label className="text-sm">Medewerker<Input value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek medewerker" /></label></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={alleenOpen} onCheckedChange={v => setAlleenOpen(v === true)} />Alleen dagen met open punten</label>
      {!selectie ? <p role="status">Dekking laden…</p> : !selectie.length ? <p className="text-sm text-muted-foreground">Geen dagen voor deze selectie.</p> : <div className="max-h-[32rem] overflow-y-auto divide-y">{selectie.map(r => <details key={`${r.medewerkerId}:${r.datum}`} className="py-3">
        <summary className="cursor-pointer text-sm"><span className="font-medium">{r.datum} · {r.medewerkerNaam}</span><span className="text-muted-foreground"> · {r.status} · {r.ontbrekendeBezoeken} ontbrekende klusregistraties</span></summary>
        <ul className="mt-2 space-y-1 text-sm">{r.bezoeken.map(b => <li key={b.werkitemId}><Link className="underline" href={`/projecten/${b.werkitemId}`}>{b.naam}</Link> · {b.gelogd ? "Uren aanwezig" : b.afwezig ? "Afwezig" : "Geen werkuren geregistreerd"}</li>)}</ul>
        {!r.bezoeken.length && <p className="mt-2 text-sm text-muted-foreground">Uren geregistreerd zonder een huidig gepland bezoek.</p>}
      </details>)}</div>}
      <HerinnerInstellingen />
    </div>
  </SectiePaneel>;
}
function HerinnerInstellingen() {
  const data = useQuery(api.veldHerinneringen.getInstellingen, {});
  const opslaan = useMutation(api.veldHerinneringen.opslaan);
  const [concept, setConcept] = useState<{ actief: boolean; ookEmail?: boolean; uurAmsterdam: number; dagOffset: 0 | -1; weekdagen: number[]; ontvangerIds: Id<"users">[] } | null>(null);
  const [bezig, setBezig] = useState(false);
  const waarden = concept ?? data?.instellingen ?? { actief: false, uurAmsterdam: 18, dagOffset: 0 as const, weekdagen: [1, 2, 3, 4, 5], ontvangerIds: [] };
  const wijzig = (patch: Partial<typeof waarden>) => setConcept({ actief: waarden.actief, ookEmail: waarden.ookEmail, uurAmsterdam: waarden.uurAmsterdam, dagOffset: waarden.dagOffset, weekdagen: waarden.weekdagen, ontvangerIds: waarden.ontvangerIds, ...patch });
  return <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Kantoorherinneringen</summary>
    <p className="my-3 text-sm text-muted-foreground">Een melding in de app bij open of deels ingediende dagen. Geen melding als er niets openstaat. Tijdzone: Amsterdam.</p>
    <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); if (!data || bezig) return; setBezig(true);
      try { await opslaan({ actief: waarden.actief, ookEmail: waarden.ookEmail ?? false, uurAmsterdam: waarden.uurAmsterdam, dagOffset: waarden.dagOffset, weekdagen: waarden.weekdagen, ontvangerIds: waarden.ontvangerIds }); setConcept(null); toast.success("Herinneringen opgeslagen"); }
      catch (fout) { toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt"); } finally { setBezig(false); }
    }}>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={waarden.actief} onCheckedChange={v => wijzig({ actief: v === true })} />Herinneringen actief</label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={waarden.ookEmail ?? false} onCheckedChange={v => wijzig({ ookEmail: v === true })} />Ook één samenvatting per e-mail naar deze kantoorontvangers</label>
      <div className="flex flex-wrap gap-3"><label className="max-w-32 text-sm">Uur (0–23)<Input type="number" min={0} max={23} step={1} value={waarden.uurAmsterdam} onChange={e => wijzig({ uurAmsterdam: Number(e.target.value) })} /></label><label className="text-sm">Registraties van<select className="block h-9 rounded-md border bg-background px-3" value={waarden.dagOffset} onChange={e => wijzig({ dagOffset: Number(e.target.value) as 0 | -1 })}><option value={0}>Vandaag</option><option value={-1}>Gisteren</option></select></label></div>
      <fieldset><legend className="mb-2 text-sm">Melden op</legend><div className="flex flex-wrap gap-3">{DAGEN.map((d, i) => <label key={d} className="flex items-center gap-1 text-sm"><Checkbox checked={waarden.weekdagen.includes(i)} onCheckedChange={v => wijzig({ weekdagen: v ? [...waarden.weekdagen, i] : waarden.weekdagen.filter(n => n !== i) })} />{d}</label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm">Ontvangers</legend><div className="flex flex-wrap gap-3">{data?.ontvangers.map(u => <label key={u.id} className="flex items-center gap-1 text-sm"><Checkbox checked={waarden.ontvangerIds.includes(u.id)} onCheckedChange={v => wijzig({ ontvangerIds: v ? [...waarden.ontvangerIds, u.id] : waarden.ontvangerIds.filter(id => id !== u.id) })} />{u.naam}</label>)}</div></fieldset>
      <Button disabled={!data || bezig} type="submit">Instellingen opslaan</Button>
      {!!data?.runs.length && <p className="text-xs text-muted-foreground">Laatste melding: {data.runs[0].datum} · {data.runs[0].openDagen} open dagen · {data.runs[0].ontvangers} ontvangers.</p>}
      {data?.runs[0]?.emailStatus && <p className="text-xs text-muted-foreground">E-mail: {data.runs[0].emailStatus}{data.runs[0].emailFout ? ` · ${data.runs[0].emailFout}` : ''}</p>}
    </form>
  </details>;
}
