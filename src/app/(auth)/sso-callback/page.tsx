"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2, Trees } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <AuthenticateWithRedirectCallback />
        </CardContent>
      </Card>
    </div>
  );
}
