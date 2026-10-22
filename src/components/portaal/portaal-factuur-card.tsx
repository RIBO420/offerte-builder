"use client";

import Link from "next/link";
import { Receipt, CreditCard, Download, Eye, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import { usePortaalFactuurPdf } from "./use-portaal-factuur-pdf";

export interface PortaalFactuur {
  _id: string;
  factuurnummer: string;
  betaalStatus: string;
  totaalInclBtw?: number;
  betaaldBedrag?: number;
  factuurdatum: number;
  datumVanDienst?: string;
  vervaldatum?: number;
  betaaldAt?: number;
  isCreditnota?: boolean;
  createdAt: number;
  paymentUrl?: string;
}

interface PortaalFactuurCardProps {
  factuur: PortaalFactuur;
}

export function getBetaalStatusConfig(betaalStatus: string) {
  switch (betaalStatus) {
    case "betaald":
      return {
        label: "Betaald",
        className: "bg-status-geaccepteerd text-status-geaccepteerd-text border-status-geaccepteerd-border",
      };
    case "gedeeltelijk_betaald":
      return {
        label: "Deels betaald",
        className: "bg-status-gepland text-status-gepland-text border-status-gepland-border",
      };
    case "vervallen":
      return {
        label: "Vervallen",
        className: "bg-destructive/10 text-destructive border-destructive/30",
      };
    case "geannuleerd":
      return {
        label: "Geannuleerd",
        className: "bg-muted text-foreground border-border",
      };
    case "open":
    default:
      return {
        label: "Openstaand",
        className: "bg-status-herinnering text-status-herinnering-text border-status-herinnering-border",
      };
  }
}

export function formatFactuurDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatDatumVanDienst(datum: string): string {
  const parsed = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return datum;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function PortaalFactuurCard({ factuur }: PortaalFactuurCardProps) {
  const statusConfig = getBetaalStatusConfig(factuur.betaalStatus);
  const isOverdue = factuur.betaalStatus === "vervallen";
  const isPayable =
    factuur.paymentUrl &&
    ["open", "gedeeltelijk_betaald"].includes(factuur.betaalStatus);
  const { downloadPdf, isDownloading } = usePortaalFactuurPdf();

  return (
    <Card className={cn(
      "border border-border bg-card transition-shadow hover:shadow-md",
      isOverdue && "border-destructive/30"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "rounded-lg p-2 shrink-0",
              isOverdue ? "bg-destructive/10" : "bg-primary/10"
            )}>
              {isOverdue ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <Receipt className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {factuur.factuurnummer}
                {factuur.isCreditnota && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(creditnota)</span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Factuurdatum: {formatFactuurDate(factuur.factuurdatum)}
                {factuur.vervaldatum && factuur.betaalStatus !== "betaald" && (
                  <> &middot; Vervaldatum: {formatFactuurDate(factuur.vervaldatum)}</>
                )}
              </p>
              {factuur.datumVanDienst && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Datum van dienst: {formatDatumVanDienst(factuur.datumVanDienst)}
                </p>
              )}
              {factuur.betaaldAt && factuur.betaalStatus === "betaald" && (
                <p className="text-sm text-status-geaccepteerd-dot mt-0.5">
                  Betaald op {formatFactuurDate(factuur.betaaldAt)}
                </p>
              )}
              {factuur.betaalStatus === "gedeeltelijk_betaald" &&
                factuur.betaaldBedrag != null &&
                factuur.totaalInclBtw != null && (
                  <p className="text-sm text-status-gepland-dot mt-0.5">
                    {formatCurrency(factuur.betaaldBedrag)} van{" "}
                    {formatCurrency(factuur.totaalInclBtw)} voldaan
                  </p>
                )}
            </div>
          </div>
          <Badge className={cn("shrink-0 border", statusConfig.className)}>
            {statusConfig.label}
          </Badge>
        </div>

        {factuur.totaalInclBtw != null && (
          <div className="mt-4 text-xl font-semibold text-foreground">
            {formatCurrency(factuur.totaalInclBtw)}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              incl. BTW
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm">
            <Link href={`/portaal/facturen/${factuur._id}`}>
              <Eye className="h-4 w-4 mr-1.5" />
              Bekijken
            </Link>
          </Button>
          {isPayable && (
            <Button asChild variant="default" size="sm">
              <a href={factuur.paymentUrl} target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4 mr-1.5" />
                Betalen
              </a>
            </Button>
          )}
          {factuur.paymentUrl && isOverdue && (
            <Button asChild variant="destructive" size="sm">
              <a href={factuur.paymentUrl} target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4 mr-1.5" />
                Alsnog betalen
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-border"
            disabled={isDownloading}
            onClick={() => downloadPdf(factuur._id)}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
