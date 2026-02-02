"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Wrench,
  Users,
} from "lucide-react";
import {
  type NacalculatieResult,
  getDeviationColor,
  formatDeviation,
  formatHoursAsDays,
} from "@/lib/nacalculatie-calculator";
import { formatDecimal } from "@/lib/format";

interface NacalculatieSummaryProps {
  data: NacalculatieResult;
  teamGrootte?: number;
  effectieveUrenPerDag?: number;
}

const StatCard = memo(function StatCard({
  title,
  gepland,
  werkelijk,
  afwijking,
  afwijkingPercentage,
  unit,
  icon: Icon,
  status,
}: {
  title: string;
  gepland: number;
  werkelijk: number;
  afwijking: number;
  afwijkingPercentage?: number;
  unit: string;
  icon: React.ElementType;
  status: "good" | "warning" | "critical";
}) {
  const colors = getDeviationColor(status);
  const TrendIcon =
    afwijking > 0 ? TrendingUp : afwijking < 0 ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 w-1 h-full ${colors.border}`}
        />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {title}
            </CardTitle>
            <Badge
              variant="outline"
              className={`${colors.text} ${colors.bg} border-0`}
            >
              <TrendIcon className="h-3 w-3 mr-1" />
              {afwijkingPercentage !== undefined
                ? formatDeviation(afwijkingPercentage)
                : `${afwijking > 0 ? "+" : ""}${afwijking}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gepland</p>
              <p className="text-lg font-semibold">
                {gepland} {unit}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Werkelijk</p>
              <p className={`text-lg font-semibold ${colors.text}`}>
                {werkelijk} {unit}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Afwijking</span>
              <span className={`text-sm font-medium ${colors.text}`}>
                {afwijking > 0 ? "+" : ""}
                {afwijking} {unit}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

export const NacalculatieSummary = memo(function NacalculatieSummary({
  data,
  teamGrootte,
  effectieveUrenPerDag = 8,
}: NacalculatieSummaryProps) {
  const urenStatus = data.status;
  const dagenStatus = getDeviationStatusFromDays(
    data.afwijkingDagen,
    data.geplandeDagen
  );
  const machineStatus = getDeviationStatusFromPercentage(
    data.afwijkingMachineKostenPercentage
  );

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card
          className={`${getDeviationColor(data.status).bg} border-0`}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  Nacalculatie Overzicht
                </h3>
                <p className={`text-sm ${getDeviationColor(data.status).text}`}>
                  Totale afwijking: {formatDeviation(data.afwijkingPercentage)}
                  {data.afwijkingPercentage > 0
                    ? " meer uren dan gepland"
                    : data.afwijkingPercentage < 0
                      ? " minder uren dan gepland"
                      : " - exact op planning"}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={`text-lg px-4 py-2 ${getDeviationColor(data.status).text} ${getDeviationColor(data.status).bg}`}
              >
                {formatDeviation(data.afwijkingPercentage)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Uren"
          gepland={Math.round(data.geplandeUren * 10) / 10}
          werkelijk={Math.round(data.werkelijkeUren * 10) / 10}
          afwijking={Math.round(data.afwijkingUren * 10) / 10}
          afwijkingPercentage={data.afwijkingPercentage}
          unit="uur"
          icon={Clock}
          status={urenStatus}
        />
        <StatCard
          title="Dagen"
          gepland={data.geplandeDagen}
          werkelijk={data.werkelijkeDagen}
          afwijking={data.afwijkingDagen}
          unit="dagen"
          icon={Calendar}
          status={dagenStatus}
        />
        <StatCard
          title="Machinekosten"
          gepland={Math.round(data.geplandeMachineKosten)}
          werkelijk={Math.round(data.werkelijkeMachineKosten)}
          afwijking={Math.round(data.afwijkingMachineKosten)}
          afwijkingPercentage={data.afwijkingMachineKostenPercentage}
          unit="EUR"
          icon={Wrench}
          status={machineStatus}
        />
        {teamGrootte && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Team grootte
                    </span>
                    <span className="font-medium">
                      {teamGrootte} personen
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Medewerkers
                    </span>
                    <span className="font-medium">
                      {data.aantalMedewerkers}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Registraties
                    </span>
                    <span className="font-medium">
                      {data.aantalRegistraties}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Formatted Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Samenvatting</CardTitle>
          <CardDescription>
            Vergelijking voorcalculatie vs werkelijke uitvoering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Gepland</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>
                  {formatHoursAsDays(data.geplandeUren, effectieveUrenPerDag)}{" "}
                  werk ({data.geplandeUren} uur)
                </li>
                <li>{data.geplandeDagen} werkdagen</li>
                {data.geplandeMachineKosten > 0 && (
                  <li>
                    EUR {data.geplandeMachineKosten.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{" "}
                    machinekosten
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Werkelijk</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>
                  {formatHoursAsDays(data.werkelijkeUren, effectieveUrenPerDag)}{" "}
                  werk ({data.werkelijkeUren} uur)
                </li>
                <li>{data.werkelijkeDagen} werkdagen</li>
                {data.werkelijkeMachineKosten > 0 && (
                  <li>
                    EUR {data.werkelijkeMachineKosten.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{" "}
                    machinekosten
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

// Helper functions
function getDeviationStatusFromDays(
  afwijking: number,
  gepland: number
): "good" | "warning" | "critical" {
  const percentage = gepland > 0 ? (afwijking / gepland) * 100 : 0;
  if (Math.abs(percentage) <= 10) return "good";
  if (Math.abs(percentage) <= 25) return "warning";
  return "critical";
}

function getDeviationStatusFromPercentage(
  percentage: number
): "good" | "warning" | "critical" {
  if (Math.abs(percentage) <= 10) return "good";
  if (Math.abs(percentage) <= 25) return "warning";
  return "critical";
}

export default NacalculatieSummary;
