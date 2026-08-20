"use client";

/**
 * VeldDag — hoofdcomponent van de veld-weergave (PRD §2.6, stap 9a).
 * Mobiel-first; "Buiten"-modus zet de shadcn-kleurtokens op hoog contrast
 * voor fel daglicht (CSS-variabelen op de container, geen aparte styles).
 */

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Send,
  Sun,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCurrentUserRole } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KlantblokKaart } from "./klantblok-kaart";
import { SegmentenLijst } from "./segmenten-lijst";

function vandaagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function schuifDag(datum: string, dagen: number): string {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + dagen);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Externe store voor de "Buiten"-modus (localStorage + event). */
function subscribeBuitenModus(callback: () => void): () => void {
  window.addEventListener("veld-buiten-modus", callback);
  return () => window.removeEventListener("veld-buiten-modus", callback);
}

/** Hoog-contrast tokens voor fel daglicht ("Buiten"-modus, bijlage C). */
const BUITEN_STIJL: CSSProperties = {
  ["--background" as string]: "#ffffff",
  ["--foreground" as string]: "#000000",
  ["--card" as string]: "#ffffff",
  ["--card-foreground" as string]: "#000000",
  ["--muted" as string]: "#f2f2f2",
  ["--muted-foreground" as string]: "#1a1a1a",
  ["--border" as string]: "#000000",
  ["--primary" as string]: "#166534",
  ["--primary-foreground" as string]: "#ffffff",
};

export function VeldDag() {
  const router = useRouter();
  const role = useCurrentUserRole();
  const isKantoor =
    role === "directie" || role === "admin" || role === "projectleider";

  // Deeplink vanaf de urenpagina (rolgezichten, WS-C): `?dag=YYYY-MM-DD` opent
  // die dag, `?medewerker=<id>` kiest voor kantoor meteen de juiste mens.
  // Alleen de beginstand — daarna navigeert de gebruiker gewoon zelf.
  const zoekParams = useSearchParams();
  const dagParam = zoekParams.get("dag");
  const [datum, setDatum] = useState(() =>
    dagParam && /^\d{4}-\d{2}-\d{2}$/.test(dagParam) ? dagParam : vandaagIso()
  );
  const [gekozenMedewerkerId, setGekozenMedewerkerId] = useState<string | null>(
    () => zoekParams.get("medewerker")
  );

  // "Buiten"-modus onthouden op het toestel (Hub-gedrag, bijlage C)
  const buiten = useSyncExternalStore(
    subscribeBuitenModus,
    () => localStorage.getItem("veld-buiten-modus") === "1",
    () => false
  );
  const toggleBuiten = () => {
    localStorage.setItem("veld-buiten-modus", buiten ? "0" : "1");
    window.dispatchEvent(new Event("veld-buiten-modus"));
  };

  const dag = useQuery(api.urenSegmenten.getVeldDag, {
    datum,
    ...(isKantoor && gekozenMedewerkerId
      ? { medewerkerId: gekozenMedewerkerId as Id<"medewerkers"> }
      : {}),
  });
  const veldInstellingen = useQuery(api.instellingen.getVeldInstellingen, {});
  const medewerkers = useQuery(
    api.medewerkers.list,
    isKantoor ? { isActief: true } : "skip"
  );

  const dienDagIn = useMutation(api.urenSegmenten.dienDagIn);
  const heropenDag = useMutation(api.urenSegmenten.heropenDag);

  const isIngediend = dag?.dagStatus === "ingediend";
  const magBewerken = dag != null && (!isIngediend || isKantoor);

  const datumLabel = useMemo(
    () =>
      new Date(`${datum}T00:00:00`).toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [datum]
  );

  const handleDienIn = async () => {
    if (!dag) return;
    try {
      const resultaat = await dienDagIn({
        datum,
        ...(isKantoor && gekozenMedewerkerId
          ? { medewerkerId: gekozenMedewerkerId as Id<"medewerkers"> }
          : {}),
      });
      toast.success(
        `Dag ingediend (${resultaat.ingediend} segmenten). Kantoor kan hem zo nodig heropenen.`
      );
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Dag indienen is mislukt"
      );
    }
  };

  const handleHeropen = async () => {
    if (!dag) return;
    try {
      await heropenDag({ datum, medewerkerId: dag.medewerker._id });
      toast.success("Dag heropend — correcties worden gelogd");
    } catch (fout) {
      toast.error(
        fout instanceof Error ? fout.message : "Dag heropenen is mislukt"
      );
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-4", buiten && "text-[1.05rem]")}
      style={buiten ? BUITEN_STIJL : undefined}
      data-buiten-modus={buiten ? "1" : undefined}
    >
      {/* Kop: titel + buiten-modus + noodprotocol */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* "Veld", niet "Mijn dag": die naam hoort sinds v13 bij het
              werkbord op /mijn-dag. Twee schermen met dezelfde kop is precies
              hoe je mensen op de verkeerde pagina laat zoeken. */}
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Veld
          </h1>
          <p className="text-muted-foreground">
            Bevestig je uren, vink taken af en dien je dag in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={buiten ? "default" : "outline"}
            size="sm"
            onClick={toggleBuiten}
            aria-pressed={buiten}
          >
            <Sun className="mr-1 h-4 w-4" aria-hidden />
            Buiten
          </Button>
          <NoodprotocolKnop
            tekst={veldInstellingen?.noodprotocolTekst ?? null}
          />
        </div>
      </div>

      {/* Datum-navigatie + (kantoor) medewerker-keuze */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDatum((d) => schuifDag(d, -1))}
          aria-label="Vorige dag"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium capitalize">{datumLabel}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDatum((d) => schuifDag(d, 1))}
          aria-label="Volgende dag"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {datum !== vandaagIso() && (
          <Button variant="ghost" size="sm" onClick={() => setDatum(vandaagIso())}>
            Vandaag
          </Button>
        )}
        {isKantoor && medewerkers && medewerkers.length > 0 && (
          <Select
            value={gekozenMedewerkerId ?? "eigen"}
            onValueChange={(waarde) =>
              setGekozenMedewerkerId(waarde === "eigen" ? null : waarde)
            }
          >
            <SelectTrigger className="w-56" aria-label="Medewerker kiezen">
              <SelectValue placeholder="Medewerker" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eigen">Eigen dag</SelectItem>
              {medewerkers.map((m) => (
                <SelectItem key={m._id} value={m._id}>
                  {m.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {dag === undefined ? (
        <p className="text-sm text-muted-foreground">Dag laden…</p>
      ) : dag === null ? (
        // Account zonder eigen medewerker-koppeling: de backend geeft bewust
        // null terug. Kantoor kan de medewerker-kiezer hierboven gebruiken;
        // anders wijzen we de weg naar de medewerkers-pagina.
        isKantoor && medewerkers && medewerkers.length > 0 ? (
          <EmptyState
            icon={<UserRound aria-hidden />}
            title="Je account is niet aan een medewerker gekoppeld"
            description="Kies hierboven een medewerker om zijn of haar dag te bekijken."
          />
        ) : (
          <EmptyState
            icon={<UserRound aria-hidden />}
            title="Je account is niet aan een medewerker gekoppeld"
            description={
              isKantoor
                ? "Koppel je account aan een medewerker via het Team-scherm om hier een dag te zien."
                : "Vraag kantoor om je account aan een medewerker te koppelen; daarna zie je hier je dag."
            }
            action={
              isKantoor
                ? {
                    label: "Naar team",
                    onClick: () => router.push("/team"),
                  }
                : undefined
            }
          />
        )
      ) : (
        <>
          {/* Dag-status */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isIngediend ? "secondary" : "outline"}>
              {isIngediend ? (
                <>
                  <Lock className="mr-1 h-3 w-3" aria-hidden /> Ingediend
                </>
              ) : (
                <>
                  <LockOpen className="mr-1 h-3 w-3" aria-hidden /> Open
                </>
              )}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {dag.medewerker.naam}
              {dag.team ? ` — team ${dag.team.naam}` : " — geen team-dag gepland"}
            </span>
            {isIngediend && isKantoor && (
              <Button variant="outline" size="sm" onClick={handleHeropen}>
                <LockOpen className="mr-1 h-4 w-4" aria-hidden />
                Heropen (met log)
              </Button>
            )}
          </div>

          {/* Klantblokken van de team-dag: taken, route+delta, afronden, meerwerk, foto's */}
          {dag.stops.length > 0 && (
            <section aria-label="Geplande klussen" className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Geplande klussen</h2>
              {dag.stops.map((stop) => (
                <KlantblokKaart
                  key={stop.werkitemId}
                  stop={stop}
                  datum={datum}
                  magBewerken={magBewerken && !isIngediend}
                />
              ))}
            </section>
          )}

          {/* Urensegmenten: voorstellen bevestigen + eigen segmenten */}
          <SegmentenLijst
            dag={dag}
            datum={datum}
            magBewerken={magBewerken}
            isKantoor={isKantoor}
            gekozenMedewerkerId={
              isKantoor && gekozenMedewerkerId
                ? (gekozenMedewerkerId as Id<"medewerkers">)
                : undefined
            }
          />

          {/* Dag indienen */}
          {!isIngediend && (
            <div className="flex justify-end">
              <Button
                onClick={handleDienIn}
                disabled={dag.segmenten.length === 0}
                size="lg"
              >
                <Send className="mr-2 h-4 w-4" aria-hidden />
                Dag indienen
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Noodprotocol — vaste snelkoppeling (bijlage C). De inhoud is een beheerbaar
 * tekstblok (instellingen); de SOP-bibliotheek volgt in fase 3.
 */
function NoodprotocolKnop({ tekst }: { tekst: string | null }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <AlertTriangle className="mr-1 h-4 w-4" aria-hidden />
          Noodprotocol
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Noodprotocol</DialogTitle>
          <DialogDescription>
            Bij een ongeval of gevaarlijke situatie: bel bij levensgevaar
            altijd eerst 112.
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm">
          {tekst?.trim() ||
            "Er is nog geen noodprotocol ingesteld. Kantoor beheert de inhoud via de veld-instellingen."}
        </div>
        <DialogFooter>
          <Button asChild variant="destructive">
            <a href="tel:112">Bel 112</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
