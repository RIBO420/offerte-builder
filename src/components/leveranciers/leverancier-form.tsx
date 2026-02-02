"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

export interface LeverancierFormData {
  naam: string;
  contactpersoon: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  kvkNummer: string;
  btwNummer: string;
  iban: string;
  betalingstermijn: string;
  notities: string;
}

export interface LeverancierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialData?: {
    _id: Id<"leveranciers">;
    naam: string;
    contactpersoon?: string;
    email?: string;
    telefoon?: string;
    adres?: string;
    postcode?: string;
    plaats?: string;
    kvkNummer?: string;
    btwNummer?: string;
    iban?: string;
    betalingstermijn?: number;
    notities?: string;
  } | null;
  onSubmit: (data: LeverancierFormData, id?: Id<"leveranciers">) => Promise<void>;
}

const emptyFormData: LeverancierFormData = {
  naam: "",
  contactpersoon: "",
  email: "",
  telefoon: "",
  adres: "",
  postcode: "",
  plaats: "",
  kvkNummer: "",
  btwNummer: "",
  iban: "",
  betalingstermijn: "",
  notities: "",
};

export function LeverancierForm({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
}: LeverancierFormProps) {
  const [formData, setFormData] = useState<LeverancierFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        setFormData({
          naam: initialData.naam,
          contactpersoon: initialData.contactpersoon || "",
          email: initialData.email || "",
          telefoon: initialData.telefoon || "",
          adres: initialData.adres || "",
          postcode: initialData.postcode || "",
          plaats: initialData.plaats || "",
          kvkNummer: initialData.kvkNummer || "",
          btwNummer: initialData.btwNummer || "",
          iban: initialData.iban || "",
          betalingstermijn: initialData.betalingstermijn?.toString() || "",
          notities: initialData.notities || "",
        });
      } else {
        setFormData(emptyFormData);
      }
    }
  }, [open, mode, initialData]);

  const handleSubmit = useCallback(async () => {
    if (!formData.naam.trim()) {
      toast.error("Vul de naam van de leverancier in");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData, mode === "edit" ? initialData?._id : undefined);
      onOpenChange(false);
    } catch {
      // Error is handled by the parent component
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, mode, initialData?._id, onOpenChange]);

  const updateField = useCallback(
    (field: keyof LeverancierFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Nieuwe Leverancier" : "Leverancier Bewerken"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Voeg een nieuwe leverancier toe aan je leveranciersbestand."
              : `Pas de gegevens van ${initialData?.naam} aan.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basisgegevens */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="naam">Bedrijfsnaam *</Label>
              <Input
                id="naam"
                placeholder="Leverancier B.V."
                value={formData.naam}
                onChange={(e) => updateField("naam", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactpersoon">Contactpersoon</Label>
              <Input
                id="contactpersoon"
                placeholder="Jan Jansen"
                value={formData.contactpersoon}
                onChange={(e) => updateField("contactpersoon", e.target.value)}
              />
            </div>
          </div>

          {/* Contactgegevens */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefoon">Telefoon</Label>
              <Input
                id="telefoon"
                placeholder="020-1234567"
                value={formData.telefoon}
                onChange={(e) => updateField("telefoon", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@leverancier.nl"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
          </div>

          {/* Adresgegevens */}
          <div className="space-y-2">
            <Label htmlFor="adres">Adres</Label>
            <Input
              id="adres"
              placeholder="Industrieweg 10"
              value={formData.adres}
              onChange={(e) => updateField("adres", e.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                placeholder="1234 AB"
                value={formData.postcode}
                onChange={(e) => updateField("postcode", e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="plaats">Plaats</Label>
              <Input
                id="plaats"
                placeholder="Amsterdam"
                value={formData.plaats}
                onChange={(e) => updateField("plaats", e.target.value)}
              />
            </div>
          </div>

          {/* Bedrijfsgegevens */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kvkNummer">KVK-nummer</Label>
              <Input
                id="kvkNummer"
                placeholder="12345678"
                value={formData.kvkNummer}
                onChange={(e) => updateField("kvkNummer", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="btwNummer">BTW-nummer</Label>
              <Input
                id="btwNummer"
                placeholder="NL123456789B01"
                value={formData.btwNummer}
                onChange={(e) => updateField("btwNummer", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                placeholder="NL12 ABCD 0123 4567 89"
                value={formData.iban}
                onChange={(e) => updateField("iban", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="betalingstermijn">Betalingstermijn (dagen)</Label>
              <Input
                id="betalingstermijn"
                type="number"
                placeholder="30"
                value={formData.betalingstermijn}
                onChange={(e) => updateField("betalingstermijn", e.target.value)}
              />
            </div>
          </div>

          {/* Notities */}
          <div className="space-y-2">
            <Label htmlFor="notities">Notities</Label>
            <Textarea
              id="notities"
              placeholder="Extra informatie over de leverancier..."
              value={formData.notities}
              onChange={(e) => updateField("notities", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "add" ? "Toevoegen" : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
