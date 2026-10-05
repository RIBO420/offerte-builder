"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Extra klant/klus invoeren binnen het bestaande segmentformulier. */
export function VeldKlusKiezer({ datum, onSelect }: { datum: string; onSelect: (id: Id<"projecten">) => void }) {
  const [zoekterm, setZoekterm] = useState("");
  const [klantId, setKlantId] = useState("");
  const [nieuw, setNieuw] = useState(false);
  const [naam, setNaam] = useState("");
  const [adres, setAdres] = useState("");
  const [postcode, setPostcode] = useState("");
  const [plaats, setPlaats] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [categorie, setCategorie] = useState<"aanleg" | "onderhoud">("onderhoud");
  const [bezig, setBezig] = useState(false);
  const [gekozenNaam, setGekozenNaam] = useState("");
  const opdracht = useRef<{ inhoud: string; sleutel: string } | null>(null);
  const resultaat = useQuery(api.veldKlanten.zoek, { datum, zoekterm });
  const maak = useMutation(api.veldKlanten.maakUitvoeringsklus);
  const klant = resultaat?.klanten.find(k => k.klantId === klantId);
  async function maakKlus() {
    if (bezig) return;
    const payload = { datum, omschrijving, categorie, ...(nieuw ? { nieuweKlant: { naam, adres, postcode, plaats } } : { klantId: klantId as Id<"klanten"> }) };
    const inhoud = JSON.stringify(payload);
    if (!opdracht.current || opdracht.current.inhoud !== inhoud) opdracht.current = { inhoud, sleutel: crypto.randomUUID() };
    setBezig(true);
    try {
      const result = await maak({ ...payload, sleutel: opdracht.current.sleutel });
      onSelect(result.werkitemId);
      setGekozenNaam(`${result.klantNaam} · ${result.werkitemNaam}`);
      toast.success("Klus gekozen; vul de gewerkte tijd in");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Klus maken is mislukt"); }
    finally { setBezig(false); }
  }
  return <details className="grid gap-2 rounded-md border p-3">
    <summary className="cursor-pointer text-sm font-medium">Andere klant of nieuwe klus</summary>
    <fieldset disabled={bezig} className="mt-3 grid min-w-0 gap-3">
      {gekozenNaam && <p role="status" className="break-words text-sm">Gekozen: {gekozenNaam}</p>}
      <Label>Klant zoeken<Input value={zoekterm} maxLength={160} placeholder="Naam, adres of plaats" onChange={e => { setZoekterm(e.target.value); setKlantId(""); }} /></Label>
      <Select value={klantId} onValueChange={id => { setKlantId(id); setNieuw(false); }}>
        <SelectTrigger><SelectValue placeholder="Geplande klanten staan bovenaan" /></SelectTrigger>
        <SelectContent>{resultaat?.klanten.map(k => <SelectItem key={k.klantId} value={k.klantId}>{k.gepland ? "Vandaag · " : ""}{k.naam}{k.plaats ? ` · ${k.plaats}` : ""}</SelectItem>)}</SelectContent>
      </Select>
      {resultaat?.meerResultaten && <p className="text-xs text-muted-foreground">Er zijn meer klanten. Verfijn je zoekopdracht.</p>}
      {klant?.werkitems.map(w => <Button type="button" variant="outline" key={w.werkitemId} className="h-auto justify-start whitespace-normal text-left" onClick={() => { onSelect(w.werkitemId); setGekozenNaam(`${klant.naam} · ${w.naam}`); }}>{w.naam} kiezen</Button>)}
      <Button type="button" variant="ghost" className="justify-start" onClick={() => { setNieuw(!nieuw); setKlantId(""); }}>{nieuw ? "Bestaande klant kiezen" : "+ Nieuwe klant"}</Button>
      {nieuw && <div className="grid gap-2">
        <Label>Klantnaam<Input value={naam} maxLength={160} onChange={e => setNaam(e.target.value)} /></Label>
        <Label>Adres (optioneel)<Input value={adres} maxLength={200} onChange={e => setAdres(e.target.value)} /></Label>
        <div className="grid grid-cols-2 gap-2"><Label>Postcode (optioneel)<Input value={postcode} maxLength={20} onChange={e => setPostcode(e.target.value)} /></Label><Label>Plaats (optioneel)<Input value={plaats} maxLength={100} onChange={e => setPlaats(e.target.value)} /></Label></div>
      </div>}
      {(nieuw || klant) && <>
        <Label>Omschrijving nieuwe klus<Input value={omschrijving} maxLength={300} placeholder="Bijvoorbeeld heg snoeien achtertuin" onChange={e => setOmschrijving(e.target.value)} /></Label>
        <Select value={categorie} onValueChange={v => setCategorie(v as typeof categorie)}><SelectTrigger aria-label="Werksoort nieuwe klus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="onderhoud">Tuinonderhoud</SelectItem><SelectItem value="aanleg">Tuinaanleg</SelectItem></SelectContent></Select>
        <Button type="button" variant="secondary" disabled={bezig || !omschrijving.trim() || (nieuw && !naam.trim())} onClick={maakKlus}>{bezig ? "Klus maken…" : "Nieuwe klus maken en kiezen"}</Button>
      </>}
    </fieldset>
  </details>;
}
