import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { nlNL } from "@clerk/localizations";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LiveRegionProvider } from "@/components/ui/live-region";
import { SkipLink } from "@/components/ui/skip-link";
import { ErrorBoundary } from "@/components/error-boundary";
import { ChunkReloadHandler } from "@/components/chunk-reload-handler";
import { MotionProvider } from "@/components/providers/motion-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Mono is een niche-font (kentekens, codes, sneltoetsen) — niet preloaden (O12).
  preload: false,
});

// Display-serif voor paginakoppen en heldcijfers ("Vakwerk in het groen").
// Alleen beschikbaar als `font-display` (via --font-fraunces → --font-display in
// globals.css); breed toepassen gebeurt in WS3/WS6/WS10. Geist blijft het werkpaard.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  // Nog nergens toegepast; de browser downloadt het font pas zodra een
  // `font-display`-element rendert — preload zou nu alleen bytes kosten.
  preload: false,
});

export const metadata: Metadata = {
  // Productnaam van het interne systeem: browsertitel en PWA heten "Top Tuinen OS".
  // openGraph/twitter hieronder houden bewust "Top Tuinen" — een gedeelde link komt
  // bij de klant terecht en die hoort de naam van ons interne systeem niet te zien.
  title: "Top Tuinen OS",
  description:
    "Bedrijfssoftware voor hoveniers: leads, klanten, offertes, projecten, planning, uren en facturen",
  keywords: ["hovenier", "offerte", "tuinaanleg", "tuinonderhoud", "projectmanagement"],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Top Tuinen OS",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Top Tuinen",
    description: "Hovenier voor tuinaanleg, tuinrenovatie en tuinonderhoud",
    type: "website",
    locale: "nl_NL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Tuinen",
    description: "Hovenier voor tuinaanleg, tuinrenovatie en tuinonderhoud",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // telemetry uit: clerk-telemetry.com staat niet in onze CSP (en hoort daar
    // ook niet), dus elke pageview leverde twee rode console-fouten op.
    <ClerkProvider localization={nlNL} signInUrl="/" telemetry={{ disabled: true }}>
      <html lang="nl" data-scroll-behavior="smooth" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} font-sans antialiased`}
        >
          <SkipLink />
          <ChunkReloadHandler />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              <ErrorBoundary>
                <MotionProvider>
                  <LiveRegionProvider>
                    <main id="main-content">
                      {children}
                    </main>
                    <Toaster position="bottom-right" richColors />
                  </LiveRegionProvider>
                </MotionProvider>
              </ErrorBoundary>
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
