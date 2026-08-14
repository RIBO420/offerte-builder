"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown, User, Plus, FileText, Clock, Euro, Megaphone, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKlantenSearch } from "@/hooks/use-klanten";
import { useKlantenWithStats } from "@/hooks/use-smart-analytics";
import {
  NieuweKlantDialog,
  type AangemaakteKlant,
} from "@/components/klanten/nieuwe-klant-dialog";
import { api } from "../../../convex/_generated/api";
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
  onLeadSelect?: (leadId: Id<"configuratorAanvragen">) => void;
  initialLeadId?: Id<"configuratorAanvragen">;
}

export function KlantSelector({
  value,
  onChange,
  onKlantSelect,
  onLeadSelect,
  initialLeadId,
}: KlantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { results: searchResults } = useKlantenSearch(searchTerm);
  const { klanten: enrichedKlanten } = useKlantenWithStats(10);
  const [selectedKlantId, setSelectedKlantId] = useState<Id<"klanten"> | null>(
    null
  );
  const [selectedLeadId, setSelectedLeadId] = useState<Id<"configuratorAanvragen"> | null>(null);
  const [showNieuweKlant, setShowNieuweKlant] = useState(false);

  // Fetch leads for the selector
  const leads = useQuery(api.configuratorAanvragen.listForOfferteSelector);

  // Load initial lead data when initialLeadId is provided
  const initialLead = useQuery(
    api.configuratorAanvragen.getById,
    initialLeadId ? { id: initialLeadId } : "skip"
  );

  useEffect(() => {
    if (initialLead && initialLeadId && !selectedLeadId && !selectedKlantId && !value.naam) {
      // Pre-fill with lead data
      const adres = initialLead.klantHuisnummer || initialLead.klantAdres || "";
      onChange({
        naam: initialLead.klantNaam || "",
        adres,
        postcode: initialLead.klantPostcode || "",
        plaats: initialLead.klantPlaats || "",
        email: initialLead.klantEmail || "",
        telefoon: initialLead.klantTelefoon || "",
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- eenmalige prefill vanuit async geladen lead-data
      setSelectedLeadId(initialLeadId);
      onLeadSelect?.(initialLeadId);

      // If the lead has a gekoppeldKlantId, select that klant
      if (initialLead.gekoppeldKlantId) {
        setSelectedKlantId(initialLead.gekoppeldKlantId);
        onKlantSelect?.(initialLead.gekoppeldKlantId);
      }
    }
  }, [initialLead, initialLeadId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSelectLead = (lead: {
    _id: Id<"configuratorAanvragen">;
    klantNaam: string;
    klantEmail: string;
    klantTelefoon: string;
    klantAdres: string;
    klantPostcode: string;
    klantHuisnummer?: string;
    klantPlaats: string;
    gekoppeldKlantId?: Id<"klanten">;
  }) => {
    const adres = lead.klantHuisnummer || lead.klantAdres || "";
    setSelectedLeadId(lead._id);
    onChange({
      naam: lead.klantNaam || "",
      adres,
      postcode: lead.klantPostcode || "",
      plaats: lead.klantPlaats || "",
      email: lead.klantEmail || "",
      telefoon: lead.klantTelefoon || "",
    });
    onLeadSelect?.(lead._id);

    // If the lead has a gekoppeldKlantId, also select that klant
    if (lead.gekoppeldKlantId) {
      setSelectedKlantId(lead.gekoppeldKlantId);
      onKlantSelect?.(lead.gekoppeldKlantId);
    } else {
      setSelectedKlantId(null);
      onKlantSelect?.(null);
    }
    setOpen(false);
    setSearchTerm("");
  };

  /** Popover sluiten en de nieuwe-klant-dialog openen met wat er al ingevuld staat. */
  const handleOpenNieuweKlant = () => {
    setOpen(false);
    setShowNieuweKlant(true);
  };

  /**
   * Vers aangemaakte klant meteen selecteren — geen extra klik nodig. Een
   * eventueel gekozen lead blijft gekoppeld (de offerte houdt zo zijn
   * lead-herkomst); de weergave schakelt vanzelf om naar de klant.
   */
  const handleKlantAangemaakt = (klant: AangemaakteKlant) => {
    handleSelectKlant(klant);
  };

  const handleClearSelection = () => {
    setSelectedKlantId(null);
    setSelectedLeadId(null);
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
        <Label>Bestaande klant of lead selecteren</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedLeadId && value.naam && !selectedKlantId ? (
                <span className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  {value.naam}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                    Lead
                  </Badge>
                </span>
              ) : selectedKlantId && value.naam ? (
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {value.naam}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Zoek of selecteer een klant of lead...
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
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
                      Maak de klant hier direct aan
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={handleOpenNieuweKlant}
                    >
                      <UserPlus className="mr-2 h-3.5 w-3.5" />
                      {searchTerm
                        ? `"${searchTerm}" aanmaken als klant`
                        : "Nieuwe klant aanmaken"}
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {/* De zoekterm zit bewust in `value`: cmdk filtert op value,
                      zodat deze actie ook zichtbaar blijft terwijl je typt. */}
                  <CommandItem
                    value={`nieuwe klant aanmaken ${searchTerm}`}
                    onSelect={handleOpenNieuweKlant}
                    className="text-primary"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {searchTerm
                      ? `"${searchTerm}" aanmaken als nieuwe klant`
                      : "Nieuwe klant aanmaken"}
                  </CommandItem>
                </CommandGroup>
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
                {/* Leads sectie */}
                {leads && leads.length > 0 && (
                  <CommandGroup heading="Leads">
                    {leads
                      .filter((lead) =>
                        !searchTerm || lead.klantNaam.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((lead) => (
                        <CommandItem
                          key={lead._id}
                          value={`lead-${lead.klantNaam}`}
                          onSelect={() => handleSelectLead(lead)}
                          className="flex-col items-start py-3"
                        >
                          <div className="flex w-full items-center gap-2">
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                selectedLeadId === lead._id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Megaphone className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                                <span className="font-medium truncate" title={lead.klantNaam}>
                                  {lead.klantNaam}
                                </span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                  Lead
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                                  {lead.pipelineStatus === "contact_gehad" ? "Contact gehad" : "Nieuw"}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {lead.klantPlaats}{lead.klantPostcode && ` · ${lead.klantPostcode}`}
                                {lead.klantEmail && ` · ${lead.klantEmail}`}
                              </span>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {/* "Nieuwe klant aanmaken" stond hier ook nog als losse knop, terwijl
            de keuzelijst hierboven diezelfde actie al bovenaan toont — óók
            terwijl je typt, en dan met de getypte naam erin. Twee knoppen voor
            één handeling, dus deze is weg. */}
        {(selectedKlantId || selectedLeadId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-xs text-muted-foreground"
          >
            <Plus className="h-3 w-3 mr-1 rotate-45" />
            Selectie wissen
          </Button>
        )}
      </div>

      <NieuweKlantDialog
        open={showNieuweKlant}
        onOpenChange={setShowNieuweKlant}
        initialValues={value}
        onCreated={handleKlantAangemaakt}
      />

      {/*
        Hier stond dezelfde set velden (naam, telefoon, adres, postcode, plaats,
        e-mail) nog een keer als los formulier. Sinds "Nieuwe klant aanmaken"
        een eigen modal heeft, was dat een tweede plek om hetzelfde in te vullen
        — met als risico dat je een klant aanmaakt die niet in de klantenlijst
        belandt. Wat je kiest of aanmaakt tonen we nu alleen ter controle.
      */}
      {value.naam && <GekozenKlant klant={value} />}
    </div>
  );
}

/** Leesbare samenvatting van de gekozen klant; het werkadres moet zichtbaar blijven. */
function GekozenKlant({ klant }: { klant: KlantData }) {
  const adresregel = [
    klant.adres,
    [klant.postcode, klant.plaats].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const contact = [klant.telefoon, klant.email].filter(Boolean).join(" · ");

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <p className="text-sm leading-snug font-medium">{klant.naam}</p>
      {adresregel && (
        <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
          {adresregel}
        </p>
      )}
      {contact && (
        <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
          {contact}
        </p>
      )}
      {!adresregel && (
        <p className="mt-1 text-xs leading-tight text-amber-600 dark:text-amber-400">
          Deze klant heeft nog geen adres. Vul dat aan op de klantpagina.
        </p>
      )}
    </div>
  );
}
