/**
 * Gebundelde sidebar-tellers (optimize O9).
 *
 * De sidebar deed op élke stafpagina vier losse count-subscriptions
 * (leads, klanten, open meldingen, concept-mails). Eén query = één
 * subscription en één invalidatie-eenheid. De tellogica is 1-op-1
 * overgenomen uit de oorspronkelijke queries, zodat de aantallen exact
 * gelijk blijven:
 * - actieveLeads  ← configuratorAanvragen.countActieveLeads (kantoor)
 * - klanten       ← klanten.countKlanten (kantoor)
 * - openMeldingen ← servicemeldingen.telOpenMeldingen (alle interne rollen)
 * - conceptMails  ← conceptMails.countWachtrij (kantoor)
 *
 * Toegangsmodel: klant-rol krijgt een AuthError (zelfde regel als
 * telOpenMeldingen); interne niet-kantoor-rollen (voorman/medewerker)
 * krijgen alleen openMeldingen — de kantoor-tellers zijn dan null. De
 * client skipt de query voor rollen die geen enkele teller zien.
 */

import { query } from "./_generated/server";
import { requireInterneRol } from "./tijdlijn";
import { getCompanyUserId, isKantoorRol } from "./roles";
import { isActieveLead, hoortInKlantenLijst } from "./leadsKlantenHelpers";
import { isOpenMelding } from "./servicemeldingen";

export const overzicht = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireInterneRol(ctx);
    const kantoor = isKantoorRol(user.role);
    const companyUserId = await getCompanyUserId(ctx);

    // servicemeldingen.telOpenMeldingen — alle interne rollen
    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();
    const openMeldingen = meldingen.filter(
      (m) =>
        !m.deletedAt &&
        m.userId.toString() === companyUserId.toString() &&
        isOpenMelding(m.status)
    ).length;

    if (!kantoor) {
      return {
        actieveLeads: null,
        klanten: null,
        openMeldingen,
        conceptMails: null,
      };
    }

    // configuratorAanvragen.countActieveLeads
    const aanvragen = await ctx.db.query("configuratorAanvragen").collect();
    const actieveLeads = aanvragen.filter(isActieveLead).length;

    // klanten.countKlanten — bewust dezelfde scope als het origineel: het
    // eigen userId van de aanvrager, niet companyUserId.
    const klantenDocs = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const klanten = klantenDocs.filter(hoortInKlantenLijst).length;

    // conceptMails.countWachtrij
    const wachtrij = await ctx.db
      .query("conceptMails")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", companyUserId).eq("status", "wachtrij")
      )
      .collect();
    const conceptMails = wachtrij.length;

    return { actieveLeads, klanten, openMeldingen, conceptMails };
  },
});
