import { GeenToegang } from "./geen-toegang";

/**
 * Vast adres voor de no-access-staat. `OrgGate` toont dezelfde component al
 * in plaats van de dashboard-shell; deze route bestaat zodat een beheerder of
 * een mail ergens naartoe kan linken.
 */
export default function GeenToegangPage() {
  return <GeenToegang />;
}
