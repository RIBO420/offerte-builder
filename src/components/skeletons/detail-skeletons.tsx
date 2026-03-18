"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

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

// Project Detail Skeleton
export function ProjectDetailSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Project laden"
      className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <span className="sr-only">Project wordt geladen...</span>

      {/* Header with back button and title */}
      <motion.div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between" variants={fadeInUp}>
        <div className="flex items-start gap-4">
          <motion.div {...shimmer}>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </motion.div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <motion.div {...shimmer}>
                <Skeleton className="h-8 w-48" />
              </motion.div>
              <motion.div {...shimmer}>
                <Skeleton className="h-6 w-24 rounded-full" />
              </motion.div>
            </div>
            <motion.div {...shimmer}>
              <Skeleton className="h-4 w-40" />
            </motion.div>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.div {...shimmer}>
            <Skeleton className="h-9 w-28" />
          </motion.div>
          <motion.div {...shimmer}>
            <Skeleton className="h-9 w-32" />
          </motion.div>
        </div>
      </motion.div>

      {/* Progress Stepper */}
      <motion.div variants={fadeInUp}>
        <Card className="p-4">
          <div className="flex justify-between gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div key={i} className="flex-1" {...shimmer}>
                <Skeleton className="h-12 w-full rounded-lg" />
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div className="grid gap-4 lg:grid-cols-3" variants={staggerContainer}>
        {/* Left Column - Project Info */}
        <motion.div className="lg:col-span-2 space-y-4" variants={staggerContainer}>
          {/* Quick Stats */}
          <motion.div
            className="grid gap-4 grid-cols-2 md:grid-cols-4"
            variants={staggerContainer}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <motion.div {...shimmer}>
                      <Skeleton className="h-10 w-10 rounded-lg" />
                    </motion.div>
                    <div className="space-y-1">
                      <motion.div {...shimmer}>
                        <Skeleton className="h-3 w-16" />
                      </motion.div>
                      <motion.div {...shimmer}>
                        <Skeleton className="h-5 w-20" />
                      </motion.div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Werklocatie Card */}
          <motion.div variants={fadeInUp}>
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
                  <Skeleton className="h-[200px] w-full rounded-lg" />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Right Column - Quick Actions */}
        <motion.div className="space-y-4" variants={staggerContainer}>
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <motion.div {...shimmer}>
                  <Skeleton className="h-6 w-28" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-4 w-40" />
                </motion.div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div key={i} {...shimmer}>
                      <Skeleton className="h-12 w-full rounded-lg" />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <motion.div {...shimmer}>
                  <Skeleton className="h-6 w-36" />
                </motion.div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <motion.div {...shimmer}>
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </motion.div>
                      <div className="flex-1 space-y-1">
                        <motion.div {...shimmer}>
                          <Skeleton className="h-4 w-full" />
                        </motion.div>
                        <motion.div {...shimmer}>
                          <Skeleton className="h-3 w-24" />
                        </motion.div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Project Kosten Skeleton
export function ProjectKostenSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Kosten laden"
      className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <span className="sr-only">Kosten worden geladen...</span>

      {/* Header with back button */}
      <motion.div className="flex items-center gap-4" variants={fadeInUp}>
        <motion.div {...shimmer}>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </motion.div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <motion.div {...shimmer}>
              <Skeleton className="h-5 w-5 rounded" />
            </motion.div>
            <motion.div {...shimmer}>
              <Skeleton className="h-7 w-40" />
            </motion.div>
          </div>
          <motion.div {...shimmer}>
            <Skeleton className="h-4 w-32" />
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
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
                  <Skeleton className="h-8 w-24 mb-1" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Chart and Table */}
      <motion.div className="grid gap-4 lg:grid-cols-2" variants={staggerContainer}>
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <motion.div {...shimmer}>
                <Skeleton className="h-6 w-36" />
              </motion.div>
              <motion.div {...shimmer}>
                <Skeleton className="h-4 w-48" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.div {...shimmer}>
                <Skeleton className="h-[200px] w-full" />
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <motion.div {...shimmer}>
                <Skeleton className="h-6 w-32" />
              </motion.div>
              <motion.div {...shimmer}>
                <Skeleton className="h-4 w-56" />
              </motion.div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <motion.div {...shimmer}>
                      <Skeleton className="h-4 w-24" />
                    </motion.div>
                    <motion.div {...shimmer} className="flex-1">
                      <Skeleton className="h-4 w-full" />
                    </motion.div>
                    <motion.div {...shimmer}>
                      <Skeleton className="h-4 w-20" />
                    </motion.div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// QC Page Skeleton
export function QCPageSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Kwaliteitscontroles laden"
      className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <span className="sr-only">Kwaliteitscontroles worden geladen...</span>

      {/* Header with back button */}
      <motion.div className="flex items-center gap-4" variants={fadeInUp}>
        <motion.div {...shimmer}>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </motion.div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <motion.div {...shimmer}>
              <Skeleton className="h-5 w-5 rounded" />
            </motion.div>
            <motion.div {...shimmer}>
              <Skeleton className="h-7 w-48" />
            </motion.div>
          </div>
          <motion.div {...shimmer}>
            <Skeleton className="h-4 w-32" />
          </motion.div>
        </div>
      </motion.div>

      {/* Status Summary Cards */}
      <motion.div
        className="grid gap-3 grid-cols-2 md:grid-cols-4"
        variants={staggerContainer}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <motion.div {...shimmer}>
                  <Skeleton className="h-4 w-20" />
                </motion.div>
                <motion.div {...shimmer}>
                  <Skeleton className="h-6 w-8" />
                </motion.div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Progress Card */}
      <motion.div variants={fadeInUp}>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <motion.div {...shimmer}>
              <Skeleton className="h-5 w-32" />
            </motion.div>
            <motion.div {...shimmer}>
              <Skeleton className="h-5 w-12" />
            </motion.div>
          </div>
          <motion.div {...shimmer}>
            <Skeleton className="h-2 w-full rounded-full" />
          </motion.div>
        </Card>
      </motion.div>

      {/* QC Checklist Cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-2"
        variants={staggerContainer}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div key={i} variants={fadeInUp}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <motion.div {...shimmer}>
                    <Skeleton className="h-5 w-28" />
                  </motion.div>
                  <motion.div {...shimmer}>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </motion.div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <motion.div {...shimmer}>
                        <Skeleton className="h-4 w-4 rounded" />
                      </motion.div>
                      <motion.div {...shimmer} className="flex-1">
                        <Skeleton className="h-4 w-full" />
                      </motion.div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
