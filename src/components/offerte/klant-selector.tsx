"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, User, Plus, FileText, Clock, Euro } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKlantenSearch, useKlanten } from "@/hooks/use-klanten";
import { useKlantenWithStats } from "@/hooks/use-smart-analytics";
import { Id } from "../../../convex/_generated/dataModel";

type Klant = {
  _id: Id<"klanten">;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
};

type EnrichedKlant = Klant & {
  offerteCount: number;
  lastOfferteDate: number | null;
  lastOfferteNummer: string | null;
  lastOfferteStatus: string | null;
  totalSpent: number;
};

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (days < 30) return `${Math.floor(days / 7)} weken geleden`;
  if (days < 365) return `${Math.floor(days / 30)} maanden geleden`;
  return `${Math.floor(days / 365)} jaar geleden`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// WCAG AA compliant colors (4.5:1 contrast ratio)
function getStatusColor(status: string): string {
  switch (status) {
    case "geaccepteerd": return "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "afgewezen": return "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "verzonden": return "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "voorcalculatie": return "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    default: return "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

interface KlantData {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email: string;
  telefoon: string;
}

interface KlantSelectorProps {
  value: KlantData;
  onChange: (data: KlantData) => void;
  onKlantSelect?: (klantId: Id<"klanten"> | null) => void;
}

export function KlantSelector({
  value,
  onChange,
  onKlantSelect,
}: KlantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { results: searchResults } = useKlantenSearch(searchTerm);
  const { recentKlanten } = useKlanten();
  const { klanten: enrichedKlanten } = useKlantenWithStats(10);
  const [selectedKlantId, setSelectedKlantId] = useState<Id<"klanten"> | null>(
    null
  );

  const typedRecentKlanten = recentKlanten as Klant[];
  const typedSearchResults = searchResults as Klant[];
  const typedEnrichedKlanten = enrichedKlanten as EnrichedKlant[];

  const handleSelectKlant = (klant: {
    _id: Id<"klanten">;
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  }) => {
    setSelectedKlantId(klant._id);
    onChange({
      naam: klant.naam,
      adres: klant.adres,
      postcode: klant.postcode,
      plaats: klant.plaats,
      email: klant.email || "",
      telefoon: klant.telefoon || "",
    });
    onKlantSelect?.(klant._id);
    setOpen(false);
    setSearchTerm("");
  };

  const handleClearSelection = () => {
    setSelectedKlantId(null);
    onChange({
      naam: "",
      adres: "",
      postcode: "",
      plaats: "",
      email: "",
      telefoon: "",
    });
    onKlantSelect?.(null);
  };

  return (
    <div className="space-y-4">
      {/* Klant Zoeken */}
      <div className="space-y-2">
        <Label>Bestaande klant selecteren</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedKlantId && value.naam ? (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {value.naam}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Zoek of selecteer een klant...
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Zoek klant op naam..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="py-6 text-center text-sm">
                    <p className="text-muted-foreground">Geen klanten gevonden</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vul de gegevens hieronder handmatig in
                    </p>
                  </div>
                </CommandEmpty>
                {!searchTerm && typedEnrichedKlanten.length > 0 && (
                  <CommandGroup heading="Recente klanten">
                    {typedEnrichedKlanten.map((klant) => (
                      <CommandItem
                        key={klant._id}
                        value={klant.naam}
                        onSelect={() => handleSelectKlant(klant)}
                        className="flex-col items-start py-3"
                      >
                        <div className="flex w-full items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              selectedKlantId === klant._id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate" title={klant.naam}>{klant.naam}</span>
                              {klant.offerteCount > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {klant.offerteCount} offerte{klant.offerteCount !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {klant.adres}, {klant.plaats}
                            </span>
                          </div>
                        </div>
                        {/* Smart info: last offerte details */}
                        {klant.lastOfferteDate && (
                          <div className="ml-6 mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {klant.lastOfferteNummer}
                            </span>
                            {klant.lastOfferteStatus && (
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0 capitalize", getStatusColor(klant.lastOfferteStatus))}
                              >
                                {klant.lastOfferteStatus}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeDate(klant.lastOfferteDate)}
                            </span>
                            {klant.totalSpent > 0 && (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <Euro className="h-3 w-3" />
                                {formatCurrency(klant.totalSpent)}
                              </span>
                            )}
                          </div>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {searchTerm && typedSearchResults.length > 0 && (
                  <CommandGroup heading="Zoekresultaten">
                    {typedSearchResults.map((klant) => (
                      <CommandItem
                        key={klant._id}
                        value={klant.naam}
                        onSelect={() => handleSelectKlant(klant)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedKlantId === klant._id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{klant.naam}</span>
                          <span className="text-xs text-muted-foreground">
                            {klant.adres}, {klant.plaats}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedKlantId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1 rotate-45" />
            Nieuwe klant invoeren
          </Button>
        )}
      </div>

      {/* Handmatige invoer */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="naam">Naam *</Label>
          <Input
            id="naam"
            placeholder="Jan Jansen"
            value={value.naam}
            onChange={(e) => {
              onChange({ ...value, naam: e.target.value });
              if (selectedKlantId) handleClearSelection();
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefoon">Telefoon</Label>
          <Input
            id="telefoon"
            placeholder="06-12345678"
            value={value.telefoon}
            onChange={(e) => {
              onChange({ ...value, telefoon: e.target.value });
              if (selectedKlantId) handleClearSelection();
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adres">Adres *</Label>
        <Input
          id="adres"
          placeholder="Hoofdstraat 1"
          value={value.adres}
          onChange={(e) => {
            onChange({ ...value, adres: e.target.value });
            if (selectedKlantId) handleClearSelection();
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode *</Label>
          <Input
            id="postcode"
            placeholder="1234 AB"
            value={value.postcode}
            onChange={(e) => {
              onChange({ ...value, postcode: e.target.value });
              if (selectedKlantId) handleClearSelection();
            }}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="plaats">Plaats *</Label>
          <Input
            id="plaats"
            placeholder="Amsterdam"
            value={value.plaats}
            onChange={(e) => {
              onChange({ ...value, plaats: e.target.value });
              if (selectedKlantId) handleClearSelection();
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="jan@voorbeeld.nl"
          value={value.email}
          onChange={(e) => {
            onChange({ ...value, email: e.target.value });
            if (selectedKlantId) handleClearSelection();
          }}
        />
      </div>
    </div>
  );
}
