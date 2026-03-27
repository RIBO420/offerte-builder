"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

// Offerte Detail Skeleton
export function OfferteDetailSkeleton() {
  return (
    <m.div
      role="status"
      aria-busy="true"
      aria-label="Offerte details laden"
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <m.div className="flex items-center gap-4" variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </m.div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <m.div {...shimmer}>
              <Skeleton className="h-8 w-32" />
            </m.div>
            <m.div {...shimmer}>
              <Skeleton className="h-6 w-20 rounded-full" />
            </m.div>
          </div>
          <m.div {...shimmer}>
            <Skeleton className="h-4 w-48" />
          </m.div>
        </div>
      </m.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Klantgegevens */}
          <m.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <m.div {...shimmer}>
                  <Skeleton className="h-6 w-32" />
                </m.div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <m.div {...shimmer}>
                      <Skeleton className="h-3 w-16" />
                    </m.div>
                    <m.div {...shimmer}>
                      <Skeleton className="h-5 w-32" />
                    </m.div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </m.div>

          {/* Regels */}
          <m.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <m.div {...shimmer}>
                  <Skeleton className="h-6 w-28" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-20" />
                </m.div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <div className="flex-1 space-y-1">
                        <m.div {...shimmer}>
                          <Skeleton className="h-4 w-48" />
                        </m.div>
                        <m.div {...shimmer}>
                          <Skeleton className="h-3 w-24" />
                        </m.div>
                      </div>
                      <m.div {...shimmer}>
                        <Skeleton className="h-4 w-20" />
                      </m.div>
                      <m.div {...shimmer}>
                        <Skeleton className="h-4 w-16" />
                      </m.div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </m.div>
        </div>

        {/* Right column */}
        <m.div className="space-y-6" variants={fadeInUp}>
          <Card>
            <CardHeader>
              <m.div {...shimmer}>
                <Skeleton className="h-6 w-20" />
              </m.div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <m.div {...shimmer}>
                    <Skeleton className="h-4 w-28" />
                  </m.div>
                  <m.div {...shimmer}>
                    <Skeleton className="h-4 w-20" />
                  </m.div>
                </div>
              ))}
            </CardContent>
          </Card>
        </m.div>
      </div>
    </m.div>
  );
}

// Offerte History Skeleton
export function OfferteHistorySkeleton() {
  return (
    <m.div
      role="status"
      aria-busy="true"
      aria-label="Versiegeschiedenis laden"
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Version Timeline */}
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
            <m.div
              className="space-y-6"
              variants={staggerContainer}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <m.div key={i} className="flex gap-4" variants={fadeInUp}>
                  <div className="flex flex-col items-center">
                    <m.div {...shimmer}>
                      <Skeleton className="h-10 w-10 rounded-full" />
                    </m.div>
                    {i < 4 && (
                      <m.div {...shimmer}>
                        <Skeleton className="h-16 w-0.5 mt-2" />
                      </m.div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pb-6">
                    <div className="flex items-center gap-2">
                      <m.div {...shimmer}>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </m.div>
                      <m.div {...shimmer}>
                        <Skeleton className="h-4 w-32" />
                      </m.div>
                    </div>
                    <m.div {...shimmer}>
                      <Skeleton className="h-4 w-48" />
                    </m.div>
                    <div className="flex gap-2">
                      <m.div {...shimmer}>
                        <Skeleton className="h-8 w-24" />
                      </m.div>
                      <m.div {...shimmer}>
                        <Skeleton className="h-8 w-20" />
                      </m.div>
                    </div>
                  </div>
                </m.div>
              ))}
            </m.div>
          </CardContent>
        </Card>
      </m.div>
    </m.div>
  );
}

// Project Detail Skeleton
export function ProjectDetailSkeleton() {
  return (
    <m.div
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
      <m.div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between" variants={fadeInUp}>
        <div className="flex items-start gap-4">
          <m.div {...shimmer}>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </m.div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <m.div {...shimmer}>
                <Skeleton className="h-8 w-48" />
              </m.div>
              <m.div {...shimmer}>
                <Skeleton className="h-6 w-24 rounded-full" />
              </m.div>
            </div>
            <m.div {...shimmer}>
              <Skeleton className="h-4 w-40" />
            </m.div>
          </div>
        </div>
        <div className="flex gap-2">
          <m.div {...shimmer}>
            <Skeleton className="h-9 w-28" />
          </m.div>
          <m.div {...shimmer}>
            <Skeleton className="h-9 w-32" />
          </m.div>
        </div>
      </m.div>

      {/* Progress Stepper */}
      <m.div variants={fadeInUp}>
        <Card className="p-4">
          <div className="flex justify-between gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <m.div key={i} className="flex-1" {...shimmer}>
                <Skeleton className="h-12 w-full rounded-lg" />
              </m.div>
            ))}
          </div>
        </Card>
      </m.div>

      {/* Main Content Grid */}
      <m.div className="grid gap-4 lg:grid-cols-3" variants={staggerContainer}>
        {/* Left Column - Project Info */}
        <m.div className="lg:col-span-2 space-y-4" variants={staggerContainer}>
          {/* Quick Stats */}
          <m.div
            className="grid gap-4 grid-cols-2 md:grid-cols-4"
            variants={staggerContainer}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <m.div key={i} variants={fadeInUp}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <m.div {...shimmer}>
                      <Skeleton className="h-10 w-10 rounded-lg" />
                    </m.div>
                    <div className="space-y-1">
                      <m.div {...shimmer}>
                        <Skeleton className="h-3 w-16" />
                      </m.div>
                      <m.div {...shimmer}>
                        <Skeleton className="h-5 w-20" />
                      </m.div>
                    </div>
                  </div>
                </Card>
              </m.div>
            ))}
          </m.div>

          {/* Werklocatie Card */}
          <m.div variants={fadeInUp}>
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
                  <Skeleton className="h-[200px] w-full rounded-lg" />
                </m.div>
              </CardContent>
            </Card>
          </m.div>
        </m.div>

        {/* Right Column - Quick Actions */}
        <m.div className="space-y-4" variants={staggerContainer}>
          <m.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <m.div {...shimmer}>
                  <Skeleton className="h-6 w-28" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-40" />
                </m.div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <m.div key={i} {...shimmer}>
                      <Skeleton className="h-12 w-full rounded-lg" />
                    </m.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </m.div>

          {/* Recent Activity */}
          <m.div variants={fadeInUp}>
            <Card>
              <CardHeader>
                <m.div {...shimmer}>
                  <Skeleton className="h-6 w-36" />
                </m.div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <m.div {...shimmer}>
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </m.div>
                      <div className="flex-1 space-y-1">
                        <m.div {...shimmer}>
                          <Skeleton className="h-4 w-full" />
                        </m.div>
                        <m.div {...shimmer}>
                          <Skeleton className="h-3 w-24" />
                        </m.div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </m.div>
        </m.div>
      </m.div>
    </m.div>
  );
}

// Project Kosten Skeleton
export function ProjectKostenSkeleton() {
  return (
    <m.div
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
      <m.div className="flex items-center gap-4" variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </m.div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <m.div {...shimmer}>
              <Skeleton className="h-5 w-5 rounded" />
            </m.div>
            <m.div {...shimmer}>
              <Skeleton className="h-7 w-40" />
            </m.div>
          </div>
          <m.div {...shimmer}>
            <Skeleton className="h-4 w-32" />
          </m.div>
        </div>
      </m.div>

      {/* Stats Cards */}
      <m.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
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
                  <Skeleton className="h-8 w-24 mb-1" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-3 w-32" />
                </m.div>
              </CardContent>
            </Card>
          </m.div>
        ))}
      </m.div>

      {/* Chart and Table */}
      <m.div className="grid gap-4 lg:grid-cols-2" variants={staggerContainer}>
        <m.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <m.div {...shimmer}>
                <Skeleton className="h-6 w-36" />
              </m.div>
              <m.div {...shimmer}>
                <Skeleton className="h-4 w-48" />
              </m.div>
            </CardHeader>
            <CardContent>
              <m.div {...shimmer}>
                <Skeleton className="h-[200px] w-full" />
              </m.div>
            </CardContent>
          </Card>
        </m.div>

        <m.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <m.div {...shimmer}>
                <Skeleton className="h-6 w-32" />
              </m.div>
              <m.div {...shimmer}>
                <Skeleton className="h-4 w-56" />
              </m.div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <m.div {...shimmer}>
                      <Skeleton className="h-4 w-24" />
                    </m.div>
                    <m.div {...shimmer} className="flex-1">
                      <Skeleton className="h-4 w-full" />
                    </m.div>
                    <m.div {...shimmer}>
                      <Skeleton className="h-4 w-20" />
                    </m.div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </m.div>
      </m.div>
    </m.div>
  );
}

// QC Page Skeleton
export function QCPageSkeleton() {
  return (
    <m.div
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
      <m.div className="flex items-center gap-4" variants={fadeInUp}>
        <m.div {...shimmer}>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </m.div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <m.div {...shimmer}>
              <Skeleton className="h-5 w-5 rounded" />
            </m.div>
            <m.div {...shimmer}>
              <Skeleton className="h-7 w-48" />
            </m.div>
          </div>
          <m.div {...shimmer}>
            <Skeleton className="h-4 w-32" />
          </m.div>
        </div>
      </m.div>

      {/* Status Summary Cards */}
      <m.div
        className="grid gap-3 grid-cols-2 md:grid-cols-4"
        variants={staggerContainer}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <m.div key={i} variants={fadeInUp}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <m.div {...shimmer}>
                  <Skeleton className="h-4 w-20" />
                </m.div>
                <m.div {...shimmer}>
                  <Skeleton className="h-6 w-8" />
                </m.div>
              </div>
            </Card>
          </m.div>
        ))}
      </m.div>

      {/* Progress Card */}
      <m.div variants={fadeInUp}>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <m.div {...shimmer}>
              <Skeleton className="h-5 w-32" />
            </m.div>
            <m.div {...shimmer}>
              <Skeleton className="h-5 w-12" />
            </m.div>
          </div>
          <m.div {...shimmer}>
            <Skeleton className="h-2 w-full rounded-full" />
          </m.div>
        </Card>
      </m.div>

      {/* QC Checklist Cards */}
      <m.div
        className="grid gap-4 md:grid-cols-2"
        variants={staggerContainer}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <m.div key={i} variants={fadeInUp}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <m.div {...shimmer}>
                    <Skeleton className="h-5 w-28" />
                  </m.div>
                  <m.div {...shimmer}>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </m.div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <m.div {...shimmer}>
                        <Skeleton className="h-4 w-4 rounded" />
                      </m.div>
                      <m.div {...shimmer} className="flex-1">
                        <Skeleton className="h-4 w-full" />
                      </m.div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </m.div>
        ))}
      </m.div>
    </m.div>
  );
}
