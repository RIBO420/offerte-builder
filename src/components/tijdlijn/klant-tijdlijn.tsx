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
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFotoUpload, useFotoUrls } from "@/hooks/use-foto-upload";
import { isKantoorRol } from "@/lib/rollen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  StickyNote,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types & constanten ──────────────────────────────────────────────────────

type Kanaal = "telefoon" | "whatsapp" | "email" | "intern" | "systeem";
type HandmatigKanaal = Exclude<Kanaal, "systeem">;

const KANAAL_LABELS: Record<Kanaal, string> = {
  telefoon: "Telefoon",
  whatsapp: "WhatsApp",
  email: "E-mail",
  intern: "Intern",
  systeem: "Systeem",
};

const KANAAL_ICONS: Record<Kanaal, React.ReactNode> = {
  telefoon: <Phone className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  intern: <StickyNote className="h-3.5 w-3.5" />,
  systeem: <Bot className="h-3.5 w-3.5" />,
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

function EntryBijlagen({ bijlagen }: { bijlagen: Id<"_storage">[] }) {
  const { urls } = useFotoUrls(bijlagen);
  if (bijlagen.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {bijlagen.map((id) => {
        const url = urls.get(id);
        if (!url) return null;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={id}
            src={url}
            alt="Bijlage bij tijdlijn-entry"
            className="h-20 w-20 rounded-md object-cover border"
          />
        );
      })}
    </div>
  );
}

function TijdlijnEntryRij({ entry }: { entry: TijdlijnEntryData }) {
  const isSysteem = entry.kanaal === "systeem";
  return (
    <div className="flex gap-3 py-3 border-b last:border-b-0">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isSysteem
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        {KANAAL_ICONS[entry.kanaal]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{entry.auteurNaam}</span>
          <span>{formatDatumTijd(entry.timestamp)}</span>
          <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
            {KANAAL_LABELS[entry.kanaal]}
          </Badge>
          {entry.werkitemNaam && (
            <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
              <Briefcase className="h-3 w-3" />
              {entry.werkitemNaam}
            </Badge>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{entry.tekst}</p>
        {entry.bijlagen && entry.bijlagen.length > 0 && (
          <EntryBijlagen bijlagen={entry.bijlagen} />
        )}
      </div>
    </div>
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
      toast.success("Toegevoegd aan de tijdlijn");
    } catch {
      toast.error("Entry toevoegen mislukt");
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Select
          value={kanaal}
          onValueChange={(v) => setKanaal(v as HandmatigKanaal)}
        >
          <SelectTrigger className="w-[140px]" aria-label="Kanaal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="telefoon">Telefoon</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="intern">Intern</SelectItem>
          </SelectContent>
        </Select>
        {!vasteWerkitemId && (
          <Select value={werkitemId} onValueChange={setWerkitemId}>
            <SelectTrigger
              className="w-[200px]"
              aria-label="Werkitem koppelen"
            >
              <SelectValue placeholder="Koppel aan klus (optioneel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geen">Geen klus</SelectItem>
              {werkitems.map((w) => (
                <SelectItem key={w._id} value={w._id.toString()}>
                  {w.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <Textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        placeholder={
          kanaal === "whatsapp"
            ? "Plak of vat het WhatsApp-gesprek samen…"
            : "Wat is er besproken of afgesproken?"
        }
        rows={3}
      />
      {voortgangen.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {voortgangen.filter((v) => v.status === "voltooid").length} van{" "}
          {voortgangen.length} foto&apos;s geüpload
        </p>
      )}
      <div className="flex items-center justify-between">
        <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ImagePlus className="h-4 w-4" />
          Foto&apos;s
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) void uploadFotos(files);
              e.target.value = "";
            }}
          />
        </label>
        <Button
          size="sm"
          onClick={handleOpslaan}
          disabled={!tekst.trim() || bezig || isBezig}
        >
          {bezig ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Toevoegen
        </Button>
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
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <History className="h-4 w-4" />
          Chat-historie van vóór de tijdlijn ({historie.length} berichten,
          alleen-lezen)
          <ChevronDown
            className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {(historie ?? []).map((msg) => (
            <div key={msg._id} className="text-sm">
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
  );
}

// ─── Hoofdcomponent ──────────────────────────────────────────────────────────

export interface KlantTijdlijnProps {
  klantId: Id<"klanten">;
  /** Vast werkitem-filter (Projecten-tab in de Chat-module) */
  vasteWerkitemId?: Id<"projecten">;
  /** Toon het read-only chat-historie-blok onderaan (default true) */
  toonHistorie?: boolean;
}

export function KlantTijdlijn({
  klantId,
  vasteWerkitemId,
  toonHistorie = true,
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

  return (
    <div className="space-y-3">
      {/* Filters + zoeken */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek in de tijdlijn…"
            className="pl-8 pr-8"
            aria-label="Zoek in de tijdlijn"
          />
          {zoektermActief && (
            <button
              type="button"
              onClick={() => setZoekterm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Zoekterm wissen"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={kanaalFilter} onValueChange={setKanaalFilter}>
          <SelectTrigger className="w-[130px]" aria-label="Filter op kanaal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle kanalen</SelectItem>
            {(Object.keys(KANAAL_LABELS) as Kanaal[]).map((k) => (
              <SelectItem key={k} value={k}>
                {KANAAL_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!vasteWerkitemId && (
          <Select value={werkitemFilter} onValueChange={setWerkitemFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Filter op klus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle klussen</SelectItem>
              {(werkitems ?? []).map((w) => (
                <SelectItem key={w._id} value={w._id.toString()}>
                  {w.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground italic">
          {zoektermActief
            ? "Geen tijdlijn-entries gevonden voor deze zoekopdracht."
            : "Nog geen tijdlijn-entries voor deze klant."}
        </p>
      ) : (
        <div>
          {entries.map((entry) => (
            <TijdlijnEntryRij
              key={entry._id}
              entry={entry as unknown as TijdlijnEntryData}
            />
          ))}
        </div>
      )}

      {toonHistorie && <ChatHistorieBlok klantId={klantId} />}
    </div>
  );
}
