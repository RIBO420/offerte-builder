import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/configurator(.*)",
  "/monitoring",
  "/manifest.json",
]);

const isPortaalAuthRoute = createRouteMatcher([
  "/portaal/inloggen(.*)",
  "/portaal/registreren(.*)",
  "/portaal/koppelen(.*)",
]);

const isPortaalRoute = createRouteMatcher([
  "/portaal(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes and portal auth — no auth required
  if (isPublicRoute(req) || isPortaalAuthRoute(req)) {
    return;
  }

  // All other routes require authentication
  const session = await auth.protect();

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
