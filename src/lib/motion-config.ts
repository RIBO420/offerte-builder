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
// List Stagger Animation Utilities
// ============================================

/**
 * Creates a stagger container with customizable timing
 * Use for list pages with multiple items
 */
export function createStaggerContainer(options?: {
  staggerChildren?: number;
  delayChildren?: number;
}): Variants {
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: options?.staggerChildren ?? 0.05,
        delayChildren: options?.delayChildren ?? 0.1,
      },
    },
  };
}

/**
 * Creates a stagger item with customizable animation
 * Use as children of stagger container
 */
export function createStaggerItem(options?: {
  y?: number;
  x?: number;
  scale?: number;
  duration?: number;
}): Variants {
  const initial: Record<string, number> = { opacity: 0 };
  const animate: Record<string, number> = { opacity: 1 };

  if (options?.y !== undefined) {
    initial.y = options.y;
    animate.y = 0;
  } else {
    initial.y = 10;
    animate.y = 0;
  }

  if (options?.x !== undefined) {
    initial.x = options.x;
    animate.x = 0;
  }

  if (options?.scale !== undefined) {
    initial.scale = options.scale;
    animate.scale = 1;
  }

  return {
    hidden: initial,
    show: {
      ...animate,
      transition: {
        duration: options?.duration ?? 0.3,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };
}

/**
 * Pre-configured list animation variants for common use cases
 */
export const listAnimations = {
  // Standard list with fade up
  fadeUp: {
    container: createStaggerContainer(),
    item: createStaggerItem({ y: 20 }),
  },
  // Card grid with scale
  cardGrid: {
    container: createStaggerContainer({ staggerChildren: 0.08 }),
    item: createStaggerItem({ y: 20, scale: 0.95 }),
  },
  // Sidebar/menu items
  menu: {
    container: createStaggerContainer({ staggerChildren: 0.03, delayChildren: 0.05 }),
    item: createStaggerItem({ x: -10, y: 0 }),
  },
  // Table rows
  tableRows: {
    container: createStaggerContainer({ staggerChildren: 0.02, delayChildren: 0 }),
    item: createStaggerItem({ y: 5, duration: 0.2 }),
  },
} as const;

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

// ============================================
// Toast/Notification Animations
// ============================================

/**
 * Toast slide-in animation (from right)
 */
export const toastSlideIn: Variants = {
  initial: {
    opacity: 0,
    x: 100,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

/**
 * Toast slide-in animation (from bottom)
 */
export const toastSlideUp: Variants = {
  initial: {
    opacity: 0,
    y: 50,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// ============================================
// Card Hover Animations
// ============================================

/**
 * Card lift animation preset
 * Apply to motion.div with whileHover and whileTap
 */
export const cardHoverLift = {
  rest: {
    y: 0,
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  },
  hover: {
    y: -4,
    boxShadow: "0 10px 40px -10px rgb(0 0 0 / 0.15), 0 4px 15px -5px rgb(0 0 0 / 0.08)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    y: 0,
    scale: 0.98,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 30,
    },
  },
};

/**
 * Card glow animation preset
 */
export const cardHoverGlow = {
  rest: {
    boxShadow: "0 0 0 0 rgba(var(--primary), 0)",
  },
  hover: {
    boxShadow: "0 0 20px 2px rgba(var(--primary), 0.15)",
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// Button Click Feedback
// ============================================

/**
 * Standard button tap animation
 * Use with whileTap on motion.button
 */
export const buttonTapFeedback = {
  scale: 0.98,
  transition: {
    type: "spring",
    stiffness: 500,
    damping: 30,
  },
};

/**
 * Primary button animation (with hover)
 */
export const primaryButtonAnimation = {
  rest: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 30,
    },
  },
};

// ============================================
// Loading States
// ============================================

/**
 * Skeleton shimmer animation (CSS keyframes alternative)
 * Use when CSS animation is preferred over Framer Motion
 */
export const shimmerAnimation = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "linear",
  },
};

/**
 * Pulse animation for loading indicators
 */
export const pulseAnimation: Variants = {
  initial: { opacity: 0.5, scale: 0.98 },
  animate: {
    opacity: [0.5, 1, 0.5],
    scale: [0.98, 1, 0.98],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ============================================
// Modal/Dialog Animations
// ============================================

/**
 * Modal backdrop animation
 */
export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/**
 * Modal content animation
 */
export const modalContent: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.15,
    },
  },
};
