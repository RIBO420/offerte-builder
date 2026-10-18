"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SectieLegeStaat } from "@/components/ui/sectie-paneel";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatHours } from "@/lib/format/number";
import { formatUrenKort } from "@/lib/format/uren-kort";
import { aantalMedewerkersTekst, dagKop, scopeLabel } from "./utils";

export interface UrenRegistratie {
  _id: string;
  medewerker: string;
  uren: number;
  datum: string;
  scope?: string;
  notities?: string;
  bron?: string;
}

interface UrenTabProps {
  isLoading: boolean;
  groupedByDate: [string, UrenRegistratie[]][];
  onEditItem: (item: UrenRegistratie) => void;
  onDeleteItem: (item: { type: "uren" | "machine"; id: string }) => void;
  /** Na afronden: geen bewerken/verwijderen meer. */
  alleenLezen?: boolean;
}

/**
 * Kolommen van een registratieregel. Breed (container ≥ 36rem): zes kolommen
 * zoals een tabel. Smal: naam + uren + menu op de eerste regel, scope ·
 * notitie · bron eronder — nooit zijwaarts scrollen.
 */
const RIJ_BREED =
  "@xl/sectie:grid-cols-[minmax(0,1.2fr)_4rem_7.5rem_minmax(0,1.6fr)_6rem_2rem] @xl/sectie:gap-x-3.5";

export function UrenTab({
  isLoading,
  groupedByDate,
  onEditItem,
  onDeleteItem,
  alleenLezen = false,
}: UrenTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LaadIndicator formaat="sectie" />
      </div>
    );
  }

  if (groupedByDate.length === 0) {
    return (
      <SectieLegeStaat
        tekst="Nog geen uren geregistreerd."
        hint={
          alleenLezen
            ? "Het project is afgerond; er komen geen uren meer bij."
            : "Registreer uren of importeer een CSV- of Excelbestand; de uren zijn nodig voor de nacalculatie."
        }
      />
    );
  }

  return (
    <div className="flex flex-col pb-1.5">
      {groupedByDate.map(([datum, items]) => {
        const dagTotaal = items.reduce((som, i) => som + i.uren, 0);
        const medewerkers = new Set(items.map((i) => i.medewerker)).size;
        const kopId = `dag-${datum}`;
        return (
          <section key={datum} aria-labelledby={kopId}>
            <div className="flex flex-wrap items-baseline gap-x-2.5 px-3 pb-1 pt-3">
              <h3 id={kopId} className="text-sm font-semibold">
                {dagKop(datum)}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatUrenKort(dagTotaal)} uur · {aantalMedewerkersTekst(medewerkers)}
              </span>
            </div>

            <div
              aria-hidden="true"
              className={`hidden items-center px-3 py-1 text-xs text-muted-foreground @xl/sectie:grid ${RIJ_BREED}`}
            >
              <span>Medewerker</span>
              <span className="text-right">Uren</span>
              <span>Scope</span>
              <span>Notitie</span>
              <span>Bron</span>
              <span />
            </div>

            <ul>
              {items.map((item) => (
                <li
                  key={item._id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-0.5 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 ${RIJ_BREED}`}
                >
                  <span className="truncate font-medium">{item.medewerker}</span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatHours(item.uren)}
                    <span className="sr-only"> uur</span>
                  </span>

                  {/* Smal één regel onder de naam; breed lossen de spans op
                      in hun eigen kolommen (`contents`). */}
                  <span className="order-last col-span-full flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground @xl/sectie:order-none @xl/sectie:contents">
                    <span className="shrink-0 @xl/sectie:text-[13px] @xl/sectie:text-foreground">
                      {item.scope ? scopeLabel(item.scope) : "Geen scope"}
                    </span>
                    {item.notities && (
                      <span aria-hidden="true" className="@xl/sectie:hidden">
                        ·
                      </span>
                    )}
                    <span
                      className="min-w-0 truncate @xl/sectie:text-[13px]"
                      title={item.notities || undefined}
                    >
                      {item.notities || <span className="hidden @xl/sectie:inline">—</span>}
                    </span>
                    <span aria-hidden="true" className="@xl/sectie:hidden">
                      ·
                    </span>
                    <span className="shrink-0">
                      {item.bron === "import" ? "Import" : "Handmatig"}
                    </span>
                  </span>

                  {alleenLezen ? (
                    <span aria-hidden="true" className="hidden @xl/sectie:block" />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label={`Acties voor registratie ${item.medewerker}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditItem(item)}>
                          <Pencil className="mr-2 size-4" />
                          Bewerken
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteItem({ type: "uren", id: item._id })}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
