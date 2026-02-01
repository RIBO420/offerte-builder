"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck, AlertTriangle, XCircle, Calendar } from "lucide-react";

interface ComplianceBadgeProps {
  type: "apk" | "verzekering";
  daysLeft: number | null;
  expiryDate?: number;
  className?: string;
  showLabel?: boolean;
}

/**
 * Get compliance status based on days remaining
 * - green: more than 60 days
 * - amber: 30-60 days (warning)
 * - red: less than 30 days or expired
 */
function getComplianceStatus(daysLeft: number | null): {
  status: "ok" | "warning" | "critical" | "unknown";
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
  icon: typeof ShieldCheck;
} {
  if (daysLeft === null) {
    return {
      status: "unknown",
      variant: "outline",
      className: "text-muted-foreground border-muted-foreground/50",
      icon: Calendar,
    };
  }

  if (daysLeft < 0) {
    return {
      status: "critical",
      variant: "destructive",
      className: "bg-red-500 text-white",
      icon: XCircle,
    };
  }

  if (daysLeft <= 30) {
    return {
      status: "critical",
      variant: "destructive",
      className: "bg-red-500 text-white",
      icon: AlertTriangle,
    };
  }

  if (daysLeft <= 60) {
    return {
      status: "warning",
      variant: "secondary",
      className: "bg-amber-500 text-white",
      icon: AlertTriangle,
    };
  }

  return {
    status: "ok",
    variant: "default",
    className: "bg-green-500 text-white",
    icon: ShieldCheck,
  };
}

function formatExpiryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(daysLeft: number | null, type: "apk" | "verzekering"): string {
  const typeName = type === "apk" ? "APK" : "Verzekering";

  if (daysLeft === null) {
    return `${typeName} datum onbekend`;
  }

  if (daysLeft < 0) {
    return `${typeName} verlopen (${Math.abs(daysLeft)} dagen geleden)`;
  }

  if (daysLeft === 0) {
    return `${typeName} verloopt vandaag`;
  }

  if (daysLeft === 1) {
    return `${typeName} verloopt morgen`;
  }

  return `${typeName} geldig nog ${daysLeft} dagen`;
}

export function ComplianceBadge({
  type,
  daysLeft,
  expiryDate,
  className,
  showLabel = true,
}: ComplianceBadgeProps) {
  const { status, className: statusClassName, icon: Icon } = getComplianceStatus(daysLeft);
  const label = type === "apk" ? "APK" : "Verz.";
  const statusLabel = getStatusLabel(daysLeft, type);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              "gap-1 cursor-default",
              statusClassName,
              className
            )}
          >
            <Icon className="h-3 w-3" />
            {showLabel && <span>{label}</span>}
            {daysLeft !== null && (
              <span className="font-bold">
                {daysLeft < 0 ? "!" : daysLeft <= 60 ? `${daysLeft}d` : null}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusLabel}</p>
          {expiryDate && (
            <p className="text-muted-foreground text-xs">
              Vervaldatum: {formatExpiryDate(expiryDate)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ComplianceStatusProps {
  apkDaysLeft: number | null;
  verzekeringDaysLeft: number | null;
  apkExpiryDate?: number;
  verzekeringExpiryDate?: number;
  className?: string;
}

/**
 * Combined compliance status showing both APK and Insurance badges
 */
export function ComplianceStatus({
  apkDaysLeft,
  verzekeringDaysLeft,
  apkExpiryDate,
  verzekeringExpiryDate,
  className,
}: ComplianceStatusProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <ComplianceBadge
        type="apk"
        daysLeft={apkDaysLeft}
        expiryDate={apkExpiryDate}
      />
      <ComplianceBadge
        type="verzekering"
        daysLeft={verzekeringDaysLeft}
        expiryDate={verzekeringExpiryDate}
      />
    </div>
  );
}

/**
 * Compact warning badge for list views - shows only if there's a warning/critical status
 */
export function ComplianceWarningBadge({
  apkDaysLeft,
  verzekeringDaysLeft,
  className,
}: {
  apkDaysLeft: number | null;
  verzekeringDaysLeft: number | null;
  className?: string;
}) {
  const apkStatus = getComplianceStatus(apkDaysLeft);
  const verzekeringStatus = getComplianceStatus(verzekeringDaysLeft);

  const hasApkWarning = apkStatus.status === "warning" || apkStatus.status === "critical";
  const hasVerzekeringWarning = verzekeringStatus.status === "warning" || verzekeringStatus.status === "critical";

  if (!hasApkWarning && !hasVerzekeringWarning) {
    return null;
  }

  const warnings: string[] = [];
  if (hasApkWarning) warnings.push("APK");
  if (hasVerzekeringWarning) warnings.push("Verz.");

  const isCritical =
    apkStatus.status === "critical" || verzekeringStatus.status === "critical";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isCritical ? "destructive" : "secondary"}
            className={cn(
              "gap-1",
              isCritical ? "bg-red-500" : "bg-amber-500",
              "text-white",
              className
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            {warnings.join(", ")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {hasApkWarning && (
              <p>{getStatusLabel(apkDaysLeft, "apk")}</p>
            )}
            {hasVerzekeringWarning && (
              <p>{getStatusLabel(verzekeringDaysLeft, "verzekering")}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Get the compliance warning count for stats display
 */
export function getComplianceWarningCount(
  voertuigen: Array<{
    apkVervaldatum?: number;
    verzekeringsVervaldatum?: number;
  }>
): { apkWarnings: number; verzekeringWarnings: number } {
  const now = Date.now();

  let apkWarnings = 0;
  let verzekeringWarnings = 0;

  for (const voertuig of voertuigen) {
    if (voertuig.apkVervaldatum) {
      const daysLeft = Math.ceil((voertuig.apkVervaldatum - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        apkWarnings++;
      }
    }

    if (voertuig.verzekeringsVervaldatum) {
      const daysLeft = Math.ceil(
        (voertuig.verzekeringsVervaldatum - now) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 30) {
        verzekeringWarnings++;
      }
    }
  }

  return { apkWarnings, verzekeringWarnings };
}
