"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Calendar,
  Truck,
  Euro,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  conflict: Users,
  deadline: Calendar,
  materieel: Truck,
  financieel: Euro,
  keuring: ShieldCheck,
};

const PRIORITY_STYLES: Record<string, { badge: string; border: string }> = {
  hoog: {
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
    border: "border-l-red-500",
  },
  middel: {
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    border: "border-l-amber-500",
  },
  laag: {
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    border: "border-l-blue-500",
  },
};

export function WarningsFeed() {
  const warnings = useQuery(api.proactiveWarnings.getWarnings);

  if (!warnings || warnings.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Waarschuwingen ({warnings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {warnings.map((w) => {
            const Icon = TYPE_ICONS[w.type] ?? AlertTriangle;
            const styles = PRIORITY_STYLES[w.prioriteit] ?? PRIORITY_STYLES.laag;

            return (
              <div
                key={w.id}
                className={cn(
                  "rounded-md border border-l-4 px-3 py-2.5",
                  styles.border
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{w.titel}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] shrink-0", styles.badge)}
                      >
                        {w.prioriteit}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.beschrijving}
                    </p>
                    {w.actie && (
                      <p className="text-xs font-medium text-primary mt-1">
                        {w.actie}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
