# Security Audit

**Date:** 2026-03-26
**Auditor:** Claude Opus 4.6 (automated)
**Scope:** Full-stack security review of Top Tuinen Offerte Calculator (Next.js 16 + Convex + Clerk)

## Summary

- Critical: 3
- Warning: 8
- Info: 5

---

## Findings

### [CRITICAL] Privilege Escalation via `makeCurrentUserAdmin` with `force: true`

**Location:** `convex/users.ts:1019-1064`
**Issue:** The `makeCurrentUserAdmin` mutation allows ANY authenticated user to grant themselves admin privileges by passing `{ force: true }`. While the default behavior checks if admins already exist, the `force` flag bypasses this check entirely. This mutation is publicly callable by any authenticated Convex client.
**Risk:** Any authenticated user (including those with `medewerker` or `viewer` roles) can escalate to admin, gaining full access to all company data, financial records, customer PII, and the ability to modify/delete any data.
**Recommendation:** Remove the `force` parameter entirely, or restrict this mutation to only work via the Convex CLI/dashboard (use `internalMutation` instead of `mutation`). If a bootstrap mechanism is needed, gate it behind a server-side-only secret or make it an internal action.

---

### [CRITICAL] Broken Admin Check in Mobile API Functions (Auth Bypass)

**Location:** `convex/mobile.ts:1052, 1103, 1144, 1174`
**Issue:** Four admin-only functions (`adminListAllUsers`, `adminListMedewerkers`, `adminUpdateUserRole`, `adminLinkUserToMedewerker`) use a flawed authorization check:
```typescript
if (user.role && user.role !== "admin") {
  throw new Error("Alleen beheerders...");
}
```
When `user.role` is `undefined` or `null` (e.g., a newly created user whose role has not been set), the condition evaluates to `false` (because `undefined` is falsy), so the check passes. This grants admin-level access to users without an assigned role.
**Risk:** Any authenticated user without an explicitly set role can list all users, list all medewerkers, change any user's role, and link/unlink user-medewerker associations. This is a direct privilege escalation vulnerability.
**Recommendation:** Replace all four instances with:
```typescript
if (user.role !== "admin") {
  throw new Error("Alleen beheerders...");
}
```
Or better, use the centralized `requireAdmin(ctx)` helper from `convex/roles.ts` which already handles this correctly.

---

### [CRITICAL] Email API Route Missing Authentication

**Location:** `src/app/api/email/route.ts:37`
**Issue:** The `/api/email` POST endpoint has rate limiting but NO authentication check. Unlike `/api/transcribe` and `/api/summarize` (which both call `auth()` from Clerk), this endpoint accepts requests from anyone. It sends real emails via Resend to arbitrary recipients with arbitrary content.
**Risk:** An attacker can abuse this endpoint to:
1. Send spam/phishing emails that appear to come from the Top Tuinen domain (noreply@toptuinen.nl)
2. Exhaust the Resend email quota
3. Damage the company's email sender reputation and deliverability
4. Impersonate the business in email communications
**Recommendation:** Add Clerk authentication at the top of the handler, identical to the pattern used in `/api/transcribe`:
```typescript
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
}
```

---

### [WARNING] Mollie Payment API Route Missing Authentication

**Location:** `src/app/api/mollie/route.ts:55`
**Issue:** The `/api/mollie` POST endpoint creates real Mollie payment sessions without any authentication. Any unauthenticated request can trigger payment creation.
**Risk:** An attacker could create fraudulent payment sessions, potentially with manipulated amounts, descriptions, or redirect URLs. While the actual money flow is controlled by Mollie, this could be used for social engineering attacks (sending victims to legitimate-looking payment pages) or to exhaust API quotas.
**Recommendation:** Add Clerk authentication. Only authenticated users (admin/medewerker) should be able to create payment links.

---

### [WARNING] FleetGo API Proxy Missing Authentication

**Location:** `src/app/api/fleetgo/route.ts:52`
**Issue:** The FleetGo API proxy has rate limiting and endpoint allowlisting but no user authentication. Any visitor can make requests to the FleetGo API through this proxy.
**Risk:** Unauthenticated users can query vehicle location data, mileage, and other fleet information. Although the endpoint allowlist limits the attack surface, fleet tracking data is sensitive operational information.
**Recommendation:** Add Clerk authentication to both the POST and GET handlers.

---

### [WARNING] Weather API Route Missing Authentication

**Location:** `src/app/api/weather/route.ts:38`
**Issue:** The `/api/weather` GET endpoint has no authentication and accepts arbitrary latitude/longitude coordinates.
**Risk:** Low severity, but the endpoint could be abused to exhaust the OpenWeatherMap API quota by sending many requests with different coordinates (bypassing the in-memory cache).
**Recommendation:** Add Clerk authentication, or at minimum add rate limiting per IP.

---

### [WARNING] Public Offerte Messages Missing Rate Limiting

**Location:** `convex/offerteMessages.ts:85-109`
**Issue:** The `sendFromCustomer` mutation (public, no auth) validates the share token but has NO rate limiting. Compare this to `publicOffertes.ts` where every public mutation calls `checkPublicOfferteRateLimit()`.
**Risk:** An attacker with a valid share token could spam unlimited messages, filling up the database and potentially overwhelming the business user's notification system.
**Recommendation:** Add `checkPublicOfferteRateLimit(args.token)` at the start of the `sendFromCustomer` handler, matching the pattern in `publicOffertes.ts`. Also add rate limiting to `markCustomerMessagesAsRead`.

---

### [WARNING] Public Mutations Accept Unbounded String Input

**Location:** `convex/publicOffertes.ts:175-296`, `convex/offerteMessages.ts:85-109`, `convex/configuratorAanvragen.ts:196-281`
**Issue:** Several public-facing mutations accept `v.string()` arguments (comment, message, klantNaam, klantAdres, etc.) without length limits. Convex `v.string()` does not enforce a maximum length.
**Risk:** An attacker could submit extremely large strings (megabytes) in comments, messages, or customer data fields, consuming database storage and potentially causing UI rendering issues. The `configuratorAanvragen.create` mutation uses `v.any()` for `specificaties`, allowing arbitrarily complex payloads.
**Recommendation:** Add explicit length validation in the handler for all public string inputs (e.g., `if (args.comment && args.comment.length > 5000) throw new Error(...)`) and replace `v.any()` with a proper typed validator for `specificaties`.

---

### [WARNING] `v.any()` Validators Bypass Type Safety

**Location:** `convex/configuratorAanvragen.ts:209`, `convex/offertes.ts:531,610`, `convex/betalingen.ts:26,138`, `convex/voertuigen.ts:196,251,374`, `convex/standaardtuinen.ts:334,357`, plus several schema fields
**Issue:** Multiple mutations and schema fields use `v.any()` as a validator. This disables Convex's input validation for those fields, allowing any JSON structure to be stored.
**Risk:** Attackers could inject unexpected data structures that may cause runtime errors in other parts of the application, or store excessively large payloads. The `configuratorAanvragen.create` mutation is public (no auth) and accepts `specificaties: v.any()`.
**Recommendation:** Replace `v.any()` with properly typed validators (like the existing `aanlegScopeDataValidator` and `onderhoudScopeDataValidator` patterns). For `specificaties`, create a union of type-specific validators matching each configurator type.

---

### [WARNING] In-Memory Rate Limiting Not Effective in Serverless

**Location:** `convex/security.ts:20-23`, `src/app/api/fleetgo/route.ts` (via `@/lib/rate-limiter`), `src/app/api/weather/route.ts:12`
**Issue:** Rate limiting uses in-memory `Map` objects. In serverless environments (Vercel, Convex), each function invocation may run in a different instance. The in-memory state is not shared across instances and is lost on cold starts.
**Risk:** Rate limits can be trivially bypassed by making requests that hit different serverless instances. The Convex rate limiter (`security.ts:20`) explicitly acknowledges this in a comment. The weather API cache also uses in-memory storage.
**Recommendation:** The email route already has an optional Upstash Redis fallback, which is the right approach. Extend this pattern to the FleetGo proxy, Convex public functions, and weather API. Alternatively, Convex supports database-backed rate limiting via the `@convex-dev/rate-limiter` library.

---

### [WARNING] Calendly Webhook Signature Verification is Optional

**Location:** `src/app/api/calendly/route.ts:81-97`
**Issue:** The Calendly webhook handler only verifies the signature if `CALENDLY_WEBHOOK_SIGNING_KEY` is configured. Without the key, the handler processes ALL incoming POST requests without any authentication:
```typescript
if (SIGNING_KEY) { // Only verifies if key exists
  if (!signatureHeader) { ... }
  if (!verifyWebhookSignature(...)) { ... }
}
// Otherwise proceeds without verification
```
**Risk:** If `CALENDLY_WEBHOOK_SIGNING_KEY` is not set in production, anyone can POST crafted webhook events. Currently the handler only logs data, but if/when the TODO items are implemented (saving to Convex), this becomes a data injection vector.
**Recommendation:** Reject all webhook requests when the signing key is not configured (matching the behavior of the Mollie webhook handler which returns false when the key is missing).

---

### [WARNING] SSRF Risk in Email Attachment URL

**Location:** `src/app/api/email/route.ts:275-279`
**Issue:** The email route accepts a `voorwaardenPdfUrl` parameter and passes it directly to Resend as an attachment path. Resend will fetch this URL server-side to attach the file.
```typescript
if (voorwaardenPdfUrl && typeof voorwaardenPdfUrl === "string") {
  attachments.push({ filename: ..., path: voorwaardenPdfUrl });
}
```
Combined with the missing authentication on this endpoint, this allows server-side request forgery (SSRF).
**Risk:** An attacker could provide internal network URLs (e.g., `http://169.254.169.254/latest/meta-data/` for cloud metadata, or internal service URLs) to probe the server's network environment. The response content would be attached to an email sent to an attacker-controlled address.
**Recommendation:** Validate that `voorwaardenPdfUrl` matches expected patterns (e.g., must start with the Convex storage URL or the app's own domain). Block private IP ranges and cloud metadata URLs. This becomes lower priority once authentication is added to the endpoint.

---

### [INFO] Production Secrets in `.env.local` (Not Committed)

**Location:** `.env.local:9`, `mobile/.env.local:9`
**Issue:** The `.env.local` files contain real Clerk API keys (`sk_test_...`, `pk_test_...`). However, these are development/test keys (prefixed with `_test_`), and the files are correctly excluded from git via the `.env*` pattern in `.gitignore`. The mobile `.env.local` also contains a commented-out production publishable key.
**Risk:** Low risk since files are not tracked. However, the production Clerk key visible in the comment (`pk_live_Y2xlcmsudG9wdHVpbmVuLmFwcCQ`) in `mobile/.env.local` could be noted.
**Recommendation:** Remove commented-out production keys from env files. Ensure CI/CD injects secrets at deploy time rather than relying on local files.

---

### [INFO] No `dangerouslySetInnerHTML` or XSS Vectors Found

**Location:** Full `src/` directory scan
**Issue:** No instances of `dangerouslySetInnerHTML`, `eval()`, `document.write()`, or `innerHTML` were found in the React codebase.
**Risk:** None. React's default JSX escaping provides XSS protection.
**Recommendation:** No action needed. Continue to avoid these patterns.

---

### [INFO] CSRF Protection Adequate

**Location:** `src/proxy.ts`, Convex backend, API routes
**Issue:** Clerk middleware (`clerkMiddleware`) provides session-based CSRF protection for authenticated routes. Convex mutations are called via WebSocket with Clerk tokens, which are not vulnerable to traditional CSRF. Public API routes use rate limiting as a partial mitigation.
**Risk:** Low. The primary CSRF risk is on the unauthenticated API routes (`/api/email`, `/api/mollie`), but these are API-only (no cookies/sessions used), so traditional CSRF does not apply. The bigger issue is the missing auth on those routes (covered above).
**Recommendation:** No additional CSRF protection needed beyond fixing the auth issues.

---

### [INFO] No SQL Injection Vectors

**Location:** `convex/*.ts`
**Issue:** Convex uses a proprietary query builder with parameterized queries (`.withIndex()`, `.filter()`, `.eq()`). There is no raw SQL or string concatenation in queries.
**Risk:** None. Convex's query language is not susceptible to injection attacks.
**Recommendation:** No action needed.

---

### [INFO] File Upload Security is Well-Implemented

**Location:** `convex/security.ts:128-248`, `convex/chat.ts:847-938`
**Issue:** File uploads have proper validation including: MIME type allowlisting, dangerous extension blocklisting, file size limits (10MB general, 500KB signatures), SVG detection, and base64 validation for signatures. Chat file uploads re-validate after upload.
**Risk:** Low. The implementation is thorough.
**Recommendation:** Consider adding server-side MIME type detection (magic bytes) in addition to the client-reported MIME type, since MIME types can be spoofed. The `fotoStorage.getUrl` and `getUrls` queries expose file URLs without authentication - consider adding auth checks if the files contain sensitive data.

---

## Priority Action Items

1. **IMMEDIATE:** Fix the email API route - add Clerk authentication (`/api/email/route.ts`)
2. **IMMEDIATE:** Fix the mobile admin auth bypass - replace `user.role && user.role !== "admin"` with `requireAdmin(ctx)` in all 4 functions (`convex/mobile.ts`)
3. **IMMEDIATE:** Remove or internalize `makeCurrentUserAdmin` with `force` option (`convex/users.ts`)
4. **HIGH:** Add auth to `/api/mollie/route.ts` and `/api/fleetgo/route.ts`
5. **HIGH:** Add rate limiting to `offerteMessages.sendFromCustomer`
6. **MEDIUM:** Add input length validation to all public mutations
7. **MEDIUM:** Replace `v.any()` validators with typed alternatives
8. **MEDIUM:** Make Calendly webhook reject requests when signing key is missing
9. **LOW:** Migrate in-memory rate limiting to Redis/database-backed solution
10. **LOW:** Add URL validation for email attachment URLs
