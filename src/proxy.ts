import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/configurator(.*)",
  "/monitoring",
  "/manifest.json",
]);

const isPortaalRoute = createRouteMatcher([
  "/portaal(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes — no auth required. The single login lives at "/".
  // Klant account-linking (/portaal/koppelen) is a protected route so Clerk
  // redirects unauthenticated invitees to "/" and returns them after login.
  if (isPublicRoute(req)) {
    return;
  }

  // All other routes require authentication. Unauthenticated users are sent to
  // our own single login at "/" (not the Clerk-hosted account portal).
  const session = await auth.protect({
    unauthenticatedUrl: new URL("/", req.url).toString(),
  });

  // Read role from session claims (configured via Clerk session_token_template)
  const role = (session.sessionClaims?.metadata as { role?: string })?.role;

  // Portal routes — allow klant role and new users (no role yet, e.g. just registered)
  if (isPortaalRoute(req)) {
    if (role && role !== "klant") {
      // Users with explicit non-klant role (admin, medewerker) → redirect to dashboard
      return Response.redirect(new URL("/dashboard", req.url));
    }
    return;
  }

  // Dashboard/other authenticated routes — klant should go to portal
  if (role === "klant") {
    return Response.redirect(new URL("/portaal/overzicht", req.url));
  }

  // All other authenticated users (medewerkers, directie, etc.) → pass through
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
