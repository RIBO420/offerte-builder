import { AlertTriangle, XCircle } from "lucide-react";

// Rood (blokkerend) en amber (toeslag) hebben geen design-token in dit project.
// Daarom expliciete dark:-varianten: donkere vlakken met lichte tekst, zodat de
// waarschuwing in dark mode als waarschuwing leesbaar blijft in plaats van als
// felle lichte balk.
export function PoortWaarschuwing({ breedte }: { breedte: string }) {
  const waarde = parseFloat(breedte);
  if (!breedte || isNaN(waarde) || waarde >= 80) return null;

  if (waarde < 60) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg text-sm">
        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800 dark:text-red-200">
            Te smal voor onze machines
          </p>
          <p className="text-red-700 dark:text-red-300 mt-0.5">
            Bij een poortbreedte van minder dan 60 cm kunnen wij helaas niet
            werken met onze verticuteermachine. Neem contact met ons op voor een
            maatwerkoplossing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg text-sm">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-amber-800 dark:text-amber-200">
          Let op: handmatig werk vereist
        </p>
        <p className="text-amber-700 dark:text-amber-300 mt-0.5">
          Bij een poortbreedte van minder dan 80 cm kunnen niet al onze machines
          worden ingezet. Er is een toeslag van 25% van toepassing voor extra
          handmatig werk.
        </p>
      </div>
    </div>
  );
}
