"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUrenKort } from "@/lib/format/uren-kort";
import { useIsKantoor } from "@/hooks/use-users";
import { getMutationErrorMessage } from "@/lib/error-handling";

type Bron = "auto" | "legacy" | "segmenten";

/**
 * De urenbronkeuze als zijpaneel van de nacalculatie. De conflictlijst bij
 * de urenrapportage (hub-export-dialog) gebruikt dezelfde mutatie.
 *
 * Alleen kantoor mag de urenbron zien (de query gooit voor andere rollen);
 * voor voorman/medewerker rendert het paneel niets.
 */
export function UrenbronPaneel({ projectId }: { projectId: Id<"projecten"> }) {
  const isKantoor = useIsKantoor();
  if (!isKantoor) return null;
  return <UrenbronPaneelInhoud projectId={projectId} />;
}

function UrenbronPaneelInhoud({ projectId }: { projectId: Id<"projecten"> }) {
  const isKantoor = useIsKantoor();
  const info = useQuery(
    api.urenRapportage.getProjectUrenBron,
    isKantoor ? { projectId } : "skip"
  );
  const bewaren = useMutation(api.urenRapportage.setProjectUrenBron);
  const [bezig, setBezig] = useState(false);

  const wijzigen = async (bron: Bron) => {
    setBezig(true);
    try {
      await bewaren({ projectId, bron });
      toast.success("Urenbron bijgewerkt");
    } catch (e) {
      toast.error(getMutationErrorMessage(e));
    } finally {
      setBezig(false);
    }
  };

  return (
    <SectiePaneel titel="Urenbron" kopbalk>
      <div className="flex flex-col gap-2 p-4">
        {info === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <>
            {info.status === "conflict" && (
              <p role="alert" className="text-[13px] font-medium text-destructive">
                Dit project heeft uren in beide bronnen. Kies welke uren meetellen.
              </p>
            )}
            <Select
              disabled={bezig}
              value={info.explicieteKeuze ?? "auto"}
              onValueChange={(v) => wijzigen(v as Bron)}
            >
              <SelectTrigger aria-label="Urenbron voor de nacalculatie" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatisch (één bron)</SelectItem>
                <SelectItem value="segmenten">
                  Dagsegmenten ({formatUrenKort(info.segmentMinuten / 60)} uur)
                </SelectItem>
                <SelectItem value="legacy">
                  Projectregistraties ({formatUrenKort(info.legacyMinuten / 60)} uur)
                </SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Bepaalt welke uren als werkelijk tellen. Twee bronnen worden nooit opgeteld.
        </p>
      </div>
    </SectiePaneel>
  );
}
