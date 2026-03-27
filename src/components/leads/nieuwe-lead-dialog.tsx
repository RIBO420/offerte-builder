"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
// Zod schema
// ============================================

const nieuweLeadSchema = z.object({
  klantNaam: z.string().min(1, "Naam is verplicht"),
  bron: z.enum(["handmatig", "telefoon", "email", "doorverwijzing"]),
  klantEmail: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
  klantTelefoon: z.string().optional(),
  klantAdres: z.string().optional(),
  klantPostcode: z.string().optional(),
  klantPlaats: z.string().optional(),
  geschatteWaarde: z.string().optional(),
  omschrijving: z.string().optional(),
});

type NieuweLeadFormData = z.infer<typeof nieuweLeadSchema>;

// ============================================
// NieuweLeadDialog component
// ============================================

interface NieuweLeadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NieuweLeadDialog({ open, onClose }: NieuweLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createHandmatig = useMutation(
    api.configuratorAanvragen.createHandmatig
  );

  const form = useForm<NieuweLeadFormData>({
    resolver: zodResolver(nieuweLeadSchema),
    defaultValues: {
      klantNaam: "",
      bron: "handmatig",
      klantEmail: "",
      klantTelefoon: "",
      klantAdres: "",
      klantPostcode: "",
      klantPlaats: "",
      geschatteWaarde: "",
      omschrijving: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        klantNaam: "",
        bron: "handmatig",
        klantEmail: "",
        klantTelefoon: "",
        klantAdres: "",
        klantPostcode: "",
        klantPlaats: "",
        geschatteWaarde: "",
        omschrijving: "",
      });
    }
  }, [open, form]);

  function resetAndClose() {
    form.reset();
    onClose();
  }

  async function handleFormSubmit(data: NieuweLeadFormData) {
    setIsSubmitting(true);
    try {
      await createHandmatig({
        klantNaam: data.klantNaam.trim(),
        bron: data.bron,
        klantEmail: data.klantEmail?.trim() || undefined,
        klantTelefoon: data.klantTelefoon?.trim() || undefined,
        klantAdres: data.klantAdres?.trim() || undefined,
        klantPostcode: data.klantPostcode?.trim() || undefined,
        klantPlaats: data.klantPlaats?.trim() || undefined,
        geschatteWaarde: data.geschatteWaarde
          ? Number(data.geschatteWaarde)
          : undefined,
        omschrijving: data.omschrijving?.trim() || undefined,
      });
      showSuccessToast("Lead aangemaakt");
      resetAndClose();
    } catch (error) {
      showErrorToast(
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Naam + Bron */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="klantNaam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Naam <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Naam klant" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bron"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bron</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bronOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email + Telefoon */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="klantEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@voorbeeld.nl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="klantTelefoon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefoon</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="06-12345678"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Adres */}
            <FormField
              control={form.control}
              name="klantAdres"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adres</FormLabel>
                  <FormControl>
                    <Input placeholder="Straat en huisnummer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Postcode + Plaats */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="klantPostcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input placeholder="1234 AB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="klantPlaats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plaats</FormLabel>
                    <FormControl>
                      <Input placeholder="Plaatsnaam" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Geschatte waarde */}
            <FormField
              control={form.control}
              name="geschatteWaarde"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geschatte waarde</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Omschrijving */}
            <FormField
              control={form.control}
              name="omschrijving"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Omschrijving</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Korte omschrijving van de aanvraag..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
