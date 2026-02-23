import { Leaf, Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ConfiguratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50/60 via-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 shadow-sm">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Top Tuinen
            </h1>
            <p className="text-xs text-green-700 font-medium tracking-wide uppercase">
              Online Configurator
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 mt-16">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-green-600">
                  <Leaf className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900">Top Tuinen</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Uw specialist in tuinaanleg, gazonleggen en tuinonderhoud.
                Kwalitatief vakwerk met persoonlijke aandacht.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 mb-3">Contact</p>
              <a
                href="tel:+31000000000"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-700 transition-colors"
              >
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                +31 (0)00 000 0000
              </a>
              <a
                href="mailto:info@toptuinen.nl"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-700 transition-colors"
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
              className="flex items-center gap-1 hover:text-green-700 transition-colors"
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
