"use client";

/**
 * Foutgrens voor de portaal-registratieflow (/portaal/registreren en
 * /portaal/koppelen).
 *
 * Dit is letterlijk het eerste wat een uitgenodigde klant van ons ziet. Deze
 * routes hangen aan Clerk (invitation ticket) en aan users.linkKlantAccount;
 * gaat daar iets mis, dan viel de klant terug op de kale root-boundary zonder
 * uitleg en zonder weg terug. De "Opnieuw proberen"-knop is hier extra
 * belangrijk: de meeste fouten in deze flow zijn tijdelijk (Clerk-token nog
 * niet gesynchroniseerd) en verdwijnen bij een retry.
 *
 * De kaartstijl is gelijk aan die van koppelen/page.tsx; het volledige scherm
 * en de achtergrond komen al van (auth)/layout.tsx, dus die herhalen we niet.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortaalAuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        section: "portaal-auth",
      },
    });
  }, [error]);

  return (
    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-gray-200 shadow-lg">
      <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
        Aanmelden lukte niet
      </h2>
      <p className="text-sm text-gray-600">
        Er ging iets mis bij het activeren van uw portaalaccount. Probeer het
        opnieuw, of gebruik de uitnodigingslink uit uw e-mail nog een keer.
      </p>

      {/* Technische details alleen lokaal: een klant heeft niets aan een stacktrace. */}
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-gray-100 p-3 text-left text-xs whitespace-pre-wrap text-gray-600">
          {error.name}: {error.message}
        </pre>
      )}

      {error.digest && (
        <p className="mt-4 text-xs text-gray-400">Referentie: {error.digest}</p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset} className="flex-1">
          <RefreshCw className="mr-2 h-4 w-4" />
          Opnieuw proberen
        </Button>
        <Button variant="outline" asChild className="flex-1 border-gray-200">
          <Link href="/">
            <LogIn className="mr-2 h-4 w-4" />
            Naar inloggen
          </Link>
        </Button>
      </div>
    </div>
  );
}
