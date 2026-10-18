"use client";

import { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";
import { GoogleIcon } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import Image from "next/image";

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
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
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

  const bezig = isLoading || !isLoaded;

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,600px)]">
      {/* Merkvlak: in licht en donker hetzelfde avondgroen. Op mobiel een
          compacte band boven het formulier, op desktop de linkerhelft. */}
      <section className="relative isolate flex min-h-[248px] flex-col overflow-hidden bg-[oklch(0.24_0.05_152)] px-6 pb-8 pt-6 text-[oklch(0.98_0.01_145)] sm:px-10 lg:min-h-dvh lg:px-14 lg:pb-12 lg:pt-12">
        {/* Sfeerfoto (dezelfde als in de configurator) met een groen verloop
            erover: bovenaan donker genoeg voor de witte tekst. */}
        <Image
          src="/images/configurator/gazon.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="-z-20 object-cover object-[50%_70%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.20_0.05_152/0.92)_0%,oklch(0.22_0.05_152/0.72)_38%,oklch(0.24_0.05_152/0.25)_70%,oklch(0.20_0.05_152/0.55)_100%)] lg:bg-[linear-gradient(180deg,oklch(0.20_0.05_152/0.88)_0%,oklch(0.22_0.05_152/0.62)_42%,oklch(0.24_0.05_152/0.08)_72%,oklch(0.20_0.05_152/0.35)_100%)]"
        />
        <div className="relative z-10 flex items-center gap-3">
          <TopTuinenLogo variant="wit" size={36} className="size-8 lg:size-9" priority />
          <span className="font-display text-base font-semibold tracking-tight lg:text-lg">
            Top Tuinen OS
          </span>
        </div>

        <div className="relative z-10 mt-6 max-w-[520px] lg:mt-[min(16vh,128px)]">
          <p className="hidden text-[13px] font-medium uppercase tracking-[0.08em] text-[oklch(0.85_0.08_148)] lg:block">
            Hoveniers&shy;software
          </p>
          <p className="font-display text-2xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-3xl lg:mt-4 lg:text-[52px] lg:leading-[1.05] lg:tracking-[-0.02em]">
            Vakwerk in het groen, van offerte tot oplevering.
          </p>
          <p className="mt-5 hidden max-w-[440px] text-[17px] leading-relaxed text-[oklch(0.88_0.03_148)] text-pretty lg:block">
            Offertes, planning, uren en facturen van Top Tuinen op één plek. Voor
            kantoor, de ploeg buiten en onze klanten.
          </p>
        </div>

      </section>

      {/* Formulier */}
      <main className="relative flex flex-1 flex-col px-6 py-10 sm:px-10 lg:justify-center lg:px-16 xl:px-24">
        <div key={view} className={`mx-auto w-full max-w-[400px] lg:mx-0 ${REVEAL_KLASSE}`}>
          <h1 className="font-display text-[28px] font-semibold tracking-tight lg:text-[32px]">
            {view === "login" ? "Welkom terug" : "Nieuw wachtwoord instellen"}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground text-pretty">
            {view === "login" ? (
              "Log in om verder te gaan waar je gebleven was."
            ) : (
              <>
                We hebben een herstelcode gestuurd naar{" "}
                <span className="font-medium text-foreground">{email.trim()}</span>.
              </>
            )}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="text-pretty">{error}</span>
            </p>
          )}

          {view === "login" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-8 h-11 w-full text-[15px] sm:h-11"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || !isLoaded}
              >
                {isGoogleLoading ? (
                  <Loader2 className="size-[18px] animate-spin" />
                ) : (
                  <GoogleIcon className="size-[18px]" />
                )}
                Doorgaan met Google
              </Button>

              <div className="my-6 flex items-center gap-3.5 text-[13px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                of met je e-mailadres
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="grid gap-[18px]">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mailadres</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="naam@voorbeeld.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11 text-[15px] sm:h-11 md:text-[15px]"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="password">Wachtwoord</Label>
                    <button
                      type="button"
                      onClick={() => void handleWachtwoordVergeten()}
                      disabled={bezig}
                      className="rounded text-[13px] font-medium text-primary underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      Wachtwoord vergeten?
                    </button>
                  </div>
                  <WachtwoordVeld
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={setPassword}
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="mt-1.5 h-11 w-full text-[15px] font-semibold sm:h-11" disabled={bezig}>
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Bezig met inloggen…
                    </>
                  ) : (
                    "Inloggen"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleResetSubmit} className="mt-8 grid gap-[18px]">
              <div className="grid gap-2">
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
                  className="h-11 font-mono text-[15px] tracking-[0.2em] sm:h-11 md:text-[15px]"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reset-password">Nieuw wachtwoord</Label>
                <WachtwoordVeld
                  id="reset-password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={setResetPassword}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="mt-1.5 h-11 w-full text-[15px] font-semibold sm:h-11" disabled={bezig}>
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Bezig met instellen…
                  </>
                ) : (
                  "Wachtwoord instellen"
                )}
              </Button>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
                <button
                  type="button"
                  onClick={terugNaarLogin}
                  className="inline-flex items-center gap-1.5 rounded font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Terug naar inloggen
                </button>
                <button
                  type="button"
                  onClick={() => void handleWachtwoordVergeten()}
                  disabled={bezig}
                  className="rounded font-medium text-primary underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  Code opnieuw sturen
                </button>
              </div>
            </form>
          )}

          {/* Klanten komen binnen via een Clerk-uitnodiging, niet via dit
              formulier; zonder deze regel stranden ze hier met een wachtwoord
              dat ze nooit hebben gehad (onboard item 7). */}
          <p className="mt-7 text-[13px] text-muted-foreground text-pretty">
            Uitnodiging ontvangen? Gebruik de link uit de e-mail om je account te
            activeren.
          </p>
        </div>

        <p className="mt-10 text-xs text-muted-foreground/80 lg:absolute lg:bottom-8 lg:left-16 lg:mt-0 xl:left-24">
          © Top Tuinen
        </p>
      </main>
    </div>
  );
}

/** Wachtwoordinvoer met tonen/verbergen; het oog staat binnen het veld. */
function WachtwoordVeld({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (waarde: string) => void;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [zichtbaar, setZichtbaar] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={zichtbaar ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        className="h-11 pe-12 text-[15px] sm:h-11 md:text-[15px]"
      />
      <button
        type="button"
        onClick={() => setZichtbaar((z) => !z)}
        aria-label={zichtbaar ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
        aria-pressed={zichtbaar}
        className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {zichtbaar ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}
