"use client";

import { Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * De bevestiging na het verzenden. Was framer-motion met een veer en twee
 * delays; dat betekende dat de hele kaart (én het bolletje met het icoon) op
 * `opacity: 0` respectievelijk `scale: 0` bleef staan zodra
 * `requestAnimationFrame` werd afgeknepen — je las dan "niets" na de meest
 * geruststellende actie van de hele flow. Nu CSS: `animate-in` draait met
 * `fill-mode: none`, dus buiten de animatie geldt gewoon de eindstaat, en
 * `motion-safe:` doet het respect voor `prefers-reduced-motion`.
 */
export function InvoiceSentSuccess({
  factuurNummer,
  klantEmail,
  onContinue,
}: {
  factuurNummer: string;
  klantEmail?: string;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-status-geaccepteerd-border bg-gradient-to-b from-status-geaccepteerd/40 to-background p-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 motion-safe:ease-out dark:to-background">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-status-geaccepteerd motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500 motion-safe:ease-out">
        <Send className="h-10 w-10 text-status-geaccepteerd-text" />
      </div>

      <h3 className="mb-2 text-2xl font-bold text-status-geaccepteerd-text">
        Factuur Verzonden!
      </h3>
      <p className="mb-4 text-lg text-status-geaccepteerd-text">
        Factuur {factuurNummer} is succesvol verstuurd
      </p>
      {klantEmail && (
        <p className="mb-6 text-muted-foreground">
          De klant ontvangt de factuur op {klantEmail}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" className="gap-2" onClick={onContinue}>
          <Eye className="h-4 w-4" />
          Bekijk Factuur
        </Button>
      </div>

      <p className="mt-6 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        Vergeet niet de factuur als betaald te markeren wanneer de betaling is ontvangen.
      </p>
    </div>
  );
}
