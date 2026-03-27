"use client";

import { m } from "framer-motion";
import { Doc } from "../../../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions, fadeInUp } from "@/lib/motion-config";
import { formatCurrency } from "./types";

export function InvoicePreviewCard({
  offerte,
  nacalculatie,
  project,
  onGenerate,
  isGenerating,
}: {
  offerte: Doc<"offertes"> | null;
  nacalculatie: Doc<"nacalculaties"> | null;
  project: Doc<"projecten">;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <m.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={prefersReducedMotion ? { duration: 0 } : transitions.entrance}
    >
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
        <CardHeader className="text-center pb-4">
          <m.div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
            animate={prefersReducedMotion ? {} : { y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <FileText className="h-8 w-8 text-primary" />
          </m.div>
          <CardTitle className="text-xl">Factuur Voorvertoning</CardTitle>
          <CardDescription>
            Bekijk de gegevens voordat je de factuur genereert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mini Invoice Preview */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            {/* Header simulation */}
            <div className="flex justify-between items-start mb-4 pb-4 border-b">
              <div>
                <p className="text-xs text-muted-foreground">FACTUUR VOOR</p>
                {offerte && (
                  <>
                    <p className="font-semibold">{offerte.klant.naam}</p>
                    <p className="text-sm text-muted-foreground">{offerte.klant.adres}</p>
                    <p className="text-sm text-muted-foreground">
                      {offerte.klant.postcode} {offerte.klant.plaats}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">PROJECT</p>
                <p className="font-semibold">{project.naam}</p>
              </div>
            </div>

            {/* Amount summary */}
            {offerte && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotaal</span>
                  <span>{formatCurrency(offerte.totalen.totaalExBtw)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    BTW ({offerte.totalen.btw > 0 ? "21%" : "0%"})
                  </span>
                  <span>{formatCurrency(offerte.totalen.btw)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Totaal</span>
                  <span className="text-primary">
                    {formatCurrency(offerte.totalen.totaalInclBtw)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Nacalculatie warning if applicable */}
          {nacalculatie && Math.abs(nacalculatie.afwijkingPercentage) > 10 && (
            <m.div
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
            >
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Afwijking in uren: {nacalculatie.afwijkingPercentage > 0 ? "+" : ""}
                  {nacalculatie.afwijkingPercentage.toFixed(1)}%
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Overweeg correctieregels toe te voegen aan de factuur.
                </p>
              </div>
            </m.div>
          )}

          {/* Generate button */}
          <div className="pt-4">
            <Button
              size="lg"
              className="w-full gap-2 h-14 text-lg"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Factuur wordt gegenereerd...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Genereer Factuur
                  <ChevronRight className="h-5 w-5 ml-auto" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </m.div>
  );
}
