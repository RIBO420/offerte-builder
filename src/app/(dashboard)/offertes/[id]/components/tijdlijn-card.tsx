"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "./utils";

interface TijdlijnCardProps {
  createdAt: number;
  updatedAt: number;
  verzondenAt?: number;
}

export function TijdlijnCard({ createdAt, updatedAt, verzondenAt }: TijdlijnCardProps) {
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
      </CardContent>
    </Card>
  );
}
