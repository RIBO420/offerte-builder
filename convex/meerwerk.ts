/**
 * Meerwerk ter plekke — veld-rol (PRD §2.6, fase 1 stap 9a).
 *
 * De voorman stuurt vanuit de dagkaart een meerwerk-verzoek (taakomschrijving
 * + geschatte tijd). Meerwerk kan alleen ná akkoord van planning/kantoor:
 * - goedkeuren met "tijd erbij" → duur-override op het werkitem, de
 *   dagkaart-cascade schuift automatisch door (blokken zijn afgeleid);
 * - goedkeuren als "nieuwe opdracht" → nieuw werkitem in de bak;
 * - afwijzen.
 *
 * Hergebruikt de bestaande meerwerk-tabel (FAC-003) additief: het veld-verzoek
 * krijgt bron "veld" + geschatteMinuten; de prijsregels blijven leeg (0) tot
 * kantoor ze bij facturatie invult — de facturatie-engine zelf is §2.8.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireAuth } from "./auth";
import {
  CANONIEKE_ROL_MAPPING,
  getCompanyUserId,
  normalizeRole,
  requireKantoor,
} from "./roles";
import { getType } from "./werkitems";
import { stopDuurMinuten } from "./dagkaartLogica";
import { logPlanwijziging } from "./planbordLogica";
import { magAfronden, magMeerwerkBeoordelen } from "./veldLogica";

const MAX_GESCHATTE_MINUTEN = 24 * 60;

/** Meerwerk-verzoek vanaf de dagkaart (voorman/medewerker, §2.6). */
export const maakVeldVerzoek = mutation({
  args: {
    werkitemId: v.id("projecten"),
    omschrijving: v.string(),
    geschatteMinuten: v.number(),
    reden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const rol = CANONIEKE_ROL_MAPPING[normalizeRole(user.role)];
    if (!magAfronden(rol)) {
      throw new ConvexError(
        "Meerwerk aanvragen is niet beschikbaar voor deze rol"
      );
    }
    const companyUserId = await getCompanyUserId(ctx);

    const omschrijving = args.omschrijving.trim();
    if (!omschrijving) {
      throw new ConvexError("Omschrijving is verplicht voor een meerwerk-verzoek");
    }
    if (
      !Number.isFinite(args.geschatteMinuten) ||
      args.geschatteMinuten <= 0 ||
      args.geschatteMinuten > MAX_GESCHATTE_MINUTEN
    ) {
      throw new ConvexError("Ongeldige geschatte tijd (1 t/m 1440 minuten)");
    }

    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    const now = Date.now();
    const geschatteUren = Math.round((args.geschatteMinuten / 60) * 100) / 100;
    return await ctx.db.insert("meerwerk", {
      projectId: werkitem._id,
      userId: companyUserId,
      omschrijving,
      reden: args.reden?.trim() || undefined,
      // Prijsregels volgen bij facturatie (§2.8); het veld levert alleen
      // taak + geschatte tijd aan (PRD §2.6)
      regels: [
        {
          id: `veld-${now}`,
          omschrijving,
          hoeveelheid: geschatteUren,
          eenheid: "uur",
          prijsPerEenheid: 0,
          totaal: 0,
        },
      ],
      totaalExclBtw: 0,
      status: "aangevraagd",
      bron: "veld",
      aangevraagdDoorId: user._id,
      aangevraagdDoorNaam: user.name,
      geschatteMinuten: args.geschatteMinuten,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Meerwerk-verzoeken van één werkitem (veld + kantoor). */
export const listVoorWerkitem = query({
  args: { werkitemId: v.id("projecten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const rol = CANONIEKE_ROL_MAPPING[normalizeRole(user.role)];
    if (!magAfronden(rol)) {
      throw new ConvexError("Meerwerk is niet beschikbaar voor deze rol");
    }
    const companyUserId = await getCompanyUserId(ctx);
    const rijen = await ctx.db
      .query("meerwerk")
      .withIndex("by_project", (q) => q.eq("projectId", args.werkitemId))
      .collect();
    return rijen.filter(
      (r) => r.userId.toString() === companyUserId.toString()
    );
  },
});

/** Openstaande veld-verzoeken voor kantoor/planning (beoordeling §2.6). */
export const listVoorBeoordeling = query({
  args: {},
  handler: async (ctx) => {
    const kantoorUser = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);
    void kantoorUser;
    const rijen = await ctx.db
      .query("meerwerk")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();
    const open = rijen.filter(
      (r) => r.status === "aangevraagd" && r.bron === "veld"
    );

    const verrijkt: (Doc<"meerwerk"> & {
      werkitemNaam: string | null;
      klantNaam: string | null;
    })[] = [];
    for (const rij of open) {
      const werkitem = await ctx.db.get(rij.projectId);
      let klantNaam: string | null = null;
      if (werkitem?.klantId) {
        const klant = await ctx.db.get(werkitem.klantId);
        klantNaam = klant?.naam ?? null;
      }
      verrijkt.push({
        ...rij,
        werkitemNaam: werkitem?.naam ?? null,
        klantNaam,
      });
    }
    return verrijkt.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Kantoor/planning keurt een veld-verzoek goed (§2.6):
 * - "tijd_erbij": geschatte tijd bovenop de huidige blokduur van het
 *   werkitem (duurOverrideMinuten) — de dagkaart-cascade schuift door;
 * - "nieuwe_opdracht": nieuw werkitem in de bak voor een beter moment.
 */
export const keurGoed = mutation({
  args: {
    id: v.id("meerwerk"),
    besluit: v.union(v.literal("tijd_erbij"), v.literal("nieuwe_opdracht")),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const rol = CANONIEKE_ROL_MAPPING[normalizeRole(kantoorUser.role)];
    if (!magMeerwerkBeoordelen(rol)) {
      throw new ConvexError("Alleen kantoor/planning beoordeelt meerwerk");
    }
    const companyUserId = await getCompanyUserId(ctx);

    const meerwerk = await ctx.db.get(args.id);
    if (
      !meerwerk ||
      meerwerk.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Meerwerk-verzoek niet gevonden");
    }
    if (meerwerk.status !== "aangevraagd") {
      throw new ConvexError(
        `Dit verzoek is al beoordeeld (status "${meerwerk.status}")`
      );
    }
    const werkitem = await ctx.db.get(meerwerk.projectId);
    if (!werkitem || werkitem.deletedAt) {
      throw new ConvexError("Werkitem van dit meerwerk niet gevonden");
    }
    const minuten = meerwerk.geschatteMinuten ?? 0;
    const now = Date.now();

    if (args.besluit === "tijd_erbij") {
      if (minuten <= 0) {
        throw new ConvexError(
          "Dit verzoek heeft geen geschatte tijd; keur het goed als nieuwe opdracht"
        );
      }
      // Duur-override = huidige blokduur + meerwerk; handmatige waarden
      // blijven leidend en alles erná cascadeert door (§8.9-mechaniek)
      const nieuweDuur = stopDuurMinuten(werkitem) + minuten;
      await ctx.db.patch(werkitem._id, {
        duurOverrideMinuten: nieuweDuur,
        updatedAt: now,
      });
      await logPlanwijziging(ctx, {
        userId: companyUserId,
        door: kantoorUser._id,
        actie: "tijd_aangepast",
        details: `${werkitem.naam}: meerwerk goedgekeurd (+${minuten} min, "${meerwerk.omschrijving}") — cascade schuift door`,
        werkitemId: werkitem._id,
        teamId: werkitem.teamId,
      });
      await ctx.db.patch(meerwerk._id, {
        status: "goedgekeurd",
        besluit: "tijd_erbij",
        goedgekeurdDoor: kantoorUser.name,
        goedgekeurdAt: now,
        updatedAt: now,
      });
      return { besluit: "tijd_erbij" as const, nieuweOpdrachtId: null };
    }

    // Nieuwe opdracht in de bak (ongepland, voor een beter moment)
    const geschatteUren =
      minuten > 0 ? Math.round((minuten / 60) * 100) / 100 : undefined;
    const nieuweOpdrachtId = await ctx.db.insert("projecten", {
      userId: werkitem.userId,
      type: getType(werkitem),
      klantId: werkitem.klantId,
      status: "gepland",
      naam: `Meerwerk: ${meerwerk.omschrijving}`,
      geschatteUren,
      adres: werkitem.adres,
      voorkeursTeamId: werkitem.voorkeursTeamId ?? werkitem.teamId,
      beschikbaarheidsVenster: werkitem.beschikbaarheidsVenster,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(meerwerk._id, {
      status: "goedgekeurd",
      besluit: "nieuwe_opdracht",
      nieuweOpdrachtId,
      goedgekeurdDoor: kantoorUser.name,
      goedgekeurdAt: now,
      updatedAt: now,
    });
    return { besluit: "nieuwe_opdracht" as const, nieuweOpdrachtId };
  },
});

/** Kantoor wijst een veld-verzoek af. */
export const wijsAf = mutation({
  args: { id: v.id("meerwerk"), reden: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const meerwerk = await ctx.db.get(args.id);
    if (
      !meerwerk ||
      meerwerk.userId.toString() !== companyUserId.toString()
    ) {
      throw new ConvexError("Meerwerk-verzoek niet gevonden");
    }
    if (meerwerk.status !== "aangevraagd") {
      throw new ConvexError(
        `Dit verzoek is al beoordeeld (status "${meerwerk.status}")`
      );
    }
    await ctx.db.patch(meerwerk._id, {
      status: "afgewezen",
      reden: args.reden?.trim() || meerwerk.reden,
      goedgekeurdDoor: kantoorUser.name,
      goedgekeurdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});
