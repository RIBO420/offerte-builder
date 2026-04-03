"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { m } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Upload,
  Trash2,
  Loader2,
  Palette,
  Image as ImageIcon,
  FileText,
  LayoutTemplate,
  Check,
  Eye,
} from "lucide-react";
import type { TemplateStijl } from "@/components/pdf/pdf-theme";

// ── Types ───────────────────────────────────────────────────────────

interface HuisstijlTabProps {
  reducedMotion: boolean;
  instellingen: {
    pdfLogoStorageId?: Id<"_storage">;
    pdfPrimaireKleur?: string;
    pdfSecundaireKleur?: string;
    pdfTemplateStijl?: TemplateStijl;
    pdfVoorwaarden?: {
      offerte?: string;
      factuur?: string;
      contract?: string;
    };
  } | null;
}

interface Voorwaarden {
  offerte: string;
  factuur: string;
  contract: string;
}

// ── Constants ───────────────────────────────────────────────────────

const DEFAULT_PRIMAIRE_KLEUR = "#16a34a";
const DEFAULT_SECUNDAIRE_KLEUR = "#1a1a1a";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
];

const TEMPLATE_STIJLEN: {
  value: TemplateStijl;
  naam: string;
  beschrijving: string;
}[] = [
  {
    value: "klassiek",
    naam: "Klassiek",
    beschrijving:
      "Vertrouwde layout met groene accenten en scope-badges",
  },
  {
    value: "minimalistisch",
    naam: "Minimalistisch",
    beschrijving:
      "Strak ontwerp met veel witruimte en dunne lijnen",
  },
  {
    value: "bold",
    naam: "Bold",
    beschrijving:
      "Opvallend design met grote gekleurde headers",
  },
];

const DUMMY_OFFERTE = {
  offerteNummer: "OFF-2026-001",
  type: "aanleg" as const,
  status: "concept",
  klant: {
    naam: "Familie de Vries",
    adres: "Eikenstraat 15",
    postcode: "3581 KL",
    plaats: "Utrecht",
    email: "devries@example.nl",
    telefoon: "06-12345678",
  },
  algemeenParams: { bereikbaarheid: "goed" },
  scopes: ["bestrating", "borders", "gras"],
  regels: [
    { id: "1", scope: "bestrating", omschrijving: "Tegels 60x60 antraciet", eenheid: "m²", hoeveelheid: 45, prijsPerEenheid: 35, totaal: 1575, type: "materiaal" as const },
    { id: "2", scope: "bestrating", omschrijving: "Legwerk bestrating", eenheid: "m²", hoeveelheid: 45, prijsPerEenheid: 25, totaal: 1125, type: "arbeid" as const },
    { id: "3", scope: "borders", omschrijving: "Lavendel", eenheid: "stuk", hoeveelheid: 30, prijsPerEenheid: 8.50, totaal: 255, type: "materiaal" as const },
    { id: "4", scope: "gras", omschrijving: "Graszoden", eenheid: "m²", hoeveelheid: 60, prijsPerEenheid: 12, totaal: 720, type: "materiaal" as const },
  ],
  totalen: {
    materiaalkosten: 2550, arbeidskosten: 1125, totaalUren: 45,
    subtotaal: 3675, marge: 735, margePercentage: 20,
    totaalExBtw: 4410, btw: 926.10, totaalInclBtw: 5336.10,
  },
  notities: "Voorbeeld offerte ter illustratie van de gekozen template stijl.",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ── Component ───────────────────────────────────────────────────────

export function HuisstijlTab({
  reducedMotion,
  instellingen,
}: HuisstijlTabProps) {
  const updatePdfBranding = useMutation(api.instellingen.updatePdfBranding);
  const generateUploadUrl = useMutation(api.fotoStorage.generateUploadUrl);
  const deleteFile = useMutation(api.fotoStorage.deleteFile);

  // Logo URL query
  const logoStorageId = instellingen?.pdfLogoStorageId ?? null;
  const logoUrl = useQuery(
    api.fotoStorage.getUrl,
    logoStorageId ? { storageId: logoStorageId } : "skip"
  );

  // ── Local state ─────────────────────────────────────────────────

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [primaireKleur, setPrimaireKleur] = useState(DEFAULT_PRIMAIRE_KLEUR);
  const [secundaireKleur, setSecundaireKleur] = useState(
    DEFAULT_SECUNDAIRE_KLEUR
  );
  const [templateStijl, setTemplateStijl] = useState<TemplateStijl>("klassiek");
  const [voorwaarden, setVoorwaarden] = useState<Voorwaarden>({
    offerte: "",
    factuur: "",
    contract: "",
  });
  const [previewingStijl, setPreviewingStijl] = useState<TemplateStijl | null>(null);

  // ── Sync from server ────────────────────────────────────────────

  useEffect(() => {
    if (instellingen) {
      setPrimaireKleur(
        instellingen.pdfPrimaireKleur ?? DEFAULT_PRIMAIRE_KLEUR
      );
      setSecundaireKleur(
        instellingen.pdfSecundaireKleur ?? DEFAULT_SECUNDAIRE_KLEUR
      );
      setTemplateStijl(instellingen.pdfTemplateStijl ?? "klassiek");
      setVoorwaarden({
        offerte: instellingen.pdfVoorwaarden?.offerte ?? "",
        factuur: instellingen.pdfVoorwaarden?.factuur ?? "",
        contract: instellingen.pdfVoorwaarden?.contract ?? "",
      });
    }
  }, [instellingen]);

  // ── Save helpers ────────────────────────────────────────────────

  const saveBranding = useCallback(
    async (updates: Parameters<typeof updatePdfBranding>[0]) => {
      setIsSaving(true);
      try {
        await updatePdfBranding(updates);
        toast.success("Huisstijl opgeslagen");
      } catch {
        toast.error("Fout bij opslaan huisstijl");
      } finally {
        setIsSaving(false);
      }
    },
    [updatePdfBranding]
  );

  // ── Logo upload ─────────────────────────────────────────────────

  const validateLogoFile = (file: File): string | null => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return "Alleen PNG, JPG of SVG bestanden zijn toegestaan.";
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
      return `Bestand is te groot (${sizeInMb} MB). Maximaal 2 MB.`;
    }
    return null;
  };

  const uploadLogo = useCallback(
    async (file: File) => {
      const error = validateLogoFile(file);
      if (error) {
        toast.error(error);
        return;
      }

      setIsUploadingLogo(true);
      try {
        // Step 1: Get upload URL
        const uploadUrl = await generateUploadUrl();

        // Step 2: Upload file to Convex storage
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Upload mislukt (status ${response.status})`);
        }

        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };

        // Step 3: Save storageId to branding settings
        await updatePdfBranding({ pdfLogoStorageId: storageId });

        // Step 4: Delete old logo if present
        if (logoStorageId) {
          try {
            await deleteFile({ storageId: logoStorageId });
          } catch {
            // Non-critical: old file cleanup failed
          }
        }

        toast.success("Logo geüpload");
      } catch {
        toast.error("Fout bij uploaden logo");
      } finally {
        setIsUploadingLogo(false);
      }
    },
    [generateUploadUrl, updatePdfBranding, deleteFile, logoStorageId]
  );

  const handleRemoveLogo = useCallback(async () => {
    if (!logoStorageId) return;

    setIsUploadingLogo(true);
    try {
      // Clear the logo reference first
      await updatePdfBranding({
        pdfLogoStorageId: null,
      });

      // Then delete the file
      try {
        await deleteFile({ storageId: logoStorageId });
      } catch {
        // Non-critical
      }

      toast.success("Logo verwijderd");
    } catch {
      toast.error("Fout bij verwijderen logo");
    } finally {
      setIsUploadingLogo(false);
    }
  }, [logoStorageId, updatePdfBranding, deleteFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadLogo(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // ── Color save on blur ──────────────────────────────────────────

  const handlePrimaireKleurBlur = useCallback(() => {
    if (primaireKleur !== (instellingen?.pdfPrimaireKleur ?? DEFAULT_PRIMAIRE_KLEUR)) {
      saveBranding({ pdfPrimaireKleur: primaireKleur });
    }
  }, [primaireKleur, instellingen?.pdfPrimaireKleur, saveBranding]);

  const handleSecundaireKleurBlur = useCallback(() => {
    if (secundaireKleur !== (instellingen?.pdfSecundaireKleur ?? DEFAULT_SECUNDAIRE_KLEUR)) {
      saveBranding({ pdfSecundaireKleur: secundaireKleur });
    }
  }, [secundaireKleur, instellingen?.pdfSecundaireKleur, saveBranding]);

  // ── Template stijl save ─────────────────────────────────────────

  const handleTemplateStijlChange = useCallback(
    (stijl: TemplateStijl) => {
      setTemplateStijl(stijl);
      saveBranding({ pdfTemplateStijl: stijl });
    },
    [saveBranding]
  );

  // ── Voorwaarden save on blur ────────────────────────────────────

  const handleVoorwaardenBlur = useCallback(
    (veld: keyof Voorwaarden) => {
      const huidigeWaarde = instellingen?.pdfVoorwaarden?.[veld] ?? "";
      if (voorwaarden[veld] !== huidigeWaarde) {
        saveBranding({
          pdfVoorwaarden: {
            offerte: voorwaarden.offerte || undefined,
            factuur: voorwaarden.factuur || undefined,
            contract: voorwaarden.contract || undefined,
          },
        });
      }
    },
    [voorwaarden, instellingen?.pdfVoorwaarden, saveBranding]
  );

  // ── Preview PDF genereren ───────────────────────────────────────

  const handlePreviewTemplate = useCallback(
    async (stijl: TemplateStijl) => {
      setPreviewingStijl(stijl);
      try {
        // Dynamic imports to avoid loading ~500KB eagerly
        const [{ pdf }, { OffertePDF }, { createPdfTheme }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/pdf/offerte-pdf"),
          import("@/components/pdf/pdf-theme"),
        ]);

        const theme = createPdfTheme(
          {
            logoUrl: logoUrl ?? null,
            primaireKleur,
            secundaireKleur,
            bedrijfsnaam: "Top Tuinen",
            bedrijfsgegevens: {},
          },
          stijl
        );

        const blob = await pdf(
          <OffertePDF
            offerte={DUMMY_OFFERTE}
            theme={theme}
            voorwaarden={voorwaarden.offerte || undefined}
          />
        ).toBlob();

        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");

        // Clean up the blob URL after a short delay to allow the tab to load
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } catch {
        toast.error("Fout bij genereren van voorbeeld PDF");
      } finally {
        setPreviewingStijl(null);
      }
    },
    [logoUrl, primaireKleur, secundaireKleur, voorwaarden.offerte]
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <m.div
      key="huisstijl"
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -20 }}
      transition={{ duration: reducedMotion ? 0 : 0.3 }}
      className="space-y-6"
    >
      {/* ── Sectie 1: Logo ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo
          </CardTitle>
          <CardDescription>
            Upload je bedrijfslogo voor gebruik op PDF documenten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logoStorageId && logoUrl ? (
            <div className="flex items-start gap-4">
              <div className="relative rounded-lg border bg-muted/30 p-4">
                <img
                  src={logoUrl}
                  alt="Bedrijfslogo"
                  className="h-20 w-auto max-w-[200px] object-contain"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
                disabled={isUploadingLogo}
                className="text-destructive hover:text-destructive"
              >
                {isUploadingLogo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Verwijderen
              </Button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              {isUploadingLogo ? (
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">
                {isUploadingLogo
                  ? "Bezig met uploaden..."
                  : "Sleep een bestand hierheen of klik om te kiezen"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG of SVG, maximaal 2 MB
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* ── Sectie 2: Kleuren ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Kleuren
          </CardTitle>
          <CardDescription>
            Kies de kleuren voor je PDF documenten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Primaire kleur */}
            <div className="space-y-2">
              <Label htmlFor="primaire-kleur">Primaire kleur</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primaire-kleur-picker"
                  value={primaireKleur}
                  onChange={(e) => setPrimaireKleur(e.target.value)}
                  onBlur={handlePrimaireKleurBlur}
                  className="h-10 w-10 cursor-pointer rounded border p-0.5"
                />
                <Input
                  id="primaire-kleur"
                  value={primaireKleur}
                  onChange={(e) => setPrimaireKleur(e.target.value)}
                  onBlur={handlePrimaireKleurBlur}
                  placeholder="#16a34a"
                  className="font-mono uppercase"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Gebruikt voor headers, accenten en links
              </p>
            </div>

            {/* Secundaire kleur */}
            <div className="space-y-2">
              <Label htmlFor="secundaire-kleur">Secundaire kleur</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="secundaire-kleur-picker"
                  value={secundaireKleur}
                  onChange={(e) => setSecundaireKleur(e.target.value)}
                  onBlur={handleSecundaireKleurBlur}
                  className="h-10 w-10 cursor-pointer rounded border p-0.5"
                />
                <Input
                  id="secundaire-kleur"
                  value={secundaireKleur}
                  onChange={(e) => setSecundaireKleur(e.target.value)}
                  onBlur={handleSecundaireKleurBlur}
                  placeholder="#1a1a1a"
                  className="font-mono uppercase"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Gebruikt voor tabelkoppen en secundaire elementen
              </p>
            </div>
          </div>

          {/* Color preview */}
          <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: primaireKleur }}
            />
            <div
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: secundaireKleur }}
            />
            <span className="text-sm text-muted-foreground">
              Voorbeeld van je kleurencombinatie
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Sectie 3: Template stijl ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Template stijl
          </CardTitle>
          <CardDescription>
            Kies een stijl voor je PDF documenten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {TEMPLATE_STIJLEN.map((stijl) => {
              const isActive = templateStijl === stijl.value;
              const isPreviewing = previewingStijl === stijl.value;
              return (
                <div key={stijl.value} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleTemplateStijlChange(stijl.value)}
                    disabled={isSaving}
                    className={`relative flex flex-1 flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:shadow-sm ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <h4 className="font-semibold">{stijl.naam}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stijl.beschrijving}
                    </p>
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewTemplate(stijl.value)}
                    disabled={previewingStijl !== null}
                    className="w-full"
                  >
                    {isPreviewing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {isPreviewing ? "Genereren..." : "Bekijk voorbeeld"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Sectie 4: Voorwaardenteksten ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Voorwaardenteksten
          </CardTitle>
          <CardDescription>
            Stel standaard voorwaarden in voor je documenten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="offerte">
              <AccordionTrigger>Offerte voorwaarden</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={voorwaarden.offerte}
                  onChange={(e) =>
                    setVoorwaarden((v) => ({ ...v, offerte: e.target.value }))
                  }
                  onBlur={() => handleVoorwaardenBlur("offerte")}
                  placeholder="Voer hier de standaard voorwaarden in die onderaan je offertes verschijnen..."
                  rows={6}
                  className="resize-y"
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="factuur">
              <AccordionTrigger>Factuur voorwaarden</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={voorwaarden.factuur}
                  onChange={(e) =>
                    setVoorwaarden((v) => ({ ...v, factuur: e.target.value }))
                  }
                  onBlur={() => handleVoorwaardenBlur("factuur")}
                  placeholder="Voer hier de standaard voorwaarden in die onderaan je facturen verschijnen..."
                  rows={6}
                  className="resize-y"
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="contract">
              <AccordionTrigger>Contract voorwaarden</AccordionTrigger>
              <AccordionContent>
                <Textarea
                  value={voorwaarden.contract}
                  onChange={(e) =>
                    setVoorwaarden((v) => ({ ...v, contract: e.target.value }))
                  }
                  onBlur={() => handleVoorwaardenBlur("contract")}
                  placeholder="Voer hier de standaard voorwaarden in die bij contracten verschijnen..."
                  rows={6}
                  className="resize-y"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Saving indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opslaan...
        </div>
      )}
    </m.div>
  );
}
