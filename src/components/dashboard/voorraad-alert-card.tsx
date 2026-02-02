"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";

export function VoorraadAlertCard() {
  const stats = useQuery(api.voorraad.getStats);
  const isLoading = stats === undefined;

  // Track changes for animation
  const [isUpdating, setIsUpdating] = useState(false);
  const prevValueRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (stats === undefined) return;

    if (prevValueRef.current !== undefined &&
        prevValueRef.current !== stats.aantalOnderMinimum) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 500);
      prevValueRef.current = stats.aantalOnderMinimum;
      return () => clearTimeout(timer);
    }

    prevValueRef.current = stats.aantalOnderMinimum;
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

  const hasAlerts = stats.aantalOnderMinimum > 0;

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
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent pointer-events-none z-10"
          />
        )}
      </AnimatePresence>
      <Link href="/voorraad" className="group block">
        <Card
          className={`p-5 transition-all hover:shadow-md ${
            hasAlerts
              ? "border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800"
              : "hover:border-orange-300 dark:hover:border-orange-800"
          }`}
        >
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl relative ${
                    hasAlerts
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-orange-100 dark:bg-orange-900/30"
                  }`}
                >
                  {hasAlerts ? (
                    <AlertTriangle
                      className={`h-6 w-6 ${
                        hasAlerts
                          ? "text-red-600 dark:text-red-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                      aria-hidden="true"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" aria-hidden="true" />
                  )}
                  {/* Real-time pulse indicator */}
                  {hasAlerts && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <motion.p
                      key={stats.aantalOnderMinimum}
                      initial={isUpdating ? { scale: 1.1, color: "rgb(239 68 68)" } : false}
                      animate={{ scale: 1, color: "inherit" }}
                      transition={{ duration: 0.3 }}
                      className="text-2xl font-bold"
                    >
                      {stats.aantalOnderMinimum}
                    </motion.p>
                    {hasAlerts && (
                      <Badge variant="destructive" className="text-xs">
                        Alert
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Voorraad Alerts
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" aria-hidden="true" />
            </div>
            {hasAlerts && (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                {stats.aantalOnderMinimum} item{stats.aantalOnderMinimum !== 1 ? "s" : ""} onder minimum voorraad
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
