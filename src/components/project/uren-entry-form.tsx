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
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

export interface UrenEntryData {
  datum: string;
  medewerker: string;
  uren: number;
  scope?: string;
  notities?: string;
}

interface UrenEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UrenEntryData) => Promise<void>;
  isLoading?: boolean;
  initialData?: Partial<UrenEntryData>;
  existingMedewerkers?: string[];
  projectScopes?: string[];
}

export function UrenEntryForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  initialData,
  existingMedewerkers = [],
  projectScopes,
}: UrenEntryFormProps) {
  const [date, setDate] = useState<Date | undefined>(
    initialData?.datum ? new Date(initialData.datum) : new Date()
  );
  const [medewerker, setMedewerker] = useState(initialData?.medewerker || "");
  const [uren, setUren] = useState(initialData?.uren?.toString() || "");
  const [scope, setScope] = useState(initialData?.scope || "");
  const [notities, setNotities] = useState(initialData?.notities || "");
  const [showNewMedewerker, setShowNewMedewerker] = useState(false);

  // Filter scopes if project has specific scopes
  const filteredScopes = projectScopes?.length
    ? availableScopes.filter((s) => projectScopes.includes(s.id))
    : availableScopes;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!date || !medewerker || !uren) return;

      await onSubmit({
        datum: format(date, "yyyy-MM-dd"),
        medewerker: medewerker.trim(),
        uren: parseFloat(uren) || 0,
        scope: scope && scope !== "__none__" ? scope : undefined,
        notities: notities.trim() || undefined,
      });

      // Reset form after successful submit
      setMedewerker("");
      setUren("");
      setScope("");
      setNotities("");
      setShowNewMedewerker(false);
    },
    [date, medewerker, uren, scope, notities, onSubmit]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset form
    setDate(new Date());
    setMedewerker("");
    setUren("");
    setScope("");
    setNotities("");
    setShowNewMedewerker(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Uren registreren</DialogTitle>
            <DialogDescription>
              Voeg handmatig gewerkte uren toe aan het project
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Datum */}
            <div className="grid gap-2">
              <Label>Datum</Label>
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

            {/* Medewerker */}
            <div className="grid gap-2">
              <Label>Medewerker</Label>
              {existingMedewerkers.length > 0 && !showNewMedewerker ? (
                <div className="flex gap-2">
                  <Select value={medewerker} onValueChange={setMedewerker}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Kies medewerker" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingMedewerkers.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setShowNewMedewerker(true);
                      setMedewerker("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={medewerker}
                    onChange={(e) => setMedewerker(e.target.value)}
                    placeholder="Naam medewerker"
                    required
                  />
                  {existingMedewerkers.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewMedewerker(false)}
                    >
                      Kiezen
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Uren */}
            <div className="grid gap-2">
              <Label htmlFor="uren">Uren</Label>
              <Input
                id="uren"
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={uren}
                onChange={(e) => setUren(e.target.value)}
                placeholder="8"
                required
              />
              <p className="text-xs text-muted-foreground">
                Gewerkte uren (halve uren toegestaan, bijv. 7.5)
              </p>
            </div>

            {/* Scope (optional) */}
            <div className="grid gap-2">
              <Label>Scope / Taak (optioneel)</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Geen scope</SelectItem>
                  {filteredScopes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notities (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="notities">Notities (optioneel)</Label>
              <Textarea
                id="notities"
                value={notities}
                onChange={(e) => setNotities(e.target.value)}
                placeholder="Beschrijving van werkzaamheden..."
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
              disabled={isLoading || !date || !medewerker || !uren}
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
interface UrenEntryButtonProps {
  onClick: () => void;
}

export function UrenEntryButton({ onClick }: UrenEntryButtonProps) {
  return (
    <Button onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      Uren registreren
    </Button>
  );
}
