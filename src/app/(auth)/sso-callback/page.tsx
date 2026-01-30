"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2, Trees, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SSOCallbackPage() {
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
            Er is iets misgegaan bij het inloggen. Probeer het opnieuw.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/sign-in">Opnieuw inloggen</Link>
            </Button>
            <Button asChild>
              <Link href="/">Naar home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
