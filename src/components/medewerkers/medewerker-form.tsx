"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
import { Loader2, User, Clock, GraduationCap, Award, FileText } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { SkillsSelector, Skill } from "./skills-selector";
import { CertificatenList, Certificaat } from "./certificaat-form";

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
  { value: "oproep", label: "Oproepkracht" },
  { value: "zzp", label: "ZZP" },
] as const;

export const WERKDAGEN = [
  { key: "ma", label: "Maandag" },
  { key: "di", label: "Dinsdag" },
  { key: "wo", label: "Woensdag" },
  { key: "do", label: "Donderdag" },
  { key: "vr", label: "Vrijdag" },
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
];

export type ContractType = typeof CONTRACT_TYPE_OPTIONS[number]["value"];

export interface MedewerkerFormData {
  naam: string;
  email: string;
  telefoon: string;
  functie: string;
  uurtarief: string;
  notities: string;
  contractType: ContractType | "";
  werkdagen: string[];
  urenPerWeek: string;
  vaardigheden: Skill[];
  certificaten: Certificaat[];
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
  // Extended fields (stored as JSON in notities or separate fields when schema is updated)
  contractType?: ContractType;
  beschikbaarheid?: {
    werkdagen: string[];
    urenPerWeek?: number;
  };
  vaardigheden?: Skill[];
  certificaten?: Certificaat[];
}

const defaultFormData: MedewerkerFormData = {
  naam: "",
  email: "",
  telefoon: "",
  functie: "",
  uurtarief: "",
  notities: "",
  contractType: "",
  werkdagen: ["ma", "di", "wo", "do", "vr"],
  urenPerWeek: "40",
  vaardigheden: [],
  certificaten: [],
};

interface MedewerkerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Medewerker | null;
  onSuccess?: () => void;
}

// Helper to serialize extended data to a JSON string
function serializeExtendedData(data: {
  contractType?: ContractType | "";
  werkdagen?: string[];
  urenPerWeek?: string;
  vaardigheden?: Skill[];
  certificaten?: Certificaat[];
}): string {
  const extended = {
    contractType: data.contractType || undefined,
    beschikbaarheid:
      data.werkdagen && data.werkdagen.length > 0
        ? {
            werkdagen: data.werkdagen,
            urenPerWeek: data.urenPerWeek
              ? parseInt(data.urenPerWeek)
              : undefined,
          }
        : undefined,
    vaardigheden:
      data.vaardigheden && data.vaardigheden.length > 0
        ? data.vaardigheden
        : undefined,
    certificaten:
      data.certificaten && data.certificaten.length > 0
        ? data.certificaten
        : undefined,
  };

  // Filter out undefined values
  const filtered = Object.fromEntries(
    Object.entries(extended).filter(([, v]) => v !== undefined)
  );

  return Object.keys(filtered).length > 0
    ? `\n---EXTENDED_DATA---\n${JSON.stringify(filtered)}`
    : "";
}

// Helper to parse extended data from notities
function parseExtendedData(notities?: string): {
  plainNotities: string;
  contractType?: ContractType;
  werkdagen?: string[];
  urenPerWeek?: number;
  vaardigheden?: Skill[];
  certificaten?: Certificaat[];
} {
  if (!notities) {
    return { plainNotities: "" };
  }

  const marker = "---EXTENDED_DATA---";
  const markerIndex = notities.indexOf(marker);

  if (markerIndex === -1) {
    return { plainNotities: notities };
  }

  const plainNotities = notities.substring(0, markerIndex).trim();
  const jsonPart = notities.substring(markerIndex + marker.length).trim();

  try {
    const parsed = JSON.parse(jsonPart);
    return {
      plainNotities,
      contractType: parsed.contractType,
      werkdagen: parsed.beschikbaarheid?.werkdagen,
      urenPerWeek: parsed.beschikbaarheid?.urenPerWeek,
      vaardigheden: parsed.vaardigheden,
      certificaten: parsed.certificaten,
    };
  } catch {
    return { plainNotities: notities };
  }
}

export function MedewerkerForm({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: MedewerkerFormProps) {
  const [formData, setFormData] = useState<MedewerkerFormData>(defaultFormData);
  const [isLoading, setIsLoading] = useState(false);

  const createMedewerker = useMutation(api.medewerkers.create);
  const updateMedewerker = useMutation(api.medewerkers.update);

  const isEditMode = !!initialData;

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        const extended = parseExtendedData(initialData.notities);
        setFormData({
          naam: initialData.naam,
          email: initialData.email || "",
          telefoon: initialData.telefoon || "",
          functie: initialData.functie || "",
          uurtarief: initialData.uurtarief?.toString() || "",
          notities: extended.plainNotities,
          contractType: extended.contractType || "",
          werkdagen: extended.werkdagen || ["ma", "di", "wo", "do", "vr"],
          urenPerWeek: extended.urenPerWeek?.toString() || "40",
          vaardigheden: extended.vaardigheden || [],
          certificaten: extended.certificaten || [],
        });
      } else {
        setFormData(defaultFormData);
      }
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.naam.trim()) {
      toast.error("Vul de naam in");
      return;
    }

    setIsLoading(true);

    // Combine plain notities with extended data
    const extendedDataStr = serializeExtendedData({
      contractType: formData.contractType,
      werkdagen: formData.werkdagen,
      urenPerWeek: formData.urenPerWeek,
      vaardigheden: formData.vaardigheden,
      certificaten: formData.certificaten,
    });
    const combinedNotities = (formData.notities.trim() + extendedDataStr).trim() || undefined;

    try {
      if (isEditMode && initialData) {
        await updateMedewerker({
          id: initialData._id,
          naam: formData.naam,
          email: formData.email || undefined,
          telefoon: formData.telefoon || undefined,
          functie: formData.functie || undefined,
          uurtarief: formData.uurtarief
            ? parseFloat(formData.uurtarief)
            : undefined,
          notities: combinedNotities,
        });
        toast.success("Medewerker bijgewerkt");
      } else {
        await createMedewerker({
          naam: formData.naam,
          email: formData.email || undefined,
          telefoon: formData.telefoon || undefined,
          functie: formData.functie || undefined,
          uurtarief: formData.uurtarief
            ? parseFloat(formData.uurtarief)
            : undefined,
          notities: combinedNotities,
        });
        toast.success("Medewerker toegevoegd");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving medewerker:", error);
      toast.error(
        isEditMode
          ? "Fout bij bijwerken medewerker"
          : "Fout bij toevoegen medewerker"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setFormData(defaultFormData);
  }, [onOpenChange]);

  const handleWerkdagToggle = useCallback(
    (dag: string) => {
      setFormData((prev) => ({
        ...prev,
        werkdagen: prev.werkdagen.includes(dag)
          ? prev.werkdagen.filter((d) => d !== dag)
          : [...prev.werkdagen, dag],
      }));
    },
    []
  );

  const isFormValid = formData.naam.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
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

          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <Accordion type="multiple" defaultValue={["basis", "beschikbaarheid", "vaardigheden"]} className="space-y-4">
              <AccordionItem value="basis" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Basisgegevens</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-4"
                  >
                    {/* Naam en Functie */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="naam">Naam *</Label>
                        <Input
                          id="naam"
                          value={formData.naam}
                          onChange={(e) =>
                            setFormData({ ...formData, naam: e.target.value })
                          }
                          placeholder="Jan Jansen"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="functie">Functie</Label>
                        <Select
                          value={formData.functie}
                          onValueChange={(value) =>
                            setFormData({ ...formData, functie: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer functie" />
                          </SelectTrigger>
                          <SelectContent>
                            {FUNCTIE_OPTIONS.map((functie) => (
                              <SelectItem key={functie} value={functie}>
                                {functie}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Email en Telefoon */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          placeholder="jan@voorbeeld.nl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telefoon">Telefoon</Label>
                        <Input
                          id="telefoon"
                          value={formData.telefoon}
                          onChange={(e) =>
                            setFormData({ ...formData, telefoon: e.target.value })
                          }
                          placeholder="06-12345678"
                        />
                      </div>
                    </div>

                    {/* Contract Type en Uurtarief */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contractType">Contract type</Label>
                        <Select
                          value={formData.contractType}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              contractType: value as ContractType,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer type" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTRACT_TYPE_OPTIONS.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uurtarief">Uurtarief (optioneel)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            EUR
                          </span>
                          <Input
                            id="uurtarief"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-12"
                            value={formData.uurtarief}
                            onChange={(e) =>
                              setFormData({ ...formData, uurtarief: e.target.value })
                            }
                            placeholder="45.00"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {/* Werkdagen */}
                    <div className="space-y-3">
                      <Label>Werkdagen</Label>
                      <div className="flex flex-wrap gap-3">
                        {WERKDAGEN.map((dag) => (
                          <div
                            key={dag.key}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`dag-${dag.key}`}
                              checked={formData.werkdagen.includes(dag.key)}
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

                    {/* Uren per week */}
                    <div className="space-y-2 max-w-[200px]">
                      <Label htmlFor="urenPerWeek">Uren per week</Label>
                      <Input
                        id="urenPerWeek"
                        type="number"
                        min="0"
                        max="60"
                        value={formData.urenPerWeek}
                        onChange={(e) =>
                          setFormData({ ...formData, urenPerWeek: e.target.value })
                        }
                        placeholder="40"
                      />
                    </div>
                  </motion.div>
                </AccordionContent>
              </AccordionItem>

              {/* Vaardigheden */}
              <AccordionItem value="vaardigheden" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    <span className="font-medium">Vaardigheden</span>
                    {formData.vaardigheden.length > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {formData.vaardigheden.length}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <SkillsSelector
                      value={formData.vaardigheden}
                      onChange={(skills) =>
                        setFormData({ ...formData, vaardigheden: skills })
                      }
                    />
                  </motion.div>
                </AccordionContent>
              </AccordionItem>

              {/* Certificaten */}
              <AccordionItem value="certificaten" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    <span className="font-medium">Certificaten</span>
                    {formData.certificaten.length > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {formData.certificaten.length}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <CertificatenList
                      certificaten={formData.certificaten}
                      onChange={(certs) =>
                        setFormData({ ...formData, certificaten: certs })
                      }
                    />
                  </motion.div>
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Textarea
                      value={formData.notities}
                      onChange={(e) =>
                        setFormData({ ...formData, notities: e.target.value })
                      }
                      placeholder="Extra informatie over de medewerker..."
                      rows={4}
                    />
                  </motion.div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isLoading || !isFormValid}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Bijwerken" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
