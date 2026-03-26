"use client";

import { useState, useEffect, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Loader2, Calendar } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { format } from "date-fns";
import { nl } from "@/lib/date-locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Ernst options
const ernstOptions = [
  { value: "klein", label: "Klein" },
  { value: "gemiddeld", label: "Gemiddeld" },
  { value: "groot", label: "Groot" },
] as const;

// Schade type options
const schadeTypeOptions = [
  { value: "deuk", label: "Deuk" },
  { value: "kras", label: "Kras" },
  { value: "breuk", label: "Breuk" },
  { value: "mechanisch", label: "Mechanisch" },
  { value: "overig", label: "Overig" },
] as const;

// Status options
const statusOptions = [
  { value: "nieuw", label: "Nieuw" },
  { value: "in_reparatie", label: "In reparatie" },
  { value: "afgehandeld", label: "Afgehandeld" },
] as const;

type Ernst = (typeof ernstOptions)[number]["value"];
type SchadeType = (typeof schadeTypeOptions)[number]["value"];
type SchadeStatus = (typeof statusOptions)[number]["value"];

export interface SchadeFormData {
  voertuigId: Id<"voertuigen">;
  datum: number;
  beschrijving: string;
  ernst: Ernst;
  schadeType: SchadeType;
  fotoUrls?: string[];
  gerapporteerdDoor: string;
  status: SchadeStatus;
  reparatieKosten?: number;
  verzekeringsClaim?: boolean;
  claimNummer?: string;
}

export interface Schade extends SchadeFormData {
  _id: Id<"voertuigSchades">;
}

// Zod schema
const schadeFormSchema = z.object({
  voertuigId: z.string().optional(),
  datum: z.date({ message: "Datum is verplicht" }),
  beschrijving: z.string().min(1, "Beschrijving is verplicht"),
  ernst: z.enum(["klein", "gemiddeld", "groot"]),
  schadeType: z.enum(["deuk", "kras", "breuk", "mechanisch", "overig"]),
  gerapporteerdDoor: z.string().min(1, "Gerapporteerd door is verplicht"),
  status: z.enum(["nieuw", "in_reparatie", "afgehandeld"]),
  reparatieKosten: z.number().min(0).optional(),
  verzekeringsClaim: z.boolean(),
  claimNummer: z.string().optional(),
});

type SchadeFormSchemaData = z.infer<typeof schadeFormSchema>;

interface SchadeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voertuigId?: Id<"voertuigen">;
  initialData?: Schade | null;
  onSuccess?: () => void;
}

export function SchadeForm({
  open,
  onOpenChange,
  voertuigId: propVoertuigId,
  initialData,
  onSuccess,
}: SchadeFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const voertuigen = useQuery(api.voertuigen.getActive);
  const createSchade = useMutation(api.voertuigSchades.create);
  const updateSchade = useMutation(api.voertuigSchades.update);

  const isEditMode = !!initialData;

  const form = useForm<SchadeFormSchemaData>({
    resolver: zodResolver(schadeFormSchema),
    defaultValues: {
      voertuigId: propVoertuigId,
      datum: new Date(),
      beschrijving: "",
      ernst: "klein",
      schadeType: "overig",
      gerapporteerdDoor: "",
      status: "nieuw",
      reparatieKosten: undefined,
      verzekeringsClaim: false,
      claimNummer: "",
    },
  });

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          voertuigId: initialData.voertuigId,
          datum: new Date(initialData.datum),
          beschrijving: initialData.beschrijving,
          ernst: initialData.ernst,
          schadeType: initialData.schadeType,
          gerapporteerdDoor: initialData.gerapporteerdDoor,
          status: initialData.status,
          reparatieKosten: initialData.reparatieKosten,
          verzekeringsClaim: initialData.verzekeringsClaim ?? false,
          claimNummer: initialData.claimNummer || "",
        });
      } else {
        form.reset({
          voertuigId: propVoertuigId,
          datum: new Date(),
          beschrijving: "",
          ernst: "klein",
          schadeType: "overig",
          gerapporteerdDoor: "",
          status: "nieuw",
          reparatieKosten: undefined,
          verzekeringsClaim: false,
          claimNummer: "",
        });
      }
    }
  }, [initialData, propVoertuigId, open, form]);

  const handleFormSubmit = async (data: SchadeFormSchemaData) => {
    const voertuigId = data.voertuigId || propVoertuigId;
    if (!voertuigId) {
      form.setError("voertuigId", { message: "Selecteer een voertuig" });
      return;
    }

    setIsLoading(true);

    try {
      if (isEditMode && initialData) {
        await updateSchade({
          id: initialData._id,
          datum: data.datum.getTime(),
          beschrijving: data.beschrijving,
          ernst: data.ernst,
          schadeType: data.schadeType,
          fotoUrls: initialData.fotoUrls,
          gerapporteerdDoor: data.gerapporteerdDoor,
          status: data.status,
          reparatieKosten: data.reparatieKosten,
          verzekeringsClaim: data.verzekeringsClaim,
          claimNummer: data.claimNummer || undefined,
        });
        showSuccessToast("Schademelding bijgewerkt");
      } else {
        await createSchade({
          voertuigId: voertuigId as Id<"voertuigen">,
          datum: data.datum.getTime(),
          beschrijving: data.beschrijving,
          ernst: data.ernst,
          schadeType: data.schadeType,
          gerapporteerdDoor: data.gerapporteerdDoor,
          status: data.status,
          reparatieKosten: data.reparatieKosten,
          verzekeringsClaim: data.verzekeringsClaim,
          claimNummer: data.claimNummer || undefined,
        });
        showSuccessToast("Schademelding toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving schade:", error);
      showErrorToast(
        isEditMode
          ? "Fout bij bijwerken schademelding"
          : "Fout bij toevoegen schademelding",
        { description: getMutationErrorMessage(error) }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const verzekeringsClaim = form.watch("verzekeringsClaim");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Schademelding bewerken" : "Nieuwe schademelding"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Pas de schademelding aan"
              : "Registreer een nieuwe schade aan een voertuig"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Voertuig selectie (alleen tonen als niet vooraf geselecteerd) */}
              {!propVoertuigId && (
                <FormField
                  control={form.control}
                  name="voertuigId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voertuig *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isEditMode}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer voertuig" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          {voertuigen?.map((v) => (
                            <SelectItem key={v._id} value={v._id}>
                              {v.kenteken} - {v.merk} {v.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Datum */}
              <FormField
                control={form.control}
                name="datum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum schade *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "d MMMM yyyy", { locale: nl })
                            ) : (
                              <span>Selecteer datum</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={nl}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Schade type en Ernst */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="schadeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type schade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          {schadeTypeOptions.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ernst"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ernst *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          {ernstOptions.map((ernst) => (
                            <SelectItem key={ernst.value} value={ernst.value}>
                              {ernst.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Beschrijving */}
              <FormField
                control={form.control}
                name="beschrijving"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschrijving *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Beschrijf de schade..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gerapporteerd door */}
              <FormField
                control={form.control}
                name="gerapporteerdDoor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gerapporteerd door *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Naam medewerker" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reparatiekosten */}
              <FormField
                control={form.control}
                name="reparatieKosten"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reparatiekosten</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">
                          &euro;
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-7"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : undefined
                            )
                          }
                          placeholder="0,00"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Verzekeringsclaim */}
              <FormField
                control={form.control}
                name="verzekeringsClaim"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Verzekeringsclaim</FormLabel>
                      <FormDescription>
                        Is er een claim ingediend bij de verzekering?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Claimnummer (alleen tonen als verzekeringsClaim true is) */}
              {verzekeringsClaim && (
                <FormField
                  control={form.control}
                  name="claimNummer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Claimnummer</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Bijv. CLM-2024-001234"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Bijwerken" : "Toevoegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
