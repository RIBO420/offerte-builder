"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  LayoutTemplate,
  Sparkles,
  User,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useStandaardtuinen } from "@/hooks/use-standaardtuinen";
import { Id, Doc } from "../../../convex/_generated/dataModel";

type Template = Doc<"standaardtuinen"> & { isSystem: boolean };

interface TemplateSelectorProps {
  type: "aanleg" | "onderhoud";
  onSelect: (templateId: Id<"standaardtuinen"> | null, templateData?: {
    scopes: string[];
    scopeData: Record<string, unknown>;
  }) => void;
  onSkip: () => void;
}

// Note: onSkip is part of the public API but currently unused in this component
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TemplateSelector({ type, onSelect, onSkip }: TemplateSelectorProps) {
  const {
    templates,
    systemTemplates,
    userTemplates,
    isLoading,
  } = useStandaardtuinen(type);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Hier stond een effect dat zes hardgecodeerde pakketten aanmaakte zodra de
  // lijst leeg was. Weghalen uit de database hielp dus niet: bij het volgende
  // bezoek stonden ze er weer. Zie convex/standaardtuinen.ts.

  const handleContinue = () => {
    if (selectedId) {
      const template = templates.find((t: Template) => t._id === selectedId);
      if (template) {
        onSelect(selectedId as Id<"standaardtuinen">, {
          scopes: template.scopes,
          scopeData: template.defaultWaarden as Record<string, unknown>,
        });
        return;
      }
    }
    onSelect(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-xs text-muted-foreground">Pakketten laden...</p>
        </CardContent>
      </Card>
    );
  }

  // Zolang er nog geen pakketten samengesteld zijn, is een keuzelijst met één
  // optie zinloos: dan meteen door naar een lege offerte.
  if (templates.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Pakketten</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-muted-foreground">
            Er zijn nog geen pakketten samengesteld. Je begint met een lege
            offerte en kiest zelf de werkzaamheden.
          </p>
          <p className="text-xs text-muted-foreground">
            Een offerte die je vaker gebruikt, kun je bewaren met{" "}
            <span className="font-medium text-foreground">
              Opslaan als sjabloon
            </span>
            . Die staat hier de volgende keer als pakket.
          </p>
          <Button onClick={() => onSelect(null)}>Beginnen</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Standaardtuin Kiezen</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Begin met een vooraf gedefinieerde tuin of start vanaf nul
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <RadioGroup
          value={selectedId || ""}
          onValueChange={(value) => setSelectedId(value || null)}
        >
          {/* Start from scratch option */}
          <div
            className={`flex items-start space-x-2 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 touch-manipulation ${
              selectedId === null ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => setSelectedId(null)}
          >
            <RadioGroupItem value="" id="scratch" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="scratch" className="cursor-pointer font-medium text-sm">
                Zelf samenstellen
              </Label>
              <p className="text-xs text-muted-foreground">
                Lege offerte, selecteer zelf de scopes
              </p>
            </div>
          </div>

          {/* System templates */}
          {systemTemplates.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 pt-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                <span className="text-xs font-medium text-muted-foreground">
                  Standaard templates
                </span>
              </div>
              {systemTemplates.map((template: Template) => (
                <div
                  key={template._id}
                  className={`flex items-start space-x-2 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 touch-manipulation ${
                    selectedId === template._id
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                  onClick={() => setSelectedId(template._id)}
                >
                  <RadioGroupItem
                    value={template._id}
                    id={template._id}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Label
                        htmlFor={template._id}
                        className="cursor-pointer font-medium text-sm"
                      >
                        {template.naam}
                      </Label>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Systeem
                      </Badge>
                    </div>
                    {template.omschrijving && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {template.omschrijving}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {template.scopes.map((scope: string) => (
                        <Badge key={scope} variant="outline" className="text-[10px] px-1.5 py-0">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* User templates */}
          {userTemplates.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 pt-2">
                <User className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-medium text-muted-foreground">
                  Mijn templates
                </span>
              </div>
              {userTemplates.map((template: Template) => (
                <div
                  key={template._id}
                  className={`flex items-start space-x-2 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 touch-manipulation ${
                    selectedId === template._id
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                  onClick={() => setSelectedId(template._id)}
                >
                  <RadioGroupItem
                    value={template._id}
                    id={template._id}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={template._id}
                      className="cursor-pointer font-medium text-sm"
                    >
                      {template.naam}
                    </Label>
                    {template.omschrijving && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {template.omschrijving}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {template.scopes.map((scope: string) => (
                        <Badge key={scope} variant="outline" className="text-[10px] px-1.5 py-0">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </RadioGroup>

        <Separator />

        <div className="flex gap-2">
          <Button size="sm" onClick={handleContinue} className="flex-1">
            Doorgaan
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
