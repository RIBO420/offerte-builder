"use client";

/**
 * Meldingen / cases — intern bord (PRD §2.4).
 *
 * Vier statuskolommen (nieuw / in behandeling / wacht op derden / opgelost),
 * filter "mijn cases" (eigenaar = ik), filter op taaksoort (meldingen /
 * plantaken van de planningsattendering §2.1) en de aanmaak-dialoog met
 * routing-defaults. Stafrollen lezen; kantoor muteert (server afgedwongen).
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useCurrentUserRole } from "@/hooks/use-users";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { MeldingenBoard } from "@/components/meldingen/meldingen-board";
import { NieuweMeldingDialog } from "@/components/meldingen/nieuwe-melding-dialog";
import { MeldingDetailModal } from "@/components/meldingen/melding-detail-modal";
import type { MeldingKaart } from "@/components/meldingen/melding-card";

export default function MeldingenPage() {
  const role = useCurrentUserRole();
  const kanMuteren =
    role === "directie" || role === "admin" || role === "projectleider";

  const [mijnCases, setMijnCases] = useState(false);
  const [taaksoort, setTaaksoort] = useState<
    "alles" | "melding" | "plantaak" | "debiteurentaak"
  >("alles");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<Id<"servicemeldingen"> | null>(null);

  const bord = useQuery(api.servicemeldingen.getBord, {
    mijnCases: mijnCases || undefined,
    taaksoort: taaksoort === "alles" ? undefined : taaksoort,
  });

  return (
    // Zelfde paginakader als de andere overzichtspagina's (zie /leads): de
    // PageHeader is de kruimelbalk en hoort bovenaan zonder marge, de inhoud
    // eronder krijgt de paginapadding. Stond hier eerder als één `space-y-6`
    // zonder padding, waardoor kop, filters en bord tegen de rand van het
    // scherm plakten.
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Meldingen</h1>
            <p className="text-sm text-muted-foreground">
              Serviceverzoeken, klachten, schades en plantaken — intern bord
            </p>
          </div>
          {kanMuteren && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4 mr-1" />
              Nieuwe melding
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="mijn-cases"
              checked={mijnCases}
              onCheckedChange={setMijnCases}
            />
            <Label htmlFor="mijn-cases">Mijn cases</Label>
          </div>
          <Select
            value={taaksoort}
            onValueChange={(v) => setTaaksoort(v as typeof taaksoort)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alles">Alles</SelectItem>
              <SelectItem value="melding">Meldingen</SelectItem>
              <SelectItem value="plantaak">Plantaken</SelectItem>
              <SelectItem value="debiteurentaak">Debiteurentaken</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {bord === undefined ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : (
          <MeldingenBoard
            bord={bord as unknown as Record<string, MeldingKaart[]> as never}
            onMeldingClick={(m) => setDetailId(m._id)}
            kanMuteren={kanMuteren}
          />
        )}

        <NieuweMeldingDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
        <MeldingDetailModal
          meldingId={detailId}
          onClose={() => setDetailId(null)}
          kanMuteren={kanMuteren}
        />
      </div>
    </>
  );
}
