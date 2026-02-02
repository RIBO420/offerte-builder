import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { nlNL } from "@clerk/localizations";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { LiveRegionProvider } from "@/components/ui/live-region";
import { SkipLink } from "@/components/ui/skip-link";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Offerte Builder | Top Tuinen",
  description:
    "Scope-gedreven offerte systeem voor hoveniersbedrijven. Aanleg- en onderhoudsoffertes waarbij niets vergeten kan worden.",
  keywords: ["offerte", "hovenier", "tuinaanleg", "tuinonderhoud", "calculator"],
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-152.png", sizes: "152x152", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Offerte Builder",
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
    title: "Offerte Builder | Top Tuinen",
    description:
      "Scope-gedreven offerte systeem voor hoveniersbedrijven. Aanleg- en onderhoudsoffertes waarbij niets vergeten kan worden.",
    type: "website",
    locale: "nl_NL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Offerte Builder | Top Tuinen",
    description:
      "Scope-gedreven offerte systeem voor hoveniersbedrijven. Aanleg- en onderhoudsoffertes waarbij niets vergeten kan worden.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={nlNL}>
      <html lang="nl" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        >
          <SkipLink />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              <ErrorBoundary>
                <LiveRegionProvider>
                  <main id="main-content">
                    {children}
                  </main>
                  <Toaster position="bottom-right" richColors />
                </LiveRegionProvider>
              </ErrorBoundary>
            </ConvexClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
