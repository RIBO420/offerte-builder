"use client";

import { useEffect, useState } from "react";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2, Trees, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

const TIMEOUT_SECONDS = 15;

export default function SSOCallbackPage() {
  const [elapsed, setElapsed] = useState(0);
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= TIMEOUT_SECONDS) {
          setShowTimeout(true);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    // Reload the page to retry the SSO callback
    window.location.reload();
  };

  if (showTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Inloggen duurt langer dan verwacht</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Het inlogproces duurt langer dan normaal. Dit kan komen door een trage verbinding of een probleem met de authenticatieserver.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Opnieuw proberen
              </Button>
              <div className="flex gap-2 w-full">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/sign-in">Terug naar inloggen</Link>
                </Button>
                <Button asChild variant="ghost" className="flex-1">
                  <Link href="/">Naar home</Link>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Als dit probleem aanhoudt, neem dan contact op met de beheerder.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trees className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Even geduld...</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Je wordt ingelogd...
          </p>
          {elapsed >= 5 && (
            <div className="w-full space-y-2">
              <Progress value={(elapsed / TIMEOUT_SECONDS) * 100} className="h-1" />
              <p className="text-xs text-muted-foreground text-center">
                Dit kan enkele seconden duren...
              </p>
            </div>
          )}
          <AuthenticateWithRedirectCallback
            signInFallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            signInForceRedirectUrl="/dashboard"
            signUpForceRedirectUrl="/dashboard"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Error boundary for SSO callback
export function SSOCallbackError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Inloggen mislukt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Er is iets misgegaan bij het inloggen. Dit kan gebeuren als de sessie is verlopen of als er een probleem is met de authenticatie.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Button asChild className="w-full">
              <Link href="/sign-in">
                <RefreshCw className="mr-2 h-4 w-4" />
                Opnieuw inloggen
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Naar home</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Als dit probleem aanhoudt, neem dan contact op met de beheerder.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
