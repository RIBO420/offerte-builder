import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/offerte/(.*)",
  "/configurator(.*)",
  "/monitoring",
  "/manifest.json",
]);

const isPortaalAuthRoute = createRouteMatcher([
  "/portaal/inloggen(.*)",
  "/portaal/registreren(.*)",
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
  await auth.protect();

  // Role-based routing is handled client-side by the portal layout
  // (which checks the user's role from Convex and redirects accordingly)
  // This keeps proxy.ts simple and avoids Clerk session claims configuration
  //
  // Portal routes are accessible to all authenticated users — the portal
  // layout's requireKlant() query will show an error if a non-klant user
  // tries to access it. Dashboard routes work for all authenticated users —
  // the sidebar filters items by role.
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
