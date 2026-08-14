"use client";

/**
 * Klanttijdlijn (PRD §2.3) — gedeelde weergave van het interne klantdossier.
 *
 * Gebruikt op:
 * - de klant-detailpagina (sectie met filters, zoeken en entry-compositie);
 * - de Chat-module, tabs Klanten en Projecten (zelfde data via dezelfde
 *   Convex-queries, andere ingang — géén tweede opslag).
 *
 * Toegang wordt server-side afgedwongen (convex/tijdlijn.ts): de klant-rol
 * krijgt op elke tijdlijn-query een AuthError. De composer wordt alleen voor
 * kantoor gerenderd (PRD §1.2-patroon: knop bestaat niet voor andere rollen).
 *
 * Weergave: dossierregels, geen kaarten. Eén omlijning aan de buitenkant
 * (`SectiePaneel`, alleen met `toonPaneel`), daarbinnen een `divide-y` lijst.
 * De Chat-module heeft al een eigen omlijsting en laat `toonPaneel` uit staan.
 */

import { Fragment, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFotoUpload, useFotoUrls } from "@/hooks/use-foto-upload";
import { isKantoorRol } from "@/lib/rollen";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FotoViewer } from "@/components/ui/foto-viewer";
import {
  SectieLegeStaat,
  SectiePaneel,
} from "@/components/ui/sectie-paneel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bot,
  Briefcase,
  ChevronDown,
  History,
  ImagePlus,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Send,
  SlidersHorizontal,
  StickyNote,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types & constanten ──────────────────────────────────────────────────────

type Kanaal = "telefoon" | "whatsapp" | "email" | "intern" | "systeem";
type HandmatigKanaal = Exclude<Kanaal, "systeem">;

/** Volgorde van de segmented control; `systeem` is niet handmatig aan te maken. */
const HANDMATIGE_KANALEN: HandmatigKanaal[] = [
  "telefoon",
  "whatsapp",
  "email",
  "intern",
];

const KANAAL_LABELS: Record<Kanaal, string> = {
  telefoon: "Telefoon",
  whatsapp: "WhatsApp",
  email: "E-mail",
  intern: "Intern",
  systeem: "Systeem",
};

const KANAAL_ICONS: Record<Kanaal, React.ReactNode> = {
  telefoon: <Phone className="size-3.5" />,
  whatsapp: <MessageCircle className="size-3.5" />,
  email: <Mail className="size-3.5" />,
  intern: <StickyNote className="size-3.5" />,
  systeem: <Bot className="size-3.5" />,
};

function formatDatumTijd(timestamp: number): string {
  return new Date(timestamp).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Lokale dagsleutel. Bewust géén `toISOString()`: die rekent naar UTC en zet
 * een entry van 23:30 op de dag erna — dan valt hij onder de verkeerde
 * datumkop.
 */
function dagSleutel(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "Vandaag" / "Gisteren" / "wo 12 aug" / "12 aug 2025" bij een ander jaar. */
function datumGroepLabel(timestamp: number, nu: Date): string {
  const d = new Date(timestamp);
  if (dagSleutel(d) === dagSleutel(nu)) return "Vandaag";
  const gisteren = new Date(nu);
  gisteren.setDate(gisteren.getDate() - 1);
  if (dagSleutel(d) === dagSleutel(gisteren)) return "Gisteren";
  if (d.getFullYear() !== nu.getFullYear()) {
    return d.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Binnen vandaag alleen de klok; de datum staat dan al in de groepskop. */
function formatTijdKort(timestamp: number, nu: Date): string {
  const d = new Date(timestamp);
  const tijd = d.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (dagSleutel(d) === dagSleutel(nu)) return tijd;
  const datum = d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== nu.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${datum} ${tijd}`;
}

// ─── Entry-weergave ──────────────────────────────────────────────────────────

interface TijdlijnEntryData {
  _id: string;
  timestamp: number;
  auteurNaam: string;
  kanaal: Kanaal;
  eventType: string;
  tekst: string;
  werkitemId?: Id<"projecten">;
  werkitemNaam?: string;
  bijlagen?: Id<"_storage">[];
}

/**
 * Eigen component omdat `useFotoUrls` een hook is: die mag niet in de `.map()`
 * van de lijst staan.
 */
function EntryBijlagen({ bijlagen }: { bijlagen: Id<"_storage">[] }) {
  const { urls } = useFotoUrls(bijlagen);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Alleen foto's met een geladen url doen mee, zodat de index in de viewer
  // altijd overeenkomt met wat er op het scherm staat.
  const zichtbaar = bijlagen
    .map((id) => ({ id, url: urls.get(id) }))
    .filter((f): f is { id: Id<"_storage">; url: string } => Boolean(f.url));

  if (zichtbaar.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {zichtbaar.map((foto, index) => (
        // Knop en geen kale <img>: een foto die je kunt openen hoort ook met
        // Tab bereikbaar te zijn en een naam te hebben.
        <button
          key={foto.id}
          type="button"
          onClick={() => setViewerIndex(index)}
          aria-label={`Foto ${index + 1} van ${zichtbaar.length} openen`}
          className="group/foto relative size-14 overflow-hidden rounded border transition-opacity hover:opacity-90 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        </button>
      ))}

      <FotoViewer
        fotos={zichtbaar.map((foto, index) => ({
          url: foto.url,
          alt: `Foto ${index + 1} bij deze tijdlijn-notitie`,
        }))}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </div>
  );
}

function TijdlijnEntryRij({
  entry,
  nu,
  isNieuwste,
}: {
  entry: TijdlijnEntryData;
  nu: Date;
  isNieuwste: boolean;
}) {
  // Systeem-entries zijn ruis waar je doorheen leest, geen gespreksnotitie:
  // dimmen in plaats van een eigen kleur of badge.
  const isSysteem = entry.kanaal === "systeem";
  return (
    <li
      className={cn(
        "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 px-3 py-2 transition-colors duration-100 hover:bg-muted/40",
        isNieuwste &&
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 items-center justify-center",
          isSysteem ? "text-muted-foreground/60" : "text-muted-foreground"
        )}
        title={KANAAL_LABELS[entry.kanaal]}
      >
        {KANAAL_ICONS[entry.kanaal]}
        <span className="sr-only">{KANAAL_LABELS[entry.kanaal]}</span>
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-snug",
            isSysteem && "text-muted-foreground"
          )}
        >
          {entry.tekst}
        </p>
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {entry.auteurNaam}
          </span>
          <span aria-hidden>·</span>
          <time
            dateTime={new Date(entry.timestamp).toISOString()}
            title={formatDatumTijd(entry.timestamp)}
          >
            {formatTijdKort(entry.timestamp, nu)}
          </time>
          {entry.werkitemNaam && (
            <>
              <span aria-hidden>·</span>
              <span
                className="inline-flex min-w-0 items-center gap-1"
                title={entry.werkitemNaam}
              >
                <Briefcase className="size-3 shrink-0" />
                <span className="truncate">{entry.werkitemNaam}</span>
              </span>
            </>
          )}
        </p>
        {entry.bijlagen && entry.bijlagen.length > 0 && (
          <EntryBijlagen bijlagen={entry.bijlagen} />
        )}
      </div>
    </li>
  );
}

// ─── Composer (kantoor-only) ─────────────────────────────────────────────────

function TijdlijnComposer({
  klantId,
  werkitems,
  vasteWerkitemId,
}: {
  klantId: Id<"klanten">;
  werkitems: { _id: Id<"projecten">; naam: string }[];
  vasteWerkitemId?: Id<"projecten">;
}) {
  const voegEntryToe = useMutation(api.tijdlijn.voegEntryToe);
  const { uploadFotos, storageIds, reset, isBezig, voortgangen } =
    useFotoUpload();

  const [kanaal, setKanaal] = useState<HandmatigKanaal>("telefoon");
  const [tekst, setTekst] = useState("");
  const [werkitemId, setWerkitemId] = useState<string>(
    vasteWerkitemId ? vasteWerkitemId.toString() : "geen"
  );
  const [bezig, setBezig] = useState(false);
  const [open, setOpen] = useState(false);

  const tekstRef = useRef<HTMLTextAreaElement>(null);
  const kanaalRefs = useRef<Partial<Record<HandmatigKanaal, HTMLButtonElement>>>(
    {}
  );

  const heeftInhoud = tekst.trim().length > 0 || storageIds.length > 0;

  /** Meegroeien zonder ooit de hele sectie te laten uitzetten (max 9rem). */
  const groeiMee = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleOpslaan = async () => {
    if (!tekst.trim() || bezig || isBezig) return;
    setBezig(true);
    try {
      await voegEntryToe({
        klantId,
        kanaal,
        tekst: tekst.trim(),
        werkitemId:
          werkitemId !== "geen" ? (werkitemId as Id<"projecten">) : undefined,
        bijlagen: storageIds.length > 0 ? storageIds : undefined,
      });
      setTekst("");
      reset();
      if (tekstRef.current) {
        tekstRef.current.style.height = "auto";
        // Focus blijft staan: vijf notities achter elkaar vastleggen moet
        // kunnen zonder opnieuw te klikken.
        tekstRef.current.focus();
      }
      toast.success("Toegevoegd aan de tijdlijn");
    } catch {
      toast.error("Entry toevoegen mislukt");
    } finally {
      setBezig(false);
    }
  };

  const handleKanaalToets = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const stap = e.key === "ArrowRight" ? 1 : -1;
    const volgende =
      HANDMATIGE_KANALEN[
        (index + stap + HANDMATIGE_KANALEN.length) % HANDMATIGE_KANALEN.length
      ];
    setKanaal(volgende);
    kanaalRefs.current[volgende]?.focus();
  };

  const uploadKlaar = voortgangen.filter((v) => v.status === "voltooid").length;

  /**
   * Het tekstveld is maar ~19px hoog in een rij van ~35px, en het kanaal-icoon
   * links is helemaal geen invoerveld. Wie op de regel klikt in plaats van
   * precies op de tekst, kreeg dus niets — en omdat "Toevoegen" en de
   * klus-select pas ná het openklappen bestaan, leest dat als "de knop doet
   * het niet". De hele regel opent nu de composer.
   */
  const openViaRegel = (event: React.MouseEvent<HTMLDivElement>) => {
    const doel = event.target as Element | null;
    // Eigen controls houden hun eigen gedrag (kanaalkeuze, klus, foto's).
    if (doel?.closest("button, input, textarea, select, a, [role='combobox']")) {
      return;
    }
    // preventDefault houdt de focus waar hij hoort: in het tekstveld.
    event.preventDefault();
    tekstRef.current?.focus();
  };

  return (
    <div
      data-open={open}
      onMouseDown={openViaRegel}
      className="group/composer border-b px-3 py-2 data-[open=false]:cursor-text data-[open=false]:hover:bg-muted/30"
      onBlur={(e) => {
        // Blijft open zolang de focus binnen de composer valt; daarbuiten pas
        // sluiten als er niets is ingevuld — halve notities mogen niet weg.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (!heeftInhoud) setOpen(false);
      }}
    >
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
        <span className="mt-0.5 flex size-5 items-center justify-center text-muted-foreground">
          {KANAAL_ICONS[kanaal]}
        </span>
        <div className="min-w-0">
          <textarea
            ref={tekstRef}
            value={tekst}
            rows={1}
            aria-label="Nieuwe tijdlijn-notitie"
            placeholder={
              kanaal === "whatsapp"
                ? "Plak of vat het WhatsApp-gesprek samen…"
                : "Wat is er besproken of afgesproken?"
            }
            style={{ maxHeight: "9rem" }}
            className="h-auto min-h-0 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-snug shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            onFocus={() => setOpen(true)}
            onChange={(e) => setTekst(e.target.value)}
            onInput={(e) => groeiMee(e.currentTarget)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleOpslaan();
                return;
              }
              // Escape mag nooit typewerk weggooien: alleen sluiten als leeg.
              if (e.key === "Escape" && !heeftInhoud) {
                setOpen(false);
                e.currentTarget.blur();
              }
            }}
          />

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 group-data-[open=false]/composer:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150">
            <div
              role="radiogroup"
              aria-label="Kanaal"
              className="flex items-center gap-0.5 rounded-md border p-0.5"
            >
              {HANDMATIGE_KANALEN.map((k, index) => (
                <button
                  key={k}
                  ref={(el) => {
                    if (el) kanaalRefs.current[k] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={kanaal === k}
                  aria-label={KANAAL_LABELS[k]}
                  title={KANAAL_LABELS[k]}
                  tabIndex={kanaal === k ? 0 : -1}
                  data-actief={kanaal === k}
                  onKeyDown={(e) => handleKanaalToets(e, index)}
                  onClick={() => setKanaal(k)}
                  className="inline-flex size-6 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card data-[actief=true]:bg-accent data-[actief=true]:text-foreground"
                >
                  {KANAAL_ICONS[k]}
                </button>
              ))}
            </div>

            {!vasteWerkitemId && (
              <Select value={werkitemId} onValueChange={setWerkitemId}>
                <SelectTrigger
                  size="sm"
                  aria-label="Werkitem koppelen"
                  /* De hoogte moet via dezelfde `data-[size=sm]`-variant
                     worden overschreven: een kale `h-7` verliest van de
                     attribuutselector die `SelectTrigger` zelf meebrengt. */
                  className="min-h-0 w-auto max-w-[12rem] gap-1 border-0 bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:bg-accent hover:text-foreground data-[size=sm]:h-7 data-[size=sm]:sm:h-7 @max-[34rem]/sectie:max-w-[8rem] dark:bg-transparent dark:hover:bg-accent"
                >
                  <Briefcase className="size-3 shrink-0" />
                  <SelectValue placeholder="Klus" />
                </SelectTrigger>
                {/* Zie klant-taken-card: de standaard "item-aligned" zet deze
                    compacte trigger zijn lijst buiten beeld. */}
                <SelectContent position="popper">
                  <SelectItem value="geen">Geen klus</SelectItem>
                  {werkitems.map((w) => (
                    <SelectItem key={w._id} value={w._id.toString()}>
                      {w.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <label
              title="Foto's toevoegen"
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-card"
            >
              <ImagePlus className="size-3.5" />
              <span className="sr-only">Foto&apos;s toevoegen</span>
              {/* sr-only en niet `hidden`: een verborgen input is niet
                  focusbaar met het toetsenbord. */}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) void uploadFotos(files);
                  e.target.value = "";
                }}
              />
            </label>

            {voortgangen.length > 0 && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {uploadKlaar}/{voortgangen.length} foto&apos;s
              </span>
            )}

            <Button
              size="xs"
              className="ml-auto h-7 min-h-0 sm:h-7"
              onClick={() => void handleOpslaan()}
              disabled={!tekst.trim() || bezig || isBezig}
            >
              {bezig ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
              Toevoegen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Read-only chat-historie (besluit §2.3: niet migreren, wel tonen) ────────

function ChatHistorieBlok({ klantId }: { klantId: Id<"klanten"> }) {
  const [open, setOpen] = useState(false);
  const historie = useQuery(api.tijdlijn.chatHistorieVoorKlant, { klantId });

  if (!historie || historie.length === 0) return null;

  return (
    <div className="border-t">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <History className="size-3 shrink-0" />
            <span className="truncate">
              Chat-historie van vóór de tijdlijn ({historie.length},
              alleen-lezen)
            </span>
            <ChevronDown
              className={cn(
                "ml-auto size-3 shrink-0 transition-transform duration-150",
                open && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-56 space-y-1.5 overflow-y-auto border-t bg-muted/20 px-3 py-2">
            {historie.map((msg) => (
              <div
                key={msg._id}
                className="break-words [overflow-wrap:anywhere] text-sm"
              >
                <span className="text-xs text-muted-foreground">
                  {formatDatumTijd(msg.createdAt)} —{" "}
                  <span className="font-medium">{msg.senderName}</span>
                  {msg.senderType === "klant" ? " (klant)" : ""}:
                </span>{" "}
                <span className="whitespace-pre-wrap">{msg.message}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Hoofdcomponent ──────────────────────────────────────────────────────────

export interface KlantTijdlijnProps {
  klantId: Id<"klanten">;
  /** Vast werkitem-filter (Projecten-tab in de Chat-module) */
  vasteWerkitemId?: Id<"projecten">;
  /** Toon het read-only chat-historie-blok onderaan (default true) */
  toonHistorie?: boolean;
  /**
   * Rendert de sectie mét eigen paneel + kop. De Chat-module laat dit uit
   * staan; die heeft al een eigen omlijsting. Default false = huidig gedrag.
   */
  toonPaneel?: boolean;
  /** Kop van het paneel; alleen relevant bij `toonPaneel`. */
  titel?: string;
  className?: string;
}

export function KlantTijdlijn({
  klantId,
  vasteWerkitemId,
  toonHistorie = true,
  toonPaneel = false,
  titel = "Tijdlijn",
  className,
}: KlantTijdlijnProps) {
  const { user } = useCurrentUser();
  const isKantoor = isKantoorRol(user?.role);

  const [kanaalFilter, setKanaalFilter] = useState<string>("alle");
  const [werkitemFilter, setWerkitemFilter] = useState<string>("alle");
  const [zoekterm, setZoekterm] = useState("");

  const effectiefWerkitemId = vasteWerkitemId
    ? vasteWerkitemId
    : werkitemFilter !== "alle"
      ? (werkitemFilter as Id<"projecten">)
      : undefined;
  const effectiefKanaal =
    kanaalFilter !== "alle" ? (kanaalFilter as Kanaal) : undefined;

  const zoektermActief = zoekterm.trim().length > 0;

  const lijst = useQuery(
    api.tijdlijn.listVoorKlant,
    zoektermActief
      ? "skip"
      : {
          klantId,
          kanaal: effectiefKanaal,
          werkitemId: effectiefWerkitemId,
        }
  );
  const zoekResultaten = useQuery(
    api.tijdlijn.zoek,
    zoektermActief
      ? {
          zoekterm: zoekterm.trim(),
          klantId,
          kanaal: effectiefKanaal,
          werkitemId: effectiefWerkitemId,
        }
      : "skip"
  );
  const werkitems = useQuery(api.tijdlijn.listWerkitemsVoorFilter, {
    klantId,
  });

  const entries = useMemo(
    () => (zoektermActief ? zoekResultaten : lijst) ?? [],
    [zoektermActief, zoekResultaten, lijst]
  );
  const isLoading = zoektermActief
    ? zoekResultaten === undefined
    : lijst === undefined;

  // Chronologie komt van de datumkoppen, niet van een verticale as: die kost
  // vaste breedte in een kolom die al krap is en draagt geen informatie.
  // `nu` komt uit dezelfde memo, zodat "Vandaag" en "14:35" nooit tegen een
  // ander referentiemoment worden berekend.
  const { nu, groepen } = useMemo(() => {
    const referentie = new Date();
    const uit: { sleutel: string; label: string; items: TijdlijnEntryData[] }[] =
      [];
    for (const ruw of entries) {
      const entry = ruw as unknown as TijdlijnEntryData;
      const sleutel = dagSleutel(new Date(entry.timestamp));
      const laatste = uit[uit.length - 1];
      if (laatste && laatste.sleutel === sleutel) {
        laatste.items.push(entry);
      } else {
        uit.push({
          sleutel,
          label: datumGroepLabel(entry.timestamp, referentie),
          items: [entry],
        });
      }
    }
    return { nu: referentie, groepen: uit };
  }, [entries]);

  const filterActief =
    kanaalFilter !== "alle" || (!vasteWerkitemId && werkitemFilter !== "alle");
  const wisFilters = () => {
    setKanaalFilter("alle");
    setWerkitemFilter("alle");
    setZoekterm("");
  };

  const actieveFilterZin = [
    kanaalFilter !== "alle" ? KANAAL_LABELS[kanaalFilter as Kanaal] : null,
    !vasteWerkitemId && werkitemFilter !== "alle"
      ? ((werkitems ?? []).find((w) => w._id.toString() === werkitemFilter)
          ?.naam ?? "Gekozen klus")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const toolbarInhoud = (
    <>
      <div className="relative min-w-0 max-w-[14rem] flex-1 @max-[34rem]/sectie:max-w-none">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={zoekterm}
          onChange={(e) => setZoekterm(e.target.value)}
          aria-label="Zoek in de tijdlijn"
          placeholder="Zoeken…"
          /* h-7 én sm:h-7: `Input` zet zelf `h-11 sm:h-10` + `min-h-[44px]`,
             en zonder de sm-variant erbij wint die op desktop alsnog. */
          className="h-7 min-h-0 rounded-md pl-7 pr-7 text-xs sm:h-7"
        />
        {zoektermActief && (
          <button
            type="button"
            aria-label="Zoekterm wissen"
            onClick={() => setZoekterm("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {filterActief && actieveFilterZin && (
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground @max-[34rem]/sectie:hidden">
          <span className="truncate" title={actieveFilterZin}>
            {actieveFilterZin}
          </span>
          <button
            type="button"
            aria-label="Filters wissen"
            title="Filters wissen"
            onClick={wisFilters}
            className="shrink-0 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="h-7 min-h-0 shrink-0 gap-1 text-muted-foreground sm:h-7"
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="@max-[34rem]/sectie:sr-only">Filter</span>
            {filterActief && (
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs">Kanaal</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={kanaalFilter}
            onValueChange={setKanaalFilter}
          >
            <DropdownMenuRadioItem value="alle">
              Alle kanalen
            </DropdownMenuRadioItem>
            {(Object.keys(KANAAL_LABELS) as Kanaal[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k}>
                <span className="flex items-center gap-2">
                  {KANAAL_ICONS[k]}
                  {KANAAL_LABELS[k]}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {!vasteWerkitemId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Klus</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={werkitemFilter}
                onValueChange={setWerkitemFilter}
              >
                <DropdownMenuRadioItem value="alle">
                  Alle klussen
                </DropdownMenuRadioItem>
                {(werkitems ?? []).map((w) => (
                  <DropdownMenuRadioItem key={w._id} value={w._id.toString()}>
                    {w.naam}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  const inhoud = (
    <>
      {/* Bij `toonPaneel` staan de filters in de sectiekop; onder 34rem is die
          kop te vol en verhuizen ze naar deze eigen regel. Zonder paneel is er
          geen kop, dus staat de regel er altijd. */}
      <div
        className={cn(
          "items-center gap-1.5 border-b px-2 py-1.5",
          toonPaneel ? "hidden @max-[34rem]/sectie:flex" : "flex"
        )}
      >
        {toolbarInhoud}
      </div>

      {/* Compositie: alleen kantoor — voor andere rollen bestaat het
          invoerveld niet in de UI (PRD §1.2-patroon); server dwingt af */}
      {isKantoor && (
        <TijdlijnComposer
          klantId={klantId}
          werkitems={werkitems ?? []}
          vasteWerkitemId={vasteWerkitemId}
        />
      )}

      {/* Tijdlijn, nieuwste boven */}
      {isLoading ? (
        <ul className="divide-y">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 px-3 py-2"
            >
              <Skeleton className="mt-0.5 size-5 rounded-full" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-[70%]" />
                <Skeleton className="h-2.5 w-[35%]" />
              </div>
            </li>
          ))}
        </ul>
      ) : entries.length === 0 ? (
        zoektermActief || filterActief ? (
          <div className="px-3 py-4">
            <p className="text-sm">Geen entries voor deze zoekopdracht.</p>
            <Button
              variant="ghost"
              size="xs"
              className="mt-1.5 h-7 min-h-0 px-2 sm:h-7"
              onClick={wisFilters}
            >
              Filters wissen
            </Button>
          </div>
        ) : (
          <SectieLegeStaat tekst="Nog niets vastgelegd." />
        )
      ) : (
        <ul className="divide-y">
          {groepen.map((groep, groepIndex) => (
            <Fragment key={groep.sleutel}>
              <li className="bg-muted/30 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {groep.label}
              </li>
              {groep.items.map((entry, index) => (
                <TijdlijnEntryRij
                  key={entry._id}
                  entry={entry}
                  nu={nu}
                  isNieuwste={groepIndex === 0 && index === 0}
                />
              ))}
            </Fragment>
          ))}
        </ul>
      )}

      {toonHistorie && <ChatHistorieBlok klantId={klantId} />}
    </>
  );

  if (toonPaneel) {
    return (
      <SectiePaneel
        titel={titel}
        icoon={<History />}
        className={className}
        uitleg={
          isKantoor
            ? "Elk telefoontje, appje en mailtje met deze klant hoort hier, zodat de volgende collega het terugleest. Kies het kanaal, koppel het aan een klus en sla op met ⌘/Ctrl + Enter."
            : "Elk telefoontje, appje en mailtje met deze klant hoort hier. Zodra kantoor een gesprek vastlegt, verschijnt het hier."
        }
        acties={
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 @max-[34rem]/sectie:hidden">
            {toolbarInhoud}
          </div>
        }
      >
        {inhoud}
      </SectiePaneel>
    );
  }

  // Zonder paneel (Chat-module) toch een container: de smalle variant moet
  // ook daar op de sectiebreedte reageren, niet op de viewport.
  return (
    <div className={cn("@container/sectie min-w-0", className)}>{inhoud}</div>
  );
}
