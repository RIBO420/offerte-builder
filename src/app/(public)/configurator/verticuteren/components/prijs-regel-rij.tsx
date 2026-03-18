import { cn } from "@/lib/utils";

export function PrijsRegelRij({
  label,
  detail,
  bedrag,
  isSubtotaal,
  highlight,
}: {
  label: string;
  detail?: string;
  bedrag: string;
  isSubtotaal?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between py-2 gap-4",
        isSubtotaal && "font-medium",
        highlight && "bg-green-50 -mx-3 px-3 rounded-md"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isSubtotaal && "font-semibold")}>{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <p
        className={cn(
          "text-sm font-medium flex-shrink-0 tabular-nums",
          isSubtotaal && "font-semibold"
        )}
      >
        {bedrag}
      </p>
    </div>
  );
}
