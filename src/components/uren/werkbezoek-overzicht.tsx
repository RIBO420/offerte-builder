"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
const keuzes: Record<string, string> = { geen: "Geen afvoer", kwart: "¼", half: "½", driekwart: "¾", vol: "Vol" };
const euro = (cent: number) => (cent / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function WerkbezoekOverzicht({ datum }: { datum: string }) {
  const data = useQuery(api.werkbezoek.getKantoorDag, { datum });
  const tarieven = useQuery(api.werkbezoek.getAfvoerTarieven, {});
  const zetTarief = useMutation(api.werkbezoek.stelAfvoerTariefIn);
  const meldAfvoer = useMutation(api.werkbezoek.meldAfvoer);
  const [zoek, setZoek] = useState("");
  const [geldigVanaf, setGeldigVanaf] = useState(datum);
  const [tarief, setTarief] = useState("");
  const [bezig, setBezig] = useState(false);
  const [bedragen, setBedragen] = useState<Record<string, string>>({});
  const bezoeken = data?.bezoeken.filter(b => `${b.naam} ${b.klantNaam ?? ""}`.toLocaleLowerCase("nl").includes(zoek.toLocaleLowerCase("nl")));
  return <SectiePaneel titel="Klusmeldingen en foto's" telling={bezoeken?.length}>
    <div className="space-y-4 p-3">
      <Input aria-label="Zoek klant of klus in bezoekmeldingen" placeholder="Zoek klant of klus" value={zoek} onChange={e => setZoek(e.target.value)} />
      {data === undefined ? <p role="status">Klusmeldingen laden…</p> : !bezoeken?.length ? <p className="text-sm text-muted-foreground">Geen bezoeken voor deze selectie.</p> : bezoeken.map(b => <article key={b.bezoekSleutel} className="space-y-3 border-b py-3 last:border-0">
        <div><Link className="font-medium hover:underline" href={`/projecten/${b.werkitemId}`}>{b.naam}</Link><p className="text-sm text-muted-foreground">{b.klantNaam} · {datum}</p></div>
        <KlusInstructie werkitemId={b.werkitemId} datum={datum} naam={b.naam} categorie={b.uitvoeringCategorie} instructie={b.instructie} updatedAt={b.werkitemUpdatedAt} klantId={b.klantId} klantNaam={b.klantNaam} eigenAdres={b.eigenAdres} bescherming={b.relatieBescherming} />
        <BezoekBemanning key={`${b.werkitemId}:${JSON.stringify(b.toegewezenMedewerkerIds)}`} werkitemId={b.werkitemId} datum={datum} override={b.toegewezenMedewerkerIds} effectieveIds={b.bemanningIds} medewerkers={data.medewerkers} />
        <p className="text-sm">{b.afronding ? `${b.afronding.afgerond ? "Afgerond" : "Niet afgerond"} · ${b.afronding.doorNaam}` : "Afronding nog niet gemeld"}</p>
        {b.afronding?.reden && <p className="text-sm tabular-nums">{b.afronding.reden}{b.afronding.resterendMinuten !== undefined ? ` · nog ongeveer ${b.afronding.resterendMinuten} minuten` : ""}</p>}
        {!!b.ontbreekt.length && <p className="text-sm text-amber-700 dark:text-amber-400">Nog open: {b.ontbreekt.join(", ")}</p>}
        {!!b.delegaties.length && <ul className="space-y-1 text-sm text-muted-foreground">{b.delegaties.map(d => <li key={d._id}>{d.doorNaam} laat {d.onderdeel} door een collega invullen. Het gedeelde antwoord blijft nodig.</li>)}</ul>}
        <p className="text-sm tabular-nums">Afvoer bij deze klus: {b.afvoer ? `${keuzes[b.afvoer.keuze]} · ${b.afvoer.bedragCent === undefined ? "Bedrag nog controleren" : euro(b.afvoer.bedragCent)}` : "Nog niet gemeld"}</p>
        {b.afvoer && <form className="flex flex-wrap items-end gap-2" onSubmit={async e => {
          e.preventDefault(); if (!b.afvoer || bezig) return;
          const bedragCent = Math.round(Number((bedragen[b.bezoekSleutel] ?? "").replace(",", ".")) * 100);
          if (!Number.isFinite(bedragCent) || bedragCent < 0 || !(bedragen[b.bezoekSleutel] ?? "").trim()) return toast.error("Vul een geldig bedrag in");
          setBezig(true);
          try { await meldAfvoer({ werkitemId: b.werkitemId, datum, keuze: b.afvoer.keuze, expectedRevision: b.afvoer.revision, bedragCent, sleutel: crypto.randomUUID() }); setBedragen(v => ({ ...v, [b.bezoekSleutel]: "" })); toast.success("Afvoerbedrag vastgelegd"); }
          catch (fout) { toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt"); } finally { setBezig(false); }
        }}><label className="max-w-40 text-xs">Afvoerbedrag (€)<Input aria-label={`Afvoerbedrag ${b.naam}`} inputMode="decimal" className="tabular-nums" value={bedragen[b.bezoekSleutel] ?? ""} onChange={e => setBedragen(v => ({ ...v, [b.bezoekSleutel]: e.target.value }))} /></label><Button disabled={bezig} size="sm" variant="outline" type="submit">Bedrag bevestigen</Button></form>}
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">{b.fotos.map(f => f.url && <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 space-y-1 rounded-lg border p-2">
          {/* Signed storage URLs carry image access; native image keeps that URL intact. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={`${f.fase === "voor" ? "Voorfoto" : "Nafoto"} bij ${b.naam}`} loading="lazy" className="aspect-square w-full rounded object-cover" />
          <span className="block truncate text-xs">{f.fase === "voor" ? "Voor" : "Na"} · {f.doorNaam}</span><span className="block text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}</span>
        </a>)}</div>
      </article>)}
      <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Afvoertarieven beheren</summary>
        <p className="my-3 text-sm text-muted-foreground">Een nieuw tarief geldt voor volgende klusmeldingen vanaf de gekozen datum. Eerdere bedragen blijven bewaard. Een retourmelding van een aanhanger levert geen kosten op.</p>
        <ul className="mb-3 text-sm">{tarieven?.map(t => <li key={t._id}>Vanaf {t.geldigVanaf}: {euro(t.volTariefCent)} voor vol</li>)}</ul>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async e => {
          e.preventDefault(); if (bezig) return;
          const volTariefCent = Math.round(Number(tarief.replace(",", ".")) * 100);
          if (!tarief.trim() || !Number.isFinite(volTariefCent) || volTariefCent < 0) return toast.error("Vul een geldig tarief in");
          setBezig(true);
          try { await zetTarief({ geldigVanaf, volTariefCent }); setTarief(""); toast.success("Tarief opgeslagen"); }
          catch (fout) { toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt"); } finally { setBezig(false); }
        }}><label className="text-sm">Geldig vanaf<Input type="date" value={geldigVanaf} onChange={e => setGeldigVanaf(e.target.value)} required /></label><label className="max-w-36 text-sm">Vol tarief (€)<Input inputMode="decimal" value={tarief} onChange={e => setTarief(e.target.value)} required /></label><Button type="submit" disabled={bezig}>Tarief opslaan</Button></form>
      </details>
    </div>
  </SectiePaneel>;
}


function BezoekBemanning({ werkitemId, datum, override, effectieveIds, medewerkers }: {
  werkitemId: Id<"projecten">; datum: string; override: Id<"medewerkers">[] | null;
  effectieveIds: Id<"medewerkers">[]; medewerkers: Array<{ id: Id<"medewerkers">; naam: string }>;
}) {
  const opslaan = useMutation(api.werkbezoek.stelBemanningIn);
  const [ploeg, setPloeg] = useState(override === null);
  const [ids, setIds] = useState<Id<"medewerkers">[]>(override ?? effectieveIds);
  const [busy, setBusy] = useState(false);
  const namen = effectieveIds.map(id => medewerkers.find(m => m.id === id)?.naam ?? "Onbekende medewerker");
  return <details className="rounded border p-3">
    <summary className="cursor-pointer text-sm">Medewerkers: {namen.join(", ") || "niemand toegewezen"}</summary>
    <div className="mt-3 space-y-3">
      <p className="text-sm font-medium">Medewerkers voor deze klus (alle geplande dagen)</p>
      <p className="text-xs text-muted-foreground">Geregistreerde uren en eerdere bezoekmeldingen blijven behouden. Een expliciet lege selectie betekent dat niemand is ingepland.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ploeg} disabled={busy} onChange={e => setPloeg(e.target.checked)} />Dagbemanning van de ploeg volgen</label>
      {!ploeg && <div className="flex flex-wrap gap-x-4 gap-y-2">{medewerkers.map(m => <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={ids.includes(m.id)} onChange={e => setIds(v => e.target.checked ? [...v, m.id] : v.filter(id => id !== m.id))} />{m.naam}</label>)}</div>}
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await opslaan({ werkitemId, datum, verwachteMedewerkerIds: override, ...(ploeg ? {} : { medewerkerIds: ids }) }); toast.success("Bezetting voor alle geplande dagen opgeslagen"); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Bezetting opslaan mislukt"); } finally { setBusy(false); }
      }}>Bezetting opslaan</Button>
    </div>
  </details>;
}


function KlusInstructie({ werkitemId, datum, naam, categorie, instructie, updatedAt, klantId, klantNaam, eigenAdres, bescherming }: {
  werkitemId: Id<"projecten">; datum: string; naam: string; categorie: "aanleg" | "onderhoud" | null; instructie: string | null; updatedAt: number;
  klantId: Id<"klanten"> | null; klantNaam: string | null; eigenAdres: string | null; bescherming: { klant: string | null; locatie: string | null };
}) {
  const opslaan = useMutation(api.werkbezoek.wijzigKlusInstructie);
  const [concept, setConcept] = useState<{ naam: string; categorie: string; instructie: string; updatedAt: number; klantId: Id<"klanten"> | null; eigenAdres: boolean; adres: string } | null>(null);
  const klanten = useQuery(api.klanten.list, concept ? {} : "skip");
  const [busy, setBusy] = useState(false);
  return <div className="space-y-2">
    {instructie && <p className="whitespace-pre-wrap break-words text-sm">{instructie}</p>}
    {!concept ? <Button size="sm" variant="ghost" onClick={() => setConcept({ naam, categorie: categorie ?? "", instructie: instructie ?? "", updatedAt, klantId, eigenAdres: !!eigenAdres, adres: eigenAdres ?? "" })}>Klus bewerken</Button> : <form className="space-y-3 rounded border p-3" onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true);
      try { await opslaan({ werkitemId, datum, naam: concept.naam, instructie: concept.instructie, expectedUpdatedAt: concept.updatedAt, ...(concept.categorie ? { categorie: concept.categorie as "aanleg" | "onderhoud" } : {}), ...(concept.klantId ? { klantId: concept.klantId } : {}), adres: concept.eigenAdres ? concept.adres : null }); setConcept(null); toast.success("Klus opgeslagen"); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Klusomschrijving opslaan mislukt"); } finally { setBusy(false); }
    }}>
      <p className="text-xs text-muted-foreground">Deze omschrijving geldt voor de hele klus. Bestaande uren en eerdere bezoekmeldingen blijven behouden.</p>
      <label className="block text-sm">Omschrijving<Input maxLength={300} value={concept.naam} disabled={busy} onChange={e => setConcept({ ...concept, naam: e.target.value })} required /></label>
      <label className="block text-sm">Categorie<select className="block h-10 w-full rounded border bg-background px-3 text-sm" value={concept.categorie} disabled={busy} onChange={e => setConcept({ ...concept, categorie: e.target.value })}><option value="">Niet opgegeven</option><option value="aanleg">Aanleg</option><option value="onderhoud">Onderhoud</option></select></label>
      <label className="block text-sm">Klant<select className="block h-10 w-full rounded border bg-background px-3 text-sm" value={concept.klantId ?? ""} disabled={busy || !!bescherming.klant || klanten === undefined} onChange={e => {
        const gekozen = klanten?.find(k => k._id === e.target.value);
        if (gekozen) setConcept({ ...concept, klantId: gekozen._id, eigenAdres: false, adres: "" });
      }}>
        {!concept.klantId && <option value="">Kies een klant</option>}
        {klantId && !klanten?.some(k => k._id === klantId) && <option value={klantId}>{klantNaam ?? "Huidige klant"}</option>}
        {klanten?.map(k => <option key={k._id} value={k._id}>{k.naam} · {k.plaats}</option>)}
      </select></label>
      {bescherming.klant && <p className="text-xs text-muted-foreground">{bescherming.klant}</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={concept.eigenAdres} disabled={busy || !!bescherming.locatie} onChange={e => setConcept({ ...concept, eigenAdres: e.target.checked })} />Eigen uitvoerlocatie gebruiken</label>
      {concept.eigenAdres ? <label className="block text-sm">Uitvoerlocatie<Input maxLength={500} value={concept.adres} disabled={busy || !!bescherming.locatie} onChange={e => setConcept({ ...concept, adres: e.target.value })} placeholder="Straat, huisnummer, postcode en plaats" required /></label> : <p className="text-xs text-muted-foreground">De route gebruikt het uitvoeradres van de gekozen klant, met het hoofdadres als terugval.</p>}
      {bescherming.locatie && <p className="text-xs text-muted-foreground">{bescherming.locatie}</p>}
      <label className="block text-sm">Werkzaamheden en instructies<Textarea rows={4} maxLength={10000} value={concept.instructie} disabled={busy} onChange={e => setConcept({ ...concept, instructie: e.target.value })} /></label>
      {concept.updatedAt !== updatedAt && <p role="alert" className="text-sm text-destructive">De klus is gewijzigd sinds je begon. Sluit deze bewerking en open de nieuwste gegevens.</p>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" type="submit" disabled={busy || !concept.naam.trim() || (concept.eigenAdres && !concept.adres.trim()) || concept.updatedAt !== updatedAt}>Klus opslaan</Button><Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => setConcept(null)}>Annuleren</Button></div>
    </form>}
  </div>;
}
