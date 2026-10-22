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
    return { label: "Geaccepteerd", variant: "default" as const, className: "bg-status-geaccepteerd text-status-geaccepteerd-text border-status-geaccepteerd-border" };
  }
  if (customerResponse?.status === "afgewezen" || status === "afgewezen") {
    return { label: "Afgewezen", variant: "default" as const, className: "bg-destructive/10 text-destructive border-destructive/30" };
  }
  if (status === "verzonden") {
    return { label: "Wacht op reactie", variant: "default" as const, className: "bg-status-herinnering text-status-herinnering-text border-status-herinnering-border" };
  }
  return { label: status, variant: "default" as const, className: "bg-muted text-foreground" };
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
      "border border-border bg-card transition-shadow hover:shadow-md",
      isRejected && "opacity-60"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {offerte.offerteNummer}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
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
          <div className="mt-4 text-xl font-semibold text-foreground">
            {formatCurrency(offerte.totaalInclBtw)}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              incl. BTW
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="default" size="sm">
            <Link href={`/portaal/offertes/${offerte._id}`}>
              <Eye className="h-4 w-4 mr-1.5" />
              {canRespond ? "Bekijken & Reageren" : "Bekijken"}
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="border-border">
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
