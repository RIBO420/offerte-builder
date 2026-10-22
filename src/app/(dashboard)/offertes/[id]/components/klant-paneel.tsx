import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { SectiePaneel } from "@/components/ui/sectie-paneel";

interface KlantPaneelProps {
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
  klantId?: string;
}

/**
 * Compacte klantgegevens in de zijkolom (vervangt KlantDetailsCard). De naam
 * staat al als titel in de kop; hier alleen adres, mail en telefoon, plus de
 * weg naar het dossier. Zonder klant toont de pagina `KlantKoppeling`.
 */
export function KlantPaneel({ klant, klantId }: KlantPaneelProps) {
  const adres = [klant.adres, [klant.postcode, klant.plaats].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <SectiePaneel
      titel="Klant"
      kopbalk
      acties={
        klantId && (
          <Link
            href={`/klanten/${klantId}`}
            className="rounded px-1 text-[13px] text-primary transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Dossier →
          </Link>
        )
      }
    >
      <ul className="grid gap-1.5 px-4 py-3 text-[13px]">
        {adres && (
          <li className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Adres" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{adres}</span>
          </li>
        )}
        {klant.email && (
          <li className="flex min-w-0 items-start gap-2">
            <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="E-mail" />
            <a
              href={`mailto:${klant.email}`}
              className="min-w-0 truncate text-primary transition-colors hover:text-primary/80"
            >
              {klant.email}
            </a>
          </li>
        )}
        {klant.telefoon && (
          <li className="flex min-w-0 items-start gap-2">
            <Phone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Telefoon" />
            <a
              href={`tel:${klant.telefoon.replace(/\s+/g, "")}`}
              className="tabular-nums transition-colors hover:text-primary"
            >
              {klant.telefoon}
            </a>
          </li>
        )}
      </ul>
    </SectiePaneel>
  );
}
