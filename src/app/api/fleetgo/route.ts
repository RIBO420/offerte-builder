/**
 * FleetGo API Proxy Route
 *
 * This server-side route proxies requests to the FleetGo API,
 * keeping the API key secure on the server.
 *
 * SECURITY: The FLEETGO_API_KEY is only available server-side.
 * Never expose it to the client.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fleetgoRateLimiter,
  getRequestIdentifier,
  createRateLimitResponse,
} from "@/lib/rate-limiter";

// Server-only API key (never exposed to client)
const FLEETGO_API_KEY = process.env.FLEETGO_API_KEY;
const FLEETGO_BASE_URL = process.env.FLEETGO_API_URL || "https://api.fleetgo.com/v1";

// Allowed endpoints to prevent abuse
const ALLOWED_ENDPOINTS = [
  "/vehicles",
  "/vehicles/locations",
] as const;

// Allowed endpoint patterns (with dynamic segments)
const ALLOWED_ENDPOINT_PATTERNS = [
  /^\/vehicles\/[^/]+$/, // /vehicles/:id
  /^\/vehicles\/license-plate\/[^/]+$/, // /vehicles/license-plate/:plate
  /^\/vehicles\/[^/]+\/location$/, // /vehicles/:id/location
  /^\/vehicles\/[^/]+\/mileage$/, // /vehicles/:id/mileage
];

function isEndpointAllowed(endpoint: string): boolean {
  // Check exact matches
  if (ALLOWED_ENDPOINTS.includes(endpoint as typeof ALLOWED_ENDPOINTS[number])) {
    return true;
  }

  // Check pattern matches
  return ALLOWED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(endpoint));
}

interface FleetGoProxyRequest {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getRequestIdentifier(request);
    const rateLimitInfo = fleetgoRateLimiter.check(identifier);

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(fleetgoRateLimiter, rateLimitInfo);
    }

    // Check if API key is configured
    if (!FLEETGO_API_KEY) {
      // Return mock data indicator when no API key is configured
      return NextResponse.json(
        { useMockData: true, message: "FleetGo API key not configured" },
        {
          status: 200,
          headers: fleetgoRateLimiter.getHeaders(rateLimitInfo),
        }
      );
    }

    // Parse request body
    const body: FleetGoProxyRequest = await request.json();
    const { endpoint, method = "GET", body: requestBody } = body;

    // Validate endpoint
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "Endpoint is verplicht" },
        { status: 400 }
      );
    }

    // Security: Only allow specific endpoints
    if (!isEndpointAllowed(endpoint)) {
      return NextResponse.json(
        { error: "Endpoint niet toegestaan" },
        { status: 403 }
      );
    }

    // Build the FleetGo API URL
    const url = `${FLEETGO_BASE_URL}${endpoint}`;

    // Make the request to FleetGo API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${FLEETGO_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: requestBody ? JSON.stringify(requestBody) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        return NextResponse.json(
          {
            error: errorData.error?.message || `FleetGo API error: ${response.status}`,
            code: errorData.error?.code || "API_ERROR",
            statusCode: response.status,
          },
          {
            status: response.status,
            headers: fleetgoRateLimiter.getHeaders(rateLimitInfo),
          }
        );
      }

      // Parse and return the response
      const data = await response.json();

      return NextResponse.json(data, {
        headers: fleetgoRateLimiter.getHeaders(rateLimitInfo),
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timeout", code: "TIMEOUT" },
          {
            status: 504,
            headers: fleetgoRateLimiter.getHeaders(rateLimitInfo),
          }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("[FleetGo API Proxy] Error:", error);

    return NextResponse.json(
      { error: "Interne serverfout bij FleetGo API", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Also support GET for simple requests (returns API status)
export async function GET(request: NextRequest) {
  const identifier = getRequestIdentifier(request);
  const rateLimitInfo = fleetgoRateLimiter.check(identifier);

  if (!rateLimitInfo.allowed) {
    return createRateLimitResponse(fleetgoRateLimiter, rateLimitInfo);
  }

  return NextResponse.json(
    {
      status: "ok",
      configured: !!FLEETGO_API_KEY,
      useMockData: !FLEETGO_API_KEY,
    },
    {
      headers: fleetgoRateLimiter.getHeaders(rateLimitInfo),
    }
  );
}
