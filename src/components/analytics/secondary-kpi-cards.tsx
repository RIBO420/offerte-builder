"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Clock, Zap, Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecondaryKpiCardsProps {
  kpis: {
    avgCycleTime?: number;
    avgResponseTime?: number;
    repeatCustomerPercentage?: number;
    repeatCustomerCount?: number;
    totalCustomers?: number;
    overallConversion?: number;
  };
}

// Glassmorphic animated card wrapper (matching the main KPI cards style)
function GlassKpiCard({
  children,
  delay = 0,
  gradient = "from-emerald-500/10 to-green-500/10",
  hoverGlow = "group-hover:shadow-emerald-500/20"
}: {
  children: React.ReactNode;
  delay?: number;
  gradient?: string;
  hoverGlow?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative"
    >
      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500`}
      />

      <Card className={`relative overflow-hidden bg-card/80 backdrop-blur-sm border-dashed border-white/10 dark:border-white/5 transition-all duration-300 ${hoverGlow} group-hover:shadow-lg group-hover:border-white/20`}>
        {/* Glass shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Decorative corner gradient */}
        <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${gradient} opacity-20 blur-2xl pointer-events-none`} />

        {children}
      </Card>
    </motion.div>
  );
}

export function SecondaryKpiCards({ kpis }: SecondaryKpiCardsProps) {
  const cycleTime = kpis.avgCycleTime ?? 0;
  const responseTime = kpis.avgResponseTime ?? 0;
  const repeatPercentage = kpis.repeatCustomerPercentage ?? 0;
  const overallConversion = kpis.overallConversion ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Deal Cycle Time */}
      <GlassKpiCard
        delay={0.4}
        gradient="from-purple-500/20 to-fuchsia-500/20"
        hoverGlow="group-hover:shadow-purple-500/20"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gem. Doorlooptijd
          </CardTitle>
          <motion.div
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-lg shadow-purple-500/30"
          >
            <Clock className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
              <AnimatedNumber
                value={cycleTime}
                duration={1000}
                formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              />
            </span>
            <span className="text-sm font-medium text-muted-foreground">dagen</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Van concept tot geaccepteerd
          </p>
        </CardContent>
      </GlassKpiCard>

      {/* Response Time */}
      <GlassKpiCard
        delay={0.5}
        gradient="from-orange-500/20 to-red-500/20"
        hoverGlow="group-hover:shadow-orange-500/20"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Reactietijd Klant
          </CardTitle>
          <motion.div
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shadow-lg",
              responseTime <= 7
                ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30"
                : responseTime <= 14
                  ? "bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/30"
                  : "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30"
            )}
          >
            <Zap className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-3xl font-bold bg-clip-text text-transparent",
              responseTime <= 7
                ? "bg-gradient-to-r from-green-500 to-emerald-500"
                : responseTime <= 14
                  ? "bg-gradient-to-r from-orange-500 to-amber-500"
                  : "bg-gradient-to-r from-red-500 to-rose-500"
            )}>
              <AnimatedNumber
                value={responseTime}
                duration={1000}
                formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              />
            </span>
            <span className="text-sm font-medium text-muted-foreground">dagen</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Van verzonden tot antwoord
          </p>
        </CardContent>
      </GlassKpiCard>

      {/* Repeat Customers */}
      <GlassKpiCard
        delay={0.6}
        gradient="from-teal-500/20 to-cyan-500/20"
        hoverGlow="group-hover:shadow-teal-500/20"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Terugkerende Klanten
          </CardTitle>
          <motion.div
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/30"
          >
            <Repeat className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
              <AnimatedNumber
                value={repeatPercentage}
                duration={1000}
                formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              />
            </span>
            <span className="text-xl font-bold text-teal-500">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {kpis.repeatCustomerCount ?? 0} van {kpis.totalCustomers ?? 0} klanten
          </p>
        </CardContent>
      </GlassKpiCard>

      {/* Overall Conversion */}
      <GlassKpiCard
        delay={0.7}
        gradient="from-indigo-500/20 to-violet-500/20"
        hoverGlow="group-hover:shadow-indigo-500/20"
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Totale Conversie
          </CardTitle>
          <motion.div
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shadow-lg",
              overallConversion >= 30
                ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30"
                : overallConversion >= 15
                  ? "bg-gradient-to-br from-amber-500 to-yellow-600 shadow-amber-500/30"
                  : "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30"
            )}
          >
            <Users className="h-4 w-4 text-white" />
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-3xl font-bold bg-clip-text text-transparent",
              overallConversion >= 30
                ? "bg-gradient-to-r from-green-500 to-emerald-500"
                : overallConversion >= 15
                  ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                  : "bg-gradient-to-r from-red-500 to-rose-500"
            )}>
              <AnimatedNumber
                value={overallConversion}
                duration={1000}
                formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              />
            </span>
            <span className={cn(
              "text-xl font-bold",
              overallConversion >= 30
                ? "text-green-500"
                : overallConversion >= 15
                  ? "text-amber-500"
                  : "text-red-500"
            )}>%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Van concept tot gewonnen
          </p>
        </CardContent>
      </GlassKpiCard>
    </div>
  );
}
