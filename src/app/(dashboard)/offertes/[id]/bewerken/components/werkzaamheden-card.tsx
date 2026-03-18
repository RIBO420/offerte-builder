"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { scopeLabels } from "./constants";

interface WerkzaamhedenCardProps {
  scopes: string[];
}

export function WerkzaamhedenCard({ scopes }: WerkzaamhedenCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Werkzaamheden</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {scopes.map((scope) => (
            <Badge key={scope} variant="secondary" className="text-xs">
              {scopeLabels[scope] || scope}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
