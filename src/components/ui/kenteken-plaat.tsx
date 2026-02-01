"use client";

import * as React from "react";
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

// Dutch license plate formats
const KENTEKEN_PATTERNS = [
  /^[A-Z]{2}-\d{2}-\d{2}$/,          // XX-99-99 (1951-1965)
  /^\d{2}-\d{2}-[A-Z]{2}$/,          // 99-99-XX (1965-1973)
  /^\d{2}-[A-Z]{2}-\d{2}$/,          // 99-XX-99 (1973-1978)
  /^[A-Z]{2}-\d{2}-[A-Z]{2}$/,       // XX-99-XX (1978-1991)
  /^[A-Z]{2}-[A-Z]{2}-\d{2}$/,       // XX-XX-99 (1991-1999)
  /^\d{2}-[A-Z]{2}-[A-Z]{2}$/,       // 99-XX-XX (1999-2005)
  /^\d{2}-[A-Z]{3}-\d$/,             // 99-XXX-9 (2005-2009)
  /^\d-[A-Z]{3}-\d{2}$/,             // 9-XXX-99 (2009-2015)
  /^[A-Z]{2}-\d{3}-[A-Z]$/,          // XX-999-X (2015-2019)
  /^[A-Z]-\d{3}-[A-Z]{2}$/,          // X-999-XX (2019-2023)
  /^[A-Z]{3}-\d{2}-[A-Z]$/,          // XXX-99-X (2023-present)
  /^[A-Z]-\d{2}-[A-Z]{3}$/,          // X-99-XXX (future)
];

function isValidKenteken(kenteken: string): boolean {
  if (!kenteken) return false;
  const normalized = kenteken.toUpperCase().trim();
  return KENTEKEN_PATTERNS.some((pattern) => pattern.test(normalized));
}

function formatKenteken(kenteken: string): string {
  if (!kenteken) return "";
  // Remove all non-alphanumeric characters and convert to uppercase
  const cleaned = kenteken.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  // Try to auto-format based on length
  if (cleaned.length === 6) {
    // Most common format: XX-XX-XX pattern
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}`;
  }

  // Return as-is if already has hyphens
  if (kenteken.includes("-")) {
    return kenteken.toUpperCase().trim();
  }

  return cleaned;
}

// EU Stars circle SVG component
const EUStars = memo(function EUStars({ className }: { className?: string }) {
  // 12 stars arranged in a circle
  const stars = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const x = 50 + 35 * Math.cos(angle);
    const y = 50 + 35 * Math.sin(angle);
    stars.push(
      <polygon
        key={i}
        points="0,-6 1.5,-2 6,-2 2.5,1 4,6 0,3 -4,6 -2.5,1 -6,-2 -1.5,-2"
        fill="#FFCC00"
        transform={`translate(${x}, ${y}) scale(0.6)`}
      />
    );
  }
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {stars}
    </svg>
  );
});

interface KentekenPlaatProps {
  kenteken: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showValidation?: boolean;
}

const sizeConfig = {
  sm: {
    plate: "w-[140px] h-[28px]",
    euStripe: "w-[18px]",
    text: "text-[11px] tracking-[0.12em]",
    stars: "w-[12px] h-[12px]",
    nlText: "text-[7px]",
    shadow: "shadow-md",
  },
  md: {
    plate: "w-[200px] h-[40px]",
    euStripe: "w-[26px]",
    text: "text-[16px] tracking-[0.15em]",
    stars: "w-[16px] h-[16px]",
    nlText: "text-[9px]",
    shadow: "shadow-lg",
  },
  lg: {
    plate: "w-[280px] h-[56px]",
    euStripe: "w-[36px]",
    text: "text-[22px] tracking-[0.18em]",
    stars: "w-[22px] h-[22px]",
    nlText: "text-[12px]",
    shadow: "shadow-xl",
  },
};

export const KentekenPlaat = memo(function KentekenPlaat({
  kenteken,
  size = "md",
  className,
  showValidation = false,
}: KentekenPlaatProps) {
  const formattedKenteken = useMemo(() => formatKenteken(kenteken), [kenteken]);
  const isValid = useMemo(() => isValidKenteken(formattedKenteken), [formattedKenteken]);
  const config = sizeConfig[size];

  // Show placeholder for empty kenteken
  if (!kenteken || !kenteken.trim()) {
    return (
      <div
        className={cn(
          "relative inline-flex items-stretch rounded-[4px] overflow-hidden",
          "bg-gray-200 border-2 border-gray-300",
          config.plate,
          config.shadow,
          className
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center bg-[#003399]",
            config.euStripe
          )}
        >
          <EUStars className={cn(config.stars, "opacity-50")} />
          <span
            className={cn(
              "font-bold text-[#FFCC00]/50 mt-0.5",
              config.nlText
            )}
          >
            NL
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span
            className={cn(
              "font-bold text-gray-400 uppercase",
              config.text
            )}
            style={{ fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif" }}
          >
            --
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative inline-flex items-stretch rounded-[4px] overflow-hidden",
        "border-2 border-black/20",
        config.plate,
        config.shadow,
        // Validation styling
        showValidation && !isValid && "ring-2 ring-red-500 ring-offset-1",
        className
      )}
      style={{
        // Realistic 3D effect with multiple shadows
        boxShadow: `
          0 1px 2px rgba(0,0,0,0.2),
          0 2px 4px rgba(0,0,0,0.15),
          inset 0 1px 0 rgba(255,255,255,0.3),
          inset 0 -1px 0 rgba(0,0,0,0.1)
        `,
      }}
    >
      {/* EU Blue stripe */}
      <div
        className={cn(
          "flex flex-col items-center justify-center",
          config.euStripe
        )}
        style={{
          background: "linear-gradient(180deg, #003399 0%, #002266 100%)",
        }}
      >
        <EUStars className={config.stars} />
        <span
          className={cn(
            "font-bold text-[#FFCC00] mt-0.5",
            config.nlText
          )}
          style={{ fontFamily: "'Arial', sans-serif" }}
        >
          NL
        </span>
      </div>

      {/* Yellow plate area */}
      <div
        className="flex-1 flex items-center justify-center relative"
        style={{
          // Authentic Dutch yellow with subtle gradient for depth
          background: "linear-gradient(180deg, #FFD500 0%, #F7B500 50%, #E5A400 100%)",
        }}
      >
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h1v1H0zm2 0h1v1H2zm1 1h1v1H3zm-2 0h1v1H1zm2 2h1v1H3zm-2 0h1v1H1zm-1 1h1v1H0zm2 0h1v1H2z' fill='%23000'/%3E%3C/svg%3E")`,
            backgroundSize: "4px 4px",
          }}
        />

        {/* License plate text */}
        <span
          className={cn(
            "relative font-bold text-black uppercase",
            config.text
          )}
          style={{
            fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
            textShadow: "0 1px 0 rgba(255,255,255,0.3)",
            // Slight emboss effect
            WebkitTextStroke: "0.3px rgba(0,0,0,0.1)",
          }}
        >
          {formattedKenteken}
        </span>
      </div>

      {/* Top highlight for 3D effect */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-b from-white/40 to-transparent pointer-events-none"
      />

      {/* Bottom shadow for 3D effect */}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
      />
    </div>
  );
});

// Compact badge variant for tables and lists
interface KentekenBadgeProps {
  kenteken: string;
  className?: string;
  showEUStripe?: boolean;
}

export const KentekenBadge = memo(function KentekenBadge({
  kenteken,
  className,
  showEUStripe = true,
}: KentekenBadgeProps) {
  const formattedKenteken = useMemo(() => formatKenteken(kenteken), [kenteken]);

  if (!kenteken || !kenteken.trim()) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded px-1.5 py-0.5",
          "bg-gray-100 text-gray-400 text-xs font-mono",
          className
        )}
      >
        --
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded overflow-hidden",
        "text-xs font-bold shadow-sm border border-black/10",
        className
      )}
    >
      {showEUStripe && (
        <span
          className="px-1 py-0.5 text-[8px] text-[#FFCC00]"
          style={{
            background: "linear-gradient(180deg, #003399 0%, #002266 100%)",
          }}
        >
          NL
        </span>
      )}
      <span
        className="px-1.5 py-0.5 text-black"
        style={{
          background: "linear-gradient(180deg, #FFD500 0%, #F7B500 100%)",
          fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        {formattedKenteken}
      </span>
    </span>
  );
});

// Export utilities
export { isValidKenteken, formatKenteken };
