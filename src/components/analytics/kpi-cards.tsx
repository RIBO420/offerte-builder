"use client";

import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { TrendingUp, Euro, FileText, Target } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";

interface KpiCardsProps {
  kpis: {
    winRate: number;
    gemiddeldeWaarde: number;
    totaleOmzet: number;
    totaalOffertes: number;
    geaccepteerdCount: number;
    afgewezenCount: number;
  };
}

// Sample trend data for sparklines (simulated monthly trend)
// Uses seeded randomness based on value to ensure consistent rendering
const generateTrendData = (value: number, trend: "up" | "down" | "stable" = "up", seed: number = 0) => {
  const variance = value * 0.15;
  const points = 7;
  const data: number[] = [];

  // Simple seeded random function for consistent results
  const seededRandom = (s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    let baseValue = trend === "up"
      ? value * (0.7 + 0.3 * progress)
      : trend === "down"
        ? value * (1 - 0.3 * progress)
        : value * (0.9 + 0.1 * Math.sin(i));

    const noise = (seededRandom(seed + i + value) - 0.5) * variance * 0.3;
    data.push(Math.max(0, baseValue + noise));
  }
  return data;
};

// Glassmorphic animated card wrapper - optimized for GPU acceleration
function GlassKpiCard({
  children,
  delay = 0,
  gradient = "from-emerald-500/10 to-green-500/10",
  hoverGlow = "group-hover:shadow-emerald-500/20",
  prefersReducedMotion = false,
}: {
  children: React.ReactNode;
  delay?: number;
  gradient?: string;
  hoverGlow?: string;
  prefersReducedMotion?: boolean;
}) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : {
        duration: 0.5,
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      className="group relative contain-paint"
    >
      {/* Glow effect on hover - reduced blur for performance */}
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-xl opacity-0 group-hover:opacity-80 transition-opacity duration-300`}
        style={{ filter: "blur(12px)" }}
      />

      <Card className={`relative h-full overflow-hidden bg-card/80 backdrop-blur-sm border-white/10 dark:border-white/5 transition-all duration-300 ${hoverGlow} group-hover:shadow-optimized-lg group-hover:border-white/20`}>
        {/* Glass shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Decorative corner gradient - reduced blur */}
        <div
          className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${gradient} opacity-30 pointer-events-none`}
          style={{ filter: "blur(16px)" }}
        />

        {children}
      </Card>
    </motion.div>
  );
}

export const KpiCards = memo(function KpiCards({ kpis }: KpiCardsProps) {
  const prefersReducedMotion = useReducedMotion();

  // Memoize trend data to prevent flickering on re-renders
  const { winRateTrend, gemiddeldeWaardeTrend, totaleOmzetTrend, totaalOffertesTrend } = useMemo(() => ({
    winRateTrend: generateTrendData(kpis.winRate, "up", 1),
    gemiddeldeWaardeTrend: generateTrendData(kpis.gemiddeldeWaarde, "up", 2),
    totaleOmzetTrend: generateTrendData(kpis.totaleOmzet, "up", 3),
    totaalOffertesTrend: generateTrendData(kpis.totaalOffertes, "stable", 4),
  }), [kpis.winRate, kpis.gemiddeldeWaarde, kpis.totaleOmzet, kpis.totaalOffertes]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Win Rate */}
      <GlassKpiCard
        delay={0}
        gradient="from-green-500/20 to-emerald-500/20"
        hoverGlow="group-hover:shadow-green-500/20"
        prefersReducedMotion={prefersReducedMotion}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Win Rate
          </CardTitle>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-optimized"
          >
            <Target className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              <AnimatedNumber
                value={kpis.winRate}
                duration={1000}
                formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              />
            </span>
            <span className="text-xl font-bold text-green-500">%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground truncate" title={`${kpis.geaccepteerdCount}/${kpis.geaccepteerdCount + kpis.afgewezenCount} gewonnen`}>
              {kpis.geaccepteerdCount}/{kpis.geaccepteerdCount + kpis.afgewezenCount} gewonnen
            </p>
            <Sparkline
              data={winRateTrend}
              width={60}
              height={24}
              color="rgb(34, 197, 94)"
              showArea
              className="opacity-70"
            />
          </div>
        </CardContent>
      </GlassKpiCard>

      {/* Gemiddelde Waarde */}
      <GlassKpiCard
        delay={0.1}
        gradient="from-blue-500/20 to-cyan-500/20"
        hoverGlow="group-hover:shadow-blue-500/20"
        prefersReducedMotion={prefersReducedMotion}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gem. Offerte Waarde
          </CardTitle>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.3 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-optimized"
          >
            <Euro className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
            <AnimatedNumber
              value={kpis.gemiddeldeWaarde}
              duration={1200}
              prefix="€"
              formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground truncate" title={`${kpis.totaalOffertes} offertes`}>
              {kpis.totaalOffertes} offertes
            </p>
            <Sparkline
              data={gemiddeldeWaardeTrend}
              width={60}
              height={24}
              color="rgb(59, 130, 246)"
              showArea
              className="opacity-70"
            />
          </div>
        </CardContent>
      </GlassKpiCard>

      {/* Totale Omzet */}
      <GlassKpiCard
        delay={0.2}
        gradient="from-amber-500/20 to-orange-500/20"
        hoverGlow="group-hover:shadow-amber-500/20"
        prefersReducedMotion={prefersReducedMotion}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Totale Omzet
          </CardTitle>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.4 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-optimized"
          >
            <TrendingUp className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            <AnimatedNumber
              value={kpis.totaleOmzet}
              duration={1400}
              prefix="€"
              formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground truncate" title="Geaccepteerd">
              Geaccepteerd
            </p>
            <Sparkline
              data={totaleOmzetTrend}
              width={60}
              height={24}
              color="rgb(245, 158, 11)"
              showArea
              className="opacity-70"
            />
          </div>
        </CardContent>
      </GlassKpiCard>

      {/* Aantal Offertes */}
      <GlassKpiCard
        delay={0.3}
        gradient="from-purple-500/20 to-violet-500/20"
        hoverGlow="group-hover:shadow-purple-500/20"
        prefersReducedMotion={prefersReducedMotion}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Aantal Offertes
          </CardTitle>
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.5 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 shadow-optimized"
          >
            <FileText className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-violet-500 bg-clip-text text-transparent">
            <AnimatedNumber
              value={kpis.totaalOffertes}
              duration={1000}
              formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground truncate" title="Deze periode">
              Deze periode
            </p>
            <Sparkline
              data={totaalOffertesTrend}
              width={60}
              height={24}
              color="rgb(168, 85, 247)"
              showArea
              className="opacity-70"
            />
          </div>
        </CardContent>
      </GlassKpiCard>
    </div>
  );
});
