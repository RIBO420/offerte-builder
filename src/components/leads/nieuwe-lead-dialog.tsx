"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================
// Types
// ============================================

type Bron = "handmatig" | "telefoon" | "email" | "doorverwijzing";

const bronOptions: { value: Bron; label: string }[] = [
  { value: "handmatig", label: "Handmatig" },
  { value: "telefoon", label: "Telefoon" },
  { value: "email", label: "E-mail" },
  { value: "doorverwijzing", label: "Doorverwijzing" },
];

// ============================================
// Initial form state
// ============================================

interface FormData {
  klantNaam: string;
  bron: Bron;
  klantEmail: string;
  klantTelefoon: string;
  klantAdres: string;
  klantPostcode: string;
  klantPlaats: string;
  geschatteWaarde: string;
  omschrijving: string;
}

const initialFormData: FormData = {
  klantNaam: "",
  bron: "handmatig",
  klantEmail: "",
  klantTelefoon: "",
  klantAdres: "",
  klantPostcode: "",
  klantPlaats: "",
  geschatteWaarde: "",
  omschrijving: "",
};

// ============================================
// NieuweLeadDialog component
// ============================================

interface NieuweLeadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NieuweLeadDialog({ open, onClose }: NieuweLeadDialogProps) {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createHandmatig = useMutation(
    api.configuratorAanvragen.createHandmatig
  );

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetAndClose() {
    setForm(initialFormData);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.klantNaam.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    setIsSubmitting(true);
    try {
      await createHandmatig({
        klantNaam: form.klantNaam.trim(),
        bron: form.bron,
        klantEmail: form.klantEmail.trim() || undefined,
        klantTelefoon: form.klantTelefoon.trim() || undefined,
        klantAdres: form.klantAdres.trim() || undefined,
        klantPostcode: form.klantPostcode.trim() || undefined,
        klantPlaats: form.klantPlaats.trim() || undefined,
        geschatteWaarde: form.geschatteWaarde
          ? Number(form.geschatteWaarde)
          : undefined,
        omschrijving: form.omschrijving.trim() || undefined,
      });
      toast.success("Lead aangemaakt");
      resetAndClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het aanmaken"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isSubmitting) resetAndClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuwe lead</DialogTitle>
          <DialogDescription>
            Voeg handmatig een nieuwe lead toe aan de pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Naam + Bron */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="klantNaam">
                Naam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="klantNaam"
                placeholder="Naam klant"
                value={form.klantNaam}
                onChange={(e) => updateField("klantNaam", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bron">Bron</Label>
              <Select
                value={form.bron}
                onValueChange={(value) => updateField("bron", value as Bron)}
              >
                <SelectTrigger id="bron">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bronOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email + Telefoon */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="klantEmail">E-mail</Label>
              <Input
                id="klantEmail"
                type="email"
                placeholder="email@voorbeeld.nl"
                value={form.klantEmail}
                onChange={(e) => updateField("klantEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="klantTelefoon">Telefoon</Label>
              <Input
                id="klantTelefoon"
                type="tel"
                placeholder="06-12345678"
                value={form.klantTelefoon}
                onChange={(e) => updateField("klantTelefoon", e.target.value)}
              />
            </div>
          </div>

          {/* Adres */}
          <div className="space-y-2">
            <Label htmlFor="klantAdres">Adres</Label>
            <Input
              id="klantAdres"
              placeholder="Straat en huisnummer"
              value={form.klantAdres}
              onChange={(e) => updateField("klantAdres", e.target.value)}
            />
          </div>

          {/* Postcode + Plaats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="klantPostcode">Postcode</Label>
              <Input
                id="klantPostcode"
                placeholder="1234 AB"
                value={form.klantPostcode}
                onChange={(e) => updateField("klantPostcode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="klantPlaats">Plaats</Label>
              <Input
                id="klantPlaats"
                placeholder="Plaatsnaam"
                value={form.klantPlaats}
                onChange={(e) => updateField("klantPlaats", e.target.value)}
              />
            </div>
          </div>

          {/* Geschatte waarde */}
          <div className="space-y-2">
            <Label htmlFor="geschatteWaarde">Geschatte waarde</Label>
            <Input
              id="geschatteWaarde"
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={form.geschatteWaarde}
              onChange={(e) => updateField("geschatteWaarde", e.target.value)}
            />
          </div>

          {/* Omschrijving */}
          <div className="space-y-2">
            <Label htmlFor="omschrijving">Omschrijving</Label>
            <Textarea
              id="omschrijving"
              placeholder="Korte omschrijving van de aanvraag..."
              value={form.omschrijving}
              onChange={(e) => updateField("omschrijving", e.target.value)}
              rows={3}
            />
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={isSubmitting}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aanmaken...
                </>
              ) : (
                "Lead aanmaken"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
