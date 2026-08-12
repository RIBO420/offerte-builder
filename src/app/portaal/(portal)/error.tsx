"use client";

/**
 * Foutgrens voor het klantenportaal.
 *
 * Zonder deze boundary schiet een fout in een portaalpagina door naar de
 * root-boundary: de klant verliest dan de portaalhuisstijl én de navigatie,
 * en ziet een kale technische pagina. Hier blijft de fout binnen <main>, dus
 * header en navigatie blijven staan en de klant kan gewoon doorklikken.
 *
 * De kleuren zijn bewust dezelfde hardcoded portaal-tokens als de rest van
 * /portaal (eigen PortaalThemeProvider, los van het dashboardthema) — mét
 * dark:-varianten, zoals de bestaande portaal-loading.tsx-bestanden.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortaalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        section: "portaal",
      },
    });
  }, [error]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#1a2e1a] dark:text-white">
            Er is iets misgegaan
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Deze pagina kon niet worden geladen. Probeer het opnieuw — blijft
            het misgaan, neem dan contact op met Top Tuinen.
          </p>
        </div>

        {/* Technische details alleen lokaal: een klant heeft niets aan een stacktrace. */}
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-gray-100 dark:bg-[#0a0f0a] p-3 text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-400">
            {error.name}: {error.message}
          </pre>
        )}

        {error.digest && (
          <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
            Referentie: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={reset} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            Opnieuw proberen
          </Button>
          <Button
            variant="outline"
            asChild
            className="flex-1 border-gray-200 dark:border-[#2a3e2a]"
          >
            <Link href="/portaal/overzicht">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Naar overzicht
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
