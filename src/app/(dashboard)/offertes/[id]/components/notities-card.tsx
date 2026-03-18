"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface NotitiesCardProps {
  notities: string | undefined | null;
}

export function NotitiesCard({ notities }: NotitiesCardProps) {
  if (!notities) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {notities}
        </p>
      </CardContent>
    </Card>
  );
}
