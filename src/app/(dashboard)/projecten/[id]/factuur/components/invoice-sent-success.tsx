"use client";

import { motion } from "framer-motion";
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
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transitions.entrance}
      className="rounded-xl border-2 border-green-200 bg-gradient-to-b from-green-50 to-white p-8 text-center dark:border-green-900 dark:from-green-950 dark:to-background"
    >
      <motion.div
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
        initial={prefersReducedMotion ? {} : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
      >
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Send className="h-10 w-10 text-green-600 dark:text-green-400" />
        </motion.div>
      </motion.div>

      <h3 className="mb-2 text-2xl font-bold text-green-800 dark:text-green-200">
        Factuur Verzonden!
      </h3>
      <p className="mb-4 text-lg text-green-700 dark:text-green-300">
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

      <motion.p
        className="mt-6 text-sm text-muted-foreground"
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Vergeet niet de factuur als betaald te markeren wanneer de betaling is ontvangen.
      </motion.p>
    </motion.div>
  );
}
