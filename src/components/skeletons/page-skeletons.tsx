"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

// Page Loading Skeleton - Generic full-page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <m.div
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
      <m.div className="flex items-center gap-4" variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </m.div>
        <div className="space-y-2">
          <m.div {...shimmer}>
            <Skeleton className="h-7 w-48" />
          </m.div>
          <m.div {...shimmer}>
            <Skeleton className="h-4 w-32" />
          </m.div>
        </div>
      </m.div>

      {/* Content cards */}
      <m.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        variants={staggerContainer}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <m.div key={i} variants={fadeInUp}>
            <Card>
              <CardHeader className="pb-2">
                <m.div {...shimmer}>
                  <Skeleton className="h-5 w-24" />
                </m.div>
              </CardHeader>
              <CardContent>
                <m.div {...shimmer}>
                  <Skeleton className="h-8 w-20 mb-1" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </m.div>
              </CardContent>
            </Card>
          </m.div>
        ))}
      </m.div>

      {/* Main content area */}
      <m.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <m.div {...shimmer}>
              <Skeleton className="h-6 w-40" />
            </m.div>
            <m.div {...shimmer}>
              <Skeleton className="h-4 w-64" />
            </m.div>
          </CardHeader>
          <CardContent>
            <m.div {...shimmer}>
              <Skeleton className="h-[250px] w-full" />
            </m.div>
          </CardContent>
        </Card>
      </m.div>
    </m.div>
  );
}

// Analytics/Rapportages Skeleton
export function AnalyticsSkeleton() {
  return (
    <m.div
      role="status"
      aria-busy="true"
      aria-label="Rapportages laden"
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* KPI Cards */}
      <m.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <m.div key={i} variants={fadeInUp}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-24" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-4 rounded" />
                </m.div>
              </CardHeader>
              <CardContent>
                <m.div {...shimmer}>
                  <Skeleton className="h-8 w-20 mb-1" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </m.div>
              </CardContent>
            </Card>
          </m.div>
        ))}
      </m.div>

      {/* Tabs Skeleton */}
      <m.div className="space-y-4" variants={fadeInUp}>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <m.div key={i} {...shimmer}>
              <Skeleton className="h-9 w-24 rounded-md" />
            </m.div>
          ))}
        </div>

        {/* Chart Skeleton */}
        <m.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <m.div {...shimmer}>
                <Skeleton className="h-6 w-40" />
              </m.div>
              <m.div {...shimmer}>
                <Skeleton className="h-4 w-64" />
              </m.div>
            </CardHeader>
            <CardContent>
              <m.div {...shimmer}>
                <Skeleton className="h-[300px] w-full" />
              </m.div>
            </CardContent>
          </Card>
        </m.div>

        {/* Two Column Charts */}
        <m.div
          className="grid gap-4 lg:grid-cols-2"
          variants={staggerContainer}
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <m.div key={i} variants={fadeInUp}>
              <Card>
                <CardHeader>
                  <m.div {...shimmer}>
                    <Skeleton className="h-6 w-32" />
                  </m.div>
                  <m.div {...shimmer}>
                    <Skeleton className="h-4 w-48" />
                  </m.div>
                </CardHeader>
                <CardContent>
                  <m.div {...shimmer}>
                    <Skeleton className="h-[300px] w-full" />
                  </m.div>
                </CardContent>
              </Card>
            </m.div>
          ))}
        </m.div>
      </m.div>
    </m.div>
  );
}
