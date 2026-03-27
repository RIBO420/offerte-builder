"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton() {
  return (
    <m.div
      role="status"
      aria-busy="true"
      aria-label="Dashboard statistieken laden"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
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
  );
}

// Dashboard Card Skeleton
export function DashboardCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <m.div {...shimmer}>
          <Skeleton className="h-5 w-32" />
        </m.div>
        <m.div {...shimmer}>
          <Skeleton className="h-4 w-48" />
        </m.div>
      </CardHeader>
      <CardContent>
        <m.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <m.div key={i} className="flex items-center gap-3" variants={fadeInUp}>
              <m.div {...shimmer}>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </m.div>
              <div className="flex-1 space-y-1">
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-24" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </m.div>
              </div>
              <m.div {...shimmer}>
                <Skeleton className="h-5 w-16" />
              </m.div>
            </m.div>
          ))}
        </m.div>
      </CardContent>
    </Card>
  );
}

// Recent Offertes List Skeleton
export function RecentOffertesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <m.div
      className="space-y-3"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {Array.from({ length: count }).map((_, i) => (
        <m.div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border"
          variants={fadeInUp}
        >
          <m.div {...shimmer}>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </m.div>
          <div className="flex-1 space-y-1">
            <m.div {...shimmer}>
              <Skeleton className="h-4 w-20" />
            </m.div>
            <m.div {...shimmer}>
              <Skeleton className="h-3 w-32" />
            </m.div>
          </div>
          <m.div {...shimmer}>
            <Skeleton className="h-5 w-16 rounded-full" />
          </m.div>
          <m.div {...shimmer}>
            <Skeleton className="h-4 w-20" />
          </m.div>
        </m.div>
      ))}
    </m.div>
  );
}

// Dashboard Page Skeleton
export function DashboardSkeleton() {
  return (
    <m.div
      role="status"
      aria-busy="true"
      aria-label="Dashboard laden"
      className="flex flex-1 flex-col gap-6 p-6 md:gap-8 md:p-8"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <span className="sr-only">Dashboard wordt geladen...</span>

      {/* Welcome Header Skeleton */}
      <m.div variants={fadeInUp}>
        <Card className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/20 dark:to-teal-950/30">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <m.div {...shimmer}>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-8 w-48" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-64" />
                </m.div>
              </div>
              <div className="flex gap-2">
                <m.div {...shimmer}>
                  <Skeleton className="h-9 w-32" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-9 w-36" />
                </m.div>
              </div>
            </div>
          </CardContent>
        </Card>
      </m.div>

      {/* Stats Skeleton */}
      <m.section variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-6 w-24 rounded-full mb-4" />
        </m.div>
        <DashboardStatsSkeleton />
      </m.section>

      {/* Pipeline Skeleton */}
      <m.section variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-6 w-32 rounded-full mb-4" />
        </m.div>
        <Card className="p-4">
          <div className="flex justify-between gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <m.div key={i} className="flex-1" {...shimmer}>
                <Skeleton className="h-16 w-full rounded-lg" />
              </m.div>
            ))}
          </div>
        </Card>
      </m.section>

      {/* Quick Actions Skeleton */}
      <m.section variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-6 w-28 rounded-full mb-4" />
        </m.div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <m.div key={i} {...shimmer}>
              <Card className="border-2 border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-9 w-36 mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </m.div>
          ))}
        </div>
      </m.section>

      {/* Recent Offertes Skeleton */}
      <m.section variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-6 w-36 rounded-full mb-4" />
        </m.div>
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
            <RecentOffertesListSkeleton count={5} />
          </CardContent>
        </Card>
      </m.section>
    </m.div>
  );
}
