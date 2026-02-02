"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/hooks/use-accessibility";

// ============================================
// Animation Variants
// ============================================

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  enter: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

// ============================================
// Transition Presets
// ============================================

const transitionPresets = {
  /** Fast, subtle transition - good for tab changes */
  fast: {
    duration: 0.15,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  /** Normal page transitions */
  normal: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  /** Slower, more dramatic transitions */
  slow: {
    duration: 0.3,
    ease: [0.16, 1, 0.3, 1] as const,
  },
  /** Spring-based transition */
  spring: {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
  },
} as const;

// ============================================
// Types
// ============================================

type TransitionVariant = "fade" | "slide-up" | "slide-right" | "scale";
type TransitionSpeed = "fast" | "normal" | "slow" | "spring";

interface PageTransitionProps {
  children: React.ReactNode;
  /** Animation variant */
  variant?: TransitionVariant;
  /** Transition speed */
  speed?: TransitionSpeed;
  /** Custom key for transition (defaults to pathname) */
  transitionKey?: string;
}

// ============================================
// Components
// ============================================

/**
 * PageTransition - Wrapper for page-level fade transitions
 *
 * Features:
 * - Subtle fade transition between pages
 * - Multiple animation variants
 * - Respects prefers-reduced-motion
 * - GPU-accelerated (opacity + transform)
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <PageTransition>
 *   {children}
 * </PageTransition>
 *
 * // With custom variant
 * <PageTransition variant="slide-up" speed="slow">
 *   {children}
 * </PageTransition>
 * ```
 */
export function PageTransition({
  children,
  variant = "fade",
  speed = "normal",
  transitionKey,
}: PageTransitionProps) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const key = transitionKey ?? pathname;

  // If reduced motion is preferred, render without animation
  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  // Select variant
  const getVariants = (): Variants => {
    switch (variant) {
      case "slide-up":
        return slideUpVariants;
      case "slide-right":
        return slideRightVariants;
      case "scale":
        return scaleVariants;
      default:
        return fadeVariants;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        variants={getVariants()}
        initial="hidden"
        animate="enter"
        exit="exit"
        transition={transitionPresets[speed]}
        className="will-change-[opacity,transform]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * ContentTransition - For transitioning content within a page
 *
 * Use this for tab content, modal content, or any content that
 * needs smooth transitions without affecting the page layout.
 *
 * @example
 * ```tsx
 * <Tabs value={tab} onValueChange={setTab}>
 *   <TabsList>...</TabsList>
 *   <ContentTransition transitionKey={tab}>
 *     {tab === 'overview' && <Overview />}
 *     {tab === 'details' && <Details />}
 *   </ContentTransition>
 * </Tabs>
 * ```
 */
export function ContentTransition({
  children,
  transitionKey,
  variant = "fade",
}: {
  children: React.ReactNode;
  transitionKey: string;
  variant?: TransitionVariant;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  const getVariants = (): Variants => {
    switch (variant) {
      case "slide-up":
        return slideUpVariants;
      case "slide-right":
        return slideRightVariants;
      case "scale":
        return scaleVariants;
      default:
        return fadeVariants;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        variants={getVariants()}
        initial="hidden"
        animate="enter"
        exit="exit"
        transition={{
          duration: 0.15,
          ease: [0.4, 0, 0.2, 1] as const,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * FadeIn - Simple fade in animation for any content
 *
 * @example
 * ```tsx
 * <FadeIn delay={0.2}>
 *   <Card>Content that fades in</Card>
 * </FadeIn>
 * ```
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export {
  fadeVariants,
  slideUpVariants,
  slideRightVariants,
  scaleVariants,
  transitionPresets,
};
