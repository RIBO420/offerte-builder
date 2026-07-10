/**
 * Planningsattendering (PRD §2.1-restant, acceptatietest §8.12).
 *
 * Dagelijkse cron (convex/crons.ts) die voor ritme-beurten waarvan het
 * seizoensvenster (of de voorziene datum) binnen `attenderingDagenVooraf`
 * dagen opent een KANTOOR-TAAK genereert op het §2.4-bord: een melding met
 * taaksoort "plantaak", tekst "… inplannen — venster opent over N dagen",
 * eigenaar kantoor (de bedrijfseigenaar) en klant + beurt gekoppeld.
 *
 * - Instelbaar per beurt: attenderingDagenVooraf (default 14) en
 *   attenderingNodig (false = geen taak) — velden op het werkitem (§2.1B).
 * - Idempotent via attenderingSleutel `plantaak:{beurtId}:{voorzieneDatum}`:
 *   herhaald draaien maakt geen dubbele taken.
 * - Escalatie: zonder actie na X dagen (escalatieDagen, default 7) kleurt de
 *   taak op het bord (isGeescaleerd in servicemeldingen.ts) — GEEN mail.
 * - Vanuit de taak: "beurt vrijgeven naar wachtrij" (geefBeurtVrij) maakt de
 *   concrete beurt aan in de opdrachtenbak en schuift het ritme door.
 *
 * MAILVEILIGHEID: deze module verstuurt NOOIT e-mail en raakt geen
 * mailpaden. De inplan-mail (§2.7) is in de UI bewust een placeholder
 * ("beschikbaar na mails-stap").
 */

import { v, ConvexError } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getCompanyUserId, normalizeRole, requireKantoor } from "./roles";
import { logTijdlijnEvent } from "./tijdlijn";
import { voegSysteemCommentToe } from "./servicemeldingen";
import {
  DEFAULT_ATTENDERING_DAGEN,
  berekenVolgendeVoorzieneDatum,
  vensterOpeningVoorDatum,
} from "./losseBeurten";
import { vandaagIso } from "./beurtgenerator";
import { addDagen, dagenTussen, termijnBereikt } from "./vervalLogica";

// ============================================
// Pure helpers (unit-testbaar zonder ctx)
// ============================================

// Gedeelde engine-kern (PRD §3.3): de datumhelpers en het termijn-criterium
// leven sinds fase 2 stap 3 in vervalLogica.ts — de generieke familie
// "item + datum + termijn + ontvanger → idempotente bord-taak" waar deze
// attendering, de debiteurenladder en de vervallogica alle drie op draaien.
// Her-export houdt bestaande importeurs (tests, planbord) werkend.
export { addDagen, dagenTussen };

/** Idempotentiesleutel van de plantaak voor één beurt-occurrence. */
export function maakAttenderingSleutel(
  beurtId: string,
  voorzieneDatum: string
): string {
  return `plantaak:${beurtId}:${voorzieneDatum}`;
}

/** Taaktekst (PRD §2.1): "Snoeibeurt [klant] inplannen — venster opent over 14 dagen". */
export function attenderingTekst(
  beurtNaam: string,
  klantNaam: string,
  vensterOpening: string,
  vandaag: string
): string {
  const dagen = dagenTussen(vandaag, vensterOpening);
  const wanneer =
    dagen > 1
      ? `venster opent over ${dagen} dagen`
      : dagen === 1
        ? "venster opent morgen"
        : "venster is open";
  return `${beurtNaam} (${klantNaam}) inplannen — ${wanneer}`;
}

export interface AttenderingKandidaat {
  ritme: NonNullable<Doc<"projecten">["ritme"]>;
  volgendeVoorzieneDatum: string;
  attenderingDagenVooraf?: number;
  attenderingNodig?: boolean;
}

/**
 * Moet er vandaag geattendeerd worden voor deze beurt? Retourneert de
 * venster-opening als vandaag >= opening - dagenVooraf, anders null.
 * attenderingNodig === false schakelt de attendering voor deze beurt uit.
 */
export function attenderingVandaagNodig(
  beurt: AttenderingKandidaat,
  vandaag: string
): { vensterOpening: string } | null {
  if (beurt.attenderingNodig === false) return null;
  if (beurt.volgendeVoorzieneDatum < vandaag) return null;
  const opening = vensterOpeningVoorDatum(
    beurt.ritme,
    beurt.volgendeVoorzieneDatum
  );
  const dagenVooraf =
    beurt.attenderingDagenVooraf ?? DEFAULT_ATTENDERING_DAGEN;
  // Generiek engine-criterium (vervalLogica.termijnBereikt): doeldatum −
  // termijnDagen ≤ vandaag — zelfde kern als de vervallogica-cron (§3.3).
  if (!termijnBereikt({ doeldatum: opening, termijnDagen: dagenVooraf }, vandaag)) {
    return null;
  }
  return { vensterOpening: opening };
}

// ============================================
// Cron — plantaken genereren (intern, geen mail)
// ============================================

/**
 * Dagelijkse attendering-run (cron). Per bedrijf (directie-gebruiker als
 * multi-tenant eigenaar): ritme-beurten waarvan het venster binnen de
 * ingestelde dagen-vooraf opent → plantaak op het meldingen-bord.
 * Idempotent via attenderingSleutel; verstuurt NOOIT e-mail.
 */
export const genereerAttenderingen = internalMutation({
  args: {},
  handler: async (ctx) => {
    const vandaag = vandaagIso();
    const users = await ctx.db.query("users").collect();
    const eigenaren = users.filter(
      (u) => normalizeRole(u.role) === "directie"
    );

    let aangemaakt = 0;
    for (const eigenaar of eigenaren) {
      const kandidaten = await ctx.db
        .query("projecten")
        .withIndex("by_user_volgendeVoorzieneDatum", (q) =>
          q.eq("userId", eigenaar._id).gte("volgendeVoorzieneDatum", vandaag)
        )
        .collect();

      for (const beurt of kandidaten) {
        // Belt & braces bovenop de indexquery
        if (beurt.userId.toString() !== eigenaar._id.toString()) continue;
        if (beurt.deletedAt || beurt.isArchived === true) continue;
        if (beurt.type !== "onderhoudsbeurt") continue;
        if (!beurt.ritme || !beurt.volgendeVoorzieneDatum) continue;
        if (!beurt.klantId) continue;

        const attendering = attenderingVandaagNodig(
          {
            ritme: beurt.ritme,
            volgendeVoorzieneDatum: beurt.volgendeVoorzieneDatum,
            attenderingDagenVooraf: beurt.attenderingDagenVooraf,
            attenderingNodig: beurt.attenderingNodig,
          },
          vandaag
        );
        if (!attendering) continue;

        // Idempotentie: bestaat de plantaak voor deze occurrence al?
        const sleutel = maakAttenderingSleutel(
          beurt._id.toString(),
          beurt.volgendeVoorzieneDatum
        );
        const bestaande = await ctx.db
          .query("servicemeldingen")
          .withIndex("by_attenderingSleutel", (q) =>
            q.eq("attenderingSleutel", sleutel)
          )
          .collect();
        if (bestaande.some((m) => m.attenderingSleutel === sleutel)) continue;

        const klant = await ctx.db.get(beurt.klantId);
        const tekst = attenderingTekst(
          beurt.naam,
          klant?.naam ?? "Onbekende klant",
          attendering.vensterOpening,
          vandaag
        );

        const now = Date.now();
        const meldingId = await ctx.db.insert("servicemeldingen", {
          userId: eigenaar._id,
          klantId: beurt.klantId,
          beschrijving: tekst,
          isGarantie: false,
          status: "nieuw",
          prioriteit: "normaal",
          kosten: 0,
          kanaal: "intern",
          eigenaarId: eigenaar._id, // eigenaar: kantoor (bedrijfseigenaar)
          werkitemId: beurt._id, // klant + beurt gekoppeld
          taaksoort: "plantaak",
          attenderingSleutel: sleutel,
          deadline: attendering.vensterOpening,
          createdAt: now,
          updatedAt: now,
        });

        await logTijdlijnEvent(ctx, {
          userId: eigenaar._id,
          klantId: beurt.klantId,
          eventType: "melding_aangemaakt",
          tekst: `Plantaak aangemaakt: ${tekst}`,
          werkitemId: beurt._id,
          meldingId,
        });
        await voegSysteemCommentToe(ctx, {
          userId: eigenaar._id,
          meldingId,
          tekst: `Automatische planningsattendering: ${tekst}`,
        });
        aangemaakt++;
      }
    }

    console.log(
      `[planningsattendering] run klaar: ${aangemaakt} nieuwe plantaken`
    );
    return { aangemaakt };
  },
});

// ============================================
// Vanuit de taak — beurt vrijgeven naar de wachtrij (kantoor)
// ============================================

/**
 * "Beurt vrijgeven naar wachtrij" (§8.12): maakt de CONCRETE beurt aan als
 * ongepland werkitem (status "gepland", geen geplandeStart → zichtbaar in
 * de opdrachtenbak), schuift het ritme van de moederbeurt door naar de
 * volgende voorziene datum en zet de plantaak op "opgelost". Idempotent via
 * generatieSleutel `los:{moederId}:{datum}`. Koppeling blijft in beide
 * richtingen behouden (melding.werkitemId ↔ werkitem.meldingId).
 */
export const geefBeurtVrij = mutation({
  args: { meldingId: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const melding = await ctx.db.get(args.meldingId);
    if (
      !melding ||
      melding.deletedAt ||
      melding.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Melding niet gevonden");
    }
    if (melding.taaksoort !== "plantaak" || !melding.werkitemId) {
      throw new ConvexError(
        "Alleen een plantaak met gekoppelde beurt kan een beurt vrijgeven"
      );
    }
    // Idempotentie op taak-niveau: een afgehandelde plantaak geeft niet
    // nogmaals vrij (zou anders de VOLGENDE ritme-occurrence vrijgeven)
    if (melding.status === "opgelost" || melding.status === "afgehandeld") {
      throw new ConvexError("Deze plantaak is al afgehandeld");
    }

    const moeder = await ctx.db.get(melding.werkitemId);
    if (
      !moeder ||
      moeder.deletedAt ||
      moeder.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Gekoppelde beurt niet gevonden");
    }
    if (!moeder.ritme || !moeder.volgendeVoorzieneDatum || !moeder.klantId) {
      throw new ConvexError("De gekoppelde beurt heeft geen ritme");
    }

    const datum = moeder.volgendeVoorzieneDatum;
    const sleutel = `los:${moeder._id.toString()}:${datum}`;

    // Idempotentie: bestaat de vrijgegeven beurt al, geef die terug
    const bestaandeItems = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", moeder.klantId))
      .collect();
    const bestaande = bestaandeItems.find(
      (i) => i.generatieSleutel === sleutel
    );

    const now = Date.now();
    let beurtId: Id<"projecten">;
    if (bestaande) {
      beurtId = bestaande._id;
    } else {
      beurtId = await ctx.db.insert("projecten", {
        userId: companyUserId,
        type: "onderhoudsbeurt",
        klantId: moeder.klantId,
        naam: `${moeder.naam} — ${datum}`,
        status: "gepland",
        // Ongepland: geen geplandeStart/teamId — opdrachtenbak (§2.2)
        bouwsteenRegels: moeder.bouwsteenRegels,
        geschatteUren: moeder.geschatteUren,
        adres: moeder.adres,
        voorzieneDatum: datum,
        generatieSleutel: sleutel,
        meldingId: melding._id,
        createdAt: now,
        updatedAt: now,
      });

      // Ritme doorschuiven op de moederbeurt (drager van het ritme)
      const volgende = berekenVolgendeVoorzieneDatum(moeder.ritme, datum);
      await ctx.db.patch(moeder._id, {
        volgendeVoorzieneDatum: volgende,
        voorzieneDatum: volgende,
        updatedAt: now,
      });
    }

    // Plantaak afronden: vrijgeven = de actie waar de taak om vroeg
    await ctx.db.patch(melding._id, {
      status: "opgelost",
      updatedAt: now,
    });

    await logTijdlijnEvent(ctx, {
      userId: companyUserId,
      klantId: moeder.klantId,
      eventType: "melding_status_gewijzigd",
      tekst: `Beurt "${moeder.naam}" (${datum}) vrijgegeven naar de wachtrij`,
      werkitemId: beurtId,
      meldingId: melding._id,
    });
    await voegSysteemCommentToe(ctx, {
      userId: companyUserId,
      meldingId: melding._id,
      tekst: `${user.name} gaf de beurt van ${datum} vrij naar de wachtrij`,
    });

    return beurtId;
  },
});
