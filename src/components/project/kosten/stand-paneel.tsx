"use client";

/**
 * "Besteed tot nu toe": het heldcijfer van de kostenpagina, met de begroting
 * ernaast, kosten- en urenvoortgang als balk en één duidende zin.
 */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { cn } from "@/lib/utils";
import {
  euro,
  opsomming,
  SOORT_LABEL,
  type KostSoort,
  type SoortRegel,
  type StandStatus,
} from "./stand";

const PIL: Record<StandStatus["toon"], { vlak: string; stip: string }> = {
  loopt: {
    vlak: "border-status-in-uitvoering-border bg-status-in-uitvoering text-status-in-uitvoering-text",
    stip: "bg-status-in-uitvoering-dot",
  },
  goed: {
    vlak: "border-status-afgerond-border bg-status-afgerond text-status-afgerond-text",
    stip: "bg-status-afgerond-dot",
  },
  marge: {
    vlak: "border-status-herinnering-border bg-status-herinnering text-status-herinnering-text",
    stip: "bg-status-herinnering-dot",
  },
  over: {
    vlak: "border-status-afgewezen-border bg-status-afgewezen text-status-afgewezen-text",
    stip: "bg-status-afgewezen-dot",
  },
  neutraal: {
    vlak: "border-status-concept-border bg-status-concept text-status-concept-text",
    stip: "bg-status-concept-dot",
  },
};

function StatusPil({ status }: { status: StandStatus }) {
  const pil = PIL[status.toon];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium",
        pil.vlak
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", pil.stip)} />
      {status.label}
    </span>
  );
}

function VoortgangsRij({
  label,
  procent,
  vulling,
}: {
  label: string;
  procent: number;
  vulling: string;
}) {
  const breedte = Math.min(100, Math.max(0, procent));
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="contents">
        <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full transition-[width] duration-500 ease-standaard motion-reduce:transition-none", vulling)}
            style={{ width: `${breedte}%` }}
          />
        </span>
        <span className="text-end font-semibold tabular-nums">{procent}%</span>
      </dd>
    </div>
  );
}

export function KostenStandPaneel({
  besteed,
  begroot,
  status,
  kostenProcent,
  urenProcent,
  duiding,
}: {
  besteed: number;
  begroot: number;
  status: StandStatus;
  kostenProcent: number;
  /** Undefined als er geen begrote uren zijn: dan alleen de kostenbalk. */
  urenProcent?: number;
  duiding: string;
}) {
  const over = begroot - besteed;
  return (
    <SectiePaneel titel="Besteed tot nu toe" acties={<StatusPil status={status} />}>
      <div className="flex flex-col gap-4 px-4 py-4 @md/sectie:px-5">
        <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
          <span className="font-display text-4xl leading-none font-semibold tracking-tight tabular-nums @md/sectie:text-[44px]">
            {euro(besteed)}
          </span>
          <span className="text-base text-muted-foreground tabular-nums">
            {begroot > 0 ? (
              <>
                van {euro(begroot)} begroot ·{" "}
                {over >= 0 ? `nog ${euro(over)} over` : `${euro(-over)} over de begroting`}
              </>
            ) : (
              "geen begroting gekoppeld"
            )}
          </span>
        </p>

        {begroot > 0 && (
          <dl className="flex flex-col gap-2">
            <VoortgangsRij label="Kosten" procent={kostenProcent} vulling="bg-accent-warm" />
            {urenProcent !== undefined && (
              <VoortgangsRij
                label="Uren gewerkt"
                procent={urenProcent}
                vulling="bg-muted-foreground/50"
              />
            )}
          </dl>
        )}

        <p className="text-pretty text-[13px] text-muted-foreground tabular-nums">{duiding}</p>
      </div>
    </SectiePaneel>
  );
}

/**
 * Amber signaal: een soort met begroting staat nog op € 0 terwijl het project
 * loopt. Per soort een omlijnde knop die de toevoegflow met die soort opent.
 */
export function NietGeboektSignaal({
  regels,
  onBoeken,
}: {
  regels: SoortRegel[];
  onBoeken: (soort: KostSoort) => void;
}) {
  if (regels.length === 0) return null;
  const enkel = regels.length === 1;
  const delen = regels.map(
    (r, i) =>
      `${i === 0 ? SOORT_LABEL[r.soort] : SOORT_LABEL[r.soort].toLowerCase()} (${euro(r.begroot)}${
        i === regels.length - 1 ? " begroot" : ""
      })`
  );
  const kop = `${opsomming(delen)} ${enkel ? "is" : "zijn"} nog niet geboekt.`;
  const uitleg = enkel
    ? `Zonder ${SOORT_LABEL[regels[0].soort].toLowerCase()}post lijkt het project goedkoper dan het is.`
    : "Zonder die posten lijkt het project goedkoper dan het is.";

  return (
    <section
      aria-label={enkel ? `${SOORT_LABEL[regels[0].soort]} nog niet geboekt` : "Soorten nog niet geboekt"}
      className="flex flex-wrap items-start gap-3 rounded-lg border border-status-herinnering-border bg-surface-aandacht px-4 py-3.5"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-status-herinnering-text"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-[1_1_16rem] text-pretty text-[13px] tabular-nums">
        <span className="font-semibold">{kop}</span>{" "}
        <span className="text-muted-foreground">{uitleg}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {regels.map((r) => (
          <Button
            key={r.soort}
            type="button"
            variant="outline"
            size="sm"
            className="border-primary/50 bg-transparent font-semibold text-primary hover:text-primary"
            onClick={() => onBoeken(r.soort)}
          >
            {SOORT_LABEL[r.soort]} boeken
          </Button>
        ))}
      </div>
    </section>
  );
}
