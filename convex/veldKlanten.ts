import { ConvexError, v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { dagStatusVoor, teamVanMedewerkerOpDag, veldContext } from "./urenSegmenten";
import { valideerUrenPeriode } from "./lib/urenTotalen";
import { naamDelenVoorNieuweKlant } from "./lib/klantNaam";
import { klantUitvoerAdres, adresRegel } from "./lib/adres";
import { werkitemsVoorMedewerkerDag } from "./lib/bezoekBemanning";

function datumControle(datum: string) {
  try { valideerUrenPeriode(datum, datum); }
  catch { throw new ConvexError("Ongeldige datum"); }
}
function tekst(waarde: string | undefined, label: string, max: number, verplicht = false) {
  const schoon = (waarde ?? "").trim().replace(/\s+/g, " ");
  if ((verplicht && !schoon) || schoon.length > max || /[\u0000-\u001f\u007f]/.test(schoon)) throw new ConvexError(`${label} is verplicht en mag maximaal ${max} tekens bevatten`);
  return schoon;
}
async function eigenVeldToegang(ctx: QueryCtx | MutationCtx) {
  const veld = await veldContext(ctx);
  const medewerker = veld.eigenMedewerker;
  if (veld.rol === "klant" || !medewerker || medewerker.orgId !== veld.orgId || medewerker.isActief === false) throw new ConvexError("Alleen een actieve gekoppelde medewerker kan deze veldactie uitvoeren");
  return { ...veld, medewerker };
}

/** Minimale klantprojectie. Eigen planning eerst, daarna actieve orgklanten. */
export const zoek = query({
  args: { datum: v.string(), zoekterm: v.optional(v.string()) },
  handler: async (ctx, args) => {
    datumControle(args.datum);
    const veld = await eigenVeldToegang(ctx);
    const zoekterm = tekst(args.zoekterm, "Zoekterm", 160).toLocaleLowerCase("nl");
    const [klanten, gepland] = await Promise.all([
      ctx.db.query("klanten").withIndex("by_org", q => q.eq("orgId", veld.orgId)).collect(),
      werkitemsVoorMedewerkerDag(ctx.db, veld.orgId, veld.medewerker._id, args.datum),
    ]);
    const resultaat = klanten.filter(k => !k.isArchived && (!zoekterm || `${k.naam} ${k.adres} ${k.postcode} ${k.plaats}`.toLocaleLowerCase("nl").includes(zoekterm))).map(k => {
      const werkitems = gepland.filter(p => p.klantId === k._id).sort((a, b) => (a.volgordeBinnenDag ?? 9999) - (b.volgordeBinnenDag ?? 9999)).map(p => ({ werkitemId: p._id, naam: p.naam, uitvoeringCategorie: p.uitvoeringCategorie ?? (p.type === "onderhoudsbeurt" ? "onderhoud" as const : null) }));
      return { klantId: k._id, naam: k.naam, adres: adresRegel(klantUitvoerAdres(k)), plaats: klantUitvoerAdres(k).plaats, gepland: werkitems.length > 0, werkitems };
    }).sort((a, b) => Number(b.gepland) - Number(a.gepland) || a.naam.localeCompare(b.naam, "nl") || a.klantId.localeCompare(b.klantId));
    return { klanten: resultaat.slice(0, 100), meerResultaten: resultaat.length > 100 };
  },
});

/** Echte losse uitvoering met omschrijving, klant en eigen toewijzing. */
export const maakUitvoeringsklus = mutation({
  args: {
    datum: v.string(), sleutel: v.string(), klantId: v.optional(v.id("klanten")),
    nieuweKlant: v.optional(v.object({ naam: v.string(), adres: v.optional(v.string()), postcode: v.optional(v.string()), plaats: v.optional(v.string()) })),
    omschrijving: v.string(), categorie: v.union(v.literal("aanleg"), v.literal("onderhoud")),
  },
  handler: async (ctx, args) => {
    datumControle(args.datum);
    const veld = await eigenVeldToegang(ctx);
    const sleutel = tekst(args.sleutel, "Opdrachtsleutel", 160, true);
    if (Boolean(args.klantId) === Boolean(args.nieuweKlant)) throw new ConvexError("Kies een bestaande klant of vul één nieuwe klant in");
    const omschrijving = tekst(args.omschrijving, "Omschrijving van het werk", 300, true);
    const nieuweKlant = args.nieuweKlant ? {
      naam: tekst(args.nieuweKlant.naam, "Klantnaam", 160, true),
      adres: tekst(args.nieuweKlant.adres, "Adres", 200),
      postcode: tekst(args.nieuweKlant.postcode, "Postcode", 20),
      plaats: tekst(args.nieuweKlant.plaats, "Plaats", 100),
    } : null;
    const inhoud = JSON.stringify({ datum: args.datum, medewerkerId: veld.medewerker._id, klantId: args.klantId ?? null, nieuweKlant, omschrijving, categorie: args.categorie });
    const receipt = await ctx.db.query("veldKlantOpdrachten").withIndex("by_org_user_sleutel", q => q.eq("orgId", veld.orgId).eq("userId", veld.user._id).eq("sleutel", sleutel)).unique();
    if (receipt && receipt.inhoud !== inhoud) throw new ConvexError("Deze opdrachtsleutel is al gebruikt voor andere invoer");
    if (receipt) {
      const [klant, klus] = await Promise.all([ctx.db.get(receipt.klantId), ctx.db.get(receipt.werkitemId)]);
      if (!klant || !klus || klant.orgId !== veld.orgId || klus.orgId !== veld.orgId || klus.klantId !== klant._id) throw new ConvexError("De eerder aangemaakte klus is niet meer beschikbaar; vraag kantoor om hulp");
      return { klantId: klant._id, werkitemId: klus._id, klantNaam: klant.naam, werkitemNaam: klus.naam, uitvoeringCategorie: klus.uitvoeringCategorie ?? args.categorie };
    }
    const dag = await dagStatusVoor(ctx.db, veld.orgId, veld.medewerker._id, args.datum);
    if (dag?.status === "ingediend") throw new ConvexError("Deze dag is ingediend; laat kantoor de dag eerst heropenen");
    const bestaandeKlant = args.klantId ? await ctx.db.get(args.klantId) : null;
    if (args.klantId && (!bestaandeKlant || bestaandeKlant.orgId !== veld.orgId || bestaandeKlant.isArchived)) throw new ConvexError("Klant niet gevonden of gearchiveerd");
    const nu = Date.now();
    const klantId = bestaandeKlant?._id ?? await ctx.db.insert("klanten", { orgId: veld.orgId, ...nieuweKlant!, ...naamDelenVoorNieuweKlant(nieuweKlant!.naam), createdAt: nu, updatedAt: nu });
    const klantNaam = bestaandeKlant?.naam ?? nieuweKlant!.naam;
    const klantAdres = bestaandeKlant ? adresRegel(klantUitvoerAdres(bestaandeKlant)) : adresRegel(nieuweKlant!);
    const team = await teamVanMedewerkerOpDag(ctx.db, veld.orgId, veld.medewerker._id, args.datum);
    const werkitemId = await ctx.db.insert("projecten", {
      orgId: veld.orgId, klantId, naam: omschrijving, type: "project", status: "in_uitvoering",
      uitvoeringCategorie: args.categorie, uitvoeringsInstructie: omschrijving,
      geplandeStart: args.datum, geplandeEind: args.datum, teamId: team?._id,
      toegewezenMedewerkerIds: [veld.medewerker._id], adres: klantAdres || undefined,
      klaarVoorFacturatie: false, createdAt: nu, updatedAt: nu,
    });
    await ctx.db.insert("veldKlantOpdrachten", { orgId: veld.orgId, userId: veld.user._id, sleutel, inhoud, klantId, werkitemId, createdAt: nu });
    return { klantId, werkitemId, klantNaam, werkitemNaam: omschrijving, uitvoeringCategorie: args.categorie };
  },
});
