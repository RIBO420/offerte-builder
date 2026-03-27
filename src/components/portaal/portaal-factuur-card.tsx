"use client";

import Link from "next/link";
import { Receipt, CreditCard, Download, Eye, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

interface PortaalFactuurCardProps {
  factuur: {
    _id: string;
    factuurnummer: string;
    status: string;
    totaalInclBtw?: number;
    vervaldatum?: number;
    betaaldAt?: number;
    createdAt: number;
    paymentUrl?: string;
  };
}

function getFactuurStatusConfig(status: string) {
  switch (status) {
    case "betaald":
      return {
        label: "Betaald",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      };
    case "vervallen":
      return {
        label: "Vervallen",
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
      };
    case "verzonden":
    default:
      return {
        label: "Openstaand",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
  }
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function PortaalFactuurCard({ factuur }: PortaalFactuurCardProps) {
  const statusConfig = getFactuurStatusConfig(factuur.status);
  const isOverdue = factuur.status === "vervallen";

  return (
    <Card className={cn(
      "border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] transition-shadow hover:shadow-md",
      isOverdue && "border-red-200 dark:border-red-900/50"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "rounded-lg p-2 shrink-0",
              isOverdue ? "bg-red-100 dark:bg-red-900/20" : "bg-[#4ADE80]/10"
            )}>
              {isOverdue ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : (
                <Receipt className="h-5 w-5 text-[#4ADE80]" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {factuur.factuurnummer}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {formatDate(factuur.createdAt)}
                {factuur.vervaldatum && factuur.status !== "betaald" && (
                  <> &middot; Vervaldatum: {formatDate(factuur.vervaldatum)}</>
                )}
              </p>
              {factuur.betaaldAt && factuur.status === "betaald" && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Betaald op {formatDate(factuur.betaaldAt)}
                </p>
              )}
            </div>
          </div>
          <Badge className={cn("shrink-0 border", statusConfig.className)}>
            {statusConfig.label}
          </Badge>
        </div>

        {factuur.totaalInclBtw != null && (
          <div className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(factuur.totaalInclBtw)}
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
              incl. BTW
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm" className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black">
            <Link href={`/portaal/facturen/${factuur._id}`}>
              <Eye className="h-4 w-4 mr-1.5" />
              Bekijken
            </Link>
          </Button>
          {factuur.paymentUrl && factuur.status === "verzonden" && (
            <Button asChild variant="default" size="sm" className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black">
              <a href={factuur.paymentUrl} target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4 mr-1.5" />
                Betalen
              </a>
            </Button>
          )}
          {factuur.paymentUrl && factuur.status === "vervallen" && (
            <Button asChild variant="destructive" size="sm">
              <a href={factuur.paymentUrl} target="_blank" rel="noopener noreferrer">
                <CreditCard className="h-4 w-4 mr-1.5" />
                Alsnog betalen
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-gray-200 dark:border-[#2a3e2a]">
            <Download className="h-4 w-4 mr-1.5" />
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
