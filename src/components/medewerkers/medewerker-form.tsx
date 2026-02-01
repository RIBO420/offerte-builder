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
import { Loader2, User, Clock, GraduationCap, Award, FileText, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { SkillsSelector, Specialisatie } from "./skills-selector";
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

const defaultFormData: MedewerkerFormData = {
  naam: "",
  email: "",
  telefoon: "",
  functie: "",
  uurtarief: "",
  notities: "",
  contractType: "",
  werkdagen: [1, 2, 3, 4, 5], // Ma-Vr
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
};

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
  const [formData, setFormData] = useState<MedewerkerFormData>(defaultFormData);
  const [isLoading, setIsLoading] = useState(false);

  const createMedewerker = useMutation(api.medewerkers.create);
  const updateMedewerker = useMutation(api.medewerkers.update);

  const isEditMode = !!initialData;

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
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

    // Build the data object for Convex
    const beschikbaarheid = formData.werkdagen.length > 0
      ? {
          werkdagen: formData.werkdagen,
          urenPerWeek: parseInt(formData.urenPerWeek) || 40,
          maxUrenPerDag: parseInt(formData.maxUrenPerDag) || 8,
        }
      : undefined;

    const adres = formData.straat.trim()
      ? {
          straat: formData.straat.trim(),
          postcode: formData.postcode.trim(),
          plaats: formData.plaats.trim(),
        }
      : undefined;

    const noodcontact = formData.noodcontactNaam.trim()
      ? {
          naam: formData.noodcontactNaam.trim(),
          telefoon: formData.noodcontactTelefoon.trim(),
          relatie: formData.noodcontactRelatie.trim(),
        }
      : undefined;

    try {
      if (isEditMode && initialData) {
        await updateMedewerker({
          id: initialData._id,
          naam: formData.naam,
          email: formData.email || undefined,
          telefoon: formData.telefoon || undefined,
          functie: formData.functie || undefined,
          uurtarief: formData.uurtarief ? parseFloat(formData.uurtarief) : undefined,
          notities: formData.notities || undefined,
          contractType: formData.contractType as ContractType || undefined,
          beschikbaarheid,
          specialisaties: formData.specialisaties.length > 0 ? formData.specialisaties : undefined,
          certificaten: formData.certificaten.length > 0 ? formData.certificaten : undefined,
          adres,
          noodcontact,
        });
        toast.success("Medewerker bijgewerkt");
      } else {
        await createMedewerker({
          naam: formData.naam,
          email: formData.email || undefined,
          telefoon: formData.telefoon || undefined,
          functie: formData.functie || undefined,
          uurtarief: formData.uurtarief ? parseFloat(formData.uurtarief) : undefined,
          notities: formData.notities || undefined,
          contractType: formData.contractType as ContractType || undefined,
          beschikbaarheid,
          specialisaties: formData.specialisaties.length > 0 ? formData.specialisaties : undefined,
          certificaten: formData.certificaten.length > 0 ? formData.certificaten : undefined,
          adres,
          noodcontact,
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

  const handleWerkdagToggle = useCallback((dag: number) => {
    setFormData((prev) => ({
      ...prev,
      werkdagen: prev.werkdagen.includes(dag)
        ? prev.werkdagen.filter((d) => d !== dag)
        : [...prev.werkdagen, dag],
    }));
  }, []);

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
                      <div className="flex flex-wrap gap-2">
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

                    {/* Uren */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
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
                      <div className="space-y-2">
                        <Label htmlFor="maxUrenPerDag">Max uren per dag</Label>
                        <Input
                          id="maxUrenPerDag"
                          type="number"
                          min="0"
                          max="12"
                          value={formData.maxUrenPerDag}
                          onChange={(e) =>
                            setFormData({ ...formData, maxUrenPerDag: e.target.value })
                          }
                          placeholder="8"
                        />
                      </div>
                    </div>
                  </motion.div>
                </AccordionContent>
              </AccordionItem>

              {/* Specialisaties */}
              <AccordionItem value="specialisaties" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    <span className="font-medium">Specialisaties</span>
                    {formData.specialisaties.length > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {formData.specialisaties.length}
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
                      value={formData.specialisaties}
                      onChange={(specs) =>
                        setFormData({ ...formData, specialisaties: specs })
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

              {/* Adresgegevens */}
              <AccordionItem value="adres" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">Adresgegevens</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="straat">Straat + huisnummer</Label>
                      <Input
                        id="straat"
                        value={formData.straat}
                        onChange={(e) =>
                          setFormData({ ...formData, straat: e.target.value })
                        }
                        placeholder="Hoofdstraat 123"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postcode">Postcode</Label>
                        <Input
                          id="postcode"
                          value={formData.postcode}
                          onChange={(e) =>
                            setFormData({ ...formData, postcode: e.target.value })
                          }
                          placeholder="1234 AB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plaats">Plaats</Label>
                        <Input
                          id="plaats"
                          value={formData.plaats}
                          onChange={(e) =>
                            setFormData({ ...formData, plaats: e.target.value })
                          }
                          placeholder="Amsterdam"
                        />
                      </div>
                    </div>
                  </motion.div>
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
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid gap-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="noodcontactNaam">Naam</Label>
                        <Input
                          id="noodcontactNaam"
                          value={formData.noodcontactNaam}
                          onChange={(e) =>
                            setFormData({ ...formData, noodcontactNaam: e.target.value })
                          }
                          placeholder="Maria Jansen"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="noodcontactRelatie">Relatie</Label>
                        <Input
                          id="noodcontactRelatie"
                          value={formData.noodcontactRelatie}
                          onChange={(e) =>
                            setFormData({ ...formData, noodcontactRelatie: e.target.value })
                          }
                          placeholder="Partner"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="noodcontactTelefoon">Telefoon</Label>
                      <Input
                        id="noodcontactTelefoon"
                        value={formData.noodcontactTelefoon}
                        onChange={(e) =>
                          setFormData({ ...formData, noodcontactTelefoon: e.target.value })
                        }
                        placeholder="06-12345678"
                      />
                    </div>
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
