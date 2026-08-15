"use client";

import { m } from "framer-motion";
import { PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { cn } from "@/lib/utils";
import { formatCurrency } from "./types";

// Pre-computed sparkle positions for celebration animation
const sparklePositions = [
  { x: 5, y: -3, left: 15, top: 20 },
  { x: -7, y: 8, left: 30, top: 45 },
  { x: 3, y: -5, left: 45, top: 70 },
  { x: -4, y: 6, left: 60, top: 20 },
  { x: 8, y: -2, left: 75, top: 45 },
  { x: -6, y: 4, left: 90, top: 70 },
];

export function ProjectCompletedCelebration({
  projectNaam,
  bedrag,
  onDismiss,
}: {
  projectNaam: string;
  bedrag: number;
  onDismiss: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    /* Het feest blijft (de sparkles en de zwaaiende popper hieronder), maar de
       tekst, het bedrag en de knop hangen niet meer aan een animatieframe: de
       kaart komt binnen met de CSS-reveal (`fill-mode: none`), dus zonder ook
       maar één frame staat alles er gewoon — inclusief "Bekijk Details".
       → src/components/pagina-reveal.tsx */
    <div
      className={cn(
        REVEAL_KLASSE,
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-chart-5 p-8 text-primary-foreground shadow-2xl"
      )}
    >
      {/* Animated background sparkles */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden">
          {sparklePositions.map((pos, i) => (
            <m.div
              key={i}
              className="absolute"
              // blanco-beginstaat-ok: losse versiersels in een oneindige lus,
              // absoluut gepositioneerd achter de kaart. Ze dragen geen tekst
              // en geen bediening, dus staat requestAnimationFrame stil, dan
              // verdwijnt alleen de glitter — niet de inhoud.
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1.2, 0.5],
                x: [0, pos.x],
                y: [0, pos.y],
              }}
              transition={{
                duration: 2,
                delay: i * 0.3,
                repeat: Infinity,
                repeatDelay: 1,
              }}
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
              }}
            >
              <Sparkles className="h-6 w-6 text-white/40" />
            </m.div>
          ))}
        </div>
      )}

      <div className="relative z-10">
        {/* Icon */}
        <m.div
          className="mb-6 flex justify-center"
          animate={prefersReducedMotion ? {} : { rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <PartyPopper className="h-10 w-10" />
          </div>
        </m.div>

        {/* Title */}
        <h2 className="mb-2 text-center text-2xl font-bold md:text-3xl">
          Project Voltooid!
        </h2>

        {/* Project name */}
        <p className="mb-4 text-center text-lg text-white/90">
          {projectNaam}
        </p>

        {/* Amount */}
        <div className="mb-6 text-center">
          <div className="inline-block rounded-xl bg-white/20 px-6 py-3 backdrop-blur-sm">
            <p className="text-sm text-white/80">Totaal ontvangen</p>
            <p className="text-3xl font-bold">{formatCurrency(bedrag)}</p>
          </div>
        </div>

        {/* Message */}
        <p className="mb-6 text-center text-white/80">
          Gefeliciteerd! De factuur is betaald en het project is succesvol afgerond.
        </p>

        {/* Dismiss button */}
        <div className="flex justify-center">
          <Button
            onClick={onDismiss}
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            Bekijk Details
          </Button>
        </div>
      </div>
    </div>
  );
}
