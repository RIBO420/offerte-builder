"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getMutationErrorMessage } from "@/lib/error-handling";

export function MateriaalRegelsPaneel() {
  const gebruiker = useQuery(api.users.current, {});
  const kantoor = ["directie", "projectleider", "admin"].includes(gebruiker?.role ?? "");
  const regels = useQuery(api.materiaalDelta.getSuggestieRegels, kantoor ? {} : "skip");
  const bewaren = useMutation(api.materiaalDelta.bewaarSuggestieRegel);
  const [trefwoord, setTrefwoord] = useState("");
  const [naam, setNaam] = useState("");
  const [bezig, setBezig] = useState(false);
  const voegToe = async () => {
    setBezig(true);
    try { await bewaren({ trefwoord, naam, soort: "materiaal", actief: true }); setTrefwoord(""); setNaam(""); toast.success("Suggestieregel opgeslagen"); }
    catch (e) { toast.error(getMutationErrorMessage(e)); }
    finally { setBezig(false); }
  };
  if (!kantoor) return null;
  return <SectiePaneel titel="Suggesties voor de buschecklist">
    <div className="grid gap-3 p-4">
      <p className="text-sm text-muted-foreground">Een trefwoord in de werkzaamheden stelt materieel voor. De ploeg kiest zelf wat op de checklist komt. Businventaris en voorraad wijzigen hierdoor niet.</p>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void voegToe(); }}><Input className="min-w-0 flex-1" placeholder="Trefwoord" aria-label="Trefwoord" value={trefwoord} maxLength={100} onChange={e => setTrefwoord(e.target.value)} /><Input className="min-w-0 flex-1" placeholder="Benodigd materieel" aria-label="Benodigd materieel" value={naam} maxLength={160} onChange={e => setNaam(e.target.value)} /><Button type="submit" disabled={bezig || !trefwoord.trim() || !naam.trim()}>Toevoegen</Button></form>
      <details><summary className="cursor-pointer text-sm">Regels bekijken en aan- of uitzetten ({regels?.length ?? 0})</summary><ul className="mt-2 divide-y">{regels?.map(r => <li key={`${r.trefwoord}|${r.naam}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words">{r.trefwoord} → {r.naam}</span><Switch aria-label={`${r.trefwoord} naar ${r.naam}`} checked={r.actief !== false} onCheckedChange={actief => bewaren({ trefwoord: r.trefwoord, naam: r.naam, soort: r.soort, actief }).catch(e => toast.error(getMutationErrorMessage(e)))} /></li>)}</ul></details>
    </div>
  </SectiePaneel>;
}
