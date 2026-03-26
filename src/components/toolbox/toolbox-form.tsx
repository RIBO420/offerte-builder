"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

// Zod schema
const toolboxFormSchema = z.object({
  datum: z.string().min(1, "Datum is verplicht"),
  onderwerp: z.string().min(1, "Onderwerp is verplicht"),
  beschrijving: z.string().optional(),
  aanwezigen: z.array(z.string()).min(1, "Selecteer minimaal een aanwezige"),
  notities: z.string().optional(),
});

type ToolboxFormData = z.infer<typeof toolboxFormSchema>;

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
  const isEditMode = !!initialData;

  const medewerkers = useQuery(api.medewerkers.list, user?._id ? { isActief: true } : "skip");
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  const form = useForm<ToolboxFormData>({
    resolver: zodResolver(toolboxFormSchema),
    defaultValues: {
      datum: new Date().toISOString().split("T")[0],
      onderwerp: "",
      beschrijving: "",
      aanwezigen: [],
      notities: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          datum: initialData.datum,
          onderwerp: initialData.onderwerp,
          beschrijving: initialData.beschrijving ?? "",
          aanwezigen: initialData.aanwezigen.map(String),
          notities: initialData.notities ?? "",
        });
      } else {
        form.reset({
          datum: new Date().toISOString().split("T")[0],
          onderwerp: "",
          beschrijving: "",
          aanwezigen: [],
          notities: "",
        });
      }
    }
  }, [open, initialData, form]);

  const aanwezigenValue = form.watch("aanwezigen");

  const toggleAanwezige = (id: string) => {
    const current = form.getValues("aanwezigen");
    const newValue = current.includes(id)
      ? current.filter((a) => a !== id)
      : [...current, id];
    form.setValue("aanwezigen", newValue, { shouldValidate: true });
  };

  const selectAll = () => {
    if (aanwezigenValue.length === medewerkersList.length) {
      form.setValue("aanwezigen", [], { shouldValidate: true });
    } else {
      form.setValue(
        "aanwezigen",
        medewerkersList.map((m) => m._id),
        { shouldValidate: true }
      );
    }
  };

  const handleFormSubmit = async (data: ToolboxFormData) => {
    setIsLoading(true);
    try {
      const aanwezigenArray = data.aanwezigen as Id<"medewerkers">[];
      if (isEditMode && initialData) {
        await updateMutation({
          id: initialData._id,
          datum: data.datum,
          onderwerp: data.onderwerp,
          beschrijving: data.beschrijving || undefined,
          aanwezigen: aanwezigenArray,
          notities: data.notities || undefined,
        });
        showSuccessToast("Toolbox meeting bijgewerkt");
      } else {
        await createMutation({
          datum: data.datum,
          onderwerp: data.onderwerp,
          beschrijving: data.beschrijving || undefined,
          aanwezigen: aanwezigenArray,
          notities: data.notities || undefined,
        });
        showSuccessToast("Toolbox meeting geregistreerd");
      }
      onOpenChange(false);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Er is een fout opgetreden");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Toolbox meeting bewerken" : "Nieuwe toolbox meeting"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="datum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="onderwerp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Onderwerp</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Bijv. Valgevaar, Machineveiligheid..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="beschrijving"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschrijving (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Toelichting op het onderwerp..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aanwezigen"
              render={() => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Aanwezigen ({aanwezigenValue.length})</FormLabel>
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                      {aanwezigenValue.length === medewerkersList.length ? "Deselecteer alles" : "Selecteer alles"}
                    </Button>
                  </div>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {medewerkersList.map((m) => (
                      <label key={m._id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={aanwezigenValue.includes(m._id)}
                          onCheckedChange={() => toggleAanwezige(m._id)}
                        />
                        <span className="text-sm">
                          {m.naam}
                          {m.functie ? <span className="text-muted-foreground"> -- {m.functie}</span> : ""}
                        </span>
                      </label>
                    ))}
                    {medewerkersList.length === 0 && (
                      <p className="text-sm text-muted-foreground">Geen medewerkers gevonden</p>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notities (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Actiepunten, afspraken..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Opslaan" : "Registreren"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
