"use client";

import { useRouter } from "next/navigation";
import { TaakKaart } from "@/components/taken/taak-kaart";
import { ReactiesBlok } from "@/components/taken/reacties-blok";
import type { ToewijsbaarPersoon, VerrijkteTaak } from "@/components/taken/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Het zijpaneel bij een kaartje (inventaris §B5).
 *
 * Bewust dezelfde `TaakKaart` als in het klantdossier, in de variant zonder
 * eigen open/dicht-knop: hier ís de kaart het paneel. Zo staat er nooit een
 * tweede, half werkende bewerkweergave naast — wat je in het dossier kunt,
 * kun je hier ook, en wat we daar veranderen verandert hier mee.
 *
 * Eronder de reacties: overleg over een taak hoort bij die taak, niet in
 * WhatsApp. Escape en een klik op de overlay sluiten het paneel (Radix).
 */
export function TaakDrawer({
  taak,
  personen,
  onSluit,
}: {
  taak: VerrijkteTaak | null;
  personen: ToewijsbaarPersoon[];
  onSluit: () => void;
}) {
  const router = useRouter();

  return (
    <Sheet open={taak !== null} onOpenChange={(open) => !open && onSluit()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        {taak && (
          <>
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">Taak</SheetTitle>
              <SheetDescription className="sr-only">
                Details, toewijzing en reacties bij deze taak.
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-4 px-4 pb-6">
              <TaakKaart
                taak={taak}
                personen={personen}
                variant="drawer"
                onOpenKlant={(klantId) => {
                  onSluit();
                  router.push(`/klanten/${klantId}?tab=taken`);
                }}
                className="rounded-lg border bg-card"
              />
              <ReactiesBlok taakId={taak._id} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
