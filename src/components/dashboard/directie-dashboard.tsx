"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Receipt, TrendingUp, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function pctChange(current: number, previous: number): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, direction: current > 0 ? "up" : "flat" };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    direction: change > 1 ? "up" : change < -1 ? "down" : "flat",
  };
}

function TrendBadge({ current, previous, invertColor }: { current: number; previous: number; invertColor?: boolean }) {
  const { value, direction } = pctChange(current, previous);
  if (direction === "flat") return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0%</span>;
  const isPositive = invertColor ? direction === "down" : direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isPositive ? "text-green-500" : "text-red-500"}`}>
      <Icon className="h-3 w-3" /> {value}%
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export function DirectieDashboard() {
  const stats = useQuery(api.directieDashboard.getDirectieStats);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { financieel: fin, operationeel: ops, kwartaalVergelijking: kw } = stats;

  return (
    <div className="space-y-6">
      {/* Section: Financieel & Operationeel (unieke KPIs) */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Financieel Overzicht</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            title="Openstaand"
            value={fmt.format(fin.openstaandBedrag)}
            icon={Receipt}
            iconColor="text-amber-500"
            footer={
              fin.vervaldeAantal > 0 ? (
                <span className="text-xs text-red-500 flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" /> {fin.vervaldeAantal} vervallen ({fmt.format(fin.vervaldenBedrag)})
                </span>
              ) : (
                <span className="text-xs text-green-500">Alles op tijd</span>
              )
            }
          />
          <MetricCard
            title="Gefactureerd dit Q"
            value={fmt.format(kw.gefactureerdThisQ)}
            icon={TrendingUp}
            iconColor="text-blue-500"
            footer={<TrendBadge current={kw.gefactureerdThisQ} previous={kw.gefactureerdPrevQ} />}
            footerLabel="vs vorig kwartaal"
          />
          <MetricCard
            title="Uren deze Maand"
            value={ops.urenDezeMaand.toFixed(0)}
            icon={Clock}
            iconColor="text-orange-500"
            footer={
              <span className="text-xs text-muted-foreground">
                Geregistreerd
              </span>
            }
          />
        </div>
      </div>

      {/* Section: Kwartaal Vergelijking */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Dit Kwartaal vs Vorig Kwartaal</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <ComparisonCard
            title="Offertes"
            current={kw.offertesThisQ}
            previous={kw.offertesPrevQ}
          />
          <ComparisonCard
            title="Geaccepteerd"
            current={kw.acceptedThisQ}
            previous={kw.acceptedPrevQ}
          />
          <ComparisonCard
            title="Omzet"
            current={kw.revenueThisQ}
            previous={kw.revenuePrevQ}
            isCurrency
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  icon: Icon,
  iconColor,
  footer,
  footerLabel,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconColor: string;
  footer?: React.ReactNode;
  footerLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">{value}</div>
        {footer && (
          <div className="flex items-center gap-1.5 mt-1">
            {footer}
            {footerLabel && (
              <span className="text-xs text-muted-foreground">{footerLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonCard({
  title,
  current,
  previous,
  isCurrency,
}: {
  title: string;
  current: number;
  previous: number;
  isCurrency?: boolean;
}) {
  const { value, direction } = pctChange(current, previous);
  const isUp = direction === "up";

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-lg font-bold">
              {isCurrency ? fmt.format(current) : current}
            </p>
            <p className="text-xs text-muted-foreground">
              Vorig: {isCurrency ? fmt.format(previous) : previous}
            </p>
          </div>
          <div
            className={`text-sm font-medium flex items-center gap-0.5 ${
              direction === "flat"
                ? "text-muted-foreground"
                : isUp
                  ? "text-green-500"
                  : "text-red-500"
            }`}
          >
            {direction === "up" && <ArrowUpRight className="h-4 w-4" />}
            {direction === "down" && <ArrowDownRight className="h-4 w-4" />}
            {direction === "flat" && <Minus className="h-4 w-4" />}
            {value}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
