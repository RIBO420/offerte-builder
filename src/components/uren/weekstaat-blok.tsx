"use client";

/**
 * De weekstaat: het volledige medewerkers × dagen-overzicht van de week,
 * gegroepeerd per ploeg — concept A uit het onderzoek als vast blok.
 *
 * Aanvulling van Ricardo (17 aug) op de eerste Controlekamer: controle op
 * afwijking alléén gooide het overzicht weg. Als alles goed loopt zag je vijf
 * regels tekst en geen enkel cijfer, en "wie schreef wat, per ploeg?" kon
 * nergens meer beantwoord worden. Dit blok geeft dat overzicht terug zonder
 * het afwijkings-denken los te laten: de statuskleur per cel volgt exact
 * dezelfde beoordeling als de vraagblokken erboven.
 *
 * Vorm: boven ~40rem containerbreedte een rij per medewerker met zeven
 * dagcellen en een rijtotaal; daaronder kantelt hij naar weekkaarten
 * (naam + dagchips die wrappen) — nooit zijwaartse scroll (harde regel 1).
 * Klik op een dag met inhoud → de Ploegenfilm van die dag.
 */

import { Fragment } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { cn } from "@/lib/utils";
import type { WeekstaatCel, WeekstaatRij } from "./controle-types";

/** Invoer gebeurt in Mijn dag; kantoor mag daar voor iedereen schrijven. */
function invoerHref(medewerkerId: string, datum: string): string {
  return `/veld?dag=${datum}&medewerker=${medewerkerId}`;
}

const DAG_KOPPEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

/** Zelfde statuskleuren als de rest van de Controlekamer. */
const CEL_TOON: Record<WeekstaatCel["status"], string> = {
  leeg: "text-muted-foreground/50",
  open: "bg-surface-aandacht text-foreground",
  ingediend: "bg-surface-primair text-foreground",
  afwijkend:
    "bg-status-afgewezen text-status-afgewezen-text ring-1 ring-inset ring-status-afgewezen-border",
};

const STATUS_TEKST: Record<WeekstaatCel["status"], string> = {
  leeg: "niets geschreven",
  open: "nog niet ingediend",
  ingediend: "ingediend",
  afwijkend: "ingediend, wijkt af",
};

function urenTekst(uren: number): string {
  return uren.toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function Cel({
  cel,
  naam,
  medewerkerId,
  onDagFilm,
}: {
  cel: WeekstaatCel;
  naam: string;
  medewerkerId: string;
  onDagFilm?: (dag: { medewerkerId: string; datum: string }) => void;
}) {
  // "0,0" in elk open vak is ruis: het amber vlak zegt al "wacht nog", het
  // getal komt pas als er echt iets geschreven is.
  const inhoud = cel.uren > 0 ? urenTekst(cel.uren) : "—";
  const label = `${naam}, ${cel.datum}: ${STATUS_TEKST[cel.status]}${
    cel.uren > 0 ? `, ${urenTekst(cel.uren)} uur` : ""
  }`;

  const basis = cn(
    "flex h-8 min-w-0 items-center justify-center rounded-md text-xs tabular-nums",
    CEL_TOON[cel.status]
  );
  const klikStijl =
    "w-full transition-shadow hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  // Een leeg vak ís de invoeringang (melding 17 aug: "we missen totaal de
  // optie om uren in te voegen"): klik → Mijn dag voor die persoon en die dag.
  if (cel.status === "leeg") {
    return (
      <Link
        href={invoerHref(medewerkerId, cel.datum)}
        title={`${label} — uren invoeren`}
        aria-label={`${label} — uren invoeren`}
        className={cn(basis, klikStijl, "hover:text-foreground")}
      >
        {inhoud}
      </Link>
    );
  }

  if (!onDagFilm) {
    return (
      <span className={cn(basis, "w-full")} title={label} aria-label={label}>
        {inhoud}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={`${label} — bekijk de dag als film`}
      aria-label={`${label} — bekijk de dag als film`}
      onClick={() => onDagFilm({ medewerkerId, datum: cel.datum })}
      className={cn(basis, klikStijl)}
    >
      {inhoud}
    </button>
  );
}

export function WeekstaatBlok({
  weekstaat,
  onDagFilm,
}: {
  weekstaat: WeekstaatRij[];
  onDagFilm?: (dag: { medewerkerId: string; datum: string }) => void;
}) {
  // Groeperen per ploeg; ploegloos onderaan als "Zonder ploeg" (alleen als er
  // óók ploegen zijn — anders is het kopje ruis).
  const groepen = new Map<string, WeekstaatRij[]>();
  for (const rij of weekstaat) {
    const sleutel = rij.ploegLabel ?? "";
    const lijst = groepen.get(sleutel) ?? [];
    lijst.push(rij);
    groepen.set(sleutel, lijst);
  }
  const heeftPloegen = [...groepen.keys()].some((k) => k !== "");

  return (
    <SectiePaneel
      titel="Weekstaat"
      icoon={<CalendarRange />}
      kopbalk
      telling={weekstaat.length}
      uitleg="Alle medewerkers en hun uren per dag, gegroepeerd per ploeg. De kleur volgt de dagcontrole hierboven: groen is ingediend, amber wacht nog, rood wijkt af. Klik op een gevulde dag om hem als ploegenfilm te bekijken; klik op een leeg vak om uren in te voeren voor die persoon en die dag."
      legeRegel={
        weekstaat.length === 0
          ? {
              tekst: "Nog geen medewerkers.",
              hint: "Voeg medewerkers toe, dan verschijnt hier de weekstaat.",
            }
          : undefined
      }
    >
      {weekstaat.length > 0 && (
        <div className="@container/weekstaat">
          {/* ── Brede stand: het grid ─────────────────────────────────── */}
          <div className="hidden @min-[40rem]/weekstaat:block">
            <div className="grid grid-cols-[minmax(7rem,1.4fr)_repeat(7,minmax(0,1fr))_minmax(3.5rem,0.9fr)] items-center gap-x-1.5 px-3 py-2">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Medewerker
              </span>
              {DAG_KOPPEN.map((kop) => (
                <span
                  key={kop}
                  className="text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {kop}
                </span>
              ))}
              <span className="text-right text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Totaal
              </span>
            </div>
            <div className="divide-y border-t">
              {[...groepen.entries()].map(([ploeg, rijen]) => (
                <Fragment key={ploeg || "zonder-ploeg"}>
                  {heeftPloegen && (
                    <p className="bg-muted/40 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {ploeg || "Zonder ploeg"}
                    </p>
                  )}
                  {rijen.map((rij) => (
                    <div
                      key={rij.medewerkerId}
                      className="grid grid-cols-[minmax(7rem,1.4fr)_repeat(7,minmax(0,1fr))_minmax(3.5rem,0.9fr)] items-center gap-x-1.5 px-3 py-1.5"
                    >
                      <span
                        className="truncate text-sm font-medium"
                        title={rij.naam}
                      >
                        {rij.naam}
                      </span>
                      {rij.dagen.map((cel) => (
                        <Cel
                          key={cel.datum}
                          cel={cel}
                          naam={rij.naam}
                          medewerkerId={rij.medewerkerId}
                          onDagFilm={onDagFilm}
                        />
                      ))}
                      <span className="text-right text-sm font-semibold tabular-nums">
                        {rij.totaalUren > 0 ? urenTekst(rij.totaalUren) : "—"}
                      </span>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>

          {/* ── Smalle stand: weekkaarten (wrap, geen zijwaartse scroll) ── */}
          <div className="divide-y @min-[40rem]/weekstaat:hidden">
            {[...groepen.entries()].map(([ploeg, rijen]) => (
              <Fragment key={ploeg || "zonder-ploeg"}>
                {heeftPloegen && (
                  <p className="bg-muted/40 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {ploeg || "Zonder ploeg"}
                  </p>
                )}
                {rijen.map((rij) => (
                  <div key={rij.medewerkerId} className="px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {rij.naam}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {rij.totaalUren > 0 ? urenTekst(rij.totaalUren) : "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {rij.dagen.map((cel, i) => (
                        <span key={cel.datum} className="w-12">
                          <span className="block text-center text-[10px] text-muted-foreground">
                            {DAG_KOPPEN[i]}
                          </span>
                          <Cel
                            cel={cel}
                            naam={rij.naam}
                            medewerkerId={rij.medewerkerId}
                            onDagFilm={onDagFilm}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </SectiePaneel>
  );
}
