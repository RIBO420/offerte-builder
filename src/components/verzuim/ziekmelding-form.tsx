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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

interface ZiekmeldingFormProps { open: boolean; onOpenChange: (open: boolean) => void; }

export function ZiekmeldingForm({ open, onOpenChange }: ZiekmeldingFormProps) {
  const { user } = useCurrentUser();
  const ziekmelden = useMutation(api.verzuim.ziekmelden);
  const [isLoading, setIsLoading] = useState(false);
  const [medewerkerId, setMedewerkerId] = useState("");
  const [startDatum, setStartDatum] = useState("");
  const [reden, setReden] = useState("");
  const [notities, setNotities] = useState("");
  const medewerkers = useQuery(api.medewerkers.list, user?._id ? { isActief: true } : "skip");
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  useEffect(() => { if (open) { setMedewerkerId(""); setStartDatum(new Date().toISOString().split("T")[0]); setReden(""); setNotities(""); } }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medewerkerId) { showErrorToast("Selecteer een medewerker"); return; }
    if (!startDatum) { showErrorToast("Vul een startdatum in"); return; }
    setIsLoading(true);
    try {
      await ziekmelden({ medewerkerId: medewerkerId as Id<"medewerkers">, startDatum, reden: reden || undefined, notities: notities || undefined });
      showSuccessToast("Ziekmelding geregistreerd");
      onOpenChange(false);
    } catch (error) { showErrorToast(error instanceof Error ? error.message : "Er is een fout opgetreden");
    } finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>Ziekmelding registreren</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="medewerker">Medewerker</Label>
            <Select value={medewerkerId} onValueChange={setMedewerkerId}>
              <SelectTrigger id="medewerker"><SelectValue placeholder="Selecteer medewerker" /></SelectTrigger>
              <SelectContent>{medewerkersList.map((m) => (<SelectItem key={m._id} value={m._id}>{m.naam}{m.functie ? ` — ${m.functie}` : ""}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="startDatum">Eerste ziektedag</Label><Input id="startDatum" type="date" value={startDatum} onChange={(e) => setStartDatum(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="reden">Reden (optioneel)</Label><Input id="reden" value={reden} onChange={(e) => setReden(e.target.value)} placeholder="Bijv. griep, rugklachten..." /><p className="text-xs text-muted-foreground">Let op: medische details zijn privacy-gevoelig.</p></div>
          <div className="space-y-2"><Label htmlFor="notities">Notities (optioneel)</Label><Textarea id="notities" value={notities} onChange={(e) => setNotities(e.target.value)} placeholder="Interne notities..." rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ziekmelden</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface HerstelmeldingFormProps { open: boolean; onOpenChange: (open: boolean) => void; verzuimId: Id<"verzuimregistraties"> | null; medewerkerNaam: string; }

export function HerstelmeldingForm({ open, onOpenChange, verzuimId, medewerkerNaam }: HerstelmeldingFormProps) {
  const herstelmelden = useMutation(api.verzuim.herstelmelden);
  const [isLoading, setIsLoading] = useState(false);
  const [herstelDatum, setHerstelDatum] = useState("");
  const [notities, setNotities] = useState("");

  useEffect(() => { if (open) { setHerstelDatum(new Date().toISOString().split("T")[0]); setNotities(""); } }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verzuimId || !herstelDatum) return;
    setIsLoading(true);
    try {
      await herstelmelden({ id: verzuimId, herstelDatum, notities: notities || undefined });
      showSuccessToast("Herstelmelding geregistreerd");
      onOpenChange(false);
    } catch (error) { showErrorToast(error instanceof Error ? error.message : "Er is een fout opgetreden");
    } finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>Herstelmelding — {medewerkerNaam}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="herstelDatum">Hersteldatum</Label><Input id="herstelDatum" type="date" value={herstelDatum} onChange={(e) => setHerstelDatum(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="notities">Notities (optioneel)</Label><Textarea id="notities" value={notities} onChange={(e) => setNotities(e.target.value)} placeholder="Opmerkingen bij herstel..." rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hersteld melden</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
