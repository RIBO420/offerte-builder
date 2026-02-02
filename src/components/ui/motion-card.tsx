"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { cn } from "@/lib/utils";

// ============================================
// Motion Card Variants (CSS)
// ============================================

const motionCardVariants = cva(
  "rounded-xl border bg-card text-card-foreground transition-colors",
  {
    variants: {
      variant: {
        default: "border-border",
        elevated: "border-primary/20 shadow-lg",
        outline: "border-2",
        ghost: "border-transparent",
      },
      hover: {
        none: "",
        lift: "cursor-pointer",
        glow: "cursor-pointer",
        scale: "cursor-pointer",
        border: "cursor-pointer",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: "none",
    },
  }
);

// ============================================
// Types
// ============================================

interface MotionCardProps
  extends Omit<HTMLMotionProps<"div">, "onDrag" | "onDragStart" | "onDragEnd">,
    VariantProps<typeof motionCardVariants> {
  children: React.ReactNode;
  /** Disable all animations */
  disableAnimation?: boolean;
  /** Custom hover scale (default: 1.02 for scale variant) */
  hoverScale?: number;
  /** Custom lift amount in pixels (default: -4 for lift variant) */
  liftAmount?: number;
}

// ============================================
// Motion Card Component
// ============================================

/**
 * MotionCard - Card component with built-in hover animations
 *
 * Features:
 * - Multiple hover effects: lift, glow, scale, border
 * - GPU-accelerated animations (transform only)
 * - Respects prefers-reduced-motion
 * - Compatible with existing Card styling
 *
 * Hover variants:
 * - `lift`: Subtle Y translation with shadow
 * - `glow`: Adds subtle glow effect
 * - `scale`: Slight scale up on hover
 * - `border`: Border color change on hover
 * - `none`: No hover effect (default)
 *
 * @example
 * ```tsx
 * <MotionCard hover="lift" className="p-6">
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </MotionCard>
 * ```
 */
export const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  (
    {
      children,
      className,
      variant,
      hover,
      disableAnimation = false,
      hoverScale = 1.02,
      liftAmount = -4,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion();
    const shouldAnimate = !disableAnimation && !reducedMotion;

    // Get hover animation based on variant
    const getHoverAnimation = () => {
      if (!shouldAnimate || hover === "none") {
        return {};
      }

      switch (hover) {
        case "lift":
          return {
            y: liftAmount,
            boxShadow:
              "0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 4px 15px -5px rgba(0, 0, 0, 0.08)",
          };
        case "glow":
          return {
            boxShadow:
              "0 0 20px 2px rgba(var(--primary), 0.15), 0 4px 15px -5px rgba(0, 0, 0, 0.08)",
          };
        case "scale":
          return {
            scale: hoverScale,
          };
        case "border":
          return {
            borderColor: "rgba(var(--primary), 0.5)",
          };
        default:
          return {};
      }
    };

    // Get tap animation
    const getTapAnimation = () => {
      if (!shouldAnimate || hover === "none") {
        return {};
      }
      return { scale: 0.98 };
    };

    return (
      <motion.div
        ref={ref}
        className={cn(motionCardVariants({ variant, hover }), className)}
        whileHover={getHoverAnimation()}
        whileTap={getTapAnimation()}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

MotionCard.displayName = "MotionCard";

// ============================================
// Interactive Card (simpler API)
// ============================================

interface InteractiveCardProps {
  children: React.ReactNode;
  /** Called when card is clicked */
  onPress?: () => void;
  /** Disable interaction */
  disabled?: boolean;
  className?: string;
}

/**
 * InteractiveCard - Simple card with click animation
 *
 * A simpler alternative to MotionCard for basic clickable cards.
 * Automatically applies lift effect and tap feedback.
 *
 * @example
 * ```tsx
 * <InteractiveCard onPress={() => navigate('/details')}>
 *   <h3>Click me</h3>
 * </InteractiveCard>
 * ```
 */
export const InteractiveCard = React.forwardRef<
  HTMLDivElement,
  InteractiveCardProps
>(({ children, className, onPress, disabled = false }, ref) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground p-6 cursor-pointer",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
      whileHover={
        !reducedMotion && !disabled
          ? {
              y: -2,
              boxShadow:
                "0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -5px rgba(0, 0, 0, 0.04)",
            }
          : undefined
      }
      whileTap={!reducedMotion && !disabled ? { scale: 0.98 } : undefined}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      onClick={disabled ? undefined : onPress}
      role={onPress ? "button" : undefined}
      tabIndex={onPress && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (onPress && !disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPress();
        }
      }}
    >
      {children}
    </motion.div>
  );
});

InteractiveCard.displayName = "InteractiveCard";

// ============================================
// Stat Card with animation
// ============================================

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
}

/**
 * StatCard - Animated statistics card
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Revenue"
 *   value="$12,345"
 *   icon={<DollarSign />}
 *   trend={{ value: 12, label: "vs last month" }}
 * />
 * ```
 */
export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  onClick,
  className,
}: StatCardProps) {
  const reducedMotion = useReducedMotion();

  const CardComponent = onClick ? motion.button : motion.div;

  return (
    <CardComponent
      className={cn(
        "rounded-xl border bg-card text-card-foreground p-6 text-left w-full",
        onClick && "cursor-pointer",
        className
      )}
      whileHover={
        onClick && !reducedMotion
          ? {
              y: -2,
              boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1)",
            }
          : undefined
      }
      whileTap={onClick && !reducedMotion ? { scale: 0.98 } : undefined}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2">
        <motion.div
          className="text-2xl font-bold"
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {value}
        </motion.div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div
            className={cn(
              "text-xs mt-1 flex items-center gap-1",
              trend.value >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            <span>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
            {trend.label && (
              <span className="text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}
      </div>
    </CardComponent>
  );
}

export { motionCardVariants };
