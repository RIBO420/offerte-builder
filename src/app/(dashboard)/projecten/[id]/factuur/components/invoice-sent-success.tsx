"use client";

import { m } from "framer-motion";
import { Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";

export function InvoiceSentSuccess({
  factuurNummer,
  klantEmail,
  onContinue,
}: {
  factuurNummer: string;
  klantEmail?: string;
  onContinue: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <m.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transitions.entrance}
      className="rounded-xl border-2 border-status-geaccepteerd-border bg-gradient-to-b from-status-geaccepteerd/40 to-background p-8 text-center dark:to-background"
    >
      <m.div
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-status-geaccepteerd"
        initial={prefersReducedMotion ? {} : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <m.div
          initial={prefersReducedMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Send className="h-10 w-10 text-status-geaccepteerd-text" />
        </m.div>
      </m.div>

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

      <m.p
        className="mt-6 text-sm text-muted-foreground"
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Vergeet niet de factuur als betaald te markeren wanneer de betaling is ontvangen.
      </m.p>
    </m.div>
  );
}
