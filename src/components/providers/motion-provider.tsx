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
          // Default spring physics for natural feel
          type: "spring",
          stiffness: 300,
          damping: 30,
          mass: 1,
        }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
