"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

// ============================================
// Types
// ============================================

interface MotionButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof buttonVariants> {
  /** Use Radix Slot for composition (asChild pattern) */
  asChild?: boolean;
  /** Disable tap animation */
  disableTapAnimation?: boolean;
  /** Custom tap scale (default: 0.98) */
  tapScale?: number;
  /** Custom hover scale (default: 1.02) */
  hoverScale?: number;
  /** Enable hover scale animation */
  enableHoverScale?: boolean;
}

// ============================================
// Motion Button Component
// ============================================

/**
 * MotionButton - Button with built-in micro-interactions
 *
 * Features:
 * - Subtle scale animation on click (scale: 0.98)
 * - Optional hover scale animation
 * - Respects prefers-reduced-motion
 * - Compatible with shadcn/ui Button variants
 * - Supports asChild for composition
 *
 * @example
 * ```tsx
 * // Basic usage
 * <MotionButton onClick={handleClick}>
 *   Click me
 * </MotionButton>
 *
 * // With hover scale
 * <MotionButton enableHoverScale onClick={handleClick}>
 *   Hover me
 * </MotionButton>
 *
 * // As link
 * <MotionButton asChild>
 *   <Link href="/page">Go to page</Link>
 * </MotionButton>
 * ```
 */
export const MotionButton = React.forwardRef<
  HTMLButtonElement,
  MotionButtonProps
>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      disableTapAnimation = false,
      tapScale = 0.98,
      hoverScale = 1.02,
      enableHoverScale = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion();
    const shouldAnimate = !reducedMotion && !disabled;

    // When asChild is true, we use Slot to merge with child
    if (asChild) {
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={cn(buttonVariants({ variant, size, className }))}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        >
          {children as React.ReactElement}
        </Slot>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        whileHover={
          shouldAnimate && enableHoverScale
            ? { scale: hoverScale }
            : undefined
        }
        whileTap={
          shouldAnimate && !disableTapAnimation
            ? { scale: tapScale }
            : undefined
        }
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

MotionButton.displayName = "MotionButton";

// ============================================
// Primary Action Button
// ============================================

interface PrimaryActionButtonProps
  extends Omit<MotionButtonProps, "variant" | "enableHoverScale"> {
  /** Show loading state */
  loading?: boolean;
  /** Loading text (optional) */
  loadingText?: string;
}

/**
 * PrimaryActionButton - Primary button with enhanced feedback
 *
 * Use this for main CTA buttons that need extra visual feedback.
 * Includes hover scale and tap animation by default.
 *
 * @example
 * ```tsx
 * <PrimaryActionButton
 *   onClick={handleSubmit}
 *   loading={isSubmitting}
 *   loadingText="Opslaan..."
 * >
 *   Opslaan
 * </PrimaryActionButton>
 * ```
 */
export const PrimaryActionButton = React.forwardRef<
  HTMLButtonElement,
  PrimaryActionButtonProps
>(
  (
    { children, loading, loadingText, disabled, className, ...props },
    ref
  ) => {
    const reducedMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        className={cn(
          buttonVariants({ variant: "default", size: "default" }),
          "relative overflow-hidden",
          className
        )}
        disabled={disabled || loading}
        whileHover={
          !reducedMotion && !disabled && !loading
            ? { scale: 1.02 }
            : undefined
        }
        whileTap={
          !reducedMotion && !disabled && !loading
            ? { scale: 0.98 }
            : undefined
        }
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <motion.span
              className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            {loadingText || (children as React.ReactNode)}
          </span>
        ) : (
          children as React.ReactNode
        )}
      </motion.button>
    );
  }
);

PrimaryActionButton.displayName = "PrimaryActionButton";

// ============================================
// Icon Button with rotation
// ============================================

interface MotionIconButtonProps
  extends Omit<MotionButtonProps, "size" | "children"> {
  icon: React.ReactNode;
  /** Rotate icon on hover */
  rotateOnHover?: boolean;
  /** Rotation degrees (default: 90) */
  rotateDegrees?: number;
  "aria-label": string;
}

/**
 * MotionIconButton - Icon button with optional rotation animation
 *
 * @example
 * ```tsx
 * <MotionIconButton
 *   icon={<Settings />}
 *   rotateOnHover
 *   onClick={openSettings}
 *   aria-label="Open settings"
 * />
 * ```
 */
export const MotionIconButton = React.forwardRef<
  HTMLButtonElement,
  MotionIconButtonProps
>(
  (
    {
      icon,
      rotateOnHover = false,
      rotateDegrees = 90,
      className,
      disabled,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion();
    const shouldAnimate = !reducedMotion && !disabled;

    return (
      <motion.button
        ref={ref}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          className
        )}
        disabled={disabled}
        whileHover={
          shouldAnimate
            ? rotateOnHover
              ? { rotate: rotateDegrees }
              : { scale: 1.1 }
            : undefined
        }
        whileTap={shouldAnimate ? { scale: 0.9 } : undefined}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 20,
        }}
        aria-label={ariaLabel}
        {...props}
      >
        {icon}
      </motion.button>
    );
  }
);

MotionIconButton.displayName = "MotionIconButton";

// ============================================
// Floating Action Button
// ============================================

interface FABProps extends Omit<MotionButtonProps, "size" | "variant"> {
  icon: React.ReactNode;
  /** Position on screen */
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  /** Extended FAB with label */
  label?: string;
}

const positionClasses = {
  "bottom-right": "fixed bottom-6 right-6",
  "bottom-left": "fixed bottom-6 left-6",
  "bottom-center": "fixed bottom-6 left-1/2 -translate-x-1/2",
};

/**
 * FloatingActionButton - Material Design style FAB with animation
 *
 * @example
 * ```tsx
 * <FloatingActionButton
 *   icon={<Plus />}
 *   label="Nieuwe offerte"
 *   onClick={handleCreate}
 *   position="bottom-right"
 * />
 * ```
 */
export const FloatingActionButton = React.forwardRef<HTMLButtonElement, FABProps>(
  ({ icon, position = "bottom-right", label, className, ...props }, ref) => {
    const reducedMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        className={cn(
          "flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg",
          "hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          label ? "px-6 py-4" : "p-4",
          positionClasses[position],
          className
        )}
        initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={!reducedMotion ? { scale: 1.05 } : undefined}
        whileTap={!reducedMotion ? { scale: 0.95 } : undefined}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 20,
        }}
        {...props}
      >
        {icon}
        {label && <span className="font-medium">{label}</span>}
      </motion.button>
    );
  }
);

FloatingActionButton.displayName = "FloatingActionButton";
