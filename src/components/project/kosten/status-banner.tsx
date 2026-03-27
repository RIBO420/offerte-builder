"use client";

import { m } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, CheckCircle } from "lucide-react";
import { getDeviationStatus, getDeviationColors, formatCurrency, type KostenDisplayData } from "./helpers";

interface StatusBannerProps {
  displayData: KostenDisplayData;
}

export function KostenStatusBanner({ displayData }: StatusBannerProps) {
  const totalAfwijkingPercentage = displayData.afwijkingPercentage.totaal;
  const status = getDeviationStatus(totalAfwijkingPercentage);
  const colors = getDeviationColors(status);

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`border-2 ${
        status === "good"
          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
          : status === "warning"
          ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20"
          : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
      }`}>
        <CardContent className="py-4 px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center ${
                status === "good"
                  ? "bg-green-100 dark:bg-green-900/50"
                  : status === "warning"
                  ? "bg-yellow-100 dark:bg-yellow-900/50"
                  : "bg-red-100 dark:bg-red-900/50"
              }`}>
                {displayData.afwijking.totaal > 0 ? (
                  <TrendingUp className={`h-6 w-6 md:h-7 md:w-7 ${colors.text}`} />
                ) : displayData.afwijking.totaal < 0 ? (
                  <TrendingDown className={`h-6 w-6 md:h-7 md:w-7 ${colors.text}`} />
                ) : (
                  <CheckCircle className="h-6 w-6 md:h-7 md:w-7 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Totale Kosten Afwijking</p>
                <p className={`text-2xl md:text-3xl font-bold ${colors.text}`}>
                  {totalAfwijkingPercentage > 0 ? "+" : ""}{totalAfwijkingPercentage}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {displayData.afwijking.totaal > 0
                    ? `${formatCurrency(displayData.afwijking.totaal)} meer dan gepland`
                    : displayData.afwijking.totaal < 0
                    ? `${formatCurrency(Math.abs(displayData.afwijking.totaal))} minder dan gepland`
                    : "Precies op budget"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 md:w-auto">
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Gepland</p>
                <p className="text-lg md:text-xl font-semibold">
                  {formatCurrency(displayData.geplandeKosten.totaal)}
                </p>
              </div>
              <div className="bg-background/60 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Werkelijk</p>
                <p className={`text-lg md:text-xl font-semibold ${colors.text}`}>
                  {formatCurrency(displayData.werkelijkeKosten.totaal)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </m.div>
  );
}
