"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

// Animation variants
const shimmer = {
  initial: { opacity: 0.5 },
  animate: { opacity: 1 },
  transition: { duration: 0.8, repeat: Infinity, repeatType: "reverse" as const }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Dashboard statistieken laden"
      className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
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
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 8 }: { columns?: number }) {
  return (
    <motion.tr className="border-b" variants={fadeInUp}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <motion.div {...shimmer}>
            <Skeleton className="h-5 w-full max-w-[120px]" />
          </motion.div>
        </td>
      ))}
    </motion.tr>
  );
}

// Offertes Table Skeleton
export function OffertesTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card role="status" aria-busy="true" aria-label="Offertes tabel laden">
      <span className="sr-only">Offertes worden geladen...</span>
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 w-[50px]"><Skeleton className="h-4 w-4" /></th>
              <th className="p-4"><Skeleton className="h-4 w-12" /></th>
              <th className="p-4"><Skeleton className="h-4 w-16" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4"><Skeleton className="h-4 w-16" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4 w-[50px]"></th>
            </tr>
          </thead>
          <motion.tbody
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} columns={9} />
            ))}
          </motion.tbody>
        </table>
      </div>
    </Card>
  );
}

// Dashboard Card Skeleton
export function DashboardCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <motion.div {...shimmer}>
          <Skeleton className="h-5 w-32" />
        </motion.div>
        <motion.div {...shimmer}>
          <Skeleton className="h-4 w-48" />
        </motion.div>
      </CardHeader>
      <CardContent>
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div key={i} className="flex items-center gap-3" variants={fadeInUp}>
              <motion.div {...shimmer}>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </motion.div>
              <div className="flex-1 space-y-1">
                <motion.div {...shimmer}>
                  <Skeleton className="h-4 w-24" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </motion.div>
              </div>
              <motion.div {...shimmer}>
                <Skeleton className="h-5 w-16" />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}

// Offerte Detail Skeleton
export function OfferteDetailSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Offerte details laden"
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <motion.div className="flex items-center gap-4" variants={fadeInUp}>
        <motion.div {...shimmer}>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </motion.div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <motion.div {...shimmer}>
              <Skeleton className="h-8 w-32" />
            </motion.div>
            <motion.div {...shimmer}>
              <Skeleton className="h-6 w-20 rounded-full" />
            </motion.div>
          </div>
          <motion.div {...shimmer}>
            <Skeleton className="h-4 w-48" />
          </motion.div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Klantgegevens */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <motion.div {...shimmer}>
                  <Skeleton className="h-6 w-32" />
                </motion.div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <motion.div {...shimmer}>
                      <Skeleton className="h-3 w-16" />
                    </motion.div>
                    <motion.div {...shimmer}>
                      <Skeleton className="h-5 w-32" />
                    </motion.div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Regels */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <motion.div {...shimmer}>
                  <Skeleton className="h-6 w-28" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-4 w-20" />
                </motion.div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <div className="flex-1 space-y-1">
                        <motion.div {...shimmer}>
                          <Skeleton className="h-4 w-48" />
                        </motion.div>
                        <motion.div {...shimmer}>
                          <Skeleton className="h-3 w-24" />
                        </motion.div>
                      </div>
                      <motion.div {...shimmer}>
                        <Skeleton className="h-4 w-20" />
                      </motion.div>
                      <motion.div {...shimmer}>
                        <Skeleton className="h-4 w-16" />
                      </motion.div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column */}
        <motion.div className="space-y-6" variants={fadeInUp}>
          <Card>
            <CardHeader>
              <motion.div {...shimmer}>
                <Skeleton className="h-6 w-20" />
              </motion.div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <motion.div {...shimmer}>
                    <Skeleton className="h-4 w-28" />
                  </motion.div>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-4 w-20" />
                  </motion.div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

// Form Card Skeleton
export function FormCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <motion.div {...shimmer}>
            <Skeleton className="h-5 w-5 rounded" />
          </motion.div>
          <motion.div {...shimmer}>
            <Skeleton className="h-6 w-32" />
          </motion.div>
        </div>
        <motion.div {...shimmer}>
          <Skeleton className="h-4 w-48" />
        </motion.div>
      </CardHeader>
      <CardContent className="space-y-6">
        <motion.div
          className="grid gap-4 md:grid-cols-2"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div key={i} className="space-y-2" variants={fadeInUp}>
              <motion.div {...shimmer}>
                <Skeleton className="h-4 w-24" />
              </motion.div>
              <motion.div {...shimmer}>
                <Skeleton className="h-10 w-full" />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}

// Recent Offertes List Skeleton
export function RecentOffertesListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <motion.div
      className="space-y-3"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border"
          variants={fadeInUp}
        >
          <motion.div {...shimmer}>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </motion.div>
          <div className="flex-1 space-y-1">
            <motion.div {...shimmer}>
              <Skeleton className="h-4 w-20" />
            </motion.div>
            <motion.div {...shimmer}>
              <Skeleton className="h-3 w-32" />
            </motion.div>
          </div>
          <motion.div {...shimmer}>
            <Skeleton className="h-5 w-16 rounded-full" />
          </motion.div>
          <motion.div {...shimmer}>
            <Skeleton className="h-4 w-20" />
          </motion.div>
        </motion.div>
      ))}
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
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
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

// Offerte History Skeleton
export function OfferteHistorySkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Versiegeschiedenis laden"
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Version Timeline */}
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
            <motion.div
              className="space-y-6"
              variants={staggerContainer}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div key={i} className="flex gap-4" variants={fadeInUp}>
                  <div className="flex flex-col items-center">
                    <motion.div {...shimmer}>
                      <Skeleton className="h-10 w-10 rounded-full" />
                    </motion.div>
                    {i < 4 && (
                      <motion.div {...shimmer}>
                        <Skeleton className="h-16 w-0.5 mt-2" />
                      </motion.div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pb-6">
                    <div className="flex items-center gap-2">
                      <motion.div {...shimmer}>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </motion.div>
                      <motion.div {...shimmer}>
                        <Skeleton className="h-4 w-32" />
                      </motion.div>
                    </div>
                    <motion.div {...shimmer}>
                      <Skeleton className="h-4 w-48" />
                    </motion.div>
                    <div className="flex gap-2">
                      <motion.div {...shimmer}>
                        <Skeleton className="h-8 w-24" />
                      </motion.div>
                      <motion.div {...shimmer}>
                        <Skeleton className="h-8 w-20" />
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
