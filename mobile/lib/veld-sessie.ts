/** De server verifieert het JWT. Deze extra controle voorkomt dat een token-
 * wissel een bewaarde opdracht per ongeluk onder een andere identiteit verstuurt. */
export function controleerVeldToken(token: string, userId: string, orgId: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) throw new Error('Geen tokeninhoud');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as Record<string, unknown>;
    if (claims.sub !== userId || claims.org_id !== orgId) throw new Error('Andere identiteit');
  } catch {
    throw new Error('Je sessie is gewijzigd. Open de dag opnieuw om te synchroniseren.');
  }
}
