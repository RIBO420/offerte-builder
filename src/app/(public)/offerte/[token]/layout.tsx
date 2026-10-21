import type { Metadata } from "next";

// Klantzichtbaar: "Top Tuinen", niet "Top Tuinen OS" (naamregel CLAUDE.md)
export const metadata: Metadata = {
  title: "Offerte – Top Tuinen",
  robots: { index: false, follow: false },
};

export default function OfferteLinkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
