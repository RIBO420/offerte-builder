"use client";

/**
 * Klant koppelen aan een offerte — één component, twee weergaven.
 *
 * Er stonden hier twee implementaties naast elkaar: `klant-koppel-strip.tsx`
 * (vrij-editor en offertedetail, met eigen Convex-aanroep) en
 * `klant-selector.tsx` (de werkbank, via de klantsectie). Twee keuzelijsten,
 * twee gedragingen, twee plekken om dezelfde fix te maken — de eindschouw
 * noemde dat bij naam (S1). Sindsdien:
 *
 * - `KlantKiezer` is de énige keuzelijst: zoeken, recente klanten mét hun
 *   offertehistorie, openstaande leads, en "nieuwe klant aanmaken" bovenaan
 *   (ook terwijl je typt).
 * - `KlantKoppeling` doet het koppelen zelf — één `offertes.koppelKlant`, één
 *   set toasts, één statusregel. De aanroeper hoort alleen wát er gekoppeld is
 *   via `onGekoppeld`, zodat de werkbank zijn eigen weergave kan bijhouden.
 *
 * `weergave` kiest de vorm, niet het gedrag:
 * - `"strip"`   één regel in de vrij-editor en op de offertedetailpagina.
 * - `"sectie"`  een `SectiePaneel` in het werkblad, met progressieve
 *               onthulling: geen klant → primair gewicht en de lijst open;
 *               klant → één regel met een stille "Wisselen".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronsUpDown,
  Clock,
  Euro,
  FileText,
  Link2Off,
  Loader2,
  Megaphone,
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
import { SectiePaneel } from "@/components/ui/sectie-paneel";
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

/** Klantgegevens zoals ze op een offerte staan (de momentopname). */
export interface KlantVelden {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email: string;
  telefoon: string;
}

export const LEGE_KLANT_VELDEN: KlantVelden = {
  naam: "",
  adres: "",
  postcode: "",
  plaats: "",
  email: "",
  telefoon: "",
};

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
  lastOfferteStatus: string | null;
  totalSpent: number;
};

function veldenVan(klant: {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
}): KlantVelden {
  return {
    naam: klant.naam ?? "",
    adres: klant.adres ?? "",
    postcode: klant.postcode ?? "",
    plaats: klant.plaats ?? "",
    email: klant.email ?? "",
    telefoon: klant.telefoon ?? "",
  };
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

function bedrag(waarde: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(waarde);
}

// ─────────────────────────────────────────────────────────────────────────────
// De keuzelijst
// ─────────────────────────────────────────────────────────────────────────────

interface KlantKiezerProps {
  /** Al gekoppelde klant — krijgt het vinkje in de lijst. */
  huidigKlantId?: Id<"klanten"> | null;
  /** Tekst op de knop; de vorm verschilt per weergave. */
  variant: "strip" | "sectie";
  heeftKlant: boolean;
  bezig: boolean;
  uitgeschakeld?: boolean;
  onKiesKlant: (klant: Klant) => void;
  onKiesLead: (velden: KlantVelden, klantId: Id<"klanten"> | null) => void;
}

function KlantKiezer({
  huidigKlantId,
  variant,
  heeftKlant,
  bezig,
  uitgeschakeld,
  onKiesKlant,
  onKiesLead,
}: KlantKiezerProps) {
  const [open, setOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState("");
  const [toonNieuweKlant, setToonNieuweKlant] = useState(false);

  const { results: zoekresultaten } = useKlantenSearch(zoekterm);
  const { klanten: recenteKlanten } = useKlantenWithStats(10);
  const leads = useQuery(api.configuratorAanvragen.listForOfferteSelector);

  const kiesKlant = (klant: Klant) => {
    setOpen(false);
    setZoekterm("");
    onKiesKlant(klant);
  };

  const kiesLead = (lead: {
    klantNaam: string;
    klantEmail: string;
    klantTelefoon: string;
    klantAdres: string;
    klantPostcode: string;
    klantHuisnummer?: string;
    klantPlaats: string;
    gekoppeldKlantId?: Id<"klanten">;
  }) => {
    setOpen(false);
    setZoekterm("");
    onKiesLead(
      {
        naam: lead.klantNaam ?? "",
        adres: lead.klantHuisnummer || lead.klantAdres || "",
        postcode: lead.klantPostcode ?? "",
        plaats: lead.klantPlaats ?? "",
        email: lead.klantEmail ?? "",
        telefoon: lead.klantTelefoon ?? "",
      },
      lead.gekoppeldKlantId ?? null
    );
  };

  const openNieuweKlant = () => {
    setOpen(false);
    setToonNieuweKlant(true);
  };

  const knop =
    variant === "sectie" ? (
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={uitgeschakeld || bezig}
        className="w-full justify-between font-normal"
      >
        <span className={cn(!heeftKlant && "text-muted-foreground")}>
          {heeftKlant ? "Andere klant of lead kiezen…" : "Zoek een klant of lead…"}
        </span>
        {bezig ? (
          <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </Button>
    ) : (
      <Button
        type="button"
        variant={heeftKlant ? "ghost" : "outline"}
        size="sm"
        disabled={uitgeschakeld || bezig}
        aria-label={heeftKlant ? "Andere klant kiezen" : "Klant koppelen"}
      >
        {bezig ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronsUpDown className="mr-2 h-3.5 w-3.5" />
        )}
        {heeftKlant ? "Andere klant" : "Klant koppelen"}
      </Button>
    );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{knop}</PopoverTrigger>
        <PopoverContent
          className={cn("p-0", variant === "sectie" ? "w-[24rem]" : "w-[22rem]")}
          align="start"
        >
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
                {/* De zoekterm zit bewust in `value`: cmdk filtert daarop, dus
                    deze actie blijft zichtbaar terwijl je typt — met de
                    getypte naam erin. */}
                <CommandItem
                  value={`nieuwe klant aanmaken ${zoekterm}`}
                  onSelect={openNieuweKlant}
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
                    <KlantRij
                      key={optie._id}
                      klant={optie}
                      gekozen={huidigKlantId === optie._id}
                      onKies={() => kiesKlant(optie)}
                    />
                  ))}
                </CommandGroup>
              )}

              {zoekterm && zoekresultaten.length > 0 && (
                <CommandGroup heading="Zoekresultaten">
                  {(zoekresultaten as Klant[]).map((optie) => (
                    <CommandItem
                      key={optie._id}
                      value={optie.naam}
                      onSelect={() => kiesKlant(optie)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          huidigKlantId === optie._id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
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

              {leads && leads.length > 0 && (
                <CommandGroup heading="Leads">
                  {leads
                    .filter(
                      (lead) =>
                        !zoekterm ||
                        lead.klantNaam
                          .toLowerCase()
                          .includes(zoekterm.toLowerCase())
                    )
                    .map((lead) => (
                      <CommandItem
                        key={lead._id}
                        value={`lead-${lead.klantNaam}`}
                        onSelect={() => kiesLead(lead)}
                        onClick={() => kiesLead(lead)}
                        className="items-start py-2"
                      >
                        <Megaphone className="mt-0.5 mr-2 h-3.5 w-3.5 shrink-0 text-scope-houtwerk" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {lead.klantNaam}
                            </span>
                            <Badge
                              variant="secondary"
                              className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
                            >
                              Lead
                            </Badge>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {lead.klantPlaats}
                            {lead.klantPostcode && ` · ${lead.klantPostcode}`}
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

      <NieuweKlantDialog
        open={toonNieuweKlant}
        onOpenChange={setToonNieuweKlant}
        initialValues={zoekterm ? { naam: zoekterm } : undefined}
        onCreated={(nieuw: AangemaakteKlant) => kiesKlant(nieuw)}
      />
    </>
  );
}

/**
 * Eén klant in de lijst. De offerteregel eronder hoort bij dezelfde keuze:
 * `onClick` naast `onSelect` maakt de hele rij klikbaar — de subregel was een
 * dode zone (eindschouw, cosmetische rij).
 */
function KlantRij({
  klant,
  gekozen,
  onKies,
}: {
  klant: KlantMetHistorie;
  gekozen: boolean;
  onKies: () => void;
}) {
  return (
    <CommandItem
      value={klant.naam}
      onSelect={onKies}
      onClick={onKies}
      className="flex-col items-start py-2"
    >
      <span className="flex w-full items-center gap-2">
        <Check
          className={cn(
            "h-4 w-4 shrink-0",
            gekozen ? "opacity-100" : "opacity-0"
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium" title={klant.naam}>
              {klant.naam}
            </span>
            {klant.offerteCount > 0 && (
              <Badge
                variant="secondary"
                className="shrink-0 px-1.5 py-0 text-[10px] font-normal"
              >
                {klant.offerteCount} offerte
                {klant.offerteCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {klant.adres}, {klant.plaats}
          </span>
        </span>
      </span>
      {klant.lastOfferteDate && (
        <span className="mt-1 ml-6 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {klant.lastOfferteNummer}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {relatieveDatum(klant.lastOfferteDate)}
          </span>
          {klant.totalSpent > 0 && (
            <span className="flex items-center gap-1">
              <Euro className="h-3 w-3" />
              {bedrag(klant.totalSpent)}
            </span>
          )}
        </span>
      )}
    </CommandItem>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// De koppeling
// ─────────────────────────────────────────────────────────────────────────────

export interface KlantKoppelingProps {
  weergave: "strip" | "sectie";
  /**
   * De offerte waar de klant aan hangt. `null` mag: het werkblad rendert deze
   * sectie al terwijl het concept nog wordt aangemaakt. Zolang er geen id is
   * wordt de keuze alleen doorgegeven, niet weggeschreven.
   */
  offerteId: Id<"offertes"> | null;
  /** Klantmomentopname op de offerte; ontbreekt bij een vers concept. */
  klant?: Partial<KlantVelden> | null;
  klantId?: Id<"klanten"> | null;
  /** Status van de offerte — bepaalt of koppelen/ontkoppelen nog mag. */
  status: string;
  /**
   * `?leadId=` uit de URL (offerte gestart vanuit een lead). Zolang de offerte
   * nog geen klant heeft nemen we de leadgegevens één keer over — de lead zelf
   * blijft in `offertes.leadId` staan.
   */
  initialLeadId?: string;
  /** Melding van de backend toen definitief maken werd geweigerd (sectie). */
  fout?: string | null;
  /** Wat er nu aan de offerte hangt — de werkbank houdt zijn eigen staat bij. */
  onGekoppeld?: (velden: KlantVelden, klantId: Id<"klanten"> | null) => void;
  className?: string;
}

export function KlantKoppeling({
  weergave,
  offerteId,
  klant,
  klantId,
  status,
  initialLeadId,
  fout,
  onGekoppeld,
  className,
}: KlantKoppelingProps) {
  const koppelKlant = useMutation(api.offertes.koppelKlant);
  const [bezig, setBezig] = useState(false);
  const [open, setOpen] = useState(false);

  const velden = klant ? veldenVan({ ...LEGE_KLANT_VELDEN, ...klant }) : LEGE_KLANT_VELDEN;
  const heeftKlant = velden.naam.trim().length > 0;

  // Wisselen mag zolang de offerte niet naar de klant is gegaan; loskoppelen
  // alleen in concept. Zelfde regels als `offertes.koppelKlant` — hier alleen
  // om knoppen niet aan te bieden die de server toch weigert.
  const magKoppelen = status === "concept" || status === "voorcalculatie";
  const magOntkoppelen = status === "concept";

  const meldRef = useRef(onGekoppeld);
  useEffect(() => {
    meldRef.current = onGekoppeld;
  }, [onGekoppeld]);

  const koppel = useCallback(
    async (nieuweVelden: KlantVelden, nieuwKlantId: Id<"klanten"> | null) => {
      meldRef.current?.(nieuweVelden, nieuwKlantId);
      // Al gekoppeld aan dezelfde klant: niets te doen. `koppelKlant` schrijft
      // een versieregel, dus een overbodige aanroep zou de historie vervuilen.
      if (nieuwKlantId && nieuwKlantId === klantId) return;
      if (!offerteId) return;

      setBezig(true);
      try {
        await koppelKlant({
          id: offerteId,
          klantId: nieuwKlantId ?? undefined,
          klant: nieuwKlantId
            ? undefined
            : {
                naam: nieuweVelden.naam,
                adres: nieuweVelden.adres,
                postcode: nieuweVelden.postcode,
                plaats: nieuweVelden.plaats,
                email: nieuweVelden.email || undefined,
                telefoon: nieuweVelden.telefoon || undefined,
              },
        });
        toast.success(`Klant gekoppeld: ${nieuweVelden.naam}`);
        setOpen(false);
      } catch (foutje) {
        toast.error("Klant koppelen mislukt", {
          description: getMutationErrorMessage(foutje),
        });
      } finally {
        setBezig(false);
      }
    },
    [koppelKlant, offerteId, klantId]
  );

  const ontkoppel = useCallback(async () => {
    meldRef.current?.(LEGE_KLANT_VELDEN, null);
    if (!offerteId) return;
    setBezig(true);
    try {
      await koppelKlant({ id: offerteId, ontkoppelen: true });
      toast.success("Klant losgekoppeld");
    } catch (foutje) {
      toast.error("Loskoppelen mislukt", {
        description: getMutationErrorMessage(foutje),
      });
    } finally {
      setBezig(false);
    }
  }, [koppelKlant, offerteId]);

  // Offerte gestart vanuit een lead: de leadgegevens één keer overnemen zodra
  // duidelijk is dat er nog geen klant hangt. `offertes.create` bewaart wel de
  // `leadId`, maar kopieert de klantvelden niet.
  const lead = useQuery(
    api.configuratorAanvragen.getById,
    initialLeadId && !heeftKlant
      ? { id: initialLeadId as Id<"configuratorAanvragen"> }
      : "skip"
  );
  const leadOvergenomen = useRef(false);
  useEffect(() => {
    if (!lead || leadOvergenomen.current) return;
    if (heeftKlant || !offerteId || !magKoppelen) return;
    leadOvergenomen.current = true;
    void koppel(
      {
        naam: lead.klantNaam ?? "",
        adres: lead.klantHuisnummer || lead.klantAdres || "",
        postcode: lead.klantPostcode ?? "",
        plaats: lead.klantPlaats ?? "",
        email: lead.klantEmail ?? "",
        telefoon: lead.klantTelefoon ?? "",
      },
      lead.gekoppeldKlantId ?? null
    );
  }, [lead, heeftKlant, offerteId, magKoppelen, koppel]);

  const kiezer = (
    <KlantKiezer
      variant={weergave}
      huidigKlantId={klantId ?? null}
      heeftKlant={heeftKlant}
      bezig={bezig}
      uitgeschakeld={!magKoppelen}
      onKiesKlant={(gekozen) => void koppel(veldenVan(gekozen), gekozen._id)}
      onKiesLead={(leadVelden, leadKlantId) =>
        void koppel(leadVelden, leadKlantId)
      }
    />
  );

  const adresregel = [
    velden.adres,
    [velden.postcode, velden.plaats].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  if (weergave === "sectie") {
    const toonKiezer = open || !heeftKlant;
    return (
      <SectiePaneel
        id="werkbank-klant"
        titel="Klant"
        icoon={<UserRound />}
        gewicht={heeftKlant ? "secundair" : "primair"}
        uitleg="Een concept mag zonder klant bestaan. Definitief maken of versturen kan pas met naam, adres, postcode en plaats."
        acties={
          heeftKlant &&
          magKoppelen && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Klaar" : "Wisselen"}
            </Button>
          )
        }
        className={className}
      >
        <div className="space-y-3 px-3 py-3">
          {heeftKlant && (
            <div className="min-w-0">
              <p className="truncate text-sm leading-snug font-medium">
                {velden.naam}
              </p>
              {adresregel ? (
                <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                  {adresregel}
                </p>
              ) : (
                <p className="mt-0.5 text-xs leading-tight text-scope-houtwerk">
                  Nog geen adres — vul dat aan vóór je de offerte verstuurt.
                </p>
              )}
            </div>
          )}

          {toonKiezer && (
            <div className="flex flex-wrap items-center gap-2">
              {kiezer}
              {heeftKlant && magOntkoppelen && (
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
          )}

          {!heeftKlant &&
            (fout ? (
              <p className="text-xs leading-4 text-destructive">{fout}</p>
            ) : (
              <p className="text-xs leading-4 text-muted-foreground">
                Verplicht vóór versturen. Zolang dit een concept is, mag het
                leeg blijven.
              </p>
            ))}
        </div>
      </SectiePaneel>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5",
        heeftKlant
          ? "border bg-muted/30"
          : "border border-dashed border-amber-300 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/20",
        className
      )}
    >
      <UserRound
        className={cn(
          "h-4 w-4 shrink-0",
          heeftKlant
            ? "text-muted-foreground"
            : "text-amber-700 dark:text-amber-400"
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {heeftKlant ? (
          <>
            <p className="truncate text-sm leading-tight font-medium">
              {velden.naam}
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
        {heeftKlant && magOntkoppelen && (
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
  );
}
