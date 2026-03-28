"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Form } from "@/components/ui/form";
import { Loader2, User, Clock, GraduationCap, Award, FileText, MapPin, Phone } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { Id } from "../../../convex/_generated/dataModel";
import { Specialisatie } from "./skills-selector";
import { Certificaat } from "./certificaat-form";

import { MedewerkerFormBasicInfo } from "./medewerker-form-basic-info";
import { MedewerkerFormBeschikbaarheid } from "./medewerker-form-beschikbaarheid";
import { MedewerkerFormSpecialisaties } from "./medewerker-form-specialisaties";
import { MedewerkerFormCertificaten } from "./medewerker-form-certificaten";
import { MedewerkerFormAdres } from "./medewerker-form-adres";
import { MedewerkerFormNoodcontact } from "./medewerker-form-noodcontact";
import { MedewerkerFormNotities } from "./medewerker-form-notities";

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
                    <MedewerkerFormBasicInfo />
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
                    <MedewerkerFormBeschikbaarheid />
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
                    <MedewerkerFormSpecialisaties />
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
                    <MedewerkerFormCertificaten />
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
                    <MedewerkerFormAdres />
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
                    <MedewerkerFormNoodcontact />
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
                    <MedewerkerFormNotities />
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
