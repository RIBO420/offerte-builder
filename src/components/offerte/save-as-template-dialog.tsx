"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { useStandaardtuinen } from "@/hooks/use-standaardtuinen";
import { toast } from "sonner";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerte: {
    type: "aanleg" | "onderhoud";
    scopes?: string[];
    scopeData?: Record<string, unknown>;
    klant: { naam: string };
  };
}

export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  offerte,
}: SaveAsTemplateDialogProps) {
  const { create } = useStandaardtuinen();
  const [isSaving, setIsSaving] = useState(false);
  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");

  const handleSave = async () => {
    if (!naam.trim()) {
      toast.error("Vul een naam in voor de template");
      return;
    }

    setIsSaving(true);
    try {
      await create({
        naam: naam.trim(),
        omschrijving: omschrijving.trim() || undefined,
        type: offerte.type,
        scopes: offerte.scopes || [],
        defaultWaarden: offerte.scopeData || {},
      });

      toast.success("Template opgeslagen");
      onOpenChange(false);
      setNaam("");
      setOmschrijving("");
    } catch (error) {
      toast.error("Fout bij opslaan template");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
      setNaam("");
      setOmschrijving("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opslaan als Template</DialogTitle>
          <DialogDescription>
            Sla deze offerte op als herbruikbare template. De klantgegevens
            worden niet meegenomen, alleen de scopes en instellingen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-naam">Template Naam *</Label>
            <Input
              id="template-naam"
              placeholder={`Bijv. "${offerte.klant.naam} tuin stijl"`}
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-omschrijving">Omschrijving</Label>
            <Textarea
              id="template-omschrijving"
              placeholder="Optionele beschrijving van deze template..."
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Wat wordt opgeslagen:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Type: {offerte.type === "aanleg" ? "Aanleg" : "Onderhoud"}</li>
              <li>Scopes: {offerte.scopes?.length || 0} werkzaamheden</li>
              <li>Alle scope instellingen en waarden</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !naam.trim()}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
