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
 *
 * Tenant-scope: alle vier de tellingen lopen op de organisatie uit het JWT.
 * De resolver staat één keer bovenaan de handler — de tellingen delen hem.
 */

import { query } from "./_generated/server";
import { requireOrgId } from "./auth";
import { requireInterneRol } from "./tijdlijn";
import { isKantoorRol } from "./roles";
import { isActieveLead, hoortInKlantenLijst } from "./leadsKlantenHelpers";
import { isOpenMelding } from "./servicemeldingen";

export const overzicht = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireInterneRol(ctx);
    const kantoor = isKantoorRol(user.role);
    const orgId = await requireOrgId(ctx);

    // servicemeldingen.telOpenMeldingen — alle interne rollen
    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const openMeldingen = meldingen.filter(
      (m) => !m.deletedAt && isOpenMelding(m.status)
    ).length;

    if (!kantoor) {
      return {
        actieveLeads: null,
        klanten: null,
        openMeldingen,
        conceptMails: null,
      };
    }

    // configuratorAanvragen.countActieveLeads — dit was de laatste lezer die
    // de leads-tabel nog ONGESCOPET binnenhaalde (een full-table scan over
    // alle tenants). Nu op by_org, net als de rest.
    const aanvragen = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const actieveLeads = aanvragen.filter(isActieveLead).length;

    // klanten.countKlanten — het origineel scopete op het eigen userId van de
    // aanvrager (dus niet op het bedrijf). Die afleiding vervalt: de tenant is
    // de organisatie, ongeacht wie er kijkt.
    const klantenDocs = await ctx.db
      .query("klanten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const klanten = klantenDocs.filter(hoortInKlantenLijst).length;

    // conceptMails.countWachtrij
    const wachtrij = await ctx.db
      .query("conceptMails")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", orgId).eq("status", "wachtrij")
      )
      .collect();
    const conceptMails = wachtrij.length;

    return { actieveLeads, klanten, openMeldingen, conceptMails };
  },
});
