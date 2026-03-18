"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail } from "lucide-react";
import { formatDate } from "./utils";

interface TijdlijnCardProps {
  createdAt: number;
  updatedAt: number;
  verzondenAt?: number;
  emailStats: { total: number; verzonden: number } | null | undefined;
}

export function TijdlijnCard({ createdAt, updatedAt, verzondenAt, emailStats }: TijdlijnCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tijdlijn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Aangemaakt</span>
          <span>{formatDate(createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Laatst gewijzigd</span>
          <span>{formatDate(updatedAt)}</span>
        </div>
        {verzondenAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Verzonden</span>
            <span>{formatDate(verzondenAt)}</span>
          </div>
        )}
        {emailStats && emailStats.total > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              Emails verzonden
            </span>
            <span>{emailStats.verzonden}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
