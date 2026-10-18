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

type Bron = "auto" | "legacy" | "segmenten";

/**
 * De urenbronkeuze als zijpaneel. Zelfde query en mutatie als
 * `ProjectUrenBronSelector` (hub-export-dialog), die elders als losse kaart
 * blijft staan; hier in de vorm van de nacalculatie.
 */
export function UrenbronPaneel({ projectId }: { projectId: Id<"projecten"> }) {
  const info = useQuery(api.urenRapportage.getProjectUrenBron, { projectId });
  const bewaren = useMutation(api.urenRapportage.setProjectUrenBron);
  const [bezig, setBezig] = useState(false);

  const wijzigen = async (bron: Bron) => {
    setBezig(true);
    try {
      await bewaren({ projectId, bron });
      toast.success("Urenbron bijgewerkt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Wijzigen mislukt");
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
