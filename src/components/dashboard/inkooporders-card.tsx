"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";

// Memoized formatter
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function InkoopordersCard() {
  const stats = useQuery(api.inkooporders.getStats);
  const isLoading = stats === undefined;

  // Track changes for animation
  const [isUpdating, setIsUpdating] = useState(false);
  const prevValueRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (stats === undefined) return;

    if (prevValueRef.current !== undefined &&
        prevValueRef.current !== stats.perStatus.besteld) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 500);
      prevValueRef.current = stats.perStatus.besteld;
      return () => clearTimeout(timer);
    }

    prevValueRef.current = stats.perStatus.besteld;
  }, [stats]);

  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </Card>
    );
  }

  const aantalBesteld = stats.perStatus.besteld;
  const waardeBesteld = stats.bedragPerStatus.besteld;
  const hasOpenOrders = aantalBesteld > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* Real-time update flash */}
      <AnimatePresence>
        {isUpdating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none z-10"
          />
        )}
      </AnimatePresence>
      <Link href="/inkoop?status=besteld" className="group block">
        <Card
          className={`p-5 transition-all hover:shadow-md ${
            hasOpenOrders
              ? "border-blue-200 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-800"
              : "hover:border-gray-300 dark:hover:border-gray-700"
          }`}
        >
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl relative ${
                    hasOpenOrders
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <ShoppingCart
                    className={`h-6 w-6 ${
                      hasOpenOrders
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                    aria-hidden="true"
                  />
                  {/* Real-time indicator when updating */}
                  <AnimatePresence>
                    {isUpdating && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <motion.p
                    key={aantalBesteld}
                    initial={isUpdating ? { scale: 1.1, color: "rgb(59 130 246)" } : false}
                    animate={{ scale: 1, color: "inherit" }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl font-bold"
                  >
                    {aantalBesteld}
                  </motion.p>
                  <p className="text-sm text-muted-foreground">
                    Open Inkooporders
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" aria-hidden="true" />
            </div>
            {hasOpenOrders && (
              <motion.p
                key={waardeBesteld}
                initial={isUpdating ? { opacity: 0.5 } : false}
                animate={{ opacity: 1 }}
                className="mt-3 text-xs text-blue-600 dark:text-blue-400"
              >
                Totale waarde: {formatCurrency(waardeBesteld)}
              </motion.p>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
