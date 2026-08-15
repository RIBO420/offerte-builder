"use client";

import { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";
import { m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";
import { GoogleIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LaadIndicator } from "@/components/ui/laad-indicator";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Wachtwoord-herstel via Clerks reset-flow, op dezelfde route: een aparte
  // pagina zou een tweede publieke ingang naast de proxy-gate betekenen.
  // "login" → "reset" zodra de herstelcode is verstuurd.
  const [view, setView] = useState<"login" | "reset">("login");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  // Route signed-in users to their home: klanten → klantenportaal, staff → dashboard.
  // We read the role from Convex (set immediately on account linking) instead of the
  // Clerk session claim, which can lag right after sign-up and would otherwise drop
  // a klant on the staff dashboard.
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  const currentUser = useQuery(
    api.users.current,
    convexAuthenticated ? {} : "skip"
  );
  useEffect(() => {
    if (!isSignedIn || !convexAuthenticated) return;
    if (currentUser === undefined) return; // role still loading
    router.replace(
      currentUser?.role === "klant" ? "/portaal/overzicht" : "/dashboard"
    );
  }, [isSignedIn, convexAuthenticated, currentUser, router]);

  // Don't render the sign-in form if already signed in
  if (isSignedIn) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <LaadIndicator formaat="pagina" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Destination is handled by the role-aware effect once the session activates.
      } else {
        setError("Er is iets misgegaan. Probeer het opnieuw.");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(
        clerkError.errors?.[0]?.message || "Ongeldige inloggegevens"
      );
    } finally {
      setIsLoading(false);
    }
  };

  /** Stap 1: herstelcode laten mailen. Vereist alleen een ingevuld e-mailadres. */
  const handleWachtwoordVergeten = async () => {
    if (!isLoaded) return;
    if (!email.trim()) {
      setError("Vul eerst je e-mailadres in; daar sturen we de herstelcode naartoe.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email.trim(),
      });
      setView("reset");
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(
        clerkError.errors?.[0]?.message ||
          "Herstelcode versturen mislukt. Controleer het e-mailadres of neem contact op met kantoor."
      );
    } finally {
      setIsLoading(false);
    }
  };

  /** Stap 2: code + nieuw wachtwoord; bij succes logt Clerk meteen in. */
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode.trim(),
        password: resetPassword,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        // Bestemming regelt de rol-bewuste effect hierboven.
      } else {
        setError("Er is iets misgegaan. Probeer het opnieuw.");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(
        clerkError.errors?.[0]?.message ||
          "Code klopt niet of is verlopen. Vraag zo nodig een nieuwe aan."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const terugNaarLogin = () => {
    setView("login");
    setResetCode("");
    setResetPassword("");
    setError("");
  };

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;

    setIsGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || "Google login mislukt");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-20 dark:opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(16, 185, 129, 0.15) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-green-500/5 blur-3xl" />

      {/* Glow effect behind card */}
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />

      <m.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center">
            <m.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-700 shadow-lg shadow-emerald-500/25"
            >
              {/* De kaart is licht in light mode, dus het witte merkteken houdt
                  een groene drager. Vlak groen i.p.v. het oude emerald-verloop:
                  dezelfde tint als de sidebar en de configurator, en wit haalt
                  er 4,95:1 op — het verloop bleef onder 3:1 hangen. */}
              <TopTuinenLogo variant="wit" size={32} className="h-8 w-8" priority />
            </m.div>
            <CardTitle className="text-2xl">
              {view === "login" ? "Welkom terug" : "Wachtwoord opnieuw instellen"}
            </CardTitle>
            <CardDescription>
              {view === "login"
                ? "Log in bij Top Tuinen OS"
                : `We hebben een herstelcode gestuurd naar ${email.trim()}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <m.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
              >
                {error}
              </m.div>
            )}

            {view === "login" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || !isLoaded}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="mr-2 h-4 w-4" />
                  )}
                  Doorgaan met Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Of met e-mail
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mailadres</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="naam@voorbeeld.nl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Wachtwoord</Label>
                      <button
                        type="button"
                        onClick={() => void handleWachtwoordVergeten()}
                        disabled={isLoading || !isLoaded}
                        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      >
                        Wachtwoord vergeten?
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-green-700"
                    disabled={isLoading || !isLoaded}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Bezig met inloggen...
                      </>
                    ) : (
                      "Inloggen"
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Herstelcode</Label>
                  <Input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Code uit de e-mail"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-password">Nieuw wachtwoord</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-green-700"
                  disabled={isLoading || !isLoaded}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Bezig met instellen...
                    </>
                  ) : (
                    "Wachtwoord instellen"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={terugNaarLogin}
                  className="mx-auto block text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Terug naar inloggen
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Klanten komen binnen via een Clerk-uitnodiging, niet via dit
            formulier; zonder deze regel stranden ze hier met een wachtwoord
            dat ze nooit hebben gehad (onboard item 7). */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Uitnodiging ontvangen? Gebruik de link uit de e-mail om je account te
          activeren.
        </p>
      </m.div>
    </div>
  );
}
