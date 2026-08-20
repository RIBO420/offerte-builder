"use client";

/**
 * Het voorman-gezicht van `/uren`: de ploegdag.
 *
 * De voorman rijdt met zijn ploeg uit en de dag verloopt voor iedereen vrijwel
 * gelijk — dus is de handeling hier één knop: **"Ploegdag bevestigen voor N
 * man"** (de group-punch uit het onderzoek §2). Per lid worden de openstaande
 * planning-voorstellen bevestigd via `urenSegmenten.bevestigAlleVoorstellen`;
 * het resultaat staat per man onder zijn rij, want een half gelukte ronde mag
 * nooit stil blijven. Afwijken (Jan was om 14:00 naar de tandarts) gebeurt
 * daarna per man in de bestaande veld-flow — de eigen dag via de knop, de rest
 * door het lid zelf op zijn eigen toestel.
 *
 * `getPloegDag` geeft `null` als er geen ploeg of koppeling is — geen fout,
 * maar het eerlijke verhaal plus de weg naar `/veld`.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckCheck, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { DagbalkRij } from "./dagbalk-rij";
import { dagZin, gedeeldeAs, useDagKeuze } from "./film";
import { dagLabelLang } from "./week";

type PloegDag = NonNullable<
  FunctionReturnType<typeof api.urenControle.getPloegDag>
>;
type PloegDagLid = PloegDag["leden"][number];

/** Uitkomst van de groepshandeling, per man. */
interface LidResultaat {
  gelukt: boolean;
  tekst: string;
}

export function PloegDagGezicht() {
  const { dag, isVandaag, schuif, kiesDag } = useDagKeuze();
  const ploegDag = useQuery(api.urenControle.getPloegDag, { datum: dag });
  const bevestigAlleVoorstellen = useMutation(
    api.urenSegmenten.bevestigAlleVoorstellen
  );

  const [bezig, setBezig] = useState(false);
  const [resultaten, setResultaten] = useState<Record<string, LidResultaat>>(
    {}
  );

  const as = useMemo(
    () => gedeeldeAs(ploegDag?.leden ?? []),
    [ploegDag]
  );

  const teBevestigen = useMemo(
    () => (ploegDag?.leden ?? []).filter((lid) => lid.openVoorstellen > 0),
    [ploegDag]
  );

  const handlePloegdagBevestigen = async () => {
    if (!ploegDag || teBevestigen.length === 0) return;
    setBezig(true);
    const nieuw: Record<string, LidResultaat> = {};
    let gelukt = 0;
    // Bewust ná elkaar, niet parallel: elk lid krijgt zijn eigen uitkomst en
    // een haperende bevestiging houdt de rest niet tegen.
    for (const lid of teBevestigen) {
      try {
        const resultaat = await bevestigAlleVoorstellen({
          datum: ploegDag.datum,
          medewerkerId: lid.medewerkerId,
        });
        nieuw[lid.medewerkerId] = {
          gelukt: true,
          tekst:
            resultaat.bevestigd === 0
              ? "Geen open voorstellen meer"
              : resultaat.bevestigd === 1
                ? "1 voorstel bevestigd"
                : `${resultaat.bevestigd} voorstellen bevestigd`,
        };
        gelukt++;
      } catch (fout) {
        nieuw[lid.medewerkerId] = {
          gelukt: false,
          tekst:
            fout instanceof Error ? fout.message : "Bevestigen is mislukt",
        };
      }
      setResultaten({ ...nieuw });
    }
    setBezig(false);
    if (gelukt === teBevestigen.length) {
      showSuccessToast(
        gelukt === 1
          ? "Ploegdag bevestigd voor 1 man"
          : `Ploegdag bevestigd voor ${gelukt} man`
      );
    } else {
      showErrorToast(
        `Bevestigd voor ${gelukt} van ${teBevestigen.length} man — zie de regels per man`
      );
    }
  };

  return (
    <div className={cn("flex flex-1 flex-col gap-5 p-4 md:p-8", REVEAL_KLASSE)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-[19px] leading-7 font-semibold tracking-tight">
            {ploegDag?.dagLabel ?? dagLabelLang(dag)}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            De dag van je ploeg: bevestig de voorstellen in één keer, wijk
            daarna per man af.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => schuif(-1)}
            aria-label="Vorige dag"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 font-normal"
            onClick={() => kiesDag(dag)}
            disabled={isVandaag}
          >
            Vandaag
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => schuif(1)}
            disabled={isVandaag}
            aria-label="Volgende dag"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {ploegDag === undefined ? (
        <PloegDagSkelet />
      ) : ploegDag === null ? (
        <GeenPloegVandaag />
      ) : (
        <div className="flex flex-col gap-4">
          <SectiePaneel
            kopbalk
            titel={ploegDag.ploeg.naam}
            icoon={<Users aria-hidden />}
            telling={ploegDag.leden.length}
          >
            <RitRegel ploeg={ploegDag.ploeg} />
            <div className="divide-y divide-border/70">
              {ploegDag.leden.map((lid, i) => (
                <DagbalkRij
                  key={lid.medewerkerId}
                  label={lid.isEigenDag ? `${lid.naam} (jij)` : lid.naam}
                  balkLabel={`${lid.naam}, ${dagLabelLang(lid.datum)}`}
                  segmenten={lid.segmenten}
                  asVanMinuten={as.asVanMinuten}
                  asTotMinuten={as.asTotMinuten}
                  uren={lid.totaalUren}
                  status={lid.status}
                  metAs={i === ploegDag.leden.length - 1}
                  meta={<LidMeta lid={lid} resultaat={resultaten[lid.medewerkerId]} />}
                />
              ))}
            </div>
          </SectiePaneel>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-9"
              onClick={handlePloegdagBevestigen}
              disabled={bezig || teBevestigen.length === 0}
            >
              <CheckCheck className="size-4" aria-hidden />
              {teBevestigen.length === 0
                ? "Geen open voorstellen"
                : teBevestigen.length === 1
                  ? "Ploegdag bevestigen voor 1 man"
                  : `Ploegdag bevestigen voor ${teBevestigen.length} man`}
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 font-normal text-muted-foreground"
            >
              <Link href={`/veld?dag=${ploegDag.datum}`}>
                Eigen dag afwijken in Veld
              </Link>
            </Button>
          </div>

          <p className="rounded-lg border bg-muted/30 px-3 py-2.5 text-[13px] tabular-nums">
            {dagZin(ploegDag.totaalZin)}
          </p>
        </div>
      )}
    </div>
  );
}

/** Voorman, bus en stops — de rit van de dag, als één gedempte regel. */
function RitRegel({ ploeg }: { ploeg: PloegDag["ploeg"] }) {
  const rit = [
    ploeg.voermanNaam ? `voorman ${ploeg.voermanNaam}` : null,
    ploeg.busLabel ? `bus ${ploeg.busLabel}` : null,
  ].filter((deel): deel is string => deel !== null);
  if (rit.length === 0 && ploeg.stops.length === 0) return null;
  return (
    <p className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
      {rit.join(" · ")}
      {rit.length > 0 && ploeg.stops.length > 0 && " · "}
      {ploeg.stops.join(" → ")}
    </p>
  );
}

/** Open voorstellen en (na de groepshandeling) de uitkomst, per man. */
function LidMeta({
  lid,
  resultaat,
}: {
  lid: PloegDagLid;
  resultaat?: LidResultaat;
}) {
  if (resultaat) {
    return (
      <span
        className={cn(
          resultaat.gelukt ? undefined : "font-medium text-status-verzonden-text"
        )}
      >
        {resultaat.tekst}
      </span>
    );
  }
  if (lid.openVoorstellen === 0) return null;
  return (
    <span>
      {lid.openVoorstellen === 1
        ? "1 voorstel staat klaar"
        : `${lid.openVoorstellen} voorstellen staan klaar`}
    </span>
  );
}

/** Geen ploeg of geen koppeling — geen fout, wel de weg naar de eigen dag. */
function GeenPloegVandaag() {
  return (
    <SectiePaneel
      kopbalk
      titel="Geen ploegdag gevonden"
      icoon={<Users aria-hidden />}
    >
      <div className="flex flex-col gap-3 px-3 py-3">
        <p className="max-w-[58ch] text-[13px] text-pretty text-muted-foreground">
          Voor deze dag staat er geen ploeg met jou erin gepland, of je account
          is nog niet aan een medewerker gekoppeld. Je eigen uren doe je gewoon
          op het Veld-scherm; kantoor kan de koppeling controleren.
        </p>
        <div>
          <Button asChild size="sm" className="h-8">
            <Link href="/veld">Naar Veld</Link>
          </Button>
        </div>
      </div>
    </SectiePaneel>
  );
}

function PloegDagSkelet() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Ploegdag laden…</span>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-3 p-3">
          <Skeleton className="h-[10px] w-full rounded" />
          <Skeleton className="h-[10px] w-full rounded" />
          <Skeleton className="h-[10px] w-full rounded" />
        </div>
      </div>
      <Skeleton className="h-9 w-64" />
    </div>
  );
}
