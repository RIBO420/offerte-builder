"use client";

import { m } from "framer-motion";
import { PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";
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
    <m.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={transitions.entrance}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-8 text-white shadow-2xl"
    >
      {/* Animated background sparkles */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden">
          {sparklePositions.map((pos, i) => (
            <m.div
              key={i}
              className="absolute"
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
        <m.h2
          className="mb-2 text-center text-2xl font-bold md:text-3xl"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Project Voltooid!
        </m.h2>

        {/* Project name */}
        <m.p
          className="mb-4 text-center text-lg text-white/90"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {projectNaam}
        </m.p>

        {/* Amount */}
        <m.div
          className="mb-6 text-center"
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        >
          <div className="inline-block rounded-xl bg-white/20 px-6 py-3 backdrop-blur-sm">
            <p className="text-sm text-white/80">Totaal ontvangen</p>
            <p className="text-3xl font-bold">{formatCurrency(bedrag)}</p>
          </div>
        </m.div>

        {/* Message */}
        <m.p
          className="mb-6 text-center text-white/80"
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Gefeliciteerd! De factuur is betaald en het project is succesvol afgerond.
        </m.p>

        {/* Dismiss button */}
        <m.div
          className="flex justify-center"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={onDismiss}
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            Bekijk Details
          </Button>
        </m.div>
      </div>
    </m.div>
  );
}
