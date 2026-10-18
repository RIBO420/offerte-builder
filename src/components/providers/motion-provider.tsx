"use client";

import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * Motion Provider
 *
 * Provides optimized Framer Motion configuration:
 * 1. Uses LazyMotion with domAnimation for smaller bundle size
 * 2. Respects prefers-reduced-motion preference
 * 3. Sets global transition defaults for consistency
 */
export function MotionProvider({ children }: MotionProviderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion={prefersReducedMotion ? "always" : "never"}
        transition={{
          // Bewegingsstandaard (okt 2026): kritisch gedempte veer van 300ms,
          // zonder doorschieten — sluit aan op de 300ms-entree in CSS.
          type: "spring",
          duration: 0.3,
          bounce: 0,
        }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
