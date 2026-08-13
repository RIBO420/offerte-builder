"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, ListTodo } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/lib/toast-utils";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const MAX_ZICHTBAAR = 6;

function vandaagISO(): string {
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

function formatDeadline(deadline: string): string {
  const [jaar, maand, dag] = deadline.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(new Date(jaar, maand - 1, dag));
}

/**
 * "Mijn taken" op het dashboard: openstaande klanttaken van de ingelogde
 * medewerker (kantoor zonder gekoppeld medewerkerprofiel ziet alle open taken
 * van het bedrijf — zie klantTaken.mijnTaken). Rendert niets als er niets
 * openstaat, zodat het dashboard niet volloopt met lege kaarten.
 */
export function MijnTaken() {
  const taken = useQuery(api.klantTaken.mijnTaken, { limit: 25 });
  const setStatus = useMutation(api.klantTaken.setStatus);
  const [bezigMet, setBezigMet] = useState<Id<"klantTaken"> | null>(null);

  if (!taken || taken.length === 0) return null;

  const handleAfronden = async (id: Id<"klantTaken">) => {
    setBezigMet(id);
    try {
      await setStatus({ id, status: "afgerond" });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij afronden taak"
      );
    } finally {
      setBezigMet(null);
    }
  };

  const zichtbaar = taken.slice(0, MAX_ZICHTBAAR);
  const rest = taken.length - zichtbaar.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          Mijn taken
          <Badge variant="secondary">{taken.length}</Badge>
        </CardTitle>
        <CardDescription>
          Openstaande klanttaken die aan jou zijn toegewezen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {zichtbaar.map((taak) => {
          const isTeLaat = taak.deadline && taak.deadline < vandaagISO();
          return (
            <div
              key={taak._id}
              className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <Checkbox
                className="mt-0.5"
                checked={false}
                disabled={bezigMet === taak._id}
                onCheckedChange={() => handleAfronden(taak._id)}
                aria-label={`Taak ${taak.titel} afronden`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{taak.titel}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {taak.klantNaam && (
                    <Link
                      href={`/klanten/${taak.klantId}`}
                      className="hover:underline"
                    >
                      {taak.klantNaam}
                    </Link>
                  )}
                  {taak.deadline && (
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        isTeLaat && "font-medium text-red-600 dark:text-red-400"
                      )}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {formatDeadline(taak.deadline)}
                      {isTeLaat && " · te laat"}
                    </span>
                  )}
                  {taak.prioriteit === "hoog" && (
                    <span className="font-medium text-red-600 dark:text-red-400">
                      Hoge prioriteit
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {rest > 0 && (
          <p className="px-2 pt-1 text-xs text-muted-foreground">
            + nog {rest} ta{rest === 1 ? "ak" : "ken"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
