"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { getUserFriendlyMessage, AuthenticationError, NotFoundError } from "@/lib/error-handling";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry with public context
    Sentry.captureException(error, {
      tags: {
        section: "public",
        isPublicPage: true,
      },
    });
  }, [error]);

  // Determine the type of error for specialized messaging
  const isNotFound = error instanceof NotFoundError ||
    error.message.toLowerCase().includes("niet gevonden") ||
    error.message.toLowerCase().includes("not found");

  const isAuthError = error instanceof AuthenticationError ||
    error.message.toLowerCase().includes("ingelogd") ||
    error.message.toLowerCase().includes("authentication");

  const userMessage = getUserFriendlyMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            {isNotFound
              ? "Offerte niet gevonden"
              : isAuthError
                ? "Toegang geweigerd"
                : "Er is iets misgegaan"}
          </CardTitle>
          <CardDescription className="text-base">
            {isNotFound
              ? "De offerte die u zoekt bestaat niet of is niet langer beschikbaar."
              : isAuthError
                ? "U heeft geen toegang tot deze pagina. Mogelijk is de link verlopen."
                : userMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show error details in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="font-medium text-destructive">
                {error.name}: {error.message}
              </div>
              {error.stack && (
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          {/* Error reference for support */}
          {error.digest && (
            <p className="text-center text-xs text-muted-foreground">
              Referentie: {error.digest}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Opnieuw proberen
            </Button>

            {!isNotFound && (
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Naar hoofdpagina
                </Link>
              </Button>
            )}
          </div>

          {/* Contact support message */}
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Blijft dit probleem zich voordoen?
            </p>
            <Button variant="link" size="sm" asChild className="h-auto p-0 mt-1">
              <a href="mailto:support@toptuinen.nl">
                <Mail className="mr-1 h-3 w-3" />
                Neem contact op
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
