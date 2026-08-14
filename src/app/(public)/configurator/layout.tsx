import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";

import "./configurator.css";

/**
 * De configurator is publiek en klantgericht: die tab hoort "Top Tuinen" te
 * heten, niet "Top Tuinen OS". Zonder deze export erft hij de root-titel, en
 * dan staat de interne productnaam in de browsertab van een bezoeker en in
 * elke gedeelde link.
 */
export const metadata: Metadata = {
  title: "Top Tuinen",
};

export default function ConfiguratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // WS9: de klantkant is altijd licht — .cfg-licht pint het lichte
    // "Loof & Leem"-palet, ook wanneer <html> de .dark-klasse draagt.
    <div className="cfg-licht cfg-veldpatroon min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {/* Groene drager onder het witte merkteken (wit-op-licht is onzichtbaar). */}
          <Link
            href="/configurator"
            className="flex items-center gap-3 group"
            aria-label="Naar het overzicht van onze diensten"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
              <TopTuinenLogo variant="wit" size={28} className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                Top Tuinen
              </h1>
              <p className="text-xs text-primary font-medium tracking-wide uppercase">
                Online Configurator
              </p>
            </div>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/90 mt-16">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary">
                  <TopTuinenLogo variant="wit" size={20} className="h-5 w-5" />
                </div>
                <span className="font-semibold text-foreground">Top Tuinen</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Uw specialist in tuinaanleg, gazonleggen en tuinonderhoud.
                Kwalitatief vakwerk met persoonlijke aandacht.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground mb-3">Contact</p>
              {/* Placeholder bewust laten staan — echt nummer volgt van de eigenaar (WS1 B8). */}
              <a
                href="tel:+31000000000"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                +31 (0)00 000 0000
              </a>
              <a
                href="mailto:info@toptuinen.nl"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                info@toptuinen.nl
              </a>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                Nederland
              </div>
            </div>
          </div>

          <Separator className="mb-4" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} Top Tuinen. Alle rechten voorbehouden.
            </p>
            <a
              href="https://www.toptuinen.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              Bezoek onze hoofdsite
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
