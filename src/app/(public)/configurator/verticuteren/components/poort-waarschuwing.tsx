import { AlertTriangle, XCircle } from "lucide-react";

// Rood (blokkerend) en amber (toeslag) hebben geen design-token in dit project.
// Daarom expliciete donkere vlakken met lichte tekst, zodat de
// waarschuwing in dark mode als waarschuwing leesbaar blijft in plaats van als
// felle lichte balk.
export function PoortWaarschuwing({ breedte }: { breedte: string }) {
  const waarde = parseFloat(breedte);
  if (!breedte || isNaN(waarde) || waarde >= 80) return null;

  if (waarde < 60) {
    return (
      <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/30 rounded-lg text-sm">
        <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-destructive">
            Te smal voor onze machines
          </p>
          <p className="text-destructive mt-0.5">
            Bij een poortbreedte van minder dan 60 cm kunnen wij helaas niet
            werken met onze verticuteermachine. Neem contact met ons op voor een
            maatwerkoplossing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-status-herinnering border border-status-herinnering-border rounded-lg text-sm">
      <AlertTriangle className="h-5 w-5 text-status-herinnering-dot flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-status-herinnering-text">
          Let op: handmatig werk vereist
        </p>
        <p className="text-status-herinnering-text mt-0.5">
          Bij een poortbreedte van minder dan 80 cm kunnen niet al onze machines
          worden ingezet. Er is een toeslag van 25% van toepassing voor extra
          handmatig werk.
        </p>
      </div>
    </div>
  );
}
