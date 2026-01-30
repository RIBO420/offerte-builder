// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: "https://620318e141a0ad1f6c07cb6024ffbed3@o4510668471730176.ingest.de.sentry.io/4510797026951248",

  // Environment and release for better filtering
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Enable logging for structured logs
  enableLogs: true,

  // Sample rate: 10% in production, 100% in development
  tracesSampleRate: isProduction ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Enable replay for session recordings - lower rates for production
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: isProduction ? 0.05 : 0.1,

  integrations: [
    Sentry.replayIntegration({
      // Additional replay configuration
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  // Filter out known non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors that are expected
    "Network request failed",
    "Failed to fetch",
    // User cancelled
    "AbortError",
  ],
});
