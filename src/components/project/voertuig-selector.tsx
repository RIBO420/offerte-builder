"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Loader2 } from "lucide-react";
import { KentekenBadge } from "@/components/ui/kenteken-plaat";
import { toast } from "sonner";

// Type for voertuig from database
interface Voertuig {
  _id: Id<"voertuigen">;
  kenteken: string;
  merk: string;
  model: string;
  type: string;
  status: "actief" | "inactief" | "onderhoud";
}

interface VoertuigSelectorProps {
  projectId: Id<"projecten">;
  selectedVoertuigen: Id<"voertuigen">[];
  onSelectionChange?: (voertuigIds: Id<"voertuigen">[]) => void;
  disabled?: boolean;
  showCard?: boolean;
  autoSave?: boolean;
}

export function VoertuigSelector({
  projectId,
  selectedVoertuigen,
  onSelectionChange,
  disabled = false,
  showCard = true,
  autoSave = true,
}: VoertuigSelectorProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Fetch active voertuigen from database
  const voertuigen = useQuery(api.voertuigen.getActive) as Voertuig[] | undefined;
  const isLoadingVoertuigen = voertuigen === undefined;

  // Mutation for updating project vehicles
  const updateVoertuigen = useMutation(api.projecten.updateVoertuigen);

  // Handle toggling a voertuig selection
  const handleToggleVoertuig = useCallback(
    async (voertuigId: Id<"voertuigen">) => {
      let newSelection: Id<"voertuigen">[];

      if (selectedVoertuigen.includes(voertuigId)) {
        // Remove from selection
        newSelection = selectedVoertuigen.filter((id) => id !== voertuigId);
      } else {
        // Add to selection
        newSelection = [...selectedVoertuigen, voertuigId];
      }

      // Notify parent component
      if (onSelectionChange) {
        onSelectionChange(newSelection);
      }

      // Auto-save to database if enabled
      if (autoSave) {
        setIsSaving(true);
        try {
          await updateVoertuigen({
            id: projectId,
            voertuigIds: newSelection,
          });
          toast.success("Voertuigen bijgewerkt");
        } catch (error) {
          toast.error("Fout bij opslaan voertuigen", {
            description: error instanceof Error ? error.message : "Onbekende fout",
          });
        } finally {
          setIsSaving(false);
        }
      }
    },
    [selectedVoertuigen, onSelectionChange, autoSave, updateVoertuigen, projectId]
  );

  // Get selected voertuig details for displaying badges
  const selectedVoertuigDetails = voertuigen?.filter((v) =>
    selectedVoertuigen.includes(v._id)
  ) || [];

  const content = (
    <div className="space-y-4">
      {/* Available vehicles checkboxes */}
      {isLoadingVoertuigen ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Voertuigen laden...
        </div>
      ) : voertuigen && voertuigen.length > 0 ? (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-muted-foreground">
            Selecteer voertuigen voor dit project
          </Label>
          <div className="space-y-2 rounded-lg border p-3">
            {voertuigen.map((voertuig) => (
              <div
                key={voertuig._id}
                className="flex items-center gap-3 py-1"
              >
                <Checkbox
                  id={`voertuig-${voertuig._id}`}
                  checked={selectedVoertuigen.includes(voertuig._id)}
                  onCheckedChange={() => handleToggleVoertuig(voertuig._id)}
                  disabled={disabled || isSaving}
                />
                <label
                  htmlFor={`voertuig-${voertuig._id}`}
                  className="flex-1 cursor-pointer flex items-center gap-3"
                >
                  <KentekenBadge kenteken={voertuig.kenteken} />
                  <span className="text-sm">
                    {voertuig.merk} {voertuig.model}
                    <span className="text-muted-foreground ml-1">
                      ({voertuig.type})
                    </span>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Geen voertuigen beschikbaar</p>
          <p className="text-xs mt-1">
            Voeg voertuigen toe in het wagenpark beheer
          </p>
        </div>
      )}

      {/* Selected vehicles summary */}
      {selectedVoertuigDetails.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Toegewezen voertuigen ({selectedVoertuigDetails.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {selectedVoertuigDetails.map((voertuig) => (
              <div
                key={voertuig._id}
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
              >
                <KentekenBadge kenteken={voertuig.kenteken} />
                <span className="text-xs text-muted-foreground">
                  {voertuig.merk} {voertuig.model}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opslaan...
        </div>
      )}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Voertuigen
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// Compact badge-only display for showing assigned vehicles
interface VoertuigBadgesProps {
  voertuigIds: Id<"voertuigen">[];
  showEmpty?: boolean;
}

export function VoertuigBadges({
  voertuigIds,
  showEmpty = true,
}: VoertuigBadgesProps) {
  // Fetch active voertuigen to get details
  const voertuigen = useQuery(api.voertuigen.getActive) as Voertuig[] | undefined;

  if (!voertuigen) {
    return null;
  }

  const selectedVoertuigen = voertuigen.filter((v) =>
    voertuigIds.includes(v._id)
  );

  if (selectedVoertuigen.length === 0) {
    if (!showEmpty) return null;
    return (
      <span className="text-sm text-muted-foreground">
        Geen voertuigen toegewezen
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {selectedVoertuigen.map((voertuig) => (
        <KentekenBadge key={voertuig._id} kenteken={voertuig.kenteken} />
      ))}
    </div>
  );
}
