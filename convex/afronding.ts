/**
 * Afrondingsflow op taakniveau — veld-rol (PRD §2.6/§8.8, fase 1 stap 9a).
 *
 * Bij het uitklokken zet de voorman per taak (bouwsteen van de beurt, code +
 * normtijd) een status: afgerond ✓ / begonnen-niet-af ◐ / niet gestart ○.
 * - Alles ✓ → werkitem "uitgevoerd" (beurt) / "afgerond" (project) +
 *   tijdlijn-event beurt_afgerond + markering klaarVoorFacturatie. De
 *   facturatie-ENGINE zelf is §2.8 — hier alleen het event/de status.
 * - Eén of meer ◐/○ → die taken automatisch afgesplitst als rest-opdracht
 *   (zelfde mechaniek als maakTaakLos: klantmetadata mee, idempotentie-
 *   gevoelige velden bewust niet), mét resterende normtijd en rest-label in
 *   de wachtrij; het werkitem sluit als "deels uitgevoerd" en het uitgevoerde
 *   deel is gemarkeerd voor facturatie.
 */

import { v, ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./auth";
import {
  CANONIEKE_ROL_MAPPING,
  getCompanyUserId,
  normalizeRole,
} from "./roles";
import { assertStatusVoorType, getType, type WerkItem } from "./werkitems";
import { logTijdlijnEvent } from "./tijdlijn";
import {
  magAfronden,
  verdeelTaakAfronding,
  type AfrondTaakInvoer,
} from "./veldLogica";

const taakStatusValidator = v.union(
  v.literal("afgerond"),
  v.literal("begonnen_niet_af"),
  v.literal("niet_gestart")
);

/** Statussen waarin een werkitem al door de afrondingsflow heen is. */
const AL_AFGEROND: ReadonlyArray<WerkItem["status"]> = [
  "uitgevoerd",
  "deels_uitgevoerd",
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
  "vervallen",
];

export const rondWerkitemAf = mutation({
  args: {
    werkitemId: v.id("projecten"),
    taken: v.array(
      v.object({
        index: v.number(),
        status: taakStatusValidator,
        notitie: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const rol = CANONIEKE_ROL_MAPPING[normalizeRole(user.role)];
    if (!magAfronden(rol)) {
      throw new ConvexError("De afrondingsflow is niet beschikbaar voor deze rol");
    }
    const companyUserId = await getCompanyUserId(ctx);

    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    if (AL_AFGEROND.includes(werkitem.status)) {
      throw new ConvexError(
        `Dit werkitem is al afgerond (status "${werkitem.status}")`
      );
    }

    // Taken materialiseren zoals de dagkaart ze toont: eigen bouwsteenregels,
    // anders de contractwerkzaamheid, anders één impliciete taak (de beurt).
    let regels = werkitem.bouwsteenRegels ?? [];
    if (regels.length === 0 && werkitem.contractWerkzaamheidId) {
      const werkzaamheid = await ctx.db.get(werkitem.contractWerkzaamheidId);
      if (werkzaamheid) {
        regels = [
          {
            bouwsteenId: werkzaamheid.bouwsteenId,
            omschrijving: werkzaamheid.omschrijving,
          },
        ];
      }
    }
    if (regels.length === 0) {
      regels = [{ omschrijving: werkitem.naam }];
    }

    // Eén status per taak, exact dekkend (geen taak vergeten of dubbel)
    if (args.taken.length !== regels.length) {
      throw new ConvexError(
        `Elke taak heeft een status nodig (${regels.length} taken, ${args.taken.length} statussen)`
      );
    }
    const gezien = new Set<number>();
    for (const taak of args.taken) {
      if (
        !Number.isInteger(taak.index) ||
        taak.index < 0 ||
        taak.index >= regels.length ||
        gezien.has(taak.index)
      ) {
        throw new ConvexError("Ongeldige of dubbele taak-index");
      }
      gezien.add(taak.index);
    }

    // Normtijd per taak (bouwsteen: urenPerBeurt, anders normurenPerEenheid)
    const bouwsteenCache = new Map<string, Doc<"bouwstenen"> | null>();
    const invoer: AfrondTaakInvoer[] = [];
    const perIndex = new Map(args.taken.map((t) => [t.index, t]));
    for (let i = 0; i < regels.length; i++) {
      const regel = regels[i];
      const opgave = perIndex.get(i)!;
      let normUren: number | null = null;
      if (regel.bouwsteenId) {
        if (!bouwsteenCache.has(regel.bouwsteenId)) {
          bouwsteenCache.set(regel.bouwsteenId, await ctx.db.get(regel.bouwsteenId));
        }
        const bouwsteen = bouwsteenCache.get(regel.bouwsteenId) ?? null;
        normUren =
          bouwsteen?.urenPerBeurt ?? bouwsteen?.normurenPerEenheid ?? null;
      }
      invoer.push({
        omschrijving: regel.omschrijving,
        bouwsteenId: regel.bouwsteenId,
        normUren,
        status: opgave.status,
        notitie: opgave.notitie?.trim() || undefined,
      });
    }

    const resultaat = verdeelTaakAfronding(invoer);
    const taakAfronding = invoer.map((t) => ({
      omschrijving: t.omschrijving,
      bouwsteenId: t.bouwsteenId as Id<"bouwstenen"> | undefined,
      status: t.status,
      notitie: t.notitie,
    }));
    const type = getType(werkitem);
    const now = Date.now();

    if (resultaat.allesAfgerond) {
      // Alles ✓ → uitgevoerd (beurt) / afgerond (project) + facturatie-markering
      const nieuweStatus = type === "onderhoudsbeurt" ? "uitgevoerd" : "afgerond";
      assertStatusVoorType(type, nieuweStatus);
      await ctx.db.patch(werkitem._id, {
        status: nieuweStatus,
        taakAfronding,
        klaarVoorFacturatie: true, // §2.8 pakt dit op; hier alleen de markering
        afgerondOp: now,
        updatedAt: now,
      });
      if (werkitem.klantId) {
        await logTijdlijnEvent(ctx, {
          userId: companyUserId,
          klantId: werkitem.klantId,
          eventType: "beurt_afgerond",
          tekst: `${werkitem.naam} afgerond — alle taken ✓ (klaar voor facturatie)`,
          auteurId: user._id,
          auteurNaam: user.name,
          werkitemId: werkitem._id,
        });
      }
      return { status: nieuweStatus, restId: null };
    }

    // Eén of meer ◐/○ → rest-opdracht met klantmetadata en resterende
    // normtijd; idempotentie-gevoelige velden (generatieSleutel, offerte-/
    // factuurkoppeling) gaan bewust NIET mee (zelfde regel als maakTaakLos).
    const restIndices = new Set(
      invoer
        .map((t, i) => (t.status !== "afgerond" ? i : -1))
        .filter((i) => i >= 0)
    );
    const restRegels = regels.filter((_, i) => restIndices.has(i));
    const restOmschrijving =
      restRegels.length === 1
        ? restRegels[0].omschrijving
        : `${restRegels.length} taken`;

    const restId = await ctx.db.insert("projecten", {
      userId: werkitem.userId,
      type,
      klantId: werkitem.klantId,
      status: "gepland",
      naam: `${werkitem.naam} (rest: ${restOmschrijving})`,
      isRestOpdracht: true, // rest-label in de wachtrij (§2.2/§8.8)
      bouwsteenRegels: restRegels,
      geschatteUren: resultaat.resterendeNormUren ?? undefined,
      adres: werkitem.adres,
      contractId: werkitem.contractId,
      voorkeursTeamId: werkitem.voorkeursTeamId ?? werkitem.teamId,
      beschikbaarheidsVenster: werkitem.beschikbaarheidsVenster,
      createdAt: now,
      updatedAt: now,
    });

    assertStatusVoorType(type, "deels_uitgevoerd");
    await ctx.db.patch(werkitem._id, {
      status: "deels_uitgevoerd",
      taakAfronding,
      // Het uitgevoerde deel gaat wél door naar facturatie (§8.8)
      klaarVoorFacturatie: true,
      afgerondOp: now,
      updatedAt: now,
    });

    if (werkitem.klantId) {
      await logTijdlijnEvent(ctx, {
        userId: companyUserId,
        klantId: werkitem.klantId,
        eventType: "beurt_afgerond",
        tekst: `${werkitem.naam} deels uitgevoerd — rest-opdracht in de wachtrij (${restOmschrijving}${
          resultaat.resterendeNormUren !== null
            ? `, ±${resultaat.resterendeNormUren} uur`
            : ""
        })`,
        auteurId: user._id,
        auteurNaam: user.name,
        werkitemId: werkitem._id,
      });
    }
    return { status: "deels_uitgevoerd" as const, restId };
  },
});
