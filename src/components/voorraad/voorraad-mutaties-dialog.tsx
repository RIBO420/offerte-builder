"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, TrendingUp, TrendingDown, RefreshCw, Package, RotateCcw, Loader2 } from "lucide-react";

// Type for mutaties from Convex
export type MutatieType = "inkoop" | "verbruik" | "correctie" | "retour";

export interface ConvexVoorraadMutatie {
  _id: string;
  type: MutatieType;
  hoeveelheid: number;
  notities?: string;
  createdAt: number;
  createdBy?: string;
  projectNaam?: string | null;
  inkooporderNummer?: string | null;
}

// Legacy interface for backwards compatibility
export interface VoorraadMutatie {
  _id: string;
  type: MutatieType;
  hoeveelheid: number;
  vorigeVoorraad: number;
  nieuweVoorraad: number;
  opmerking?: string;
  gebruiker: string;
  datum: number;
}

interface VoorraadMutatiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productnaam: string;
  eenheid: string;
  mutaties: ConvexVoorraadMutatie[];
  isLoading?: boolean;
}

const mutatieTypeConfig: Record<MutatieType, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  inkoop: { label: "Inkoop", icon: TrendingUp, variant: "default" },
  verbruik: { label: "Verbruik", icon: TrendingDown, variant: "secondary" },
  correctie: { label: "Correctie", icon: RefreshCw, variant: "outline" },
  retour: { label: "Retour", icon: RotateCcw, variant: "outline" },
};

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function VoorraadMutatiesDialog({
  open,
  onOpenChange,
  productnaam,
  eenheid,
  mutaties,
  isLoading = false,
}: VoorraadMutatiesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Mutatie Historie
          </DialogTitle>
          <DialogDescription>
            {productnaam}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Mutaties laden...</p>
          </div>
        ) : mutaties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Geen mutaties</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              Er zijn nog geen voorraadmutaties voor dit product.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Wijziging</TableHead>
                  <TableHead>Referentie</TableHead>
                  <TableHead>Notities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mutaties.map((mutatie) => {
                  const config = mutatieTypeConfig[mutatie.type] || mutatieTypeConfig.correctie;
                  const IconComponent = config.icon;
                  const isPositive = mutatie.type === "inkoop" || mutatie.type === "retour" || mutatie.hoeveelheid > 0;

                  // Build reference string from project or inkooporder
                  const reference = mutatie.projectNaam
                    ? `Project: ${mutatie.projectNaam}`
                    : mutatie.inkooporderNummer
                    ? `Order: ${mutatie.inkooporderNummer}`
                    : mutatie.createdBy || "-";

                  return (
                    <TableRow key={mutatie._id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(mutatie.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          <IconComponent className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={isPositive ? "text-green-600" : "text-orange-600"}>
                          {mutatie.hoeveelheid > 0 ? "+" : ""}{mutatie.hoeveelheid} {eenheid}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">
                        {reference}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {mutatie.notities || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
