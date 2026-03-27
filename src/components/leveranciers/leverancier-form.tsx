"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";

// Zod schema for leverancier form
const leverancierFormSchema = z.object({
  naam: z.string().min(1, "Bedrijfsnaam is verplicht"),
  contactpersoon: z.string().optional(),
  email: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
  telefoon: z.string().optional(),
  adres: z.string().optional(),
  postcode: z.string().optional(),
  plaats: z.string().optional(),
  kvkNummer: z.string().optional(),
  btwNummer: z.string().optional(),
  iban: z.string().optional(),
  betalingstermijn: z.string().optional(),
  notities: z.string().optional(),
});

export type LeverancierFormData = z.infer<typeof leverancierFormSchema>;

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

export function LeverancierForm({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
}: LeverancierFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LeverancierFormData>({
    resolver: zodResolver(leverancierFormSchema),
    defaultValues: {
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
    },
  });

  // Reset form when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialData) {
        form.reset({
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
        form.reset({
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
        });
      }
    }
  }, [open, mode, initialData, form]);

  const handleFormSubmit = async (data: LeverancierFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data, mode === "edit" ? initialData?._id : undefined);
      onOpenChange(false);
    } catch {
      // Error is handled by the parent component
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Basisgegevens */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="naam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrijfsnaam *</FormLabel>
                      <FormControl>
                        <Input placeholder="Leverancier B.V." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactpersoon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contactpersoon</FormLabel>
                      <FormControl>
                        <Input placeholder="Jan Jansen" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contactgegevens */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="telefoon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefoon</FormLabel>
                      <FormControl>
                        <Input placeholder="020-1234567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="info@leverancier.nl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Adresgegevens */}
              <FormField
                control={form.control}
                name="adres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adres</FormLabel>
                    <FormControl>
                      <Input placeholder="Industrieweg 10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="postcode"
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
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="plaats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plaats</FormLabel>
                        <FormControl>
                          <Input placeholder="Amsterdam" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Bedrijfsgegevens */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="kvkNummer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KVK-nummer</FormLabel>
                      <FormControl>
                        <Input placeholder="12345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="btwNummer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BTW-nummer</FormLabel>
                      <FormControl>
                        <Input placeholder="NL123456789B01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="iban"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IBAN</FormLabel>
                      <FormControl>
                        <Input placeholder="NL12 ABCD 0123 4567 89" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="betalingstermijn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Betalingstermijn (dagen)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notities */}
              <FormField
                control={form.control}
                name="notities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notities</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Extra informatie over de leverancier..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "add" ? "Toevoegen" : "Opslaan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
