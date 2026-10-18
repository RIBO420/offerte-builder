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
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { formatHours } from "@/lib/format/number";
import { formatCurrency, formatDate } from "./utils";

interface MachineUsageItem {
  _id: string;
  datum: string;
  uren: number;
  kosten: number;
  machine?: {
    naam: string;
    type?: string;
  } | null;
}

interface MachinesTabProps {
  isLoading: boolean;
  machineUsage: MachineUsageItem[];
  totaalKosten: number;
  onShowMachineForm: () => void;
  onDeleteItem: (item: { type: "uren" | "machine"; id: string }) => void;
  /** Na afronden: geen toevoegen/verwijderen meer. */
  alleenLezen?: boolean;
}

const RIJ_BREED =
  "@xl/sectie:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4rem_6.5rem_2rem] @xl/sectie:gap-x-3.5";

export function MachinesTab({
  isLoading,
  machineUsage,
  totaalKosten,
  onShowMachineForm,
  onDeleteItem,
  alleenLezen = false,
}: MachinesTabProps) {
  const toevoegen = alleenLezen ? null : (
    <Button variant="outline" size="sm" onClick={onShowMachineForm}>
      <Plus className="mr-1.5 size-4" />
      Machinegebruik toevoegen
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <LaadIndicator formaat="sectie" />
      </div>
    );
  }

  if (machineUsage.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 pr-3">
        <SectieLegeStaat
          tekst="Nog geen machinegebruik geregistreerd."
          hint="De kosten tellen mee in de nacalculatie."
        />
        {toevoegen}
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-1 pt-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          Totaal <span className="font-semibold text-foreground">{formatCurrency(totaalKosten)}</span>
        </p>
        {toevoegen}
      </div>

      <div
        aria-hidden="true"
        className={`hidden items-center px-3 py-1 text-xs text-muted-foreground @xl/sectie:grid ${RIJ_BREED}`}
      >
        <span>Machine</span>
        <span>Datum</span>
        <span className="text-right">Uren</span>
        <span className="text-right">Kosten</span>
        <span />
      </div>

      <ul>
        {machineUsage.map((item) => {
          const naam = item.machine?.naam || "Onbekende machine";
          return (
            <li
              key={item._id}
              className={`grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-0.5 rounded-md px-3 py-2 transition-colors hover:bg-muted/50 ${RIJ_BREED}`}
            >
              <span className="min-w-0 truncate font-medium">
                {naam}
                {item.machine?.type && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {item.machine.type}
                  </span>
                )}
              </span>
              <span className="order-last col-span-full text-xs text-muted-foreground tabular-nums @xl/sectie:order-none @xl/sectie:col-span-1 @xl/sectie:text-[13px] @xl/sectie:text-foreground">
                {formatDate(item.datum)}
                <span className="@xl/sectie:hidden"> · {formatHours(item.uren)} uur</span>
              </span>
              <span className="hidden text-right tabular-nums @xl/sectie:inline">
                {formatHours(item.uren)}
              </span>
              <span className="text-right font-semibold tabular-nums">
                {formatCurrency(item.kosten)}
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
                      aria-label={`Acties voor machinegebruik ${naam}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onDeleteItem({ type: "machine", id: item._id })}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Verwijderen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
