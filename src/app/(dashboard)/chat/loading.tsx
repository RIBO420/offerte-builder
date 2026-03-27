import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Chat laden...</span>

      {/* Page header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Title */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Chat layout skeleton */}
        <div className="flex flex-1 rounded-lg border overflow-hidden" style={{ minHeight: "500px" }}>
          {/* Sidebar */}
          <div className="w-64 border-r p-4 space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-5 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 flex flex-col">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="flex-1 p-4 space-y-4">
              <div className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-48 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 flex-row-reverse">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 text-right">
                  <Skeleton className="h-3 w-24 ml-auto" />
                  <Skeleton className="h-10 w-56 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-36 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="border-t p-4">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
