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
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
          Ongeldige registratielink
        </h2>
        <p className="text-sm text-gray-600">
          U kunt alleen registreren via een uitnodiging van Top Tuinen.
          Neem contact op als u een uitnodiging verwacht.
        </p>
      </div>
    );
  }

  // If already signed in (e.g. as admin), offer to sign out first
  if (isSignedIn) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
          U bent al ingelogd
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          U bent momenteel ingelogd met een ander account. Om een nieuw
          klantenportaal-account aan te maken, moet u eerst uitloggen.
        </p>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-[#4ADE80] hover:bg-[#22c55e] text-black font-medium rounded-lg transition-colors"
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
          formButtonPrimary: "bg-[#4ADE80] hover:bg-[#22c55e] text-black",
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
