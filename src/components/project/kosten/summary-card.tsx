"use client";

import { memo } from "react";
import { m } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getDeviationStatus, getDeviationColors, formatCurrencyShort } from "./helpers";

// Loading skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[180px]" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
}

// Summary Card Component
export const SummaryCard = memo(function SummaryCard({
  title,
  gepland,
  werkelijk,
  afwijking,
  afwijkingPercentage,
  icon: Icon,
  iconColor,
}: {
  title: string;
  gepland: number;
  werkelijk: number;
  afwijking: number;
  afwijkingPercentage: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  const status = getDeviationStatus(afwijkingPercentage);
  const colors = getDeviationColors(status);
  const TrendIcon = afwijking > 0 ? TrendingUp : afwijking < 0 ? TrendingDown : Minus;

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${colors.border}`} />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full ${iconColor} flex items-center justify-center`}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              {title}
            </CardTitle>
            <Badge variant="outline" className={`${colors.text} ${colors.bg} border-0`}>
              <TrendIcon className="h-3 w-3 mr-1" />
              {afwijkingPercentage > 0 ? "+" : ""}{afwijkingPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gepland</p>
              <p className="text-lg font-semibold">{formatCurrencyShort(gepland)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Werkelijk</p>
              <p className={`text-lg font-semibold ${colors.text}`}>
                {formatCurrencyShort(werkelijk)}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Afwijking</span>
              <span className={`text-sm font-medium ${colors.text}`}>
                {afwijking > 0 ? "+" : ""}{formatCurrencyShort(afwijking)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </m.div>
  );
});
