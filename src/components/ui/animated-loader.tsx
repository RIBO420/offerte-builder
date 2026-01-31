"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

// ============================================
// PageLoader - Full-page centered loader
// ============================================

interface PageLoaderProps {
  text?: string;
  className?: string;
}

export function PageLoader({ text, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center bg-background",
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative"
      >
        {/* Pulsing glow effect */}
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 blur-xl"
          animate={{
            opacity: [0.4, 0.7, 0.4],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Icon container */}
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30"
          animate={{
            y: [0, -4, 0],
          }}
          transition={{
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
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
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <motion.div
        className={cn(
          "rounded-full border-emerald-200 border-t-emerald-500",
          spinnerSizes[size]
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
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
  const defaultFallback = (
    <div className="space-y-4">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {fallback || defaultFallback}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
