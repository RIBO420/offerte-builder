"use client";

import dynamic from "next/dynamic";
import { DialogLoadingSkeleton } from "@/components/ui/chart-loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton for SendEmailDialog
function SendEmailDialogSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-4 w-64" />
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

// Loading skeleton for ShareOfferteDialog
function ShareDialogSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-4 w-80" />
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Dynamically imported SendEmailDialog
 * Reduces initial bundle by ~20KB (email templates, form logic)
 */
export const DynamicSendEmailDialog = dynamic(
  () => import("./send-email-dialog").then((mod) => mod.SendEmailDialog),
  {
    loading: () => <SendEmailDialogSkeleton />,
    ssr: false,
  }
);

/**
 * Dynamically imported ShareOfferteDialog
 * Only loaded when user wants to share an offerte
 */
export const DynamicShareOfferteDialog = dynamic(
  () => import("./share-offerte-dialog").then((mod) => mod.ShareOfferteDialog),
  {
    loading: () => <ShareDialogSkeleton />,
    ssr: false,
  }
);
