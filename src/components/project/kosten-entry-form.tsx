"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plus, Euro } from "lucide-react";
import { format, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Cost types
const kostenTypes = [
  { id: "materiaal", label: "Materiaal", icon: "M" },
  { id: "arbeid", label: "Arbeid", icon: "A" },
  { id: "machine", label: "Machine", icon: "MA" },
  { id: "overig", label: "Overig", icon: "O" },
] as const;

// All available scopes
const availableScopes = [
  { id: "grondwerk", label: "Grondwerk" },
  { id: "bestrating", label: "Bestrating" },
  { id: "borders", label: "Borders" },
  { id: "gras", label: "Gazon" },
  { id: "houtwerk", label: "Houtwerk" },
  { id: "water_elektra", label: "Water/Elektra" },
  { id: "specials", label: "Specials" },
  { id: "gras_onderhoud", label: "Gras Onderhoud" },
  { id: "borders_onderhoud", label: "Borders Onderhoud" },
  { id: "heggen", label: "Heggen" },
  { id: "bomen", label: "Bomen" },
  { id: "overig", label: "Overig" },
];

export interface KostenEntryData {
  datum: string;
  type: "materiaal" | "arbeid" | "machine" | "overig";
  omschrijving: string;
  bedrag: number;
  scope?: string;
  medewerker?: string;
  factuurNummer?: string;
  notities?: string;
}

interface KostenEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: KostenEntryData) => Promise<void>;
  isLoading?: boolean;
  initialData?: Partial<KostenEntryData>;
  projectScopes?: string[];
}

export function KostenEntryForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  initialData,
  projectScopes,
}: KostenEntryFormProps) {
  const [date, setDate] = useState<Date | undefined>(
    initialData?.datum ? new Date(initialData.datum) : new Date()
  );
  const [type, setType] = useState<"materiaal" | "arbeid" | "machine" | "overig">(
    initialData?.type || "materiaal"
  );
  const [omschrijving, setOmschrijving] = useState(initialData?.omschrijving || "");
  const [bedrag, setBedrag] = useState(initialData?.bedrag?.toString() || "");
  const [scope, setScope] = useState(initialData?.scope || "");
  const [medewerker, setMedewerker] = useState(initialData?.medewerker || "");
  const [factuurNummer, setFactuurNummer] = useState(initialData?.factuurNummer || "");
  const [notities, setNotities] = useState(initialData?.notities || "");

  // Filter scopes if project has specific scopes
  const filteredScopes = projectScopes?.length
    ? availableScopes.filter((s) => projectScopes.includes(s.id))
    : availableScopes;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!date || !omschrijving || !bedrag) return;

      await onSubmit({
        datum: format(date, "yyyy-MM-dd"),
        type,
        omschrijving: omschrijving.trim(),
        bedrag: parseFloat(bedrag) || 0,
        scope: scope && scope !== "__none__" ? scope : undefined,
        medewerker: medewerker.trim() || undefined,
        factuurNummer: factuurNummer.trim() || undefined,
        notities: notities.trim() || undefined,
      });

      // Reset form after successful submit
      setOmschrijving("");
      setBedrag("");
      setScope("");
      setMedewerker("");
      setFactuurNummer("");
      setNotities("");
    },
    [date, type, omschrijving, bedrag, scope, medewerker, factuurNummer, notities, onSubmit]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset form
    setDate(new Date());
    setType("materiaal");
    setOmschrijving("");
    setBedrag("");
    setScope("");
    setMedewerker("");
    setFactuurNummer("");
    setNotities("");
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Kosten toevoegen</DialogTitle>
            <DialogDescription>
              Voeg een nieuwe kostenpost toe aan het project
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Datum met snelkeuze */}
            <div className="grid gap-2">
              <Label>Datum</Label>
              {/* Snelkeuze knoppen */}
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge
                  variant={date && format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => setDate(new Date())}
                >
                  Vandaag
                </Badge>
                <Badge
                  variant={date && format(date, "yyyy-MM-dd") === format(subDays(new Date(), 1), "yyyy-MM-dd") ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => setDate(subDays(new Date(), 1))}
                >
                  Gisteren
                </Badge>
                <Badge
                  variant={date && format(date, "yyyy-MM-dd") === format(subDays(new Date(), 2), "yyyy-MM-dd") ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => setDate(subDays(new Date(), 2))}
                >
                  Eergisteren
                </Badge>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? (
                      format(date, "EEEE d MMMM yyyy", { locale: nl })
                    ) : (
                      <span>Selecteer datum</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={nl}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label>Type kosten</Label>
              <div className="flex flex-wrap gap-2">
                {kostenTypes.map((t) => (
                  <Badge
                    key={t.id}
                    variant={type === t.id ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 transition-colors px-3 py-1.5"
                    onClick={() => setType(t.id)}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Omschrijving */}
            <div className="grid gap-2">
              <Label htmlFor="omschrijving">Omschrijving *</Label>
              <Input
                id="omschrijving"
                value={omschrijving}
                onChange={(e) => setOmschrijving(e.target.value)}
                placeholder="Bijv. Levering tegels, Machinehuur graafmachine..."
                required
              />
            </div>

            {/* Bedrag */}
            <div className="grid gap-2">
              <Label htmlFor="bedrag">Bedrag (EUR) *</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="bedrag"
                  type="number"
                  min="0"
                  step="0.01"
                  value={bedrag}
                  onChange={(e) => setBedrag(e.target.value)}
                  placeholder="0,00"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Scope (optional) */}
            <div className="grid gap-2">
              <Label>Scope / Werkgebied (optioneel)</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer scope" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="__none__">Geen scope</SelectItem>
                  {filteredScopes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Medewerker (optional, for arbeid type) */}
            {type === "arbeid" && (
              <div className="grid gap-2">
                <Label htmlFor="medewerker">Medewerker (optioneel)</Label>
                <Input
                  id="medewerker"
                  value={medewerker}
                  onChange={(e) => setMedewerker(e.target.value)}
                  placeholder="Naam medewerker"
                />
              </div>
            )}

            {/* Factuur nummer (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="factuurNummer">Factuur/Bon nummer (optioneel)</Label>
              <Input
                id="factuurNummer"
                value={factuurNummer}
                onChange={(e) => setFactuurNummer(e.target.value)}
                placeholder="Bijv. F2024-001"
              />
            </div>

            {/* Notities (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="notities">Notities (optioneel)</Label>
              <Textarea
                id="notities"
                value={notities}
                onChange={(e) => setNotities(e.target.value)}
                placeholder="Extra opmerkingen..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !date || !omschrijving || !bedrag}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Button trigger component for convenience
interface KostenEntryButtonProps {
  onClick: () => void;
}

export function KostenEntryButton({ onClick }: KostenEntryButtonProps) {
  return (
    <Button onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      Kosten toevoegen
    </Button>
  );
}
