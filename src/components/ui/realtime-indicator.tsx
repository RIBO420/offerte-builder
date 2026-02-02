"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Pulse indicator for real-time updates.
 * Shows a subtle pulse animation when data is updating.
 */
export function RealtimePulse({
  isActive,
  className,
  color = "green",
}: {
  isActive: boolean;
  className?: string;
  color?: "green" | "blue" | "orange" | "red";
}) {
  const colorClasses = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
  };

  return (
    <AnimatePresence>
      {isActive && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5",
            className
          )}
        >
          <motion.span
            animate={{
              scale: [1, 1.5, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              colorClasses[color]
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              colorClasses[color]
            )}
          />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * Badge with animated update indicator.
 * Shows a flash animation when the value changes.
 */
export function RealtimeBadge({
  value,
  isUpdating,
  className,
  variant = "default",
}: {
  value: number;
  isUpdating?: boolean;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
}) {
  if (value === 0) return null;

  const variantClasses = {
    default: "bg-primary text-primary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-input bg-background",
    secondary: "bg-secondary text-secondary-foreground",
  };

  return (
    <motion.span
      key={value}
      initial={isUpdating ? { scale: 1.2, opacity: 0.8 } : false}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        isUpdating && "ring-2 ring-offset-1 ring-offset-background ring-primary/50",
        className
      )}
    >
      {value}
    </motion.span>
  );
}

/**
 * Wrapper that adds a subtle flash animation when content updates.
 */
export function RealtimeFlash({
  children,
  isUpdating,
  className,
  color = "green",
}: {
  children: React.ReactNode;
  isUpdating: boolean;
  className?: string;
  color?: "green" | "blue" | "orange" | "amber";
}) {
  const flashColors = {
    green: "from-green-500/10 to-transparent",
    blue: "from-blue-500/10 to-transparent",
    orange: "from-orange-500/10 to-transparent",
    amber: "from-amber-500/10 to-transparent",
  };

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence>
        {isUpdating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "absolute inset-0 rounded-lg bg-gradient-to-r pointer-events-none",
              flashColors[color]
            )}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

/**
 * Animated number that smoothly transitions between values.
 */
export function AnimatedNumber({
  value,
  className,
  formatFn,
}: {
  value: number;
  className?: string;
  formatFn?: (value: number) => string;
}) {
  const displayValue = formatFn ? formatFn(value) : value.toString();

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {displayValue}
    </motion.span>
  );
}

/**
 * Status dot with optional pulse animation.
 */
export function StatusDot({
  status,
  pulse,
  size = "sm",
  className,
}: {
  status: "online" | "offline" | "updating" | "warning" | "error";
  pulse?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-400",
    updating: "bg-blue-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
  };

  const sizeClasses = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
    md: "h-3 w-3",
  };

  return (
    <span className={cn("relative flex", className)}>
      {pulse && status !== "offline" && (
        <motion.span
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            statusColors[status]
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full",
          sizeClasses[size],
          statusColors[status]
        )}
      />
    </span>
  );
}

/**
 * "Live" indicator badge.
 */
export function LiveIndicator({
  isLive = true,
  className,
}: {
  isLive?: boolean;
  className?: string;
}) {
  if (!isLive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-xs font-medium text-green-700 dark:text-green-400",
        className
      )}
    >
      <StatusDot status="online" pulse size="xs" />
      <span>Live</span>
    </motion.div>
  );
}

/**
 * Notification badge with bounce animation for new items.
 */
export function NotificationBadge({
  count,
  hasNew,
  max = 99,
  className,
}: {
  count: number;
  hasNew?: boolean;
  max?: number;
  className?: string;
}) {
  if (count === 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <motion.span
      initial={hasNew ? { scale: 0.5 } : false}
      animate={
        hasNew
          ? {
              scale: [1, 1.2, 1],
            }
          : { scale: 1 }
      }
      transition={{
        duration: 0.3,
      }}
      className={cn(
        "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white",
        hasNew && "ring-2 ring-background",
        className
      )}
    >
      {displayCount}
    </motion.span>
  );
}
