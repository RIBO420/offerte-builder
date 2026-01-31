/**
 * Framer Motion Configuration & Utilities
 *
 * Centralized configuration for performance-optimized animations.
 * All animations should use GPU-accelerated properties (transform, opacity)
 * and respect prefers-reduced-motion.
 */

import { type Transition, type Variants } from "framer-motion";

// ============================================
// Reduced Motion Helper
// ============================================

/**
 * Get reduced motion safe animation values
 * Returns static values when user prefers reduced motion
 */
export function getReducedMotionProps<T extends Record<string, unknown>>(
  fullMotion: T,
  reducedMotion: Partial<T>
): T {
  // This is used at render time with the useReducedMotion hook
  return { ...fullMotion, ...reducedMotion } as T;
}

// ============================================
// Performance-Optimized Transitions
// ============================================

/**
 * Standard transitions optimized for performance
 * Uses spring physics for natural feel
 */
export const transitions = {
  // Fast micro-interactions (buttons, toggles)
  fast: {
    type: "spring",
    stiffness: 500,
    damping: 30,
    mass: 1,
  } as Transition,

  // Normal UI animations (cards, modals)
  normal: {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 1,
  } as Transition,

  // Smooth easing for opacity/fade
  fade: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  // Expo ease out for dramatic entrances
  entrance: {
    duration: 0.5,
    ease: [0.16, 1, 0.3, 1],
  } as Transition,

  // Stagger children configuration
  stagger: {
    staggerChildren: 0.05,
    delayChildren: 0.1,
  } as Transition,
} as const;

// ============================================
// GPU-Accelerated Animation Variants
// ============================================

/**
 * Fade in animation - opacity only (GPU accelerated)
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Fade in with Y translation (GPU accelerated)
 * Preferred over animating top/margin
 */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

/**
 * Fade in from left (GPU accelerated)
 */
export const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

/**
 * Fade in from right (GPU accelerated)
 */
export const fadeInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 10 },
};

/**
 * Scale animation (GPU accelerated)
 * ALWAYS use scale instead of width/height animations
 */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/**
 * Pop animation with spring (GPU accelerated)
 */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.fast,
  },
  exit: { opacity: 0, scale: 0.8 },
};

/**
 * Stagger container - wraps children that should animate in sequence
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

/**
 * Stagger children variant - use with staggerContainer
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ============================================
// Reduced Motion Variants
// ============================================

/**
 * Reduced motion versions - opacity only, no transforms
 * Use these when prefers-reduced-motion is true
 */
export const reducedMotionVariants = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,

  // Instant transition for reduced motion
  instant: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  } as Variants,
};

// ============================================
// Hover/Tap Animations (GPU-accelerated)
// ============================================

/**
 * Subtle lift effect on hover
 * Uses translateY (GPU) not margin/top
 */
export const hoverLift = {
  whileHover: { y: -4 },
  whileTap: { y: 0 },
  transition: transitions.fast,
};

/**
 * Scale on hover/tap (GPU accelerated)
 */
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: transitions.fast,
};

/**
 * Subtle scale for buttons (GPU accelerated)
 */
export const buttonTap = {
  whileTap: { scale: 0.98 },
  transition: transitions.fast,
};

// ============================================
// Collapsible/Accordion Optimization
// ============================================

/**
 * Optimized expand/collapse animation
 *
 * IMPORTANT: Animating height causes layout thrashing.
 * Preferred approach: Use CSS grid with grid-template-rows: 0fr -> 1fr
 * or use clipPath for GPU-accelerated collapse.
 *
 * This variant uses opacity + scale for better performance.
 * Wrap content in overflow-hidden container.
 */
export const expandCollapse: Variants = {
  initial: {
    opacity: 0,
    scaleY: 0,
    originY: 0,
  },
  animate: {
    opacity: 1,
    scaleY: 1,
    transition: {
      opacity: { duration: 0.2 },
      scaleY: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
  },
  exit: {
    opacity: 0,
    scaleY: 0,
    transition: {
      opacity: { duration: 0.15 },
      scaleY: { duration: 0.2 },
    },
  },
};

/**
 * CSS-based collapse using grid (most performant)
 * Use with Tailwind: grid grid-rows-[0fr] -> grid-rows-[1fr]
 */
export const gridCollapseClass = {
  closed: "grid-rows-[0fr]",
  open: "grid-rows-[1fr]",
};

// ============================================
// Performance Hints
// ============================================

/**
 * CSS will-change values for animated elements
 * Apply these as className only during animation
 */
export const willChangeClasses = {
  transform: "will-change-transform",
  opacity: "will-change-opacity",
  transformOpacity: "will-change-[transform,opacity]",
};

/**
 * Layout containment hints for complex animated components
 * Improves painting performance
 */
export const containmentClasses = {
  layout: "contain-layout",
  style: "contain-style",
  paint: "contain-paint",
  strict: "contain-strict",
};
