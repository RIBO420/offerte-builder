"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

// Form Card Skeleton
export function FormCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <m.div {...shimmer}>
            <Skeleton className="h-5 w-5 rounded" />
          </m.div>
          <m.div {...shimmer}>
            <Skeleton className="h-6 w-32" />
          </m.div>
        </div>
        <m.div {...shimmer}>
          <Skeleton className="h-4 w-48" />
        </m.div>
      </CardHeader>
      <CardContent className="space-y-6">
        <m.div
          className="grid gap-4 md:grid-cols-2"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <m.div key={i} className="space-y-2" variants={fadeInUp}>
              <m.div {...shimmer}>
                <Skeleton className="h-4 w-24" />
              </m.div>
              <m.div {...shimmer}>
                <Skeleton className="h-10 w-full" />
              </m.div>
            </m.div>
          ))}
        </m.div>
      </CardContent>
    </Card>
  );
}
