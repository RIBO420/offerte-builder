"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Checkbox } from "@/components/ui/checkbox";
import { SectiePaneel, SectieLegeStaat } from "@/components/ui/sectie-paneel";
import { Loader2 } from "lucide-react";
import { KentekenBadge } from "@/components/ui/kenteken-plaat";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

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
          showSuccessToast("Voertuigen bijgewerkt");
        } catch (error) {
          showErrorToast("Fout bij opslaan voertuigen", {
            description: error instanceof Error ? error.message : "Onbekende fout",
          });
        } finally {
          setIsSaving(false);
        }
      }
    },
    [selectedVoertuigen, onSelectionChange, autoSave, updateVoertuigen, projectId]
  );

  const aantalGekozen = voertuigen
    ? voertuigen.filter((v) => selectedVoertuigen.includes(v._id)).length
    : 0;

  const content = isLoadingVoertuigen ? (
    <p className="flex items-center gap-2 px-3 py-3 text-[13px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Voertuigen laden…
    </p>
  ) : voertuigen && voertuigen.length > 0 ? (
    <div className="flex flex-col p-1" aria-busy={isSaving}>
      {voertuigen.map((voertuig) => (
        <label
          key={voertuig._id}
          htmlFor={`voertuig-${voertuig._id}`}
          className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:bg-muted/50"
        >
          <Checkbox
            id={`voertuig-${voertuig._id}`}
            checked={selectedVoertuigen.includes(voertuig._id)}
            onCheckedChange={() => handleToggleVoertuig(voertuig._id)}
            disabled={disabled || isSaving}
          />
          <KentekenBadge kenteken={voertuig.kenteken} showEUStripe={false} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {voertuig.merk} {voertuig.model}
            <span className="text-muted-foreground"> · {voertuig.type}</span>
          </span>
        </label>
      ))}
    </div>
  ) : (
    <SectieLegeStaat
      tekst="Geen voertuigen beschikbaar"
      hint="Voeg voertuigen toe in het wagenparkbeheer."
    />
  );

  if (!showCard) {
    return content;
  }

  return (
    <SectiePaneel
      titel="Voertuigen"
      kopbalk
      acties={
        voertuigen && voertuigen.length > 0 ? (
          <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            {isSaving && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
            {aantalGekozen} van {voertuigen.length} gekozen
          </span>
        ) : undefined
      }
    >
      {content}
    </SectiePaneel>
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
