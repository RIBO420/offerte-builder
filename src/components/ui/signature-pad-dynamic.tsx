"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton for signature pad
function SignaturePadSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="w-full h-32 rounded-lg" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-1.5 pt-2 border-t">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  );
}

// Dynamically import SignaturePad since signature_pad library is ~50KB
// Only used on public offerte page when customer signs
export const DynamicSignaturePad = dynamic(
  () => import("./signature-pad").then((mod) => mod.SignaturePadComponent),
  {
    loading: () => <SignaturePadSkeleton />,
    ssr: false,
  }
);
