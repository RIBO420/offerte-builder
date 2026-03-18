"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScopeTag, type ScopeType, scopeTypes } from "@/components/ui/scope-tag";
import { scopeLabels, bereikbaarheidLabels } from "./utils";

interface ScopesCardProps {
  scopes: string[] | undefined;
  algemeenParams: {
    bereikbaarheid: string;
    achterstalligheid?: string;
  };
}

export function ScopesCard({ scopes, algemeenParams }: ScopesCardProps) {
  if (!scopes || scopes.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Werkzaamheden</CardTitle>
        <CardDescription>
          Geselecteerde scopes voor deze offerte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {scopes.map((scope) => {
            // Check if scope is a valid ScopeType for ScopeTag
            const isScopeType = (scopeTypes as readonly string[]).includes(scope);
            if (isScopeType) {
              return (
                <ScopeTag key={scope} scope={scope as ScopeType} showIcon />
              );
            }
            // Fallback to Badge for scopes not in ScopeTag's scopeTypes
            return (
              <Badge key={scope} variant="secondary">
                {scopeLabels[scope] || scope}
              </Badge>
            );
          })}
        </div>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Bereikbaarheid:{" "}
            <span className="font-medium text-foreground">
              {bereikbaarheidLabels[algemeenParams.bereikbaarheid]}
            </span>
          </p>
          {algemeenParams.achterstalligheid && (
            <p className="text-sm text-muted-foreground">
              Achterstalligheid:{" "}
              <span className="font-medium text-foreground capitalize">
                {algemeenParams.achterstalligheid}
              </span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
