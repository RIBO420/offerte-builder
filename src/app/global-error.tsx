"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center bg-background">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Kritieke fout</h1>
            <p className="text-muted-foreground max-w-md">
              Er is een ernstige fout opgetreden in de applicatie. Onze
              excuses voor het ongemak.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground">
                Fout ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Probeer opnieuw
            </Button>
            <Button asChild>
              <a href="/">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </a>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
