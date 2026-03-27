"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RegistrationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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

  return (
    <SignUp
      path="/portaal/registreren"
      routing="path"
      afterSignUpUrl={`/portaal/overzicht?invitation=${token}`}
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
