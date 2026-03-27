"use client";

import { useMutation, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

function KoppelenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const { isAuthenticated } = useConvexAuth();
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsert);
  const linkKlantAccount = useMutation(api.users.linkKlantAccount);
  const [status, setStatus] = useState<"waiting" | "linking" | "success" | "error">("waiting");
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 10;

  useEffect(() => {
    if (!token || !isAuthenticated || !isClerkLoaded || !clerkUser) return;

    const attemptLink = async () => {
      setStatus("linking");
      try {
        // Step 1: Ensure user record exists in Convex
        await upsertUser({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || "",
          name: clerkUser.fullName || clerkUser.firstName || "Klant",
        });

        // Step 2: Link to klant record
        await linkKlantAccount({ invitationToken: token });

        setStatus("success");
        setTimeout(() => {
          router.replace("/portaal/overzicht");
        }, 1500);
      } catch (err: unknown) {
        const msg = (err as { data?: { message?: string }; message?: string })?.data?.message
          || (err as Error)?.message || "";
        // Auth not synced yet — retry
        if (msg.includes("ingelogd") && retryCount.current < maxRetries) {
          retryCount.current++;
          setTimeout(attemptLink, 1500);
        } else {
          setStatus("error");
          setError(msg || "Koppeling mislukt");
        }
      }
    };

    // Initial delay for Convex auth to sync with Clerk
    const timer = setTimeout(attemptLink, 2000);
    return () => clearTimeout(timer);
  }, [token, isAuthenticated, isClerkLoaded, clerkUser, upsertUser, linkKlantAccount, router]);

  if (!token) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-gray-200 shadow-lg">
        <XCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
          Ongeldige link
        </h2>
        <p className="text-sm text-gray-600">
          Deze koppelings-link is ongeldig. Neem contact op met het bedrijf.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center p-8 bg-white rounded-xl border border-gray-200 shadow-lg">
      {(status === "waiting" || status === "linking") && (
        <>
          <Loader2 className="h-10 w-10 text-[#4ADE80] animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
            Account koppelen...
          </h2>
          <p className="text-sm text-gray-600">
            Uw account wordt gekoppeld aan uw klantprofiel. Even geduld.
          </p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle className="h-10 w-10 text-[#4ADE80] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
            Account gekoppeld!
          </h2>
          <p className="text-sm text-gray-600">
            U wordt doorgestuurd naar uw portaal...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#1a2e1a] mb-2">
            Koppeling mislukt
          </h2>
          <p className="text-sm text-red-600">{error}</p>
        </>
      )}
    </div>
  );
}

export default function PortaalKoppelenPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto text-center p-8">
          <Loader2 className="h-10 w-10 text-[#4ADE80] animate-spin mx-auto" />
        </div>
      }
    >
      <KoppelenContent />
    </Suspense>
  );
}
