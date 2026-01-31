import { NextResponse } from "next/server";

// Sentry tunnel route to avoid ad-blockers
// This proxies Sentry events from the client to Sentry's ingest endpoint

// Allowed Sentry project IDs for security validation
const SENTRY_PROJECT_IDS = ["4510797026951248"];

export async function POST(request: Request) {
  try {
    const envelope = await request.text();
    const pieces = envelope.split("\n");

    // Parse the envelope header to get the DSN
    const header = JSON.parse(pieces[0]);
    const dsn = new URL(header.dsn);

    // Validate that this is going to your Sentry project
    const projectId = dsn.pathname.replace("/", "");
    if (!SENTRY_PROJECT_IDS.includes(projectId)) {
      return NextResponse.json(
        { error: "Invalid Sentry project" },
        { status: 403 }
      );
    }

    // Use the host from the DSN to support different Sentry regions (EU, US, etc.)
    const sentryIngestUrl = `https://${dsn.host}/api/${projectId}/envelope/`;

    // Forward the envelope to Sentry
    const response = await fetch(sentryIngestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
      body: envelope,
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Sentry tunnel error:", error);
    return NextResponse.json(
      { error: "Failed to tunnel to Sentry" },
      { status: 500 }
    );
  }
}

// Also handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Return 405 for other methods with proper headers
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: {
        "Allow": "POST, OPTIONS"
      }
    }
  );
}
