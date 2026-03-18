"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, Eye, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "./utils";

interface CustomerResponse {
  status: "geaccepteerd" | "afgewezen" | "bekeken";
  viewedAt?: number;
  signedAt?: number;
  comment?: string;
  signature?: string;
}

interface CustomerResponseCardProps {
  customerResponse: CustomerResponse;
}

export function CustomerResponseCard({ customerResponse }: CustomerResponseCardProps) {
  return (
    <Card className={cn(
      "border-2",
      customerResponse.status === "geaccepteerd" && "border-green-500 bg-green-50 dark:bg-green-950/30",
      customerResponse.status === "afgewezen" && "border-red-500 bg-red-50 dark:bg-red-950/30",
      customerResponse.status === "bekeken" && "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {customerResponse.status === "geaccepteerd" && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-700">Geaccepteerd</span>
            </>
          )}
          {customerResponse.status === "afgewezen" && (
            <>
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700">Afgewezen</span>
            </>
          )}
          {customerResponse.status === "bekeken" && (
            <>
              <Eye className="h-5 w-5 text-blue-600" />
              <span className="text-blue-700">Bekeken</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {customerResponse.viewedAt && (
          <p className="text-xs text-muted-foreground">
            Bekeken op {formatDate(customerResponse.viewedAt)}
          </p>
        )}
        {customerResponse.signedAt && (
          <p className="text-xs text-muted-foreground">
            Ondertekend op {formatDate(customerResponse.signedAt)}
          </p>
        )}
        {customerResponse.comment && (
          <div className="rounded bg-white/50 dark:bg-black/20 p-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Opmerking klant:</p>
            <p className="text-sm">{customerResponse.comment}</p>
          </div>
        )}
        {customerResponse.signature && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <PenTool className="h-3 w-3" />
              Handtekening
            </p>
            <div className="flex items-center justify-center max-h-20 overflow-hidden">
              {/* Using img for base64 data URLs (signatures) - not suitable for next/image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={customerResponse.signature}
                alt="Handtekening klant"
                className="max-w-full max-h-20 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
