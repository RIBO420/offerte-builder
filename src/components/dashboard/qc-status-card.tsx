"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";

export function QCStatusCard() {
  const stats = useQuery(api.kwaliteitsControles.getDashboardStats);
  const isLoading = stats === undefined;

  // Track changes for animation
  const [isUpdating, setIsUpdating] = useState(false);
  const prevValueRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (stats === undefined) return;

    if (prevValueRef.current !== undefined &&
        prevValueRef.current !== stats.totaalOpen) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 500);
      prevValueRef.current = stats.totaalOpen;
      return () => clearTimeout(timer);
    }

    prevValueRef.current = stats.totaalOpen;
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

  const hasOpenChecks = stats.totaalOpen > 0;
  const linkHref = stats.eersteProjectMetOpenCheck
    ? `/projecten/${stats.eersteProjectMetOpenCheck}/kwaliteit`
    : "/projecten";

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
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none z-10"
          />
        )}
      </AnimatePresence>
      <Link href={linkHref} className="group block">
        <Card
          className={`p-5 transition-all hover:shadow-md ${
            hasOpenChecks
              ? "border-purple-200 dark:border-purple-900/50 hover:border-purple-300 dark:hover:border-purple-800"
              : "hover:border-gray-300 dark:hover:border-gray-700"
          }`}
        >
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl relative ${
                    hasOpenChecks
                      ? "bg-purple-100 dark:bg-purple-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <CheckSquare
                    className={`h-6 w-6 ${
                      hasOpenChecks
                        ? "text-purple-600 dark:text-purple-400"
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
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <motion.p
                      key={stats.totaalOpen}
                      initial={isUpdating ? { scale: 1.1, color: "rgb(147 51 234)" } : false}
                      animate={{ scale: 1, color: "inherit" }}
                      transition={{ duration: 0.3 }}
                      className="text-2xl font-bold"
                    >
                      {stats.totaalOpen}
                    </motion.p>
                    {hasOpenChecks && (
                      <Badge
                        variant="outline"
                        className="text-xs border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400"
                      >
                        Open
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Lopende QC Checks
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" aria-hidden="true" />
            </div>
            {hasOpenChecks && stats.projecten.length > 0 && (
              <div className="mt-3 space-y-1">
                {stats.projecten.slice(0, 2).map((project) => (
                  <p
                    key={project.projectId.toString()}
                    className="text-xs text-muted-foreground truncate"
                    title={project.projectNaam}
                  >
                    {project.projectNaam}: {project.aantalOpen} check
                    {project.aantalOpen !== 1 ? "s" : ""}
                  </p>
                ))}
                {stats.projecten.length > 2 && (
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    +{stats.projecten.length - 2} meer projecten
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
