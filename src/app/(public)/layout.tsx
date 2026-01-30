"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProvider client={convex}>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {children}
      </div>
    </ConvexProvider>
  );
}
