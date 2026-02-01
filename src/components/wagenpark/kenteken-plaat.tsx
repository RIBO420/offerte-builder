"use client";

import { cn } from "@/lib/utils";

interface KentekenPlaatProps {
  kenteken: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Formats a Dutch license plate string to standard format with dashes
 */
function formatKenteken(kenteken: string): string {
  // Remove existing dashes and convert to uppercase
  const cleaned = kenteken.replace(/-/g, "").toUpperCase();

  // Dutch plates are typically 6 characters
  if (cleaned.length !== 6) return kenteken.toUpperCase();

  // Format as XX-XX-XX
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
}

/**
 * Dutch license plate component
 * Displays a license plate in the traditional yellow Dutch style
 */
export function KentekenPlaat({
  kenteken,
  size = "md",
  className,
}: KentekenPlaatProps) {
  const formattedKenteken = formatKenteken(kenteken);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-bold tracking-wider rounded border-2 border-black bg-[#F7B500] text-black whitespace-nowrap",
        sizeClasses[size],
        className
      )}
      style={{
        fontFamily: '"Kenteken", "DIN 1451 Std", "DIN 1451", system-ui, sans-serif',
        textShadow: "none",
      }}
    >
      <span className="inline-flex items-center gap-0.5">
        {/* Blue EU strip on the left */}
        <span
          className={cn(
            "flex flex-col items-center justify-center bg-[#003399] text-white rounded-l -ml-2 -my-0.5",
            size === "sm" && "-ml-1.5 px-0.5 py-0.5 text-[6px]",
            size === "md" && "px-1 py-1 text-[8px]",
            size === "lg" && "px-1.5 py-1.5 text-[10px]"
          )}
          style={{
            marginLeft: size === "sm" ? "-0.5rem" : size === "md" ? "-0.75rem" : "-1rem",
            marginTop: size === "sm" ? "-0.125rem" : size === "md" ? "-0.25rem" : "-0.375rem",
            marginBottom: size === "sm" ? "-0.125rem" : size === "md" ? "-0.25rem" : "-0.375rem",
          }}
        >
          {/* EU stars circle */}
          <svg
            viewBox="0 0 24 24"
            className={cn(
              "fill-[#FFCC00]",
              size === "sm" && "w-2 h-2",
              size === "md" && "w-2.5 h-2.5",
              size === "lg" && "w-3 h-3"
            )}
          >
            <circle cx="12" cy="12" r="10" fill="none" />
            {/* 12 stars in a circle */}
            {[...Array(12)].map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const x = 12 + 8 * Math.cos(angle);
              const y = 12 + 8 * Math.sin(angle);
              return (
                <polygon
                  key={i}
                  points={`${x},${y - 1.5} ${x + 0.6},${y - 0.5} ${x + 1.5},${y - 0.5} ${x + 0.8},${y + 0.2} ${x + 1.1},${y + 1.2} ${x},${y + 0.6} ${x - 1.1},${y + 1.2} ${x - 0.8},${y + 0.2} ${x - 1.5},${y - 0.5} ${x - 0.6},${y - 0.5}`}
                />
              );
            })}
          </svg>
          <span className="font-bold leading-none">NL</span>
        </span>
        {/* License plate text */}
        <span className={cn(
          size === "sm" && "ml-1",
          size === "md" && "ml-1.5",
          size === "lg" && "ml-2"
        )}>
          {formattedKenteken}
        </span>
      </span>
    </div>
  );
}
