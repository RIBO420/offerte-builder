"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { formatDistanceToNow } from "date-fns";
import { nl } from "@/lib/date-locale";
import {
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  RotateCcw,
  FilePlus,
  User,
  Home,
  TreePine,
  Search,
  Ruler,
  Paintbrush,
  CalendarClock,
  SprayCan,
  ImageIcon,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Lead } from "./lead-card";

// ============================================
// Pipeline status configuration
// ============================================

type PipelineStatus =
  | "nieuw"
  | "contact_gehad"
  | "offerte_verstuurd"
  | "gewonnen"
  | "verloren";

const statusBadgeConfig: Record<
  PipelineStatus,
  { label: string; className: string }
> = {
  nieuw: {
    label: "Nieuw",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  contact_gehad: {
    label: "Contact gehad",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  offerte_verstuurd: {
    label: "Offerte verstuurd",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  },
  gewonnen: {
    label: "Gewonnen",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  verloren: {
    label: "Verloren",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
};

const typeBadgeConfig: Record<string, { label: string; className: string }> = {
  gazon: {
    label: "Gazon",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  boomschors: {
    label: "Boomschors",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  verticuteren: {
    label: "Verticuteren",
    className:
      "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  },
  contact: {
    label: "Website",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

// Quick action mapping: current status → next status
const quickActionMap: Record<
  PipelineStatus,
  { label: string; nextStatus: PipelineStatus } | null
> = {
  nieuw: { label: "Contact gehad", nextStatus: "contact_gehad" },
  contact_gehad: {
    label: "Offerte verstuurd",
    nextStatus: "offerte_verstuurd",
  },
  offerte_verstuurd: { label: "Gewonnen", nextStatus: "gewonnen" },
  gewonnen: null,
  verloren: { label: "Heropenen", nextStatus: "nieuw" },
};

// Activity dot colors
const activityDotColors: Record<string, string> = {
  status_wijziging: "bg-yellow-500",
  notitie: "bg-blue-500",
  toewijzing: "bg-purple-500",
  offerte_gekoppeld: "bg-indigo-500",
  aangemaakt: "bg-green-500",
};

// Price formatter
const priceFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// ============================================
// FotoLightbox component
// ============================================

interface FotoLightboxProps {
  fotos: { storageId: Id<"_storage">; url: string }[];
  initialIndex: number;
  onClose: () => void;
}

function FotoLightbox({ fotos, initialIndex, onClose }: FotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % fotos.length);
  }, [fotos.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + fotos.length) % fotos.length);
  }, [fotos.length]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goToNext, goToPrev]);

  const currentFoto = fotos[currentIndex];
  if (!currentFoto) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={`Foto ${currentIndex + 1} van ${fotos.length}`}
      aria-modal="true"
    >
      {/* Teller */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
        {currentIndex + 1} / {fotos.length}
      </div>

      {/* Sluit-knop */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
        aria-label="Sluiten"
      >
        <X className="size-5" />
      </button>

      {/* Vorige-knop */}
      {fotos.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
          aria-label="Vorige foto"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {/* Foto */}
      <img
        src={currentFoto.url}
        alt={`Foto ${currentIndex + 1} van ${fotos.length}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Volgende-knop */}
      {fotos.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
          aria-label="Volgende foto"
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>
  );
}

// ============================================
// EditablePriceField component
// ============================================

/**
 * Parse een Nederlandse prijsstring naar een getal.
 * Accepteert formaten als "1.234", "1234", "1.234,56", "€ 1.234" etc.
 */
function parseDutchPrice(value: string): number | null {
  // Strip alles behalve cijfers, punt en komma
  const cleaned = value.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;

  // NL-format: punt = duizendtallen, komma = decimaal
  // Verwijder duizendtallen-punten en vervang komma door punt
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function EditablePriceField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | undefined;
  onSave: (value: number) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setInputValue(value ? String(value).replace(".", ",") : "");
    setIsEditing(true);
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  async function handleSave() {
    const parsed = parseDutchPrice(inputValue);
    if (parsed === null && inputValue.trim() !== "") {
      showErrorToast("Ongeldige prijs");
      return;
    }

    const newValue = parsed ?? 0;
    // Alleen opslaan als de waarde verschilt
    if (newValue === (value ?? 0)) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het opslaan"
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex-1 rounded-lg border border-primary bg-muted/30 px-3 py-2">
        <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">€</span>
          <Input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-6 px-1 py-0 text-sm font-semibold border-0 bg-transparent shadow-none focus-visible:ring-0"
            placeholder="0"
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-left hover:border-primary/50 hover:bg-muted/50 transition-colors group cursor-pointer"
    >
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        {label}
        <Pencil className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </p>
      <p className="text-sm font-semibold">
        {value ? priceFormatter.format(value) : "-"}
      </p>
    </button>
  );
}

// ============================================
// LeadDetailModal component
// ============================================

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailModal({ lead, open, onClose }: LeadDetailModalProps) {
  const [notitie, setNotitie] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Mutations
  const updatePipelineStatus = useMutation(
    api.configuratorAanvragen.updatePipelineStatus
  );
  const verwijderLead = useMutation(api.configuratorAanvragen.verwijder);
  const markGewonnen = useMutation(api.configuratorAanvragen.markGewonnen);
  const toewijzen = useMutation(api.configuratorAanvragen.toewijzen);
  const createActiviteit = useMutation(api.leadActiviteiten.create);
  const updatePrijzen = useMutation(api.configuratorAanvragen.updatePrijzen);

  // Queries (only run when modal is open and lead is set)
  const activiteiten = useQuery(
    api.leadActiviteiten.listByLead,
    lead ? { leadId: lead._id } : "skip"
  );
  const users = useQuery(api.users.listUsersWithDetails, lead ? {} : "skip");
  const fotoUrls = useQuery(
    api.fotoStorage.getUrls,
    lead && lead.fotoIds && lead.fotoIds.length > 0
      ? { storageIds: lead.fotoIds }
      : "skip"
  );

  const handleVerwijder = useCallback(async () => {
    if (!lead) return;
    setIsDeleting(true);
    try {
      await verwijderLead({ id: lead._id });
      showSuccessToast("Lead verwijderd");
      onClose();
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het verwijderen"
      );
    } finally {
      setIsDeleting(false);
    }
  }, [lead, verwijderLead, onClose]);

  if (!lead) return null;

  const pipelineStatus: PipelineStatus =
    (lead.pipelineStatus as PipelineStatus) ?? "nieuw";
  const statusConfig = statusBadgeConfig[pipelineStatus];
  const typeConfig = typeBadgeConfig[lead.type] ?? {
    label: lead.type,
    className: "bg-gray-100 text-gray-800",
  };
  const quickAction = quickActionMap[pipelineStatus];

  // Handlers
  async function handleQuickAction() {
    if (!quickAction || !lead) return;

    try {
      if (quickAction.nextStatus === "gewonnen") {
        await markGewonnen({ id: lead._id });
        showSuccessToast("Lead gemarkeerd als gewonnen");
      } else {
        await updatePipelineStatus({
          id: lead._id,
          pipelineStatus: quickAction.nextStatus,
        });
        showSuccessToast(`Status gewijzigd naar "${quickAction.label}"`);
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het wijzigen van de status"
      );
    }
  }

  async function handleToewijzen(userId: string) {
    if (!lead) return;

    try {
      await toewijzen({
        id: lead._id,
        toegewezenAan: userId as Id<"users">,
      });
      showSuccessToast("Lead toegewezen");
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het toewijzen"
      );
    }
  }

  async function handleSaveNotitie() {
    if (!notitie.trim() || !lead) return;

    setIsSavingNote(true);
    try {
      await createActiviteit({
        leadId: lead._id,
        type: "notitie",
        beschrijving: notitie.trim(),
      });
      setNotitie("");
      showSuccessToast("Notitie opgeslagen");
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Er ging iets mis bij het opslaan"
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  // Build Google Maps link
  const adresParts = [
    lead.klantHuisnummer,
    lead.klantPostcode,
    lead.klantPlaats,
  ].filter(Boolean);
  const adresString = adresParts.join(", ");
  const mapsUrl = adresString
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresString)}`
    : null;

  // Specificaties rendering
  const specs = lead.specificaties as Record<string, unknown> | undefined;

  // Contact-specifieke velden
  const isContact = lead.type === "contact";
  const onderwerp = specs?.onderwerp as string | undefined;
  const bericht = specs?.bericht as string | undefined;
  const tuinoppervlak = specs?.tuinoppervlak as string | undefined;
  const heeftOntwerp = specs?.heeftOntwerp as string | undefined;
  const onderhoudFrequentie = specs?.onderhoudFrequentie as string | undefined;
  const reinigingOpties = specs?.reinigingOpties as string[] | undefined;
  const hoeGevonden = specs?.hoeGevonden as string | undefined;

  const onderwerpLabels: Record<string, string> = {
    tuinonderhoud: "Tuinonderhoud",
    tuinaanleg: "Tuinaanleg",
    reiniging: "Reiniging",
    zakelijk: "Zakelijk",
    anders: "Anders",
  };

  // Find assigned user
  const assignedUser = users?.find((u) => u._id === lead.toegewezenAan);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="text-xl">{lead.klantNaam}</DialogTitle>
            <Badge
              variant="secondary"
              className={statusConfig.className}
            >
              {statusConfig.label}
            </Badge>
            <Badge
              variant="secondary"
              className={typeConfig.className}
            >
              {typeConfig.label}
            </Badge>
            <div className="ml-auto flex items-center gap-1.5">
              {quickAction && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleQuickAction}
                >
                  {pipelineStatus === "verloren" ? (
                    <RotateCcw className="size-3.5 mr-1.5" />
                  ) : (
                    <ArrowRight className="size-3.5 mr-1.5" />
                  )}
                  {quickAction.label}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lead verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je de lead van {lead.klantNaam} wilt
                      verwijderen? Dit verwijdert ook alle activiteiten en
                      foto&apos;s. Deze actie kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleVerwijder}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Verwijderen..." : "Verwijderen"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Details en activiteiten voor lead {lead.klantNaam}
          </DialogDescription>
        </DialogHeader>

        {/* Body: two columns */}
        <div className="flex flex-col md:flex-row gap-6 overflow-hidden flex-1 min-h-0">
          {/* Left column — Lead information */}
          <div className="flex-1 overflow-y-auto space-y-6 md:pr-2">
            {/* 1. Contactgegevens */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Contactgegevens</h3>
              <div className="space-y-2">
                {lead.klantEmail && (
                  <a
                    href={`mailto:${lead.klantEmail}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="size-4 shrink-0" />
                    <span className="truncate">{lead.klantEmail}</span>
                  </a>
                )}
                {lead.klantTelefoon && (
                  <a
                    href={`tel:${lead.klantTelefoon}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="size-4 shrink-0" />
                    <span>{lead.klantTelefoon}</span>
                  </a>
                )}
                {!lead.klantEmail && !lead.klantTelefoon && (
                  <p className="text-sm text-muted-foreground">
                    Geen contactgegevens beschikbaar
                  </p>
                )}
              </div>
            </section>

            {/* 2. Locatie */}
            {(lead.klantPostcode || lead.klantHuisnummer || lead.klantPlaats || lead.klantAdres) && (
              <section>
                <h3 className="text-sm font-semibold mb-3">Locatie</h3>
                <div className="space-y-2">
                  {lead.klantHuisnummer && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Home className="size-4 shrink-0" />
                      <span>Huisnummer {lead.klantHuisnummer}</span>
                    </div>
                  )}
                  {(lead.klantPostcode || lead.klantPlaats) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" />
                      <span>
                        {[lead.klantPostcode, lead.klantPlaats].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  {lead.klantAdres && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" />
                      <span>{lead.klantAdres}</span>
                    </div>
                  )}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                    >
                      <MapPin className="size-3" />
                      Bekijk op Google Maps
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* 3. Projectinfo (contact leads) */}
            {isContact && onderwerp && (
              <section>
                <h3 className="text-sm font-semibold mb-3">Projectinfo</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <TreePine className="size-3" />
                      Onderwerp
                    </p>
                    <p className="text-sm font-medium">
                      {onderwerpLabels[onderwerp] ?? onderwerp}
                    </p>
                  </div>
                  {tuinoppervlak && (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Ruler className="size-3" />
                        Tuinoppervlak
                      </p>
                      <p className="text-sm font-medium">{tuinoppervlak}</p>
                    </div>
                  )}
                  {onderwerp === "tuinaanleg" && heeftOntwerp && (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Paintbrush className="size-3" />
                        Heeft ontwerp
                      </p>
                      <p className="text-sm font-medium">{heeftOntwerp}</p>
                    </div>
                  )}
                  {onderwerp === "tuinonderhoud" && onderhoudFrequentie && (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        Frequentie
                      </p>
                      <p className="text-sm font-medium">{onderhoudFrequentie}</p>
                    </div>
                  )}
                  {onderwerp === "reiniging" && reinigingOpties && reinigingOpties.length > 0 && (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 col-span-2">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <SprayCan className="size-3" />
                        Reiniging van
                      </p>
                      <p className="text-sm font-medium">{reinigingOpties.join(", ")}</p>
                    </div>
                  )}
                </div>
                {bericht && (
                  <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground mb-1">Bericht</p>
                    <p className="text-sm whitespace-pre-wrap">{bericht}</p>
                  </div>
                )}
              </section>
            )}

            {/* 3b. Specificaties (niet-contact leads) */}
            {!isContact && specs && Object.keys(specs).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-3">Specificaties</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-sm font-medium">
                        {String(value ?? "-")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Marketingbron */}
            {(hoeGevonden || lead.bron) && (
              <section>
                <h3 className="text-sm font-semibold mb-3">Bron</h3>
                <div className="space-y-2">
                  {hoeGevonden && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Search className="size-4 shrink-0" />
                      <span>Gevonden via: {hoeGevonden}</span>
                    </div>
                  )}
                  {lead.bron && (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">Leadbron</p>
                      <p className="text-sm font-medium capitalize">
                        {lead.bron.replace(/_/g, " ")}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 5. Foto's */}
            {lead.fotoIds && lead.fotoIds.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <ImageIcon className="size-4" />
                  Foto&apos;s ({lead.fotoIds.length})
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {fotoUrls
                    ? fotoUrls.map(({ storageId, url }, index) =>
                        url ? (
                          <button
                            key={storageId}
                            type="button"
                            onClick={() => setLightboxIndex(index)}
                            className="block aspect-square rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                          >
                            <img
                              src={url}
                              alt={`Foto ${index + 1}`}
                              className="size-full object-cover"
                            />
                          </button>
                        ) : null
                      )
                    : Array.from({ length: lead.fotoIds.length }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-square rounded-lg border bg-muted/30 animate-pulse"
                        />
                      ))}
                </div>
                {/* Foto lightbox */}
                {lightboxIndex !== null && fotoUrls && (
                  <FotoLightbox
                    fotos={fotoUrls.filter(
                      (f): f is { storageId: Id<"_storage">; url: string } => f.url !== null
                    )}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                  />
                )}
              </section>
            )}

            {/* 6. Prijzen */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Prijzen</h3>
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    Indicatieprijs
                  </p>
                  <p className="text-sm font-semibold">
                    {priceFormatter.format(lead.indicatiePrijs)}
                  </p>
                </div>
                <EditablePriceField
                  label="Geschatte waarde"
                  value={lead.geschatteWaarde}
                  onSave={async (value) => {
                    await updatePrijzen({
                      id: lead._id,
                      geschatteWaarde: value,
                    });
                    showSuccessToast("Geschatte waarde opgeslagen");
                  }}
                />
                <EditablePriceField
                  label="Definitieve prijs"
                  value={lead.definitievePrijs}
                  onSave={async (value) => {
                    await updatePrijzen({
                      id: lead._id,
                      definitievePrijs: value,
                    });
                    showSuccessToast("Definitieve prijs opgeslagen");
                  }}
                />
              </div>
            </section>

            {/* 4. Offertes */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Offertes</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Nog geen offertes gekoppeld aan deze lead
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`/offertes/nieuw/aanleg?leadId=${lead._id}`}
                >
                  <FilePlus className="size-3.5 mr-1.5" />
                  Offerte aanmaken
                </a>
              </Button>
            </section>

            {/* 5. Toewijzing */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Toewijzing</h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="size-4 shrink-0" />
                  <span>
                    {assignedUser
                      ? assignedUser.name ?? assignedUser.email
                      : "Niet toegewezen"}
                  </span>
                </div>
              </div>
              {users && users.length > 0 && (
                <div className="mt-2">
                  <Select
                    value={lead.toegewezenAan ?? ""}
                    onValueChange={handleToewijzen}
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue placeholder="Wijs toe aan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.name ?? user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </section>
          </div>

          {/* Right column — Activiteitenlog */}
          <div className="w-full md:w-[320px] shrink-0 bg-card rounded-lg border flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold mb-3">Activiteitenlog</h3>

              {/* Notitie input */}
              <Textarea
                placeholder="Schrijf een notitie..."
                value={notitie}
                onChange={(e) => setNotitie(e.target.value)}
                rows={2}
                className="mb-2 text-sm"
              />
              <Button
                size="sm"
                onClick={handleSaveNotitie}
                disabled={!notitie.trim() || isSavingNote}
                className="w-full"
              >
                {isSavingNote ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-4">
              {activiteiten && activiteiten.length > 0 ? (
                <div className="space-y-4">
                  {activiteiten.map((activiteit) => (
                    <div
                      key={activiteit._id}
                      className="flex gap-3 text-sm"
                    >
                      {/* Colored dot */}
                      <div className="mt-1.5 shrink-0">
                        <span
                          className={`block size-2.5 rounded-full ${
                            activityDotColors[activiteit.type] ??
                            "bg-gray-400"
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground leading-snug">
                          {activiteit.beschrijving}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(
                            new Date(activiteit.createdAt),
                            { addSuffix: true, locale: nl }
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nog geen activiteiten
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
