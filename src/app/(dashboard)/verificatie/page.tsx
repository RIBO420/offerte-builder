"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { RequireAdmin } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPin, Mail, Phone, User, Euro, CheckCircle, XCircle, ClipboardList, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// ============================================
// Type definities
// ============================================

type AanvraagStatus =
  | "nieuw"
  | "in_behandeling"
  | "goedgekeurd"
  | "afgekeurd"
  | "voltooid";

type AanvraagType = "gazon" | "boomschors" | "verticuteren";

type ConfiguratorAanvraag = {
  _id: Id<"configuratorAanvragen">;
  type: AanvraagType;
  status: AanvraagStatus;
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  klantTelefoon: string;
  klantAdres: string;
  klantPostcode: string;
  klantPlaats: string;
  specificaties: Record<string, unknown>;
  indicatiePrijs: number;
  definitievePrijs?: number;
  betalingId?: string;
  betalingStatus?: "open" | "betaald" | "mislukt";
  notities?: string;
  toegewezenAan?: Id<"users">;
  verificatieNotities?: string;
  createdAt: number;
  updatedAt: number;
};

// ============================================
// Helper functies
// ============================================

function formatPrijs(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(bedrag);
}

function formatDatum(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

// ============================================
// Status badge component
// ============================================

const statusConfig: Record<
  AanvraagStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  nieuw: {
    label: "Nieuw",
    variant: "default",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  in_behandeling: {
    label: "In behandeling",
    variant: "outline",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  goedgekeurd: {
    label: "Goedgekeurd",
    variant: "outline",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  },
  afgekeurd: {
    label: "Afgekeurd",
    variant: "destructive",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  },
  voltooid: {
    label: "Voltooid",
    variant: "secondary",
    className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300",
  },
};

const typeConfig: Record<
  AanvraagType,
  { label: string; className: string }
> = {
  gazon: {
    label: "Gazon",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  boomschors: {
    label: "Boomschors",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  },
  verticuteren: {
    label: "Verticuteren",
    className: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300",
  },
};

function StatusBadge({ status }: { status: AanvraagStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function TypeBadge({ type }: { type: AanvraagType }) {
  const config = typeConfig[type];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// ============================================
// Specificaties samenvatting component
// ============================================

function SpecificatiesSamenvatting({
  type,
  specificaties,
}: {
  type: AanvraagType;
  specificaties: Record<string, unknown>;
}) {
  const items: Array<{ label: string; waarde: string }> = [];

  if (type === "gazon") {
    if (specificaties.oppervlakte) {
      items.push({ label: "Oppervlakte", waarde: `${specificaties.oppervlakte} m²` });
    }
    if (specificaties.soortGras) {
      items.push({ label: "Soort gras", waarde: String(specificaties.soortGras) });
    }
    if (specificaties.ondergrond) {
      items.push({ label: "Ondergrond", waarde: String(specificaties.ondergrond) });
    }
  } else if (type === "boomschors") {
    if (specificaties.oppervlakte) {
      items.push({ label: "Oppervlakte", waarde: `${specificaties.oppervlakte} m²` });
    }
    if (specificaties.dikte) {
      items.push({ label: "Dikte laag", waarde: `${specificaties.dikte} cm` });
    }
    if (specificaties.soort) {
      items.push({ label: "Soort schors", waarde: String(specificaties.soort) });
    }
  } else if (type === "verticuteren") {
    if (specificaties.oppervlakte) {
      items.push({ label: "Oppervlakte", waarde: `${specificaties.oppervlakte} m²` });
    }
    if (specificaties.frequentie) {
      items.push({ label: "Frequentie", waarde: String(specificaties.frequentie) });
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Geen specificaties beschikbaar</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.label} className="text-xs bg-muted px-2 py-1 rounded">
          <span className="font-medium">{item.label}:</span> {item.waarde}
        </span>
      ))}
    </div>
  );
}

// ============================================
// Volledige specificaties component (voor detail sheet)
// ============================================

function VolleSpecificaties({
  specificaties,
}: {
  specificaties: Record<string, unknown>;
}) {
  const entries = Object.entries(specificaties).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Geen specificaties opgegeven</p>
    );
  }

  return (
    <div className="grid gap-2">
      {entries.map(([sleutel, waarde]) => (
        <div key={sleutel} className="flex justify-between items-start py-1 border-b last:border-0">
          <span className="text-sm font-medium capitalize">
            {sleutel.replace(/([A-Z])/g, " $1").toLowerCase()}
          </span>
          <span className="text-sm text-muted-foreground text-right max-w-[60%]">
            {typeof waarde === "boolean"
              ? waarde
                ? "Ja"
                : "Nee"
              : String(waarde)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Detail Sheet component
// ============================================

function AanvraagDetailSheet({
  aanvraag,
  users,
  open,
  onClose,
}: {
  aanvraag: ConfiguratorAanvraag | null;
  users: Array<{ _id: Id<"users">; name: string; email: string }>;
  open: boolean;
  onClose: () => void;
}) {
  const [notitie, setNotitie] = useState("");
  const [definitievePrijs, setDefinitievePrijs] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateStatusMutation = useMutation(api.configuratorAanvragen.updateStatus);
  const addNotitieMutation = useMutation(api.configuratorAanvragen.addNotitie);
  const setPrijsMutation = useMutation(api.configuratorAanvragen.setPrijs);
  const toewijzenMutation = useMutation(api.configuratorAanvragen.toewijzen);

  const handleStatusWijzigen = async (nieuweStatus: AanvraagStatus) => {
    if (!aanvraag) return;
    setIsSubmitting(true);
    try {
      await updateStatusMutation({
        id: aanvraag._id,
        status: nieuweStatus,
      });
      toast.success(`Status gewijzigd naar "${statusConfig[nieuweStatus].label}"`);
    } catch {
      toast.error("Fout bij wijzigen status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotitieOpslaan = async () => {
    if (!aanvraag || !notitie.trim()) return;
    setIsSubmitting(true);
    try {
      await addNotitieMutation({ id: aanvraag._id, notitie });
      toast.success("Notitie opgeslagen");
      setNotitie("");
    } catch {
      toast.error("Fout bij opslaan notitie");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrijsInstellen = async () => {
    if (!aanvraag || !definitievePrijs) return;
    const prijs = parseFloat(definitievePrijs.replace(",", "."));
    if (isNaN(prijs) || prijs < 0) {
      toast.error("Voer een geldige prijs in");
      return;
    }
    setIsSubmitting(true);
    try {
      await setPrijsMutation({ id: aanvraag._id, definitievePrijs: prijs });
      toast.success("Definitieve prijs ingesteld");
      setDefinitievePrijs("");
    } catch {
      toast.error("Fout bij instellen prijs");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToewijzen = async (userId: string) => {
    if (!aanvraag) return;
    setIsSubmitting(true);
    try {
      await toewijzenMutation({
        id: aanvraag._id,
        toegewezenAan: userId as Id<"users">,
      });
      toast.success("Aanvraag toegewezen");
    } catch {
      toast.error("Fout bij toewijzen aanvraag");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!aanvraag) return null;

  const googleMapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    `${aanvraag.klantAdres}, ${aanvraag.klantPostcode} ${aanvraag.klantPlaats}`
  )}`;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Aanvraag {aanvraag.referentie}
          </SheetTitle>
          <SheetDescription>
            Ingediend op {formatDatum(aanvraag.createdAt)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Status & type */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={aanvraag.status} />
            <TypeBadge type={aanvraag.type} />
          </div>

          {/* Klantgegevens */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Klantgegevens</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{aanvraag.klantNaam}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${aanvraag.klantEmail}`}
                  className="text-primary hover:underline"
                >
                  {aanvraag.klantEmail}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${aanvraag.klantTelefoon}`}
                  className="hover:underline"
                >
                  {aanvraag.klantTelefoon}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p>{aanvraag.klantAdres}</p>
                  <p>
                    {aanvraag.klantPostcode} {aanvraag.klantPlaats}
                  </p>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    Bekijk op Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Specificaties */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Volledige specificaties</h3>
            <VolleSpecificaties specificaties={aanvraag.specificaties} />
          </div>

          {/* Prijzen */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Prijzen</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Indicatieprijs</span>
                <span className="font-medium">{formatPrijs(aanvraag.indicatiePrijs)}</span>
              </div>
              {aanvraag.definitievePrijs !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Definitieve prijs</span>
                  <span className="font-semibold text-primary">
                    {formatPrijs(aanvraag.definitievePrijs)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Verificatienotities */}
          {aanvraag.verificatieNotities && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Verificatienotities</h3>
              <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {aanvraag.verificatieNotities}
              </p>
            </div>
          )}

          {/* Acties sectie */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold">Acties</h3>

            {/* Status wijzigen */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status wijzigen</Label>
              <div className="flex flex-wrap gap-2">
                {aanvraag.status !== "in_behandeling" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusWijzigen("in_behandeling")}
                    disabled={isSubmitting}
                  >
                    In behandeling nemen
                  </Button>
                )}
                {aanvraag.status !== "goedgekeurd" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => handleStatusWijzigen("goedgekeurd")}
                    disabled={isSubmitting}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Goedkeuren
                  </Button>
                )}
                {aanvraag.status !== "afgekeurd" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-700 border-red-300 hover:bg-red-50"
                    onClick={() => handleStatusWijzigen("afgekeurd")}
                    disabled={isSubmitting}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Afkeuren
                  </Button>
                )}
                {aanvraag.status !== "voltooid" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusWijzigen("voltooid")}
                    disabled={isSubmitting}
                  >
                    Voltooien
                  </Button>
                )}
              </div>
            </div>

            {/* Definitieve prijs instellen */}
            <div className="space-y-2">
              <Label htmlFor="definitievePrijs" className="text-xs text-muted-foreground">
                Definitieve prijs instellen
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Euro className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="definitievePrijs"
                    placeholder="0,00"
                    value={definitievePrijs}
                    onChange={(e) => setDefinitievePrijs(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handlePrijsInstellen}
                  disabled={isSubmitting || !definitievePrijs}
                >
                  Instellen
                </Button>
              </div>
            </div>

            {/* Toewijzen aan medewerker */}
            {users.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Toewijzen aan medewerker
                </Label>
                <Select onValueChange={handleToewijzen} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer medewerker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((gebruiker) => (
                      <SelectItem key={gebruiker._id} value={gebruiker._id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          <span>{gebruiker.name}</span>
                          <span className="text-muted-foreground text-xs">({gebruiker.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notitie toevoegen */}
            <div className="space-y-2">
              <Label htmlFor="notitie" className="text-xs text-muted-foreground">
                Verificatienotitie toevoegen
              </Label>
              <Textarea
                id="notitie"
                placeholder="Voeg een interne notitie toe..."
                value={notitie}
                onChange={(e) => setNotitie(e.target.value)}
                rows={3}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleNotitieOpslaan}
                disabled={isSubmitting || !notitie.trim()}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Notitie opslaan
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Aanvraag card component
// ============================================

function AanvraagCard({
  aanvraag,
  users,
  onBeoordelen,
}: {
  aanvraag: ConfiguratorAanvraag;
  users: Array<{ _id: Id<"users">; name: string; email: string }>;
  onBeoordelen: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [definitievePrijs, setDefinitievePrijs] = useState("");
  const [afkeurReden, setAfkeurReden] = useState("");
  const [showAfkeurInput, setShowAfkeurInput] = useState(false);

  const updateStatusMutation = useMutation(api.configuratorAanvragen.updateStatus);
  const toewijzenMutation = useMutation(api.configuratorAanvragen.toewijzen);
  const setPrijsMutation = useMutation(api.configuratorAanvragen.setPrijs);

  const handleGoedkeuren = async () => {
    setIsSubmitting(true);
    try {
      if (definitievePrijs) {
        const prijs = parseFloat(definitievePrijs.replace(",", "."));
        if (!isNaN(prijs) && prijs >= 0) {
          await setPrijsMutation({ id: aanvraag._id, definitievePrijs: prijs });
        }
      }
      await updateStatusMutation({ id: aanvraag._id, status: "goedgekeurd" });
      toast.success("Aanvraag goedgekeurd");
      setDefinitievePrijs("");
    } catch {
      toast.error("Fout bij goedkeuren aanvraag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAfkeuren = async () => {
    if (!afkeurReden.trim()) {
      toast.error("Voer een reden in voor de afkeuring");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateStatusMutation({
        id: aanvraag._id,
        status: "afgekeurd",
        verificatieNotities: afkeurReden.trim(),
      });
      toast.success("Aanvraag afgekeurd");
      setAfkeurReden("");
      setShowAfkeurInput(false);
    } catch {
      toast.error("Fout bij afkeuren aanvraag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToewijzen = async (userId: string) => {
    setIsSubmitting(true);
    try {
      await toewijzenMutation({
        id: aanvraag._id,
        toegewezenAan: userId as Id<"users">,
      });
      toast.success("Aanvraag toegewezen");
    } catch {
      toast.error("Fout bij toewijzen aanvraag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toegewezenMedewerker = aanvraag.toegewezenAan
    ? users.find((u) => u._id === aanvraag.toegewezenAan)
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={aanvraag.status} />
            <TypeBadge type={aanvraag.type} />
          </div>
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
            {aanvraag.referentie}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Klantgegevens */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium">{aanvraag.klantNaam}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{aanvraag.klantEmail}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{aanvraag.klantTelefoon}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {aanvraag.klantAdres}, {aanvraag.klantPostcode} {aanvraag.klantPlaats}
            </span>
          </div>
        </div>

        {/* Specificaties samenvatting */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Specificaties</p>
          <SpecificatiesSamenvatting
            type={aanvraag.type}
            specificaties={aanvraag.specificaties}
          />
        </div>

        {/* Prijzen */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Indicatieprijs</p>
            <p className="font-semibold">{formatPrijs(aanvraag.indicatiePrijs)}</p>
          </div>
          {aanvraag.definitievePrijs !== undefined && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Definitieve prijs</p>
              <p className="font-semibold text-primary">
                {formatPrijs(aanvraag.definitievePrijs)}
              </p>
            </div>
          )}
        </div>

        {/* Toegewezen medewerker */}
        {toegewezenMedewerker && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            <UserCheck className="h-3.5 w-3.5" />
            <span>Toegewezen aan {toegewezenMedewerker.name}</span>
          </div>
        )}

        {/* Datum */}
        <p className="text-xs text-muted-foreground">
          Ingediend: {formatDatum(aanvraag.createdAt)}
        </p>

        {/* Optioneel goedkeurprijs veld */}
        {aanvraag.status === "nieuw" || aanvraag.status === "in_behandeling" ? (
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Euro className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Aangepaste prijs (optioneel)"
                  value={definitievePrijs}
                  onChange={(e) => setDefinitievePrijs(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Afkeurreden veld */}
            {showAfkeurInput && (
              <Textarea
                placeholder="Reden voor afkeuring (verplicht)"
                value={afkeurReden}
                onChange={(e) => setAfkeurReden(e.target.value)}
                rows={2}
                className="text-sm"
              />
            )}

            {/* Actieknoppen */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onBeoordelen}
                className="flex-1"
              >
                <ClipboardList className="h-4 w-4 mr-1" />
                Beoordelen
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleGoedkeuren}
                disabled={isSubmitting}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Goedkeuren
              </Button>
              {showAfkeurInput ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleAfkeuren}
                    disabled={isSubmitting || !afkeurReden.trim()}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Bevestig afkeuring
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAfkeurInput(false);
                      setAfkeurReden("");
                    }}
                  >
                    Annuleren
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-700 border-red-200 hover:bg-red-50"
                  onClick={() => setShowAfkeurInput(true)}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Afkeuren
                </Button>
              )}
            </div>

            {/* Toewijzen dropdown */}
            {users.length > 0 && (
              <Select onValueChange={handleToewijzen} disabled={isSubmitting}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Toewijzen aan medewerker..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((gebruiker) => (
                    <SelectItem key={gebruiker._id} value={gebruiker._id}>
                      {gebruiker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          /* Alleen beoordelen knop voor afgehandelde aanvragen */
          <div className="border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onBeoordelen}
              className="w-full"
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              Details bekijken
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Hoofd paginainhoud component
// ============================================

type TabFilter = "nieuw" | "in_behandeling" | "goedgekeurd" | "afgekeurd" | "alle";

function VerificatiePageContent() {
  const [actieveTab, setActieveTab] = useState<TabFilter>("nieuw");
  const [geselecteerdeAanvraag, setGeselecteerdeAanvraag] =
    useState<ConfiguratorAanvraag | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Real-time data via Convex
  const alleAanvragen = useQuery(api.configuratorAanvragen.list) as
    | ConfiguratorAanvraag[]
    | undefined;

  // Lijst van alle users voor toewijzen-functie
  const alleUsers = useQuery(api.users.listUsersWithDetails) ?? [];

  const users = useMemo(
    () =>
      alleUsers.map((u) => ({
        _id: u._id as Id<"users">,
        name: u.name,
        email: u.email,
      })),
    [alleUsers]
  );

  // Teller per status voor tab labels
  const tellerPerStatus = useMemo(() => {
    if (!alleAanvragen) return {} as Record<AanvraagStatus, number>;
    return alleAanvragen.reduce(
      (acc, aanvraag) => {
        acc[aanvraag.status] = (acc[aanvraag.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<AanvraagStatus, number>
    );
  }, [alleAanvragen]);

  // Gefilterde aanvragen op basis van actieve tab
  const gefilterdeAanvragen = useMemo(() => {
    if (!alleAanvragen) return [];
    if (actieveTab === "alle") return alleAanvragen;
    return alleAanvragen.filter((a) => a.status === actieveTab);
  }, [alleAanvragen, actieveTab]);

  const handleBeoordelen = (aanvraag: ConfiguratorAanvraag) => {
    setGeselecteerdeAanvraag(aanvraag);
    setDetailSheetOpen(true);
  };

  const isLoading = alleAanvragen === undefined;

  const tabLabel = (status: AanvraagStatus | "alle", label: string) => {
    const count =
      status === "alle"
        ? (alleAanvragen?.length ?? 0)
        : (tellerPerStatus[status] ?? 0);
    return count > 0 ? `${label} (${count})` : label;
  };

  if (isLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            </div>
            <p className="text-muted-foreground animate-pulse">Laden...</p>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Paginatitel */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Verificatie Aanvragen
          </h1>
          <p className="text-muted-foreground">
            Beoordeel online aanvragen van klanten
          </p>
        </div>

        {/* Filter tabs */}
        <Tabs
          value={actieveTab}
          onValueChange={(val) => setActieveTab(val as TabFilter)}
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="nieuw" className="text-xs sm:text-sm">
              {tabLabel("nieuw", "Nieuw")}
            </TabsTrigger>
            <TabsTrigger value="in_behandeling" className="text-xs sm:text-sm">
              {tabLabel("in_behandeling", "In behandeling")}
            </TabsTrigger>
            <TabsTrigger value="goedgekeurd" className="text-xs sm:text-sm">
              {tabLabel("goedgekeurd", "Goedgekeurd")}
            </TabsTrigger>
            <TabsTrigger value="afgekeurd" className="text-xs sm:text-sm">
              {tabLabel("afgekeurd", "Afgekeurd")}
            </TabsTrigger>
            <TabsTrigger value="alle" className="text-xs sm:text-sm">
              {tabLabel("alle", "Alle")}
            </TabsTrigger>
          </TabsList>

          {/* Aanvragen grid */}
          <div className="mt-6">
            {gefilterdeAanvragen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Geen aanvragen gevonden</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {actieveTab === "alle"
                    ? "Er zijn nog geen configurator-aanvragen binnengekomen."
                    : `Er zijn geen aanvragen met de status "${statusConfig[actieveTab as AanvraagStatus]?.label ?? actieveTab}".`}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gefilterdeAanvragen.map((aanvraag) => (
                  <AanvraagCard
                    key={aanvraag._id}
                    aanvraag={aanvraag}
                    users={users}
                    onBeoordelen={() => handleBeoordelen(aanvraag)}
                  />
                ))}
              </div>
            )}
          </div>
        </Tabs>
      </motion.div>

      {/* Detail sheet */}
      <AanvraagDetailSheet
        aanvraag={geselecteerdeAanvraag}
        users={users}
        open={detailSheetOpen}
        onClose={() => {
          setDetailSheetOpen(false);
          setGeselecteerdeAanvraag(null);
        }}
      />
    </>
  );
}

// ============================================
// Geexporteerde pagina component
// ============================================

export default function VerificatiePage() {
  return (
    <RequireAdmin>
      <VerificatiePageContent />
    </RequireAdmin>
  );
}
