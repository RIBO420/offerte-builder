"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";

// ============================================
// PageLoader - Full-page centered loader
// ============================================

interface PageLoaderProps {
  text?: string;
  className?: string;
}

export function PageLoader({ text, className }: PageLoaderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center bg-background",
        className
      )}
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : transitions.entrance}
        className="relative"
      >
        {/* Pulsing glow effect - disabled for reduced motion */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-primary/80"
            style={{ filter: "blur(16px)" }}
            animate={{
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Icon container */}
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-optimized-lg"
          animate={prefersReducedMotion ? undefined : {
            y: [0, -4, 0],
          }}
          transition={prefersReducedMotion ? { duration: 0 } : {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Trees className="h-10 w-10 text-white" />
        </motion.div>
      </motion.div>

      {text && (
        <motion.p
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : {
            duration: 0.5,
            delay: 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-6 text-sm text-muted-foreground"
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

// ============================================
// SpinnerLoader - Inline spinner
// ============================================

const spinnerSizes = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-3",
} as const;

const textSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

interface SpinnerLoaderProps {
  size?: keyof typeof spinnerSizes;
  text?: string;
  className?: string;
}

export function SpinnerLoader({
  size = "md",
  text,
  className,
}: SpinnerLoaderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <motion.div
        className={cn(
          "rounded-full border-primary/20 border-t-primary will-change-transform",
          spinnerSizes[size]
        )}
        animate={prefersReducedMotion ? undefined : { rotate: 360 }}
        transition={prefersReducedMotion ? { duration: 0 } : {
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
        style={prefersReducedMotion ? { opacity: 0.7 } : undefined}
      />
      {text && (
        <span className={cn("text-muted-foreground", textSizes[size])}>
          {text}
        </span>
      )}
    </div>
  );
}

// ============================================
// ContentLoader - Container with loading state
// ============================================

interface ContentLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function ContentLoader({
  isLoading,
  children,
  fallback,
  className,
}: ContentLoaderProps) {
  const prefersReducedMotion = useReducedMotion();

  const defaultFallback = (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );

  // For reduced motion, use instant transitions
  if (prefersReducedMotion) {
    return (
      <div className={cn("relative", className)}>
        {isLoading ? (fallback || defaultFallback) : children}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.fade}
          >
            {fallback || defaultFallback}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.fade}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
