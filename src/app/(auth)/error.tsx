"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, LogIn, Home } from "lucide-react";
import Link from "next/link";
import { getUserFriendlyMessage, AuthenticationError, AuthorizationError } from "@/lib/error-handling";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to Sentry with auth context
    Sentry.captureException(error, {
      tags: {
        section: "auth",
        isAuthPage: true,
      },
    });
  }, [error]);

  // Determine if this is a session-related error that requires re-login
  const isSessionError =
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error.message.toLowerCase().includes("session") ||
    error.message.toLowerCase().includes("token") ||
    error.message.toLowerCase().includes("expired") ||
    error.message.toLowerCase().includes("verlopen") ||
    error.message.toLowerCase().includes("ingelogd");

  const userMessage = getUserFriendlyMessage(error);

  // For session errors, redirect to sign-in after showing the message
  const handleSignIn = () => {
    router.push("/sign-in");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-xl">
            {isSessionError
              ? "Sessie verlopen"
              : "Aanmeldfout"}
          </CardTitle>
          <CardDescription className="text-base">
            {isSessionError
              ? "Uw sessie is verlopen of ongeldig. Log opnieuw in om door te gaan."
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
            {isSessionError ? (
              <>
                <Button onClick={handleSignIn} className="w-full">
                  <LogIn className="mr-2 h-4 w-4" />
                  Opnieuw inloggen
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Naar hoofdpagina
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button onClick={reset} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Opnieuw proberen
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/sign-in">
                    <LogIn className="mr-2 h-4 w-4" />
                    Naar inlogpagina
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Help text */}
          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Problemen met inloggen? Controleer of uw browser cookies accepteert
              en of JavaScript is ingeschakeld.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
