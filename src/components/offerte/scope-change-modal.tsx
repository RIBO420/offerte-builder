"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shovel,
  Layers,
  Flower2,
  Trees,
  Hammer,
  Zap,
  Sparkles,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import type { AanlegScope } from "@/app/(dashboard)/offertes/nieuw/aanleg/hooks/useAanlegWizard";
import { SCOPES } from "@/app/(dashboard)/offertes/nieuw/aanleg/hooks/useAanlegWizard";

// Scope icons mapping
const SCOPE_ICONS = {
  grondwerk: Shovel,
  bestrating: Layers,
  borders: Flower2,
  gras: Trees,
  houtwerk: Hammer,
  water_elektra: Zap,
  specials: Sparkles,
} as const;

interface ScopeChangeModalProps {
  selectedScopes: AanlegScope[];
  onScopesChange: (scopes: AanlegScope[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScopeChangeModal({
  selectedScopes,
  onScopesChange,
  open,
  onOpenChange,
}: ScopeChangeModalProps) {
  const [pendingScopes, setPendingScopes] = useState<AanlegScope[]>(selectedScopes);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset pending state when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setPendingScopes(selectedScopes);
        setHasChanges(false);
      }
      onOpenChange(isOpen);
    },
    [selectedScopes, onOpenChange]
  );

  const toggleScope = useCallback(
    (scopeId: AanlegScope) => {
      setPendingScopes((prev) => {
        const next = prev.includes(scopeId)
          ? prev.filter((s) => s !== scopeId)
          : [...prev, scopeId];
        setHasChanges(true);
        return next;
      });
    },
    []
  );

  // Determine which scopes are being removed (had data, now deselected)
  const removedScopes = selectedScopes.filter(
    (s) => !pendingScopes.includes(s)
  );

  const handleSave = useCallback(() => {
    onScopesChange(pendingScopes);
    onOpenChange(false);
  }, [pendingScopes, onScopesChange, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scopes wijzigen</DialogTitle>
          <DialogDescription>
            Selecteer welke werkzaamheden onderdeel zijn van dit project. Je kunt
            scopes toevoegen of verwijderen zonder terug te gaan naar stap 1.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          {SCOPES.map((scope) => {
            const isSelected = pendingScopes.includes(scope.id);
            const Icon = SCOPE_ICONS[scope.id];
            return (
              <div
                key={scope.id}
                className={`relative flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all duration-200 hover:shadow-md active:scale-[0.98] touch-manipulation ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30"
                }`}
                onClick={() => toggleScope(scope.id)}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    toggleScope(scope.id);
                  }
                }}
              >
                <div
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                    isSelected
                      ? `${scope.color} border-transparent text-white scale-100`
                      : "border-input bg-background scale-95"
                  }`}
                >
                  {isSelected ? (
                    <Check
                      className="h-5 w-5 animate-in zoom-in-50 duration-200"
                      strokeWidth={3}
                    />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground opacity-50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <Label className="cursor-pointer font-medium text-sm">
                      {scope.naam}
                    </Label>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {scope.beschrijving}
                  </p>
                  {scope.verplicht && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {scope.verplicht.map((v) => (
                        <Badge
                          key={v}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          + {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {removedScopes.length > 0 && (
          <Alert variant="destructive" className="mt-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Let op:</span> Data voor{" "}
              {removedScopes
                .map((s) => {
                  const scope = SCOPES.find((sc) => sc.id === s);
                  return scope?.naam || s;
                })
                .join(", ")}{" "}
              wordt verwijderd.
            </AlertDescription>
          </Alert>
        )}

        {pendingScopes.length === 0 && hasChanges && (
          <Alert className="mt-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Selecteer minimaal een scope om door te gaan.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Annuleren
          </Button>
          <Button
            onClick={handleSave}
            disabled={pendingScopes.length === 0}
          >
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
