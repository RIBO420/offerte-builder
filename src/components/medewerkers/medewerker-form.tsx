"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, User, Clock, GraduationCap, Award, FileText, MapPin, Phone } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { Id } from "../../../convex/_generated/dataModel";
import { SkillsSelector, Specialisatie } from "./skills-selector";
import { CertificatenList, Certificaat } from "./certificaat-form";
import { inputPatterns, formatInput, validateInput } from "@/lib/input-patterns";

export const FUNCTIE_OPTIONS = [
  "Hovenier",
  "Voorman",
  "Leerling",
  "Tuinontwerper",
  "Machinist",
  "Administratie",
  "Eigenaar",
  "Overig",
];

export const CONTRACT_TYPE_OPTIONS = [
  { value: "fulltime", label: "Fulltime" },
  { value: "parttime", label: "Parttime" },
  { value: "zzp", label: "ZZP" },
  { value: "seizoen", label: "Seizoenswerker" },
] as const;

export type ContractType = "fulltime" | "parttime" | "zzp" | "seizoen";

// Werkdagen as numbers (0=zondag, 1=maandag, etc.)
export const WERKDAGEN = [
  { key: 1, label: "Ma" },
  { key: 2, label: "Di" },
  { key: 3, label: "Wo" },
  { key: 4, label: "Do" },
  { key: 5, label: "Vr" },
  { key: 6, label: "Za" },
  { key: 0, label: "Zo" },
];

export interface MedewerkerFormData {
  naam: string;
  email: string;
  telefoon: string;
  functie: string;
  uurtarief: string;
  notities: string;
  contractType: ContractType | "";
  werkdagen: number[];
  urenPerWeek: string;
  maxUrenPerDag: string;
  specialisaties: Specialisatie[];
  certificaten: Certificaat[];
  // Adres
  straat: string;
  postcode: string;
  plaats: string;
  // Noodcontact
  noodcontactNaam: string;
  noodcontactTelefoon: string;
  noodcontactRelatie: string;
}

export interface Medewerker {
  _id: Id<"medewerkers">;
  naam: string;
  email?: string;
  telefoon?: string;
  functie?: string;
  uurtarief?: number;
  isActief: boolean;
  notities?: string;
  createdAt: number;
  updatedAt: number;
  contractType?: ContractType;
  beschikbaarheid?: {
    werkdagen: number[];
    urenPerWeek: number;
    maxUrenPerDag: number;
  };
  specialisaties?: Specialisatie[];
  certificaten?: Certificaat[];
  adres?: {
    straat: string;
    postcode: string;
    plaats: string;
  };
  noodcontact?: {
    naam: string;
    telefoon: string;
    relatie: string;
  };
}

// Zod schema for medewerker form
const medewerkerFormSchema = z.object({
  naam: z.string().min(1, "Naam is verplicht"),
  email: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
  telefoon: z.string().optional(),
  functie: z.string().optional(),
  uurtarief: z.string().optional(),
  notities: z.string().optional(),
  contractType: z.string().optional(),
  werkdagen: z.array(z.number()).optional(),
  urenPerWeek: z.string().optional(),
  maxUrenPerDag: z.string().optional(),
  specialisaties: z.custom<Specialisatie[]>().optional(),
  certificaten: z.custom<Certificaat[]>().optional(),
  straat: z.string().optional(),
  postcode: z.string().optional(),
  plaats: z.string().optional(),
  noodcontactNaam: z.string().optional(),
  noodcontactTelefoon: z.string().optional(),
  noodcontactRelatie: z.string().optional(),
});

type MedewerkerFormSchemaData = z.infer<typeof medewerkerFormSchema>;

interface MedewerkerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Medewerker | null;
  onSuccess?: () => void;
}

export function MedewerkerForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: MedewerkerFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const createMedewerker = useMutation(api.medewerkers.create);
  const updateMedewerker = useMutation(api.medewerkers.update);

  const isEditMode = !!initialData;

  const form = useForm<MedewerkerFormSchemaData>({
    resolver: zodResolver(medewerkerFormSchema),
    defaultValues: {
      naam: "",
      email: "",
      telefoon: "",
      functie: "",
      uurtarief: "",
      notities: "",
      contractType: "",
      werkdagen: [1, 2, 3, 4, 5],
      urenPerWeek: "40",
      maxUrenPerDag: "8",
      specialisaties: [],
      certificaten: [],
      straat: "",
      postcode: "",
      plaats: "",
      noodcontactNaam: "",
      noodcontactTelefoon: "",
      noodcontactRelatie: "",
    },
  });

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        form.reset({
          naam: initialData.naam,
          email: initialData.email || "",
          telefoon: initialData.telefoon || "",
          functie: initialData.functie || "",
          uurtarief: initialData.uurtarief?.toString() || "",
          notities: initialData.notities || "",
          contractType: initialData.contractType || "",
          werkdagen: initialData.beschikbaarheid?.werkdagen || [1, 2, 3, 4, 5],
          urenPerWeek: initialData.beschikbaarheid?.urenPerWeek?.toString() || "40",
          maxUrenPerDag: initialData.beschikbaarheid?.maxUrenPerDag?.toString() || "8",
          specialisaties: initialData.specialisaties || [],
          certificaten: initialData.certificaten || [],
          straat: initialData.adres?.straat || "",
          postcode: initialData.adres?.postcode || "",
          plaats: initialData.adres?.plaats || "",
          noodcontactNaam: initialData.noodcontact?.naam || "",
          noodcontactTelefoon: initialData.noodcontact?.telefoon || "",
          noodcontactRelatie: initialData.noodcontact?.relatie || "",
        });
      } else {
        form.reset({
          naam: "",
          email: "",
          telefoon: "",
          functie: "",
          uurtarief: "",
          notities: "",
          contractType: "",
          werkdagen: [1, 2, 3, 4, 5],
          urenPerWeek: "40",
          maxUrenPerDag: "8",
          specialisaties: [],
          certificaten: [],
          straat: "",
          postcode: "",
          plaats: "",
          noodcontactNaam: "",
          noodcontactTelefoon: "",
          noodcontactRelatie: "",
        });
      }
    }
  }, [initialData, open, form]);

  const handleFormSubmit = async (data: MedewerkerFormSchemaData) => {
    setIsLoading(true);

    // Build the data object for Convex
    const werkdagen = data.werkdagen ?? [];
    const beschikbaarheid = werkdagen.length > 0
      ? {
          werkdagen,
          urenPerWeek: parseInt(data.urenPerWeek || "40") || 40,
          maxUrenPerDag: parseInt(data.maxUrenPerDag || "8") || 8,
        }
      : undefined;

    const adres = data.straat?.trim()
      ? {
          straat: data.straat.trim(),
          postcode: data.postcode?.trim() || "",
          plaats: data.plaats?.trim() || "",
        }
      : undefined;

    const noodcontact = data.noodcontactNaam?.trim()
      ? {
          naam: data.noodcontactNaam.trim(),
          telefoon: data.noodcontactTelefoon?.trim() || "",
          relatie: data.noodcontactRelatie?.trim() || "",
        }
      : undefined;

    try {
      if (isEditMode && initialData) {
        await updateMedewerker({
          id: initialData._id,
          naam: data.naam,
          email: data.email || undefined,
          telefoon: data.telefoon || undefined,
          functie: data.functie || undefined,
          uurtarief: data.uurtarief ? parseFloat(data.uurtarief) : undefined,
          notities: data.notities || undefined,
          contractType: (data.contractType as ContractType) || undefined,
          beschikbaarheid,
          specialisaties: (data.specialisaties ?? []).length > 0 ? data.specialisaties : undefined,
          certificaten: (data.certificaten ?? []).length > 0 ? data.certificaten : undefined,
          adres,
          noodcontact,
        });
        showSuccessToast("Medewerker bijgewerkt");
      } else {
        await createMedewerker({
          naam: data.naam,
          email: data.email || undefined,
          telefoon: data.telefoon || undefined,
          functie: data.functie || undefined,
          uurtarief: data.uurtarief ? parseFloat(data.uurtarief) : undefined,
          notities: data.notities || undefined,
          contractType: (data.contractType as ContractType) || undefined,
          beschikbaarheid,
          specialisaties: (data.specialisaties ?? []).length > 0 ? data.specialisaties : undefined,
          certificaten: (data.certificaten ?? []).length > 0 ? data.certificaten : undefined,
          adres,
          noodcontact,
        });
        showSuccessToast("Medewerker toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving medewerker:", error);
      showErrorToast(
        isEditMode
          ? "Fout bij bijwerken medewerker"
          : "Fout bij toevoegen medewerker",
        { description: getMutationErrorMessage(error) }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleWerkdagToggle = useCallback(
    (dag: number) => {
      const current = form.getValues("werkdagen") ?? [];
      const newDagen = current.includes(dag)
        ? current.filter((d) => d !== dag)
        : [...current, dag];
      form.setValue("werkdagen", newDagen);
    },
    [form]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Medewerker bewerken" : "Nieuwe medewerker"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? `Pas de gegevens van ${initialData?.naam} aan`
                  : "Voeg een nieuwe medewerker toe aan je team"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <Accordion
                type="multiple"
                defaultValue={["basis", "beschikbaarheid"]}
                className="space-y-2"
              >
                {/* Basisgegevens */}
                <AccordionItem value="basis" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Basisgegevens</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid gap-4"
                    >
                      {/* Naam en Functie */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="naam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Naam *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Jan Jansen" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="functie"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Functie</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecteer functie" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {FUNCTIE_OPTIONS.map((functie) => (
                                    <SelectItem key={functie} value={functie}>
                                      {functie}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Email en Telefoon */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>E-mail</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder={inputPatterns.email.placeholder}
                                  inputMode={inputPatterns.email.inputMode}
                                  autoComplete={inputPatterns.email.autoComplete}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="telefoon"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefoon</FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value}
                                  onChange={(e) => {
                                    const formatted = formatInput("telefoon", e.target.value);
                                    field.onChange(formatted);
                                  }}
                                  placeholder={inputPatterns.telefoon.placeholder}
                                  inputMode={inputPatterns.telefoon.inputMode}
                                  autoComplete={inputPatterns.telefoon.autoComplete}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Contract Type en Uurtarief */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="contractType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contract type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecteer type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {CONTRACT_TYPE_OPTIONS.map((type) => (
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
                          name="uurtarief"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Uurtarief (optioneel)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    EUR
                                  </span>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="pl-12"
                                    placeholder="45.00"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </m.div>
                  </AccordionContent>
                </AccordionItem>

                {/* Beschikbaarheid */}
                <AccordionItem value="beschikbaarheid" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Beschikbaarheid</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      {/* Werkdagen */}
                      <div className="space-y-3">
                        <Label>Werkdagen</Label>
                        <div className="flex flex-wrap gap-2">
                          {WERKDAGEN.map((dag) => (
                            <div
                              key={dag.key}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`dag-${dag.key}`}
                                checked={(form.watch("werkdagen") ?? []).includes(dag.key)}
                                onCheckedChange={() => handleWerkdagToggle(dag.key)}
                              />
                              <Label
                                htmlFor={`dag-${dag.key}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {dag.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Uren */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="urenPerWeek"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Uren per week</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min="0"
                                  max="60"
                                  placeholder="40"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxUrenPerDag"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max uren per dag</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min="0"
                                  max="12"
                                  placeholder="8"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </m.div>
                  </AccordionContent>
                </AccordionItem>

                {/* Specialisaties */}
                <AccordionItem value="specialisaties" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      <span className="font-medium">Specialisaties</span>
                      {(form.watch("specialisaties") ?? []).length > 0 && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {(form.watch("specialisaties") ?? []).length}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Controller
                        control={form.control}
                        name="specialisaties"
                        render={({ field }) => (
                          <SkillsSelector
                            value={field.value ?? []}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    </m.div>
                  </AccordionContent>
                </AccordionItem>

                {/* Certificaten */}
                <AccordionItem value="certificaten" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      <span className="font-medium">Certificaten</span>
                      {(form.watch("certificaten") ?? []).length > 0 && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {(form.watch("certificaten") ?? []).length}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Controller
                        control={form.control}
                        name="certificaten"
                        render={({ field }) => (
                          <CertificatenList
                            certificaten={field.value ?? []}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    </m.div>
                  </AccordionContent>
                </AccordionItem>

                {/* Adresgegevens */}
                <AccordionItem value="adres" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Adresgegevens</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid gap-4"
                    >
                      <FormField
                        control={form.control}
                        name="straat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Straat + huisnummer</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Hoofdstraat 123" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="postcode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Postcode</FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value}
                                  onChange={(e) => {
                                    const formatted = formatInput("postcode", e.target.value);
                                    field.onChange(formatted);
                                  }}
                                  placeholder={inputPatterns.postcode.placeholder}
                                  inputMode={inputPatterns.postcode.inputMode}
                                  autoComplete={inputPatterns.postcode.autoComplete}
                                  maxLength={inputPatterns.postcode.maxLength}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="plaats"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Plaats</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Amsterdam" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </m.div>
                  </AccordionContent>
                </AccordionItem>

                {/* Noodcontact */}
                <AccordionItem value="noodcontact" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">Noodcontact</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid gap-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="noodcontactNaam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Naam</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Maria Jansen" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="noodcontactRelatie"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Relatie</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Partner" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="noodcontactTelefoon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefoon</FormLabel>
                            <FormControl>
                              <Input
                                value={field.value}
                                onChange={(e) => {
                                  const formatted = formatInput("telefoon", e.target.value);
                                  field.onChange(formatted);
                                }}
                                placeholder={inputPatterns.telefoon.placeholder}
                                inputMode={inputPatterns.telefoon.inputMode}
                                autoComplete={inputPatterns.telefoon.autoComplete}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </m.div>
                  </AccordionContent>
                </AccordionItem>

                {/* Notities */}
                <AccordionItem value="notities" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">Notities</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <FormField
                        control={form.control}
                        name="notities"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Extra informatie over de medewerker..."
                                rows={4}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </m.div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
