"use client";

/**
 * Blok 3 · "Wat kan door?" — de stille meerderheid.
 *
 * Eén regel in plaats van een lijst: "17 dagen zonder bijzonderheden". Wie het
 * tóch wil zien klapt uit en krijgt naam · datum · totaal · mini-dagbalk.
 * Controleren blijft mógelijk, het hoeft alleen niet meer — dat is het hele
 * punt van controle op afwijking.
 *
 * De export is de checklist van de loonronde: hij kleurt pas primair als "wie is
 * achter" én "wat wijkt af" leeg zijn. Zolang er werk ligt is hij een gedempte
 * knop die je kúnt gebruiken, geen groene uitnodiging die suggereert dat je
 * klaar bent.
 */

import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { CheckCheck, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { formatHours } from "@/lib/format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { keurWeekGoedRef } from "./controle-api";
import type { DagSamenvatting } from "./controle-types";
import { Dagbalk } from "./dagbalk";
import { dagLabelLang } from "./week";

/**
 * Mag de export primair kleuren? Alleen als er niets meer op kantoor wacht.
 * Pure functie, want dit is een regel en geen opmaak — en zo is hij te testen
 * zonder de knop te renderen.
 */
export function exportIsPrimair(stand: {
  achter: number;
  afwijkend: number;
}): boolean {
  return stand.achter === 0 && stand.afwijkend === 0;
}

export function KanDoorBlok({
  stil,
  weekStart,
  achterAantal,
  afwijkendAantal,
  gekweten,
  exportKnop,
}: {
  stil: DagSamenvatting[];
  weekStart: string;
  achterAantal: number;
  afwijkendAantal: number;
  /** Dagen die deze week al akkoord bevonden zijn. */
  gekweten: number;
  /** De ExportDropdown; de pagina bepaalt of hij er is (kantoor-rol). */
  exportKnop?: (variant: "default" | "outline") => ReactNode;
}) {
  const keurWeekGoed = useMutation(keurWeekGoedRef);
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const primair = exportIsPrimair({
    achter: achterAantal,
    afwijkend: afwijkendAantal,
  });

  const handleAllesAkkoord = async () => {
    setBezig(true);
    try {
      const resultaat = await keurWeekGoed({ weekStart });
      const aantal = resultaat?.gekweten ?? stil.length;
      showSuccessToast(
        aantal === 1 ? "1 dag akkoord bevonden" : `${aantal} dagen akkoord bevonden`
      );
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Akkoord geven is mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  const kwijtingsRegel =
    gekweten > 0
      ? `${gekweten === 1 ? "1 dag is" : `${gekweten} dagen zijn`} deze week al akkoord bevonden.`
      : undefined;

  if (stil.length === 0) {
    return (
      <SectiePaneel
        kopbalk
        titel="Wat kan door?"
        icoon={<CheckCheck aria-hidden />}
        legeRegel={{
          tekst: "Niets staat te wachten.",
          hint:
            kwijtingsRegel ??
            "Zodra een dag is ingediend en geen afwijking heeft, komt hij hier.",
        }}
        uitleg="Ingediende dagen zonder afwijking. Eén klik op “Alles akkoord” kwijt ze allemaal; de export naar loon staat ernaast."
        acties={
          <div data-primair={primair ? "true" : "false"}>
            {exportKnop?.(primair ? "default" : "outline")}
          </div>
        }
      />
    );
  }

  return (
    <SectiePaneel
      kopbalk
      titel="Wat kan door?"
      icoon={<CheckCheck aria-hidden />}
      telling={stil.length}
      uitleg="Ingediende dagen zonder afwijking. Eén klik op “Alles akkoord” kwijt ze allemaal; de export naar loon staat ernaast."
    >
      <div className="flex flex-col gap-2 px-3 py-2.5 @[38rem]/sectie:flex-row @[38rem]/sectie:items-center @[38rem]/sectie:gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="uren-kan-door-lijst"
          className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
            aria-hidden
          />
          <span className="font-display font-semibold tabular-nums">
            {stil.length}{" "}
            {stil.length === 1 ? "dag" : "dagen"} zonder bijzonderheden
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {open ? "· inklappen" : "· uitklappen om te bekijken"}
          </span>
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={handleAllesAkkoord}
            disabled={bezig}
          >
            Alles akkoord
          </Button>
          <div data-primair={primair ? "true" : "false"}>
            {exportKnop?.(primair ? "default" : "outline")}
          </div>
        </div>
      </div>

      {kwijtingsRegel && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          {kwijtingsRegel}
        </p>
      )}

      {open && (
        <ul id="uren-kan-door-lijst" className="divide-y border-t">
          {stil.map((dag) => (
            <li
              key={`${dag.medewerkerId}-${dag.datum}`}
              className="flex flex-col gap-1.5 px-3 py-2 @[34rem]/sectie:grid @[34rem]/sectie:grid-cols-[10rem_1fr_4rem] @[34rem]/sectie:items-center @[34rem]/sectie:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{dag.naam}</p>
                <time
                  dateTime={dag.datum}
                  className="text-[11px] text-muted-foreground"
                >
                  {dagLabelLang(dag.datum)}
                </time>
              </div>
              <Dagbalk
                segmenten={dag.segmenten}
                formaat="mini"
                label={`${dag.naam}, ${dagLabelLang(dag.datum)}`}
              />
              <p className="text-[12.5px] tabular-nums text-muted-foreground @[34rem]/sectie:text-right">
                {formatHours(dag.totaalUren)} uur
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectiePaneel>
  );
}
