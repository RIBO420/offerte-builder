"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

// Page Loading Skeleton - Generic full-page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Pagina laden"
      className="flex flex-1 flex-col gap-6 p-4 md:p-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <span className="sr-only">Pagina wordt geladen...</span>

      {/* Header with back button and title */}
      <motion.div className="flex items-center gap-4" variants={fadeInUp}>
        <motion.div {...shimmer}>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </motion.div>
        <div className="space-y-2">
          <motion.div {...shimmer}>
            <Skeleton className="h-7 w-48" />
          </motion.div>
          <motion.div {...shimmer}>
            <Skeleton className="h-4 w-32" />
          </motion.div>
        </div>
      </motion.div>

      {/* Content cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        variants={staggerContainer}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <Card>
              <CardHeader className="pb-2">
                <motion.div {...shimmer}>
                  <Skeleton className="h-5 w-24" />
                </motion.div>
              </CardHeader>
              <CardContent>
                <motion.div {...shimmer}>
                  <Skeleton className="h-8 w-20 mb-1" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Main content area */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <motion.div {...shimmer}>
              <Skeleton className="h-6 w-40" />
            </motion.div>
            <motion.div {...shimmer}>
              <Skeleton className="h-4 w-64" />
            </motion.div>
          </CardHeader>
          <CardContent>
            <motion.div {...shimmer}>
              <Skeleton className="h-[250px] w-full" />
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Analytics/Rapportages Skeleton
export function AnalyticsSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Rapportages laden"
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <motion.div {...shimmer}>
                  <Skeleton className="h-4 w-24" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-4 w-4 rounded" />
                </motion.div>
              </CardHeader>
              <CardContent>
                <motion.div {...shimmer}>
                  <Skeleton className="h-8 w-20 mb-1" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs Skeleton */}
      <motion.div className="space-y-4" variants={fadeInUp}>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div key={i} {...shimmer}>
              <Skeleton className="h-9 w-24 rounded-md" />
            </motion.div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <motion.div {...shimmer}>
                <Skeleton className="h-6 w-40" />
              </motion.div>
              <motion.div {...shimmer}>
                <Skeleton className="h-4 w-64" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div {...shimmer}>
                <Skeleton className="h-[300px] w-full" />
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Two Column Charts */}
        <motion.div
          className="grid gap-4 lg:grid-cols-2"
          variants={staggerContainer}
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <Card>
                <CardHeader>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-6 w-32" />
                  </motion.div>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-4 w-48" />
                  </motion.div>
                </CardHeader>
                <CardContent>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-[300px] w-full" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
