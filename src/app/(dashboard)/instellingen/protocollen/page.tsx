"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useCurrentUserRole, useIsKantoor } from "@/hooks/use-users";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ContactenBeheer } from "./contacten-beheer";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

type Protocol = Doc<"protocollen">;
const ROLLEN = ["voorman", "medewerker", "onderaannemer_zzp", "materiaalman"] as const;
type Rol = typeof ROLLEN[number];

export default function ProtocollenPage() {
  const rol = useCurrentUserRole();
  const kantoor = useIsKantoor();
  const lijst = useQuery(api.protocollen.list, kantoor ? {} : "skip");
  const opslaan = useMutation(api.protocollen.opslaan);
  const archiveer = useMutation(api.protocollen.archiveer);
  const [bestaand, setBestaand] = useState<Protocol | null>(null);
  const [open, setOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [wanneer, setWanneer] = useState("");
  const [stappen, setStappen] = useState("");
  const [waarschuwing, setWaarschuwing] = useState("");
  const [contactNaam, setContactNaam] = useState("");
  const [contactTelefoon, setContactTelefoon] = useState("");
  const [doelgroepen, setDoelgroepen] = useState<Rol[]>([]);
  const [icoon, setIcoon] = useState("");
  const [spoed, setSpoed] = useState(false);
  const [volgorde, setVolgorde] = useState("0");
  const [bezig, setBezig] = useState(false);
  function bewerk(rij: Protocol | null) {
    setIcoon(rij?.icoon ?? ""); setSpoed(rij?.spoed ?? false); setVolgorde(String(rij?.volgorde ?? 0));
    setBestaand(rij); setTitel(rij?.titel ?? ""); setWanneer(rij?.wanneer ?? "");
    setStappen(rij?.stappen.join("\n") ?? ""); setWaarschuwing(rij?.waarschuwing ?? "");
    setContactNaam(rij?.contactNaam ?? ""); setContactTelefoon(rij?.contactTelefoon ?? "");
    setDoelgroepen((rij?.doelgroepen ?? []).filter((r): r is Rol => ROLLEN.includes(r as Rol))); setOpen(true);
  }
  // Rol nog onbekend: laden tonen, niet kort "alleen voor kantoor" laten flitsen.
  if (rol === null) return <div role="status" aria-live="polite" className="p-6 text-sm text-muted-foreground">Protocollen laden…</div>;
  if (!kantoor) return <div className="p-6">Protocolbeheer is beschikbaar voor kantoor.</div>;
  return <div className={`${REVEAL_KLASSE} mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-8`}>
    <Link href="/instellingen" className="text-sm text-muted-foreground hover:underline">← Instellingen</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl">Werk- en noodprotocollen</h1><Button onClick={() => bewerk(null)}>Protocol toevoegen</Button></div>
    <p className="text-sm text-muted-foreground">Gepubliceerde instructies verschijnen in de medewerkersapp. Kantoor beheert de inhoud en ziet ook gearchiveerde versies.</p>
    {open && <SectiePaneel titel={bestaand ? "Protocol bewerken" : "Nieuw protocol"}>
      <form className="space-y-4 p-4" onSubmit={async e => {
        e.preventDefault(); if (bezig) return; setBezig(true);
        try {
          await opslaan({ ...(bestaand ? { id: bestaand._id, expectedRevision: bestaand.revision } : {}), titel, wanneer,
            stappen: stappen.split("\n").map(s => s.trim()).filter(Boolean), waarschuwing: waarschuwing || undefined,
            contactNaam: contactNaam || undefined, contactTelefoon: contactTelefoon || undefined, doelgroepen, actief: true, icoon: icoon || undefined, spoed, volgorde: Number(volgorde) });
          setOpen(false); toast.success("Protocol gepubliceerd");
        } catch (fout) { toast.error(fout instanceof Error ? fout.message : "Opslaan mislukt"); }
        finally { setBezig(false); }
      }}>
        <div className="space-y-1"><Label htmlFor="protocol-titel">Titel</Label><Input id="protocol-titel" value={titel} onChange={e => setTitel(e.target.value)} maxLength={120} required /></div>
        <div className="space-y-1"><Label htmlFor="protocol-wanneer">Wanneer gebruik je dit?</Label><Textarea id="protocol-wanneer" value={wanneer} onChange={e => setWanneer(e.target.value)} maxLength={2000} required /></div>
        <div className="space-y-1"><Label htmlFor="protocol-stappen">Stappen — één stap per regel</Label><Textarea id="protocol-stappen" value={stappen} onChange={e => setStappen(e.target.value)} rows={7} required /></div>
        <div className="space-y-1"><Label htmlFor="protocol-waarschuwing">Belangrijk (optioneel)</Label><Textarea id="protocol-waarschuwing" value={waarschuwing} onChange={e => setWaarschuwing(e.target.value)} maxLength={2000} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="protocol-contact">Contactpersoon</Label><Input id="protocol-contact" value={contactNaam} onChange={e => setContactNaam(e.target.value)} maxLength={120} /></div><div className="space-y-1"><Label htmlFor="protocol-telefoon">Telefoonnummer</Label><Input id="protocol-telefoon" type="tel" value={contactTelefoon} onChange={e => setContactTelefoon(e.target.value)} maxLength={40} /></div></div>
        <div className="flex flex-wrap items-center gap-4"><label className="text-sm">Icoon (emoji)<Input value={icoon} onChange={e => setIcoon(e.target.value)} maxLength={60} /></label><label className="max-w-40 text-sm">Volgorde<NumberInput value={volgorde} onChange={n => setVolgorde(String(n))} step={1} decimals={0} min={-10000} max={10000} required /></label><label className="flex items-center gap-2 text-sm"><Checkbox checked={spoed} onCheckedChange={v => setSpoed(v === true)} />Noodprotocol</label></div>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">Doelgroep — leeg betekent alle medewerkers</legend><div className="flex flex-wrap gap-4">{ROLLEN.map(rol => <label key={rol} className="flex items-center gap-2 text-sm"><Checkbox checked={doelgroepen.includes(rol)} onCheckedChange={checked => setDoelgroepen(v => checked ? [...v, rol] : v.filter(r => r !== rol))} />{rol.replaceAll("_", " ")}</label>)}</div></fieldset>
        <div className="flex gap-2"><Button disabled={bezig} type="submit">{bezig ? "Opslaan…" : "Publiceren"}</Button><Button variant="outline" type="button" onClick={() => setOpen(false)}>Annuleren</Button></div>
      </form>
    </SectiePaneel>}
    <ContactenBeheer />
    <SectiePaneel titel="Bibliotheek" telling={lijst?.length}>
      <div className="divide-y">{lijst === undefined ? <p className="p-4 text-sm" role="status">Protocollen laden…</p> : !lijst.length ? <p className="p-4 text-sm text-muted-foreground">Nog geen protocollen. Voeg de instructies voor de ploeg toe.</p> : lijst.map(rij => <article key={rij._id} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">{rij.titel} {!rij.actief && <span className="text-muted-foreground">· gearchiveerd</span>}</h2><span className="text-xs text-muted-foreground">Versie {rij.revision}</span></div>
        <p className="text-sm text-muted-foreground">{rij.wanneer}</p>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => bewerk(rij)}>{rij.actief ? "Bewerken" : "Opnieuw publiceren"}</Button>{rij.actief && <Button variant="ghost" size="sm" onClick={async () => {
          try { await archiveer({ id: rij._id, expectedRevision: rij.revision }); toast.success("Protocol gearchiveerd"); }
          catch (fout) { toast.error(fout instanceof Error ? fout.message : "Archiveren mislukt"); }
        }}>Archiveren</Button>}</div>
      </article>)}</div>
    </SectiePaneel>
  </div>;
}
