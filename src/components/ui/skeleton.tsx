import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-accent",
        "before:absolute before:inset-0",
        "before:translate-x-[-100%]",
        "before:animate-shimmer",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-white/20 before:to-transparent",
        "dark:before:via-white/10",
        className
      )}
      style={{
        ...props.style,
      }}
      {...props}
    />
  )
}

export { Skeleton }
