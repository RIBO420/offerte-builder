import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Leaf, Search, ShieldCheck } from "lucide-react";

/**
 * WS9 — volwaardige indexpagina van de publieke configurator.
 * Verving de tijdelijke WS1-redirect naar /configurator/gazon (B5): wie de
 * kale URL krijgt of onthoudt, kiest hier zelf een dienst. Licht, gastvrij,
 * met echte foto's van Top Tuinen (hoofdsite) per dienst.
 */

const DIENSTEN = [
  {
    href: "/configurator/gazon",
    beeld: "/images/configurator/gazon.webp",
    alt: "Strak aangelegd gazon tussen buxushagen",
    titel: "Gazon aanleggen",
    tekst:
      "Graszoden, inzaaien of kunstgras — in 4 stappen naar een directe indicatieprijs.",
    duur: "±3 minuten",
  },
  {
    href: "/configurator/boomschors",
    beeld: "/images/configurator/boomschors.webp",
    alt: "Border met verse boomschors en vaste planten",
    titel: "Boomschors bestellen",
    tekst:
      "Bereken hoeveel kuub u nodig heeft en bestel direct — bezorgen of ophalen.",
    duur: "±2 minuten",
  },
  {
    href: "/configurator/verticuteren",
    beeld: "/images/configurator/verticuteren.webp",
    alt: "Siergrassen en groene borders in avondlicht",
    titel: "Verticuteren",
    tekst:
      "Mos en vilt uit het gazon, met bijzaaien en bemesting als opties. Direct een prijs.",
    duur: "±2 minuten",
  },
] as const;

export default function ConfiguratorIndexPage() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-10 sm:py-14">
      {/* Kop */}
      <div className="text-center mb-10 sm:mb-12">
        <p className="text-sm font-medium tracking-wide uppercase text-primary mb-3">
          Vrijblijvend en direct een prijsindicatie
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
          Waar kunnen we u mee helpen?
        </h2>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Kies een dienst, vertel ons over uw tuin en u ziet meteen wat het
          ongeveer kost. Daarna nemen wij persoonlijk contact met u op.
        </p>
      </div>

      {/* Dienstkaarten */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {DIENSTEN.map((dienst) => (
          <Link
            key={dienst.href}
            href={dienst.href}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={dienst.beeld}
                alt={dienst.alt}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {dienst.titel}
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed flex-1">
                {dienst.tekst}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {dienst.duur}
                </span>
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  Start
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Geruststelling */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <Leaf className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Vrijblijvend.</span>{" "}
            U ziet eerst de prijsindicatie; pas daarna vragen we uw gegevens.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Vakwerk.</span>{" "}
            Wij controleren alles ter plaatse voordat u een definitieve
            offerte ontvangt.
          </p>
        </div>
      </div>

      {/* Bestaande aanvraag */}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Al een aanvraag gedaan?{" "}
        <Link
          href="/configurator/status"
          className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80"
        >
          <Search className="h-3.5 w-3.5" />
          Volg uw aanvraag
        </Link>
      </p>
    </div>
  );
}
