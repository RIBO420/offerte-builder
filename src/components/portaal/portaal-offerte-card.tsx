"use client";

import Link from "next/link";
import { FileText, Eye, Download, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

interface PortaalOfferteCardProps {
  offerte: {
    _id: string;
    offerteNummer: string;
    type?: string;
    status: string;
    totaalInclBtw?: number;
    createdAt: number;
    verzondenAt?: number;
    customerResponse?: {
      status?: string;
      respondedAt?: number;
    };
  };
}

function getStatusConfig(status: string, customerResponse?: { status?: string }) {
  if (customerResponse?.status === "geaccepteerd" || status === "geaccepteerd") {
    return { label: "Geaccepteerd", variant: "default" as const, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
  }
  if (customerResponse?.status === "afgewezen" || status === "afgewezen") {
    return { label: "Afgewezen", variant: "default" as const, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" };
  }
  if (status === "verzonden") {
    return { label: "Wacht op reactie", variant: "default" as const, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
  }
  return { label: status, variant: "default" as const, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" };
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function PortaalOfferteCard({ offerte }: PortaalOfferteCardProps) {
  const statusConfig = getStatusConfig(offerte.status, offerte.customerResponse);
  const isRejected = offerte.status === "afgewezen" || offerte.customerResponse?.status === "afgewezen";
  const canRespond = offerte.status === "verzonden" && !offerte.customerResponse?.status;

  return (
    <Card className={cn(
      "border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] transition-shadow hover:shadow-md",
      isRejected && "opacity-60"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-[#4ADE80]/10 p-2 shrink-0">
              <FileText className="h-5 w-5 text-[#4ADE80]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {offerte.offerteNummer}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {offerte.type === "onderhoud" ? "Onderhoud" : "Aanleg"} &middot;{" "}
                {formatDate(offerte.verzondenAt ?? offerte.createdAt)}
              </p>
            </div>
          </div>
          <Badge className={cn("shrink-0 border", statusConfig.className)}>
            {statusConfig.label}
          </Badge>
        </div>

        {offerte.totaalInclBtw != null && (
          <div className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(offerte.totaalInclBtw)}
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
              incl. BTW
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm" className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black">
            <Link href={`/portaal/offertes/${offerte._id}`}>
              <Eye className="h-4 w-4 mr-1.5" />
              {canRespond ? "Bekijken & Reageren" : "Bekijken"}
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="border-gray-200 dark:border-[#2a3e2a]">
            <Download className="h-4 w-4 mr-1.5" />
            PDF
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/portaal/chat">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Vraag stellen
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
