"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, Calculator, Shovel, Hammer, Leaf, Sparkles, Fence, Droplets, Trees, CheckCircle2 } from "lucide-react";
import Link from "next/link";

// Scope definities met kleuren en iconen
const scopes = [
  {
    id: "grondwerk",
    label: "Grondwerk",
    description: "Ontgraven en afvoeren",
    icon: Shovel,
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-700",
    textColor: "text-amber-700 dark:text-amber-300",
    basePrice: 35, // € per m²
    min: 10,
    max: 500,
    default: 100,
    unit: "m²",
  },
  {
    id: "bestrating",
    label: "Bestrating",
    description: "Tegels/klinkers leggen",
    icon: Hammer,
    color: "from-slate-500 to-slate-600",
    bgColor: "bg-slate-50 dark:bg-slate-800/50",
    borderColor: "border-slate-200 dark:border-slate-700",
    textColor: "text-slate-700 dark:text-slate-300",
    basePrice: 85,
    min: 10,
    max: 300,
    default: 50,
    unit: "m²",
  },
  {
    id: "borders",
    label: "Borders",
    description: "Beplanting aanleggen",
    icon: Leaf,
    color: "from-emerald-500 to-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    borderColor: "border-emerald-200 dark:border-emerald-700",
    textColor: "text-emerald-700 dark:text-emerald-300",
    basePrice: 65,
    min: 5,
    max: 200,
    default: 30,
    unit: "m²",
  },
  {
    id: "gras",
    label: "Gras & Gazon",
    description: "Zaaien of graszoden",
    icon: Sparkles,
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/30",
    borderColor: "border-green-200 dark:border-green-700",
    textColor: "text-green-700 dark:text-green-300",
    basePrice: 25,
    min: 10,
    max: 1000,
    default: 150,
    unit: "m²",
  },
  {
    id: "houtwerk",
    label: "Houtwerk",
    description: "Schutting/vlonder",
    icon: Fence,
    color: "from-amber-600 to-amber-700",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    borderColor: "border-amber-300 dark:border-amber-700",
    textColor: "text-amber-800 dark:text-amber-300",
    basePrice: 120,
    min: 5,
    max: 100,
    default: 20,
    unit: "m",
  },
  {
    id: "water",
    label: "Water & Elektra",
    description: "Verlichting & drainage",
    icon: Droplets,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
    borderColor: "border-blue-200 dark:border-blue-700",
    textColor: "text-blue-700 dark:text-blue-300",
    basePrice: 45,
    min: 1,
    max: 50,
    default: 10,
    unit: "punten",
  },
  {
    id: "onderhoud",
    label: "Onderhoud",
    description: "Periodiek onderhoud",
    icon: Trees,
    color: "from-green-600 to-green-700",
    bgColor: "bg-green-50 dark:bg-green-900/30",
    borderColor: "border-green-300 dark:border-green-700",
    textColor: "text-green-800 dark:text-green-300",
    basePrice: 15,
    min: 50,
    max: 5000,
    default: 500,
    unit: "m²/jaar",
  },
] as const;

type ScopeId = (typeof scopes)[number]["id"];

// Prijs formatter
const formatPrice = (price: number) => {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
};

// Berekening logic (vereenvoudigd voor demo)
const calculateEstimate = (scopeId: ScopeId, amount: number) => {
  const scope = scopes.find((s) => s.id === scopeId);
  if (!scope) return { materialen: 0, arbeid: 0, totaal: 0 };

  // Vereenvoudigde berekening
  const base = amount * scope.basePrice;
  const materialen = base * 0.6; // 60% materialen
  const arbeid = base * 0.4; // 40% arbeid
  const totaal = materialen + arbeid;

  return {
    materialen: Math.round(materialen),
    arbeid: Math.round(arbeid),
    totaal: Math.round(totaal),
  };
};

export function DemoCalculator() {
  const [selectedScope, setSelectedScope] = useState<ScopeId>("grondwerk");
  const [amount, setAmount] = useState(100);
  const [showResult, setShowResult] = useState(false);

  const currentScope = useMemo(
    () => scopes.find((s) => s.id === selectedScope)!,
    [selectedScope]
  );

  const estimate = useMemo(
    () => calculateEstimate(selectedScope, amount),
    [selectedScope, amount]
  );

  const handleScopeChange = (scopeId: ScopeId) => {
    setSelectedScope(scopeId);
    const newScope = scopes.find((s) => s.id === scopeId)!;
    setAmount(newScope.default);
    setShowResult(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="overflow-hidden border-2 shadow-2xl shadow-emerald-500/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calculator className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">Probeer het zelf</h3>
          </div>
          <p className="text-emerald-100 text-sm">
            Bereken binnen 10 seconden een indicatie voor je project
          </p>
        </div>

        <CardContent className="p-6">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Scope Selection & Input */}
            <div className="space-y-6">
              {/* Scope Selector */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-3 block">
                  Kies je scope
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                  {scopes.map((scope) => {
                    const Icon = scope.icon;
                    const isSelected = selectedScope === scope.id;

                    return (
                      <motion.button
                        key={scope.id}
                        onClick={() => handleScopeChange(scope.id)}
                        className={`relative flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? `${scope.bgColor} ${scope.borderColor} ${scope.textColor} border-2`
                            : "bg-muted/30 border-border hover:bg-muted/50"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            isSelected ? scope.textColor : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            isSelected ? scope.textColor : "text-foreground"
                          }`}
                        >
                          {scope.label}
                        </span>
                        {isSelected && (
                          <motion.div
                            layoutId="selectedScope"
                            className={`absolute inset-0 border-2 rounded-lg ${scope.borderColor}`}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Hoeveelheid
                  </label>
                  <motion.span
                    key={amount}
                    initial={{ scale: 1.2, color: "#10b981" }}
                    animate={{ scale: 1, color: "inherit" }}
                    className="text-lg font-bold tabular-nums"
                  >
                    {amount} {currentScope.unit}
                  </motion.span>
                </div>
                <Slider
                  value={[amount]}
                  onValueChange={(value) => {
                    setAmount(value[0]);
                    setShowResult(true);
                  }}
                  min={currentScope.min}
                  max={currentScope.max}
                  step={currentScope.id === "water" ? 1 : 5}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {currentScope.min} {currentScope.unit}
                  </span>
                  <span>
                    {currentScope.max} {currentScope.unit}
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  currentScope.min,
                  Math.round((currentScope.min + currentScope.max) / 4),
                  Math.round((currentScope.min + currentScope.max) / 2),
                  Math.round((currentScope.min + currentScope.max) * 0.75),
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setAmount(preset);
                      setShowResult(true);
                    }}
                    className="px-3 py-1 text-xs rounded-full bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Result */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {!showResult ? (
                  <motion.div
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/30 rounded-xl border-2 border-dashed"
                  >
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentScope.color} flex items-center justify-center mb-4 opacity-50`}
                    >
                      <currentScope.icon className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Pas de hoeveelheid aan om een
                      <br />
                      indicatie te zien
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    {/* Total Price */}
                    <div
                      className={`p-6 rounded-xl bg-gradient-to-br ${currentScope.color} text-white`}
                    >
                      <p className="text-white/80 text-sm mb-1">Geschatte investering</p>
                      <motion.p
                        key={estimate.totaal}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-4xl font-bold tabular-nums"
                      >
                        {formatPrice(estimate.totaal)}
                      </motion.p>
                      <p className="text-white/70 text-xs mt-2">
                        Inclusief materialen en arbeid
                      </p>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-sm">Materialen</span>
                        </div>
                        <motion.span
                          key={estimate.materialen}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="font-semibold tabular-nums"
                        >
                          {formatPrice(estimate.materialen)}
                        </motion.span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          <span className="text-sm">Arbeid</span>
                        </div>
                        <motion.span
                          key={estimate.arbeid}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="font-semibold tabular-nums"
                        >
                          {formatPrice(estimate.arbeid)}
                        </motion.span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>Inclusief normuren berekening</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>Automatische correctiefactoren</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>Vergeet geen enkele post</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <Button
                      asChild
                      className={`w-full h-12 mt-4 bg-gradient-to-r ${currentScope.color} hover:opacity-90 text-white font-semibold`}
                    >
                      <Link href="/sign-up">
                        Maak volledige offerte
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      Gratis proefperiode van 14 dagen
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
