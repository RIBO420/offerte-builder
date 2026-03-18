"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  PenTool,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OfferteChat } from "@/components/offerte/offerte-chat";
import { formatDate } from "./utils";
import type { Id } from "../../../../../../convex/_generated/dataModel";

interface KlantInteractieCardProps {
  offerteId: Id<"offertes">;
  klantNaam: string;
  shareToken: string | undefined | null;
  customerResponse?: {
    status: string;
    signedAt?: number;
    viewedAt?: number;
    comment?: string;
    signature?: string;
  };
}

export function KlantInteractieCard({ offerteId, klantNaam, shareToken, customerResponse }: KlantInteractieCardProps) {
  if (!shareToken) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Klantinteractie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Response & Chat - Side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: Customer Response & Signature */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Klantreactie</p>
            {customerResponse ? (
              <div className={cn(
                "rounded-lg p-3 h-[200px] flex flex-col",
                customerResponse.status === "geaccepteerd" && "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800",
                customerResponse.status === "afgewezen" && "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800",
                customerResponse.status === "bekeken" && "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
              )}>
                <div className="flex items-center gap-1.5 shrink-0">
                  {customerResponse.status === "geaccepteerd" && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Geaccepteerd</span>
                    </>
                  )}
                  {customerResponse.status === "afgewezen" && (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">Afgewezen</span>
                    </>
                  )}
                  {customerResponse.status === "bekeken" && (
                    <>
                      <Eye className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Bekeken</span>
                    </>
                  )}
                </div>
                {(customerResponse.signedAt || customerResponse.viewedAt) && (
                  <p className="text-[10px] text-muted-foreground mt-1 shrink-0">
                    {formatDate(customerResponse.signedAt || customerResponse.viewedAt!)}
                  </p>
                )}
                {customerResponse.comment && (
                  <p className="text-xs text-muted-foreground italic mt-2 shrink-0 line-clamp-2">
                    &quot;{customerResponse.comment}&quot;
                  </p>
                )}
                {customerResponse.signature ? (
                  <div className="flex-1 flex flex-col mt-2 min-h-0">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1 shrink-0">
                      <PenTool className="h-2.5 w-2.5" />
                      Handtekening
                    </p>
                    <div className="flex-1 flex items-center justify-center min-h-0">
                      {/* Using img for base64 data URLs (signatures) - not suitable for next/image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={customerResponse.signature}
                        alt="Handtekening"
                        className="max-w-full max-h-full object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                ) : customerResponse.status !== "bekeken" ? (
                  <div className="flex-1 flex items-center justify-center mt-2 bg-white/50 dark:bg-black/10 rounded border border-dashed">
                    <p className="text-[10px] text-muted-foreground">Geen handtekening</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg p-3 bg-muted/50 border border-dashed h-[200px] flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Nog geen reactie</p>
              </div>
            )}
          </div>

          {/* Right: Compact Chat */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Berichten
            </p>
            <div className="h-[200px]">
              <OfferteChat offerteId={offerteId} klantNaam={klantNaam} compact inline />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
