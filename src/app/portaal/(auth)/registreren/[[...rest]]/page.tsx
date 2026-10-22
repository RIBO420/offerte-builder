"use client";

import { SignUp, useAuth, useClerk } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";

function RegistrationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  const handleSignOut = useCallback(() => {
    signOut({ redirectUrl: `/portaal/registreren?token=${token}` });
  }, [signOut, token]);

  if (!token) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-card rounded-xl border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Ongeldige registratielink
        </h2>
        <p className="text-sm text-muted-foreground">
          U kunt alleen registreren via een uitnodiging van Top Tuinen.
          Neem contact op als u een uitnodiging verwacht.
        </p>
      </div>
    );
  }

  // If already signed in (e.g. as admin), offer to sign out first
  if (isSignedIn) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-card rounded-xl border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          U bent al ingelogd
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          U bent momenteel ingelogd met een ander account. Om een nieuw
          klantenportaal-account aan te maken, moet u eerst uitloggen.
        </p>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
        >
          Uitloggen en registreren
        </button>
      </div>
    );
  }

  return (
    <SignUp
      path="/portaal/registreren"
      routing="path"
      forceRedirectUrl={`/portaal/koppelen?token=${token}`}
      appearance={{
        elements: {
          formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
          card: "shadow-lg",
        },
      }}
    />
  );
}

export default function PortaalRegisterPage() {
  return (
    <Suspense>
      <RegistrationContent />
    </Suspense>
  );
}
