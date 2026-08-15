"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  Check,
  ChevronsUpDown,
  Clock,
  FileText,
  Link2Off,
  Loader2,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  NieuweKlantDialog,
  type AangemaakteKlant,
} from "@/components/klanten/nieuwe-klant-dialog";
import { useKlantenSearch } from "@/hooks/use-klanten";
import { useKlantenWithStats } from "@/hooks/use-smart-analytics";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Klant = {
  _id: Id<"klanten">;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
};

type KlantMetHistorie = Klant & {
  offerteCount: number;
  lastOfferteDate: number | null;
  lastOfferteNummer: string | null;
};

export interface KlantKoppelStripProps {
  offerteId: Id<"offertes">;
  /** Klantmomentopname op de offerte; ontbreekt bij een vers concept. */
  klant?: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  } | null;
  /** Status van de offerte — bepaalt of koppelen/ontkoppelen nog mag. */
  status: string;
  className?: string;
}

function relatieveDatum(timestamp: number): string {
  const dagen = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (dagen <= 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 7) return `${dagen} dagen geleden`;
  if (dagen < 30) return `${Math.floor(dagen / 7)} weken geleden`;
  if (dagen < 365) return `${Math.floor(dagen / 30)} maanden geleden`;
  return `${Math.floor(dagen / 365)} jaar geleden`;
}

/**
 * "Klant koppelen" bovenin de regel-editor van een vrije offerte.
 *
 * Sinds de klant optioneel is bij concept (masterplan A3) kan een offerte hier
 * binnenkomen zonder klant. Dat mag geen verborgen valkuil worden: de stille
 * staat zegt daarom expliciet dat de klant vóór versturen verplicht is — de
 * harde guard staat server-side in convex/lib/offerteKlant.ts.
 *
 * De keuzelijst is dezelfde als in de wizard: zoeken, recente klanten mét hun
 * offertehistorie, en "nieuwe klant aanmaken" bovenaan (ook terwijl je typt).
 */
export function KlantKoppelStrip({
  offerteId,
  klant,
  status,
  className,
}: KlantKoppelStripProps) {
  const koppelKlant = useMutation(api.offertes.koppelKlant);
  const [open, setOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState("");
  const [bezig, setBezig] = useState(false);
  const [toonNieuweKlant, setToonNieuweKlant] = useState(false);

  const { results: zoekresultaten } = useKlantenSearch(zoekterm);
  const { klanten: recenteKlanten } = useKlantenWithStats(8);

  // Wisselen mag zolang de offerte niet naar de klant is gegaan; loskoppelen
  // alleen in concept. Zelfde regels als de mutation — hier alleen om knoppen
  // niet aan te bieden die de server toch weigert.
  const magKoppelen = status === "concept" || status === "voorcalculatie";
  const magOntkoppelen = status === "concept";

  const koppel = async (gekozen: Klant) => {
    setBezig(true);
    try {
      await koppelKlant({ id: offerteId, klantId: gekozen._id });
      toast.success(`Klant gekoppeld: ${gekozen.naam}`);
      setOpen(false);
      setZoekterm("");
    } catch (fout) {
      toast.error("Klant koppelen mislukt", {
        description: getMutationErrorMessage(fout),
      });
    } finally {
      setBezig(false);
    }
  };

  const ontkoppel = async () => {
    setBezig(true);
    try {
      await koppelKlant({ id: offerteId, ontkoppelen: true });
      toast.success("Klant losgekoppeld");
    } catch (fout) {
      toast.error("Loskoppelen mislukt", {
        description: getMutationErrorMessage(fout),
      });
    } finally {
      setBezig(false);
    }
  };

  const naNieuweKlant = (nieuw: AangemaakteKlant) => {
    void koppel(nieuw);
  };

  const adresregel = klant
    ? [klant.adres, [klant.postcode, klant.plaats].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : "";

  const kiezer = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={klant ? "ghost" : "outline"}
          size="sm"
          disabled={!magKoppelen || bezig}
          aria-label={klant ? "Andere klant kiezen" : "Klant koppelen"}
        >
          {bezig ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronsUpDown className="mr-2 h-3.5 w-3.5" />
          )}
          {klant ? "Andere klant" : "Klant koppelen"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Zoek klant op naam…"
            value={zoekterm}
            onValueChange={setZoekterm}
          />
          <CommandList>
            <CommandEmpty>
              <p className="py-4 text-center text-sm text-muted-foreground">
                Geen klant gevonden
              </p>
            </CommandEmpty>
            <CommandGroup>
              {/* Zoekterm in `value`: cmdk filtert daarop, dus deze actie blijft
                  zichtbaar terwijl je typt — met de getypte naam erin. */}
              <CommandItem
                value={`nieuwe klant aanmaken ${zoekterm}`}
                onSelect={() => {
                  setOpen(false);
                  setToonNieuweKlant(true);
                }}
                className="text-primary"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {zoekterm
                  ? `"${zoekterm}" aanmaken als nieuwe klant`
                  : "Nieuwe klant aanmaken"}
              </CommandItem>
            </CommandGroup>
            {!zoekterm && recenteKlanten.length > 0 && (
              <CommandGroup heading="Recente klanten">
                {(recenteKlanten as KlantMetHistorie[]).map((optie) => (
                  <CommandItem
                    key={optie._id}
                    value={optie.naam}
                    onSelect={() => void koppel(optie)}
                    className="flex-col items-start py-2"
                  >
                    <span className="flex w-full items-center gap-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          klant?.naam === optie.naam
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {optie.naam}
                          </span>
                          {optie.offerteCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="shrink-0 px-1.5 py-0 text-[10px]"
                            >
                              {optie.offerteCount} offerte
                              {optie.offerteCount !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {optie.adres}, {optie.plaats}
                        </span>
                      </span>
                    </span>
                    {optie.lastOfferteDate && (
                      <span className="mt-1 ml-6 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {optie.lastOfferteNummer}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relatieveDatum(optie.lastOfferteDate)}
                        </span>
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {zoekterm && zoekresultaten.length > 0 && (
              <CommandGroup heading="Zoekresultaten">
                {(zoekresultaten as Klant[]).map((optie) => (
                  <CommandItem
                    key={optie._id}
                    value={optie.naam}
                    onSelect={() => void koppel(optie)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {optie.naam}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {optie.adres}, {optie.plaats}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5",
          klant
            ? "border bg-muted/30"
            : "border border-dashed border-amber-300 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/20",
          className
        )}
      >
        <UserRound
          className={cn(
            "h-4 w-4 shrink-0",
            klant ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          {klant ? (
            <>
              <p className="truncate text-sm leading-tight font-medium">
                {klant.naam}
              </p>
              {adresregel && (
                <p className="truncate text-xs leading-tight text-muted-foreground">
                  {adresregel}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm leading-tight font-medium text-amber-900 dark:text-amber-200">
                Nog geen klant — verplicht vóór versturen
              </p>
              <p className="text-xs leading-tight text-amber-800/80 dark:text-amber-300/80">
                Als concept mag de offerte zonder klant bestaan; koppel hem
                voordat je de offerte definitief maakt of verstuurt.
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {magKoppelen && kiezer}
          {klant && magOntkoppelen && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void ontkoppel()}
              disabled={bezig}
              className="text-muted-foreground"
            >
              <Link2Off className="mr-2 h-3.5 w-3.5" />
              Ontkoppelen
            </Button>
          )}
        </div>
      </div>

      <NieuweKlantDialog
        open={toonNieuweKlant}
        onOpenChange={setToonNieuweKlant}
        initialValues={zoekterm ? { naam: zoekterm } : undefined}
        onCreated={naNieuweKlant}
      />
    </>
  );
}
