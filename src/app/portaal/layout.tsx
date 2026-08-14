import type { Metadata } from "next";

/**
 * Laag boven het klantportaal die alleen de titel overschrijft.
 *
 * De root-layout zet "Top Tuinen OS" — de interne productnaam. Een klant hoort
 * die niet te zien; voor hem heet het gewoon Top Tuinen. Zonder deze laag erft
 * elk portaalscherm de root-titel, ook in de browsertab en in een gedeelde link.
 *
 * Waarom hier en niet in `(portal)/layout.tsx`: die is een client component en
 * mag daarom geen `metadata` exporteren. Deze server-layout ligt erboven en
 * dekt zowel `(auth)` als `(portal)` af.
 */
export const metadata: Metadata = {
  title: "Top Tuinen",
  openGraph: { title: "Top Tuinen" },
  twitter: { title: "Top Tuinen" },
};

export default function PortaalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
