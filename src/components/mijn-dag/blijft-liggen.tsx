"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PersoonAvatar } from "@/components/taken/persoon-avatar";
import type { VerrijkteTaak } from "@/components/taken/types";
import { voornaamVan } from "@/components/taken/types";
import type { BlijftLiggenItem } from "@/components/mijn-dag/verdeel-op";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

/**
 * "Dit blijft liggen" (inventaris §B3) — het enige rode op dit scherm.
 *
 * Het bord toont wat er te doen is; dit paneel toont wat er níet gebeurt.
 * Twee knoppen, want dat zijn de twee uitwegen uit stilstand: je port de
 * ander (**Herinneren** — de server bepaalt bij wie de reminder terechtkomt)
 * of je haalt het naar je toe (**Zelf oppakken**). Een reminder is bewust
 * géén beweging op de taak: de teller loopt door, anders pord je een taak
 * simpelweg uit het paneel zonder dat er iets gebeurd is.
 */
function BijWie({ taak }: { taak: VerrijkteTaak }) {
  // "Bij wie ligt dit nu?" — bij een taak die op check wacht is dat de
  // checker, niet de maker die hem klaarzette.
  const wie =
    taak.status === "check"
      ? (taak.checker ?? taak.maker)
      : (taak.maker ?? taak.checker);
  // Zonder toewijzing zegt de redenregel al "niemand toegewezen";
  // dat hier herhalen is ruis.
  if (!wie) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs leading-4 text-muted-foreground">
      bij {voornaamVan(wie.naam)}
      <PersoonAvatar persoon={taak.maker} rol="maker" />
      <PersoonAvatar persoon={taak.checker} rol="checker" />
    </span>
  );
}

function Acties({ taak }: { taak: VerrijkteTaak }) {
  const herinner = useMutation(api.taakReacties.plaatsHerinnering);
  const zelfOppakken = useMutation(api.klantTaken.zelfOppakken);
  const [bezig, setBezig] = useState(false);

  const doe = async (
    actie: () => Promise<unknown>,
    gelukt: (uitkomst: unknown) => string
  ) => {
    setBezig(true);
    try {
      const uitkomst = await actie();
      showSuccessToast(gelukt(uitkomst));
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Er ging iets mis"
      );
    } finally {
      setBezig(false);
    }
  };

  const knop =
    "rounded-md px-2.5 py-1.5 text-xs font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

  return (
    <div className="flex flex-wrap gap-1.5 pt-0.5">
      <button
        type="button"
        disabled={bezig}
        className={cn(knop, "border bg-card hover:bg-accent")}
        onClick={(e) => {
          e.stopPropagation();
          void doe(
            () => herinner({ taakId: taak._id }),
            (uitkomst) => {
              const naam = (uitkomst as { gerichtAan: string | null })
                ?.gerichtAan;
              return naam
                ? `Herinnering geplaatst voor ${naam}`
                : "Herinnering geplaatst";
            }
          );
        }}
      >
        Herinneren
      </button>
      <button
        type="button"
        disabled={bezig}
        className={cn(
          knop,
          "bg-foreground text-background hover:bg-foreground/90"
        )}
        onClick={(e) => {
          e.stopPropagation();
          void doe(
            () => zelfOppakken({ taakId: taak._id }),
            () => "Je hebt dit zelf opgepakt"
          );
        }}
      >
        Zelf oppakken
      </button>
    </div>
  );
}

function LiggenKaart({
  item,
  onOpen,
}: {
  item: BlijftLiggenItem<VerrijkteTaak>;
  onOpen: (taak: VerrijkteTaak) => void;
}) {
  return (
    <article className="grid gap-1.5 rounded-lg border border-status-vervallen-border bg-card px-3 py-2.5 shadow-xs">
      <button
        type="button"
        onClick={() => onOpen(item.taak)}
        className="grid justify-items-start gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
          {item.taak.klantNaam}
        </span>
        <span className="line-clamp-2 break-words text-sm font-semibold leading-snug">
          {item.taak.titel}
        </span>
      </button>

      <ul className="grid gap-0.5">
        {item.redenen.map((reden) => (
          <li
            key={reden.tekst}
            className={cn(
              "text-xs leading-4",
              reden.hard
                ? "font-medium text-status-vervallen-text"
                : "text-muted-foreground"
            )}
          >
            · {reden.tekst}
          </li>
        ))}
      </ul>

      <BijWie taak={item.taak} />
      <Acties taak={item.taak} />
    </article>
  );
}

/** Weergave "Als kolom": vast links, zodat je er niet omheen scrolt. */
export function BlijftLiggenKolom({
  items,
  onOpen,
}: {
  items: Array<BlijftLiggenItem<VerrijkteTaak>>;
  onOpen: (taak: VerrijkteTaak) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Dit blijft liggen"
      className="sticky left-0 z-20 flex min-w-[15rem] max-w-[24rem] flex-1 basis-[18.5rem] flex-col rounded-xl border border-status-vervallen-border bg-status-vervallen/40 shadow-sm"
    >
      {/* De kop is het enige verzadigde vlak op het bord: donkerrood met witte
          tekst in licht thema; in dark een rode tint met rode tekst, omdat
          witte tekst op onze lichtere dark-rood te weinig contrast houdt. */}
      <header className="sticky top-0 z-10 flex items-center gap-2.5 rounded-t-xl bg-destructive px-3 py-2.5 text-white dark:bg-destructive/15 dark:text-status-vervallen-text">
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            Dit blijft liggen
          </span>
          <span className="block truncate text-[11px] leading-4 opacity-85">
            eerst dit, dan de rest
          </span>
        </span>
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-semibold tabular-nums text-status-vervallen-text">
          {items.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {items.map((item) => (
          <LiggenKaart key={item.taak._id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

/**
 * Weergave "Als balk": boven het bord, en léég is hier een uitkomst — dan
 * staat er een groene regel in plaats van niets. "Niets blijft liggen" is
 * informatie; een leeg vlak is dat niet.
 */
export function BlijftLiggenBalk({
  items,
  onOpen,
}: {
  items: Array<BlijftLiggenItem<VerrijkteTaak>>;
  onOpen: (taak: VerrijkteTaak) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-status-afgerond-border bg-status-afgerond px-3 py-2 text-sm text-status-afgerond-text">
        <CheckCircle2 aria-hidden className="size-4 shrink-0" />
        Niets blijft liggen. Alles loopt.
      </p>
    );
  }

  return (
    <section
      aria-label="Dit blijft liggen"
      className="grid gap-2 rounded-lg border border-status-vervallen-border bg-status-vervallen/40 p-2"
    >
      <h2 className="flex items-center gap-2 px-1 text-sm font-medium text-status-vervallen-text">
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        Dit blijft liggen
        <span className="rounded-full bg-card px-1.5 py-0.5 text-[11px] tabular-nums">
          {items.length}
        </span>
      </h2>
      <div className="grid gap-2 @2xl/bord:grid-cols-2 @5xl/bord:grid-cols-3">
        {items.map((item) => (
          <LiggenKaart key={item.taak._id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
