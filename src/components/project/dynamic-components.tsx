"use client";

import dynamic from "next/dynamic";
import { ChartLoadingSkeleton, PDFLoadingSkeleton } from "@/components/ui/chart-loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Loading skeleton for FactuurPreview
function FactuurPreviewSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-8 w-32 ml-auto" />
            <Skeleton className="h-5 w-24 ml-auto" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between py-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-px w-full" />
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for NacalculatieSummary
function NacalculatieSummarySkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-20" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <div>
                  <Skeleton className="h-3 w-14 mb-1" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Loading skeleton for AfwijkingenTabel
function AfwijkingenTabelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="border-b">
            <div className="flex p-3">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-20 ml-4" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-4 w-16 ml-8" />
              <Skeleton className="h-4 w-20 ml-8" />
              <Skeleton className="h-4 w-20 ml-8" />
            </div>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex p-3 border-b last:border-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24 ml-4" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-12 ml-8" />
              <Skeleton className="h-4 w-16 ml-8" />
              <Skeleton className="h-6 w-16 ml-8 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dynamically imported FactuurPreview
 * Only loaded when viewing factuur details
 */
export const DynamicFactuurPreview = dynamic(
  () => import("./factuur-preview").then((mod) => mod.FactuurPreview),
  {
    loading: () => <FactuurPreviewSkeleton />,
    ssr: false,
  }
);

/**
 * Dynamically imported FactuurPDF
 * Heavy component using @react-pdf/renderer (~500KB)
 */
export const DynamicFactuurPDF = dynamic(
  () => import("./factuur-pdf").then((mod) => mod.FactuurPDF),
  {
    loading: () => <PDFLoadingSkeleton />,
    ssr: false,
  }
);

/**
 * Dynamically imported NacalculatieSummary
 * Only loaded on nacalculatie pages
 */
export const DynamicNacalculatieSummary = dynamic(
  () => import("./nacalculatie-summary").then((mod) => mod.NacalculatieSummary),
  {
    loading: () => <NacalculatieSummarySkeleton />,
    ssr: false,
  }
);

/**
 * Dynamically imported AfwijkingenTabel
 * Only loaded on nacalculatie pages
 */
export const DynamicAfwijkingenTabel = dynamic(
  () => import("./afwijkingen-tabel").then((mod) => mod.AfwijkingenTabel),
  {
    loading: () => <AfwijkingenTabelSkeleton />,
    ssr: false,
  }
);

/**
 * Dynamically imported VergelijkingChart
 * Uses recharts library - already has internal dynamic imports
 * Provides additional wrapper for lazy loading the component itself
 */
export const DynamicVergelijkingChart = dynamic(
  () => import("./vergelijking-chart").then((mod) => mod.VergelijkingChart),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-56" />
          </div>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <ChartLoadingSkeleton height={350} />
        </CardContent>
      </Card>
    ),
    ssr: false,
  }
);

/**
 * Dynamically imported AfwijkingChart
 */
export const DynamicAfwijkingChart = dynamic(
  () => import("./vergelijking-chart").then((mod) => mod.AfwijkingChart),
  {
    loading: () => (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <ChartLoadingSkeleton height={300} />
        </CardContent>
      </Card>
    ),
    ssr: false,
  }
);
