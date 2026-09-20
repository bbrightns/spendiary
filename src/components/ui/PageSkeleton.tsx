export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-surface-muted rounded-full" />
          <div className="h-8 w-44 bg-surface-muted rounded-xl" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 bg-surface-muted rounded-full" />
          <div className="h-9 w-32 bg-surface-muted rounded-full" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-surface-muted rounded" />
              <div className="h-8 w-8 bg-surface-muted rounded-xl" />
            </div>
            <div className="h-7 w-32 bg-surface-muted rounded-lg" />
            <div className="h-3 w-16 bg-surface-muted rounded" />
          </div>
        ))}
      </div>

      {/* Main Content / Chart Skeleton Card */}
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="h-5 w-36 bg-surface-muted rounded" />
          <div className="h-8 w-28 bg-surface-muted rounded-full" />
        </div>
        <div className="h-56 w-full bg-surface-muted/60 rounded-2xl flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
        </div>
      </div>
    </div>
  )
}
