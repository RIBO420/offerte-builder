/**
 * Backfill: de oorspronkelijke aanvraag (tekst + foto's) van al gekoppelde
 * leads alsnog in het klantdossier zetten.
 *
 * Sinds sep 2026 gebeurt dit automatisch bij elke conversie
 * (leadsKlantenHelpers.neemAanvraagOverInDossier). Leads die vóór die tijd
 * gewonnen of gekoppeld zijn, hebben nog geen "lead_aanvraag"-event en geen
 * klantBestanden-verwijzingen naar hun foto's. Deze migratie haalt dat in.
 *
 * Wat hij WEL doet, per lead met `gekoppeldKlantId` (ongeacht status/archief):
 *   - klant bestaat en hoort bij dezelfde organisatie als de lead, anders
 *     overslaan met reden (`klant_weg`, `andere_org`);
 *   - één klantTijdlijn-event "lead_aanvraag" op de aanvraagdatum, met de
 *     foto's als bijlagen (idempotent via klantTijdlijn.bronLeadId);
 *   - per foto een klantBestanden-rij met bron "lead" die naar hetzélfde
 *     storage-object verwijst (idempotent op storageId per klant).
 * Wat hij NIET doet: leads muteren, storage kopiëren of verwijderen.
 *
 * Uitvoeren (eerst droog — leest de hele tabel in één keer, schrijft niets):
 *   1. npx convex run migrations/leadAanvraagNaarDossier:start '{"dryRun":true}'
 *   2. Rapport lezen: `eventsToegevoegd`/`fotosToegevoegd` zijn wat er zou
 *      gebeuren; `overgeslagen` + voorbeelden zijn de gevallen om na te lopen.
 *   3. npx convex run migrations/leadAanvraagNaarDossier:start '{"dryRun":false}'
 *      Tekst van bestaande events herschrijven na een opmaakwijziging:
 *      '{"dryRun":false,"vernieuwTekst":true}' (dry run: idem met dryRun true).
 *      → 100 leads per aanroep; herhalen met de teruggegeven `continueCursor`
 *      als '{"dryRun":false,"cursor":"…"}' tot `isDone` true is.
 *   4. npx convex run migrations/leadAanvraagNaarDossier:verifieerAanvraagOvername
 *      → `zonderEvent` moet 0 zijn (behalve leads waarvan de klant weg is).
 * Nogmaals draaien is veilig: een tweede run voegt niets toe.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  bepaalAanvraagOvername,
  voerAanvraagOvernameUit,
} from "../leadsKlantenHelpers";
import { leesAlleOfBatch, verzamelVoorbeelden } from "./_batch";
import { aanvraagTekst } from "../lib/leadAanvraagTekst";

type OverslaanReden = "klant_weg" | "andere_org";

type Voorbeeld = {
  leadId: Id<"configuratorAanvragen">;
  referentie: string;
  actie: "event" | "fotos" | "event+fotos" | "tekst" | OverslaanReden;
};

export const start = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    // Herschrijf de tekst van al aanwezige aanvraag-events met de huidige
    // aanvraagTekst (bijv. na een opmaakwijziging). Raakt alleen `tekst`.
    vernieuwTekst: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const vernieuwTekst = args.vernieuwTekst ?? false;
    const lezing = await leesAlleOfBatch(ctx, "configuratorAanvragen", {
      dryRun,
      cursor: args.cursor,
    });

    let gekoppeld = 0;
    let eventsToegevoegd = 0;
    let fotosToegevoegd = 0;
    let alAanwezig = 0;
    let tekstVernieuwd = 0;
    const overgeslagen: Record<OverslaanReden, number> = {
      klant_weg: 0,
      andere_org: 0,
    };
    const voorbeelden = verzamelVoorbeelden<Voorbeeld>();

    for (const lead of lezing.documenten) {
      const klantId = lead.gekoppeldKlantId;
      if (!klantId) continue;
      gekoppeld++;

      const klant = await ctx.db.get(klantId);
      const orgId = lead.orgId;
      const reden: OverslaanReden | null = !klant
        ? "klant_weg"
        : !orgId || klant.orgId?.toString() !== orgId.toString()
          ? "andere_org"
          : null;
      if (reden) {
        overgeslagen[reden]++;
        voorbeelden.voegToe({ leadId: lead._id, referentie: lead.referentie, actie: reden });
        continue;
      }

      const plan = await bepaalAanvraagOvername(ctx, lead, klantId, orgId);
      const fotos = plan.ontbrekendeFotoIds.length;
      if (!plan.eventNodig && fotos === 0) {
        alAanwezig++;
        if (vernieuwTekst) {
          const event = await ctx.db
            .query("klantTijdlijn")
            .withIndex("by_bron_lead", (q) => q.eq("bronLeadId", lead._id))
            .first();
          const nieuweTekst = aanvraagTekst(lead);
          if (event && event.tekst !== nieuweTekst) {
            tekstVernieuwd++;
            voorbeelden.voegToe({ leadId: lead._id, referentie: lead.referentie, actie: "tekst" });
            if (!dryRun) await ctx.db.patch(event._id, { tekst: nieuweTekst });
          }
        }
        continue;
      }

      if (plan.eventNodig) eventsToegevoegd++;
      fotosToegevoegd += fotos;
      voorbeelden.voegToe({
        leadId: lead._id,
        referentie: lead.referentie,
        actie: plan.eventNodig ? (fotos > 0 ? "event+fotos" : "event") : "fotos",
      });

      if (!dryRun) {
        await voerAanvraagOvernameUit(ctx, lead, klantId, orgId, plan);
      }
    }

    console.log(
      `[leadAanvraagNaarDossier] ${dryRun ? "DRY RUN" : "UITGEVOERD"}: ` +
        `${lezing.documenten.length} leads bekeken, ${gekoppeld} gekoppeld, ` +
        `${eventsToegevoegd} events, ${fotosToegevoegd} foto's, ${alAanwezig} al aanwezig` +
        (vernieuwTekst ? `, ${tekstVernieuwd} teksten vernieuwd` : "")
    );

    return {
      dryRun,
      bekeken: lezing.documenten.length,
      gekoppeld,
      eventsToegevoegd,
      fotosToegevoegd,
      alAanwezig,
      tekstVernieuwd,
      overgeslagen,
      voorbeelden: voorbeelden.lijst,
      isDone: lezing.isDone,
      continueCursor: lezing.continueCursor,
    };
  },
});

/** Controle achteraf: gekoppelde leads zonder aanvraag-event in het dossier. */
export const verifieerAanvraagOvername = internalQuery({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("configuratorAanvragen").collect();
    const gekoppeld = leads.filter(
      (l): l is Doc<"configuratorAanvragen"> & { gekoppeldKlantId: Id<"klanten"> } =>
        l.gekoppeldKlantId !== undefined
    );
    let zonderEvent = 0;
    let klantWeg = 0;
    for (const lead of gekoppeld) {
      const klant = await ctx.db.get(lead.gekoppeldKlantId);
      if (!klant) {
        klantWeg++;
        continue;
      }
      const event = await ctx.db
        .query("klantTijdlijn")
        .withIndex("by_bron_lead", (q) => q.eq("bronLeadId", lead._id))
        .first();
      if (!event) zonderEvent++;
    }
    return { totaalLeads: leads.length, gekoppeld: gekoppeld.length, zonderEvent, klantWeg };
  },
});
