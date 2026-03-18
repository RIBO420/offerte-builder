import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  verplicht?: boolean;
  hulptekst?: string;
}

export function Field({
  label,
  error,
  children,
  verplicht = true,
  hulptekst,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm font-medium", error && "text-red-600")}>
        {label}
        {verplicht && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {hulptekst && !error && (
        <p className="text-xs text-muted-foreground">{hulptekst}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
