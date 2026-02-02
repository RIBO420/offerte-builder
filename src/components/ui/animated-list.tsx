"use client";

import * as React from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { cn } from "@/lib/utils";

// ============================================
// Animation Variants
// ============================================

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
    },
  },
};

const slideItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
    },
  },
};

const scaleItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// Types
// ============================================

type AnimationType = "fade-up" | "slide" | "scale";

interface AnimatedListProps<T> {
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  animation?: AnimationType;
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
  initialDelay?: number;
  emptyState?: React.ReactNode;
  /** Use custom container element (default: ul) */
  as?: "ul" | "ol" | "div";
  /** Use custom item element (default: li for ul/ol, div otherwise) */
  itemAs?: "li" | "div";
}

interface AnimatedListItemProps {
  children: React.ReactNode;
  className?: string;
  animation?: AnimationType;
  as?: "li" | "div";
}

// ============================================
// Components
// ============================================

/**
 * AnimatedListItem - Individual item with entrance animation
 * Can be used standalone or within AnimatedList
 */
export function AnimatedListItem({
  children,
  className,
  animation = "fade-up",
  as: Component = "li",
}: AnimatedListItemProps) {
  const reducedMotion = useReducedMotion();

  const getVariants = () => {
    if (reducedMotion) {
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      };
    }

    switch (animation) {
      case "slide":
        return slideItemVariants;
      case "scale":
        return scaleItemVariants;
      default:
        return itemVariants;
    }
  };

  return (
    <motion.li
      variants={getVariants()}
      className={cn("list-none", className)}
      // @ts-expect-error - motion.li accepts any valid HTML attribute
      as={Component}
    >
      {children}
    </motion.li>
  );
}

/**
 * AnimatedList - A list container with staggered entrance animations
 *
 * Features:
 * - Staggered entrance animations for list items
 * - Multiple animation styles: fade-up, slide, scale
 * - Respects prefers-reduced-motion
 * - GPU-accelerated animations (transform + opacity)
 * - AnimatePresence for exit animations
 *
 * @example
 * ```tsx
 * <AnimatedList
 *   items={offertes}
 *   keyExtractor={(offerte) => offerte._id}
 *   renderItem={(offerte) => <OfferteCard offerte={offerte} />}
 *   animation="fade-up"
 * />
 * ```
 */
export function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  animation = "fade-up",
  className,
  itemClassName,
  staggerDelay = 0.05,
  initialDelay = 0.1,
  emptyState,
  as: Container = "ul",
  itemAs,
}: AnimatedListProps<T>) {
  const reducedMotion = useReducedMotion();

  const getItemVariants = (): Variants => {
    if (reducedMotion) {
      return {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      };
    }

    switch (animation) {
      case "slide":
        return slideItemVariants;
      case "scale":
        return scaleItemVariants;
      default:
        return itemVariants;
    }
  };

  const customContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: reducedMotion
        ? { duration: 0.1 }
        : {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
    },
    exit: {
      opacity: 0,
      transition: reducedMotion
        ? { duration: 0.1 }
        : {
            staggerChildren: 0.03,
            staggerDirection: -1,
          },
    },
  };

  // Determine item element type
  const ItemElement = itemAs || (Container === "div" ? "div" : "li");
  const MotionItem = motion[ItemElement as "li" | "div"];

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const MotionContainer = motion[Container];

  return (
    <MotionContainer
      variants={customContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn("list-none p-0 m-0", className)}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <MotionItem
            key={keyExtractor(item, index)}
            variants={getItemVariants()}
            layout
            className={cn("list-none", itemClassName)}
          >
            {renderItem(item, index)}
          </MotionItem>
        ))}
      </AnimatePresence>
    </MotionContainer>
  );
}

// ============================================
// Table Row Animation
// ============================================

interface AnimatedTableRowProps {
  children: React.ReactNode;
  index?: number;
  className?: string;
}

/**
 * AnimatedTableRow - Table row with subtle entrance animation
 *
 * @example
 * ```tsx
 * <TableBody>
 *   {items.map((item, index) => (
 *     <AnimatedTableRow key={item.id} index={index}>
 *       <TableCell>...</TableCell>
 *     </AnimatedTableRow>
 *   ))}
 * </TableBody>
 * ```
 */
export function AnimatedTableRow({
  children,
  index = 0,
  className,
}: AnimatedTableRowProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.tr
      initial={reducedMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.3,
        delay: reducedMotion ? 0 : index * 0.03,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.tr>
  );
}

// ============================================
// Grid Animation
// ============================================

interface AnimatedGridProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

/**
 * AnimatedGrid - Grid container with staggered children animations
 * Wraps children and applies stagger animation
 */
export function AnimatedGrid({
  children,
  className,
  staggerDelay = 0.08,
}: AnimatedGridProps) {
  const reducedMotion = useReducedMotion();

  const gridContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: reducedMotion
        ? { duration: 0.1 }
        : {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          },
    },
  };

  const gridItemVariants: Variants = reducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
          },
        },
      };

  return (
    <motion.div
      variants={gridContainerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {React.Children.map(children, (child) =>
        child ? (
          <motion.div variants={gridItemVariants}>{child}</motion.div>
        ) : null
      )}
    </motion.div>
  );
}

export { containerVariants, itemVariants, slideItemVariants, scaleItemVariants };
