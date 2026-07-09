/**
 * Canoniek rollenmodel (PRD §1.2) — client-side spiegel van convex/roles.ts.
 *
 * Mapping 7-rollenmodel → canonieke PRD-rollen:
 *   kantoor    = directie, projectleider (legacy: admin)
 *   voorman    = voorman
 *   medewerker = medewerker, onderaannemer_zzp, materiaalman
 *   klant      = klant (legacy: viewer)
 *
 * Bindende regel: alleen `kantoor` heeft de capability *versturen naar klant*.
 * Voor andere rollen bestaat de verstuurknop niet in de UI (niet gerenderd,
 * niet disabled) en weigert de API server-side.
 */

/** True als de rol tot `kantoor` behoort (directie of projectleider). */
export function isKantoorRol(role: string | null | undefined): boolean {
  return role === "directie" || role === "projectleider" || role === "admin";
}

/**
 * Capability-check (PRD §1.2): alleen kantoor mag naar de klant versturen.
 * Gebruik dit om verstuurknoppen conditioneel te renderen.
 */
export function kanNaarKlantVersturen(role: string | null | undefined): boolean {
  return isKantoorRol(role);
}
