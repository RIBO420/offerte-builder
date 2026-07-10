/**
 * Centrale mail-/push-sandbox-guard (fase 0).
 *
 * Extern versturen (Resend e-mail, Clerk-invitations, Expo push) gebeurt
 * ALLEEN als de env-var EMAIL_VERZENDEN_ACTIEF exact "true" is op de
 * deployment (Convex env) of server (Next.js env).
 *
 * Fail-closed: variabele afwezig, leeg, of iets anders dan "true"
 * (incl. "TRUE", "1", "yes") = NIET versturen. In dat geval wordt de
 * verzendpoging gelogd met status SANDBOX_EMAIL_STATUS en wordt de
 * externe API-call overgeslagen.
 *
 * Dit bestand is bewust dependency-vrij zodat zowel Convex-functies als
 * de Next.js API-routes en unit-tests het kunnen importeren.
 */

/** Status waarmee onderdrukte verzendpogingen worden gelogd. */
export const SANDBOX_EMAIL_STATUS = "onderdrukt (sandbox)" as const;

/** Uitleg die in het error-/reden-veld van logs wordt gezet. */
export const SANDBOX_EMAIL_REDEN =
  "EMAIL_VERZENDEN_ACTIEF staat niet op 'true' — verzending onderdrukt (sandbox)";

/**
 * Mag er daadwerkelijk extern verstuurd worden (e-mail én push)?
 * Alleen `true` bij de exacte string "true".
 */
export function isEmailVerzendenActief(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.EMAIL_VERZENDEN_ACTIEF === "true";
}
