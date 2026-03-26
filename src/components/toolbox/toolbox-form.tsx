"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

interface ToolboxFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    _id: Id<"toolboxMeetings">;
    datum: string;
    onderwerp: string;
    beschrijving?: string;
    aanwezigen: Id<"medewerkers">[];
    notities?: string;
  };
}

export function ToolboxForm({ open, onOpenChange, initialData }: ToolboxFormProps) {
  const { user } = useCurrentUser();
  const createMutation = useMutation(api.toolboxMeetings.create);
  const updateMutation = useMutation(api.toolboxMeetings.update);
  const [isLoading, setIsLoading] = useState(false);
  const [datum, setDatum] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [aanwezigen, setAanwezigen] = useState<Set<string>>(new Set());
  const [notities, setNotities] = useState("");
  const isEditMode = !!initialData;

  const medewerkers = useQuery(api.medewerkers.list, user?._id ? { isActief: true } : "skip");
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setDatum(initialData.datum);
        setOnderwerp(initialData.onderwerp);
        setBeschrijving(initialData.beschrijving ?? "");
        setAanwezigen(new Set(initialData.aanwezigen.map(String)));
        setNotities(initialData.notities ?? "");
      } else {
        setDatum(new Date().toISOString().split("T")[0]);
        setOnderwerp("");
        setBeschrijving("");
        setAanwezigen(new Set());
        setNotities("");
      }
    }
  }, [open, initialData]);

  const toggleAanwezige = (id: string) => {
    setAanwezigen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (aanwezigen.size === medewerkersList.length) {
      setAanwezigen(new Set());
    } else {
      setAanwezigen(new Set(medewerkersList.map((m) => m._id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onderwerp.trim()) { showErrorToast("Onderwerp is verplicht"); return; }
    if (aanwezigen.size === 0) { showErrorToast("Selecteer minimaal één aanwezige"); return; }
    if (!datum) { showErrorToast("Datum is verplicht"); return; }

    setIsLoading(true);
    try {
      const aanwezigenArray = Array.from(aanwezigen) as Id<"medewerkers">[];
      if (isEditMode) {
        await updateMutation({ id: initialData._id, datum, onderwerp, beschrijving: beschrijving || undefined, aanwezigen: aanwezigenArray, notities: notities || undefined });
        showSuccessToast("Toolbox meeting bijgewerkt");
      } else {
        await createMutation({ datum, onderwerp, beschrijving: beschrijving || undefined, aanwezigen: aanwezigenArray, notities: notities || undefined });
        showSuccessToast("Toolbox meeting geregistreerd");
      }
      onOpenChange(false);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Er is een fout opgetreden");
    } finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditMode ? "Toolbox meeting bewerken" : "Nieuwe toolbox meeting"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="datum">Datum</Label><Input id="datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="onderwerp">Onderwerp</Label><Input id="onderwerp" value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} placeholder="Bijv. Valgevaar, Machineveiligheid..." required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="beschrijving">Beschrijving (optioneel)</Label><Textarea id="beschrijving" value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} placeholder="Toelichting op het onderwerp..." rows={2} /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Aanwezigen ({aanwezigen.size})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={selectAll}>{aanwezigen.size === medewerkersList.length ? "Deselecteer alles" : "Selecteer alles"}</Button>
            </div>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              {medewerkersList.map((m) => (
                <label key={m._id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={aanwezigen.has(m._id)} onCheckedChange={() => toggleAanwezige(m._id)} />
                  <span className="text-sm">{m.naam}{m.functie ? <span className="text-muted-foreground"> — {m.functie}</span> : ""}</span>
                </label>
              ))}
              {medewerkersList.length === 0 && <p className="text-sm text-muted-foreground">Geen medewerkers gevonden</p>}
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="notities">Notities (optioneel)</Label><Textarea id="notities" value={notities} onChange={(e) => setNotities(e.target.value)} placeholder="Actiepunten, afspraken..." rows={3} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditMode ? "Opslaan" : "Registreren"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
