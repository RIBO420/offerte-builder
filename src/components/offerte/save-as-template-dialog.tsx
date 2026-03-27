"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Save } from "lucide-react";
import { useStandaardtuinen } from "@/hooks/use-standaardtuinen";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

// Zod schema
const templateSchema = z.object({
  naam: z.string().min(1, "Vul een naam in voor de template"),
  omschrijving: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

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

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      naam: "",
      omschrijving: "",
    },
  });

  const handleFormSubmit = async (data: TemplateFormData) => {
    setIsSaving(true);
    try {
      await create({
        naam: data.naam.trim(),
        omschrijving: data.omschrijving?.trim() || undefined,
        type: offerte.type,
        scopes: offerte.scopes || [],
        defaultWaarden: offerte.scopeData || {},
      });

      showSuccessToast("Template opgeslagen");
      onOpenChange(false);
      form.reset();
    } catch {
      showErrorToast("Fout bij opslaan template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
      form.reset();
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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="naam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Naam *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={`Bijv. "${offerte.klant.naam} tuin stijl"`}
                        disabled={isSaving}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="omschrijving"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Omschrijving</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optionele beschrijving van deze template..."
                        disabled={isSaving}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
              <Button type="submit" disabled={isSaving || !form.watch("naam")?.trim()}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Opslaan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
