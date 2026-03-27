"use client";

import { Clock, ListChecks } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FocusCardsProps {
  geregistreerdeUren: number;
  normUrenTotaal: number | null;
  geschatteDagen: number | null;
  teamGrootte: number | null;
  totaleTaken: number;
  afgerondeTaken: number;
}

export function ProjectFocusCards({
  geregistreerdeUren,
  normUrenTotaal,
  geschatteDagen,
  teamGrootte,
  totaleTaken,
  afgerondeTaken,
}: FocusCardsProps) {
  const urenPercentage = normUrenTotaal && normUrenTotaal > 0
    ? Math.round((geregistreerdeUren / normUrenTotaal) * 100)
    : 0;
  const planningPercentage = totaleTaken > 0
    ? Math.round((afgerondeTaken / totaleTaken) * 100)
    : 0;
  const openTaken = totaleTaken - afgerondeTaken;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Uren Focus Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Uren Voortgang
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{urenPercentage}%</span>
        </div>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-4xl font-extrabold tracking-tight">
            {geregistreerdeUren.toFixed(1)}
          </span>
          <span className="text-base text-muted-foreground">
            / {normUrenTotaal?.toFixed(1) ?? "—"} uur
          </span>
        </div>

        <Progress
          value={urenPercentage}
          className="h-2 mt-3 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-blue-400"
        />

        <div className="flex justify-between mt-2 text-[11px] text-muted-foreground/70">
          <span>{geschatteDagen?.toFixed(1) ?? "—"} dagen geschat</span>
          <span>{teamGrootte ?? "—"} teamleden</span>
        </div>
      </div>

      {/* Planning Focus Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <ListChecks className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Planning Voortgang
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{planningPercentage}%</span>
        </div>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-4xl font-extrabold tracking-tight">
            {afgerondeTaken}
          </span>
          <span className="text-base text-muted-foreground">
            / {totaleTaken} taken
          </span>
        </div>

        <Progress
          value={planningPercentage}
          className="h-2 mt-3 [&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-green-400"
        />

        <div className="flex justify-between mt-2 text-[11px] text-muted-foreground/70">
          <span>{afgerondeTaken} afgerond</span>
          <span>{openTaken} open</span>
        </div>
      </div>
    </div>
  );
}
