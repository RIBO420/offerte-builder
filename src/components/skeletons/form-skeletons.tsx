"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

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
