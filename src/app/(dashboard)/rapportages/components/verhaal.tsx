"use client";

/**
 * /rapportages — één scrollverhaal met vier vraagsecties.
 *
 * De acht tabs zijn weg. Reden: ze ordenden op datasoort (omzet, klanten,
 * marges) terwijl een ondernemer in vragen denkt, en `AnimatePresence
 * mode="wait"` liet de pagina bij elke wissel leeg knipperen én naar boven
 * springen. Eén pagina, één data-load, sticky ankernavigatie.
 *
 * Alles op deze pagina komt uit `api.rapportage.getRapportage`. Er is geen
 * tweede bron en geen enkele hardcoded waarde — dat is R1, en het is meteen de
 * reden dat dashboard en rapportage nooit meer een ander bedrag kunnen tonen.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { m } from "framer-motion";
import { FileDown } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-accessibility";
import {
  isPeriodePreset,
  periodePresetLabel,
  type PeriodePreset,
} from "@/lib/rapportage-labels";
import { AnkerNavigatie } from "./anker-navigatie";
import { AntwoordBlok, Doorklik, SECTIES } from "./antwoord-blok";
import { PeriodeKiezer, type AangepastBereik } from "./periode-kiezer";
import { RapportageSkelet } from "./rapportage-skelet";
import { SectieBesteWerk } from "./sectie-beste-werk";
import { SectieGeldLigt } from "./sectie-geld-ligt";
import { SectieHoeLoopt } from "./sectie-hoe-loopt";
import { SectiePipeline } from "./sectie-pipeline";
import type { Rapportage } from "./types";

const STANDAARD_PRESET: PeriodePreset = "dit-jaar";

/**
 * Oude deeplinks blijven werken. `/rapportages?tab=marges` was een tab die niet
 * meer bestaat; de inhoud ervan zit nu in een van de vier vragen. In plaats van
 * de parameter te negeren (en de bezoeker bovenaan te dumpen) springt de pagina
 * naar het anker waar die inhoud naartoe verhuisd is.
 */
const OUDE_TABS: Record<string, (typeof SECTIES)[number]["id"]> = {
  overzicht: "hoe-loopt",
  omzet: "hoe-loopt",
  pipeline: "pipeline",
  klanten: "beste-werk",
  marges: "beste-werk",
  calculatie: "geld-ligt",
  medewerkers: "beste-werk",
  projecten: "geld-ligt",
};

export function RapportageVerhaal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();

  const presetUitUrl = searchParams.get("periode");
  const preset: PeriodePreset = isPeriodePreset(presetUitUrl)
    ? presetUitUrl
    : STANDAARD_PRESET;

  const van = Number(searchParams.get("van")) || undefined;
  const tot = Number(searchParams.get("tot")) || undefined;
  // Gememoïseerd omdat dit object rechtstreeks in de query-args belandt: een
  // nieuwe objectidentiteit per render zou elke render een nieuwe subscription
  // opzetten.
  const aangepast: AangepastBereik | undefined = useMemo(
    () => (preset === "aangepast" && van && tot ? { van, tot } : undefined),
    [preset, van, tot]
  );

  // ── Oude ?tab=-links netjes opvangen ──────────────────────────────────
  const oudeTab = searchParams.get("tab");
  useEffect(() => {
    if (!oudeTab) return;
    const anker = OUDE_TABS[oudeTab] ?? SECTIES[0].id;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}#${anker}`, {
      scroll: false,
    });
    // Het anker bestaat pas als de secties gerenderd zijn; één frame wachten is
    // genoeg en voorkomt een sprong naar de bovenkant.
    requestAnimationFrame(() => {
      document.getElementById(anker)?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [oudeTab, pathname, router, searchParams, reducedMotion]);

  const kiesPeriode = useCallback(
    (nieuw: PeriodePreset, bereik?: AangepastBereik) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      if (nieuw === STANDAARD_PRESET) {
        params.delete("periode");
      } else {
        params.set("periode", nieuw);
      }
      if (nieuw === "aangepast" && bereik) {
        params.set("van", String(bereik.van));
        params.set("tot", String(bereik.tot));
      } else {
        params.delete("van");
        params.delete("tot");
      }
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  const data = useQuery(api.rapportage.getRapportage, {
    preset,
    startDate: aangepast?.van,
    endDate: aangepast?.tot,
  });

  // Cross-fade bij periodewissel (R6): het vorige rapport blijft staan en
  // vervaagt licht terwijl het nieuwe binnenkomt. Zonder dit valt de pagina bij
  // elke wissel terug op skeletons — dat is de flikkering die de oude pagina
  // bij elke tabklik had.
  //
  // Bewust een render-fase state-aanpassing en géén effect: een `setState` in
  // een effect zou een extra render-ronde ná de paint kosten, en dan zíé je het
  // oude rapport eerst verdwijnen. Dit is het patroon "state aanpassen als props
  // veranderen" uit de React-docs — React draait de render direct opnieuw,
  // zonder tussentijdse paint.
  const [getoond, setGetoond] = useState<Rapportage | undefined>(undefined);
  if (data !== undefined && data !== getoond) {
    setGetoond(data);
  }
  const laadt = data === undefined;

  const afdrukHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("periode", preset);
    if (aangepast) {
      params.set("van", String(aangepast.van));
      params.set("tot", String(aangepast.tot));
    }
    return `/rapportages/afdruk?${params.toString()}`;
  }, [preset, aangepast]);

  const acties = (
    <>
      <PeriodeKiezer
        preset={preset}
        periodeLabel={getoond?.periode.label}
        aangepast={aangepast}
        onKies={kiesPeriode}
      />
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-8 gap-2 font-normal"
      >
        <Link href={afdrukHref} target="_blank" rel="noopener">
          <FileDown className="size-3.5" />
          Download maandrapport
        </Link>
      </Button>
    </>
  );

  return (
    <>
      <div className="border-b border-border/70 px-4 pt-6 pb-5 md:px-8 md:pt-9">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Rapport ·{" "}
            {getoond?.periode.label ?? periodePresetLabel(preset)}
          </p>
          <h1 className="mt-1.5 font-display text-[32px] leading-tight font-semibold tracking-tight md:text-[40px]">
            Hoe staat het bedrijf ervoor?
          </h1>
          <p className="mt-2 max-w-[62ch] text-[15px] text-pretty text-muted-foreground">
            Vier vragen, vier antwoorden — met de cijfers waar ze op rusten en
            een doorklik naar de offertes, facturen en klanten die ze maken.
          </p>
        </div>
      </div>

      <AnkerNavigatie
        acties={acties}
        sectiesKlaar={getoond !== undefined && getoond.meta.heeftData}
      />

      <div className="px-4 pb-16 md:px-8">
        {getoond === undefined ? (
          <div className="pt-8">
            <RapportageSkelet />
          </div>
        ) : (
          <m.div
            className="mx-auto max-w-5xl pt-8"
            animate={{ opacity: laadt ? 0.45 : 1 }}
            transition={{
              duration: reducedMotion ? 0 : 0.28,
              ease: [0.23, 1, 0.32, 1],
            }}
            aria-busy={laadt}
          >
            {!getoond.meta.heeftData ? (
              <GeenData periodeLabel={getoond.periode.label} />
            ) : (
              <>
                <AntwoordBlok
                  id="hoe-loopt"
                  vraag={SECTIES[0].vraag}
                  reikwijdte={getoond.periode.label}
                  index={0}
                >
                  <SectieHoeLoopt
                    hoeLoopt={getoond.hoeLoopt}
                    periode={getoond.periode}
                  />
                </AntwoordBlok>

                <AntwoordBlok
                  id="pipeline"
                  vraag={SECTIES[1].vraag}
                  reikwijdte="Open werk — los van de gekozen periode"
                  index={1}
                >
                  <SectiePipeline
                    pipeline={getoond.pipeline}
                    periode={getoond.periode}
                  />
                </AntwoordBlok>

                <AntwoordBlok
                  id="geld-ligt"
                  vraag={SECTIES[2].vraag}
                  reikwijdte="Openstaand geld nu · calculatie over de periode"
                  index={2}
                >
                  <SectieGeldLigt
                    geldLigt={getoond.geldLigt}
                    periode={getoond.periode}
                    preset={preset}
                    startDate={aangepast?.van}
                    endDate={aangepast?.tot}
                  />
                </AntwoordBlok>

                <AntwoordBlok
                  id="beste-werk"
                  vraag={SECTIES[3].vraag}
                  reikwijdte={getoond.periode.label}
                  index={3}
                >
                  <SectieBesteWerk
                    besteWerk={getoond.besteWerk}
                    periode={getoond.periode}
                  />
                </AntwoordBlok>
              </>
            )}
          </m.div>
        )}
      </div>
    </>
  );
}

/**
 * Eerlijke lege staat (R1): niet "geen data beschikbaar" met een gloeiend
 * icoon, maar wat er ontbreekt en wanneer het verschijnt.
 */
function GeenData({ periodeLabel }: { periodeLabel: string }) {
  return (
    <div className="max-w-[58ch] py-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        Over {periodeLabel} valt nog niets te rapporteren
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-pretty text-muted-foreground">
        Er is in deze periode geen offerte getekend, geen factuur verstuurd en
        er staat geen werk open. Het rapport vult zich vanzelf: zodra een
        offerte op <em>geaccepteerd</em> staat verschijnt de omzet, zodra een
        factuur de deur uit is verschijnt de facturatie, en zodra een project is
        nagecalculeerd verschijnt het verschil tussen begroot en werkelijk.
      </p>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Kijk anders eerst naar een ruimere periode.
      </p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        <Doorklik href="/rapportages?periode=alles">
          Bekijk alle tijd
        </Doorklik>
        <Doorklik href="/offertes">Bekijk de offertes</Doorklik>
      </div>
    </div>
  );
}
