"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Receipt,
  ArrowLeft,
  Calendar,
  CreditCard,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import {
  getBetaalStatusConfig,
  formatFactuurDate,
  formatDatumVanDienst,
} from "@/components/portaal/portaal-factuur-card";
import { usePortaalFactuurPdf } from "@/components/portaal/use-portaal-factuur-pdf";

function statusIconVoor(betaalStatus: string) {
  switch (betaalStatus) {
    case "betaald":
      return { icon: CheckCircle, iconColor: "text-emerald-600 dark:text-emerald-400" };
    case "vervallen":
      return { icon: AlertTriangle, iconColor: "text-red-600 dark:text-red-400" };
    default:
      return { icon: Clock, iconColor: "text-amber-600 dark:text-amber-400" };
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-48 mt-1" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export default function PortaalFactuurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // Reuse the getFacturen list query and find the specific factuur
  const facturen = useQuery(api.portaal.getFacturen);
  const factuur = facturen?.find((f) => f._id === id);
  const { downloadPdf, isDownloading } = usePortaalFactuurPdf();

  if (facturen === undefined) {
    return <DetailSkeleton />;
  }

  if (!factuur) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Factuur niet gevonden
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Deze factuur bestaat niet of u heeft geen toegang.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/portaal/facturen">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Terug naar facturen
          </Link>
        </Button>
      </div>
    );
  }

  const statusConfig = getBetaalStatusConfig(factuur.betaalStatus);
  const { icon: StatusIcon, iconColor } = statusIconVoor(factuur.betaalStatus);
  const isBetaald = factuur.betaalStatus === "betaald";
  const isVervallen = factuur.betaalStatus === "vervallen";
  const isDeelbetaald = factuur.betaalStatus === "gedeeltelijk_betaald";
  const isPayable =
    factuur.paymentUrl && (factuur.betaalStatus === "open" || isDeelbetaald);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0 mt-0.5" aria-label="Terug naar facturen">
          <Link href="/portaal/facturen">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {factuur.factuurnummer}
            </h1>
            <Badge className={cn("border", statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatFactuurDate(factuur.factuurdatum)}
            </span>
          </div>
        </div>
      </div>

      {/* Status card */}
      <Card className={cn(
        "border",
        isBetaald
          ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
          : isVervallen
            ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
            : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
      )}>
        <CardContent className="p-4 flex items-center gap-3">
          <StatusIcon className={cn("h-5 w-5 shrink-0", iconColor)} />
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-white">
              {isBetaald
                ? "Deze factuur is betaald"
                : isVervallen
                  ? "Deze factuur is vervallen"
                  : isDeelbetaald
                    ? "Deze factuur is deels betaald"
                    : "Deze factuur staat open"}
            </p>
            {factuur.betaaldAt && isBetaald && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Betaald op {formatFactuurDate(factuur.betaaldAt)}
              </p>
            )}
            {isDeelbetaald &&
              factuur.betaaldBedrag != null &&
              factuur.totaalInclBtw != null && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatCurrency(factuur.betaaldBedrag)} van{" "}
                  {formatCurrency(factuur.totaalInclBtw)} voldaan
                </p>
              )}
            {factuur.vervaldatum && !isBetaald && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Vervaldatum: {formatFactuurDate(factuur.vervaldatum)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amount details */}
      <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#4ADE80]" />
            Factuurbedrag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {factuur.totaalInclBtw != null && (
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(factuur.totaalInclBtw)}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                incl. BTW
              </span>
            </div>
          )}

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Factuurnummer</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {factuur.factuurnummer}
              </span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Factuurdatum</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatFactuurDate(factuur.factuurdatum)}
              </span>
            </div>
            {factuur.datumVanDienst && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Datum van dienst</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDatumVanDienst(factuur.datumVanDienst)}
                </span>
              </div>
            )}
            {factuur.vervaldatum && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Vervaldatum</span>
                <span className={cn(
                  "font-medium",
                  isVervallen
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-900 dark:text-white"
                )}>
                  {formatFactuurDate(factuur.vervaldatum)}
                </span>
              </div>
            )}
            {isDeelbetaald && factuur.betaaldBedrag != null && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Reeds voldaan</span>
                <span className="font-medium text-sky-600 dark:text-sky-400">
                  {formatCurrency(factuur.betaaldBedrag)}
                </span>
              </div>
            )}
            {factuur.betaaldAt && (
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Betaald op</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatFactuurDate(factuur.betaaldAt)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3">
            {isPayable && (
              <Button asChild className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black">
                <a href={factuur.paymentUrl} target="_blank" rel="noopener noreferrer">
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  Nu betalen
                </a>
              </Button>
            )}
            {factuur.paymentUrl && isVervallen && (
              <Button asChild variant="destructive">
                <a href={factuur.paymentUrl} target="_blank" rel="noopener noreferrer">
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  Alsnog betalen
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="border-gray-200 dark:border-[#2a3e2a]"
              disabled={isDownloading}
              onClick={() => downloadPdf(factuur._id)}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              PDF downloaden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
