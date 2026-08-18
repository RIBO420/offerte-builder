/**
 * Team-scherm: personeelsdossier én app-toegang in één model.
 *
 * De medewerkersrij ís de bron van waarheid. Een account is er niet naast, maar
 * eraan vast: `clerkUserId` (actief) of de vier `uitnodiging*`-velden
 * (uitgenodigd). `listTeam` vertaalt dat naar één `accountStatus`, zodat de UI
 * geen twee tabellen tegen elkaar hoeft te leggen.
 *
 * Uitnodigen loopt via **Clerk organization-invitations**: Clerk stuurt de mail
 * en bewaakt de acceptatie; wij bewaren alleen het invitation-id om hem later
 * te kunnen intrekken. Zodra de uitgenodigde inlogt, koppelt `users.upsert`
 * account ↔ medewerker op het genormaliseerde `uitnodigingEmail`.
 *
 * Rolverdeling:
 *   - lezen (`listTeam`): iedereen binnen de organisatie die het scherm mag
 *     openen — de UI laat een projectleider alleen kijken;
 *   - schrijven (alle drie de actions): directie-only, via `requireAdmin`.
 *
 * Waarom actions: praten met api.clerk.com kan niet vanuit een mutation. Het
 * patroon is daarom steeds hetzelfde drieluik — valideren (mutation, mét
 * auth), Clerk bellen (action), registreren (mutation). De validatie zit
 * bewust vóór de netwerkcall: een geweigerde actie belt Clerk nooit.
 */

import { v, ConvexError } from "convex/values";
import { query, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOrg, requireOrgId, AuthError } from "./auth";
import { requireAdmin } from "./roles";
import { userRoleValidator } from "./validators";
import type { UserRole } from "./roles";

const CLERK_API = "https://api.clerk.com/v1";

/**
 * Rollen die je via het Team-scherm mag uitdelen.
 *
 * `klant` hoort hier niet: dat is een portaalaccount met een `linkedKlantId`,
 * geen personeelslid, en het loopt via de klant-uitnodigingsflow. De legacy-
 * literals `admin`/`viewer` staan alleen nog in de validator voor bestaande
 * databaserijen — nieuwe uitnodigingen mogen ze niet meer introduceren.
 * `userRoleValidator` accepteert ze wél, dus de weigering moet hier staan.
 */
const UITNODIGBARE_ROLLEN: readonly UserRole[] = [
  "directie",
  "projectleider",
  "voorman",
  "medewerker",
  "onderaannemer_zzp",
  "materiaalman",
];

/**
 * Eén normalisatie voor het uitnodigingsadres: trim + lowercase. Zowel de
 * uniciteitscheck, de Clerk-call als het opgeslagen `uitnodigingEmail` gebruiken
 * deze functie — anders bewaakt de check een ander adres dan er in de database
 * belandt en matcht `users.upsert` bij het inloggen niets.
 */
function normaliseerUitnodigingEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** De Clerk-sleutel uit de Convex-env, met een melding die iets uitlegt. */
function clerkSecret(): string {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "CLERK_SECRET_KEY ontbreekt in de Convex-env — zet hem met `npx convex env set CLERK_SECRET_KEY sk_…`"
    );
  }
  return secret;
}

/**
 * Foutmelding met status én body. Clerk zet de bruikbare informatie
 * ("duplicate invitation", "not a member") uitsluitend in de body; alleen de
 * status doorgeven maakt elk probleem een raadsel in het serverlog.
 */
function clerkFout(actie: string, status: number, body: string): Error {
  return new Error(`${actie} mislukt: ${status} ${body}`);
}

// ============================================
// LEZEN
// ============================================

/**
 * Alle medewerkers van de organisatie, met hun toegangsstatus.
 *
 * Eén `requireOrgId` voor de hele query; de account-lookup per medewerker loopt
 * over `by_clerk_id` en is dus een indexed point-read — acceptabel voor een
 * personeelsbestand.
 */
export const listTeam = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return await Promise.all(
      medewerkers.map(async (m) => {
        // Guard vóór de index-eq: `q.eq("clerkId", undefined)` zou álle
        // users zonder clerkId matchen (CLAUDE.md-regel 4).
        const clerkUserId = m.clerkUserId;
        const account = clerkUserId
          ? await ctx.db
              .query("users")
              .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
              .unique()
          : null;

        // Volgorde is bindend: een bestaand account wint van een openstaande
        // uitnodiging (die blijft na acceptatie op "geaccepteerd" staan).
        const accountStatus = account
          ? ("actief" as const)
          : m.uitnodigingStatus === "uitgenodigd"
            ? ("uitgenodigd" as const)
            : ("geen" as const);

        return {
          ...m,
          accountStatus,
          account: account
            ? { id: account._id, email: account.email, role: account.role }
            : null,
        };
      })
    );
  },
});

// ============================================
// UITNODIGEN
// ============================================

/**
 * Alle controles vóór de Clerk-call: rechten, tenantgrens, en de uniciteit van
 * het uitnodigingsadres.
 *
 * Die uniciteit is geen luxe. `users.upsert` koppelt bij de eerste login met
 * `.first()` op `by_uitnodiging_email`: staan er twee openstaande uitnodigingen
 * op hetzelfde adres, dan bepaalt de opslagvolgorde welke medewerker het
 * account krijgt. Het schema kent geen unique-constraint, dus de bewaking zit
 * hier — op het schrijfpad dat de tweede rij zou maken.
 */
export const valideerUitnodiging = internalMutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    email: v.string(),
    rol: userRoleValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const org = await requireOrg(ctx);

    if (!UITNODIGBARE_ROLLEN.includes(args.rol as UserRole)) {
      throw new ConvexError(
        `De rol "${args.rol}" kan niet worden uitgenodigd voor het team`
      );
    }

    const email = normaliseerUitnodigingEmail(args.email);
    if (!email) {
      throw new ConvexError("Vul een e-mailadres in om iemand uit te nodigen");
    }

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker || medewerker.orgId !== org._id) {
      // Bewust dezelfde melding voor "bestaat niet" en "andere organisatie":
      // anders is dit een bevestiging dat een id elders bestaat.
      throw new AuthError("Medewerker niet gevonden");
    }
    if (medewerker.clerkUserId) {
      throw new ConvexError("Deze medewerker heeft al een account");
    }

    // Uniciteit 1 — een ándere medewerker in deze organisatie met een
    // openstaande uitnodiging op hetzelfde adres. De index is niet
    // org-gescoped, dus filteren we er zelf op; ingetrokken en geaccepteerde
    // uitnodigingen blokkeren niets.
    const zelfdeAdres = await ctx.db
      .query("medewerkers")
      .withIndex("by_uitnodiging_email", (q) =>
        q.eq("uitnodigingEmail", email)
      )
      .collect();
    const botsendeUitnodiging = zelfdeAdres.find(
      (m) =>
        m._id !== args.medewerkerId &&
        m.orgId === org._id &&
        m.uitnodigingStatus === "uitgenodigd"
    );
    if (botsendeUitnodiging) {
      throw new ConvexError(
        `Er staat al een uitnodiging open op ${email} (${botsendeUitnodiging.naam})`
      );
    }

    // Uniciteit 2 — er bestaat al een account op dit adres dat aan een ándere
    // medewerker hangt. Zonder deze check nodig je iemand uit op een adres
    // waarmee de koppeling nooit kan slagen (upsert koppelt een user maar aan
    // één medewerker) en blijft de uitnodiging eeuwig openstaan.
    const accounts = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const bezetAccount = accounts.find(
      (u) => u.linkedMedewerkerId && u.linkedMedewerkerId !== args.medewerkerId
    );
    if (bezetAccount) {
      throw new ConvexError(
        `Het account op ${email} is al aan een andere medewerker gekoppeld`
      );
    }

    return { clerkOrgId: org.clerkOrgId };
  },
});

/** Schrijft de uitnodiging weg nadat Clerk hem heeft aangenomen. */
export const registreerUitnodiging = internalMutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    email: v.string(),
    rol: userRoleValidator,
    clerkInvitationId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.medewerkerId, {
      uitnodigingEmail: normaliseerUitnodigingEmail(args.email),
      uitnodigingRol: args.rol,
      uitnodigingStatus: "uitgenodigd",
      uitnodigingClerkId: args.clerkInvitationId,
    });
    return null;
  },
});

/**
 * Nodig een medewerker uit voor de Clerk-organisatie.
 *
 * De Clerk-rol is grofmazig (admin/member) en stuurt alleen wat iemand in
 * Clerk zelf mag; de app-rol reist mee in `public_metadata.role` en wordt bij
 * de eerste login door `users.upsert` overgenomen — maar alleen als de user nog
 * de default-rol heeft. Uitnodigen degradeert dus nooit een bestaand account.
 */
export const stuurUitnodiging = action({
  args: {
    medewerkerId: v.id("medewerkers"),
    email: v.string(),
    rol: userRoleValidator,
  },
  handler: async (ctx, args) => {
    const { clerkOrgId } = await ctx.runMutation(
      internal.team.valideerUitnodiging,
      args
    );
    const secret = clerkSecret();
    const email = normaliseerUitnodigingEmail(args.email);

    const res = await fetch(
      `${CLERK_API}/organizations/${clerkOrgId}/invitations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          role: args.rol === "directie" ? "org:admin" : "org:member",
          public_metadata: { role: args.rol },
        }),
      }
    );
    if (!res.ok) {
      throw clerkFout("Clerk-uitnodiging", res.status, await res.text());
    }

    const invitation = (await res.json()) as { id: string };
    await ctx.runMutation(internal.team.registreerUitnodiging, {
      medewerkerId: args.medewerkerId,
      email,
      rol: args.rol,
      clerkInvitationId: invitation.id,
    });

    return { clerkInvitationId: invitation.id };
  },
});

// ============================================
// UITNODIGING INTREKKEN
// ============================================

export const valideerIntrekking = internalMutation({
  args: { medewerkerId: v.id("medewerkers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const org = await requireOrg(ctx);

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker || medewerker.orgId !== org._id) {
      throw new AuthError("Medewerker niet gevonden");
    }
    if (medewerker.uitnodigingStatus !== "uitgenodigd") {
      throw new ConvexError(
        "Voor deze medewerker staat geen uitnodiging open"
      );
    }

    return {
      clerkOrgId: org.clerkOrgId,
      uitnodigingClerkId: medewerker.uitnodigingClerkId,
    };
  },
});

/**
 * Wist het uitnodigingsadres en zet de status op "ingetrokken".
 *
 * `uitnodigingEmail: undefined` verwijdert het veld (ctx.db.patch doet dat bij
 * undefined). Dat is precies de bedoeling: zolang het adres blijft staan, kan
 * `users.upsert` er via `by_uitnodiging_email` op blijven matchen — de status
 * beschermt daar wel tegen, maar een ingetrokken uitnodiging hoort geen adres
 * meer te dragen dat elders de uniciteitscheck vult.
 */
export const registreerIntrekking = internalMutation({
  args: { medewerkerId: v.id("medewerkers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.medewerkerId, {
      uitnodigingStatus: "ingetrokken",
      uitnodigingEmail: undefined,
    });
    return null;
  },
});

/**
 * Trek een openstaande uitnodiging in.
 *
 * **Idempotent richting Clerk.** Kent Clerk de uitnodiging niet (meer) — 404,
 * of een 400 omdat hij al ingetrokken of geaccepteerd is — dan trekken we hem
 * lokaal tóch in. De alternatieve route (hard falen) laat de medewerker voor
 * altijd "uitgenodigd" heten in ons scherm terwijl er bij Clerk niets meer
 * openstaat, en daar is met geen enkele knop meer uit te komen. Andere fouten
 * (500, netwerkproblemen, verkeerde sleutel) gooien wél: dan is de toestand bij
 * Clerk onbekend en mogen we niet doen alsof het gelukt is.
 */
export const trekUitnodigingIn = action({
  args: { medewerkerId: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { clerkOrgId, uitnodigingClerkId } = await ctx.runMutation(
      internal.team.valideerIntrekking,
      args
    );

    // Een uitnodiging zonder invitation-id is nooit bij Clerk aangekomen
    // (of komt uit een migratie): niets in te trekken, alleen lokaal opruimen.
    if (uitnodigingClerkId) {
      const secret = clerkSecret();
      const res = await fetch(
        `${CLERK_API}/organizations/${clerkOrgId}/invitations/${uitnodigingClerkId}/revoke`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) {
        const body = await res.text();
        const alWeg =
          res.status === 404 ||
          (res.status === 400 && /revok|accept|already|not.?found/i.test(body));
        if (!alWeg) {
          throw clerkFout("Clerk-intrekking", res.status, body);
        }
        console.warn(
          `[team/trekUitnodigingIn] Clerk kende uitnodiging ${uitnodigingClerkId} niet meer (${res.status}) — lokaal alsnog ingetrokken`
        );
      }
    }

    await ctx.runMutation(internal.team.registreerIntrekking, args);
    return { success: true as const };
  },
});

// ============================================
// TOEGANG INTREKKEN
// ============================================

export const valideerToegangIntrekking = internalMutation({
  args: { medewerkerId: v.id("medewerkers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const org = await requireOrg(ctx);

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker || medewerker.orgId !== org._id) {
      throw new AuthError("Medewerker niet gevonden");
    }
    if (!medewerker.clerkUserId) {
      throw new ConvexError("Deze medewerker heeft geen actief account");
    }

    return { clerkOrgId: org.clerkOrgId, clerkUserId: medewerker.clerkUserId };
  },
});

/**
 * Ontkoppelt medewerker en account nadat het org-lidmaatschap weg is.
 *
 * De rol van het account blijft staan: toegang intrekken is geen rolwijziging,
 * en degraderen zou bij een herstel (opnieuw uitnodigen) stilzwijgend
 * rechten kosten. Rol wijzigen loopt via `users.updateUserRole`.
 */
export const registreerToegangIntrekking = internalMutation({
  args: { medewerkerId: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) return null;

    const clerkUserId = medewerker.clerkUserId;
    if (clerkUserId) {
      const account = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
        .unique();
      if (account) {
        await ctx.db.patch(account._id, { linkedMedewerkerId: undefined });
      }
    }

    await ctx.db.patch(args.medewerkerId, { clerkUserId: undefined });
    return null;
  },
});

/**
 * Haal iemand uit de Clerk-organisatie en ontkoppel het account.
 *
 * Let op het endpoint: `/organizations/{orgId}/memberships/{userId}` werkt op
 * het **Clerk-user-id**, niet op het membership-id. Het Clerk-account zelf
 * blijft bestaan — dat verwijderen is een aparte, zwaardere actie
 * (`users.deleteUser`).
 */
export const trekToegangIn = action({
  args: { medewerkerId: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const { clerkOrgId, clerkUserId } = await ctx.runMutation(
      internal.team.valideerToegangIntrekking,
      args
    );
    const secret = clerkSecret();

    const res = await fetch(
      `${CLERK_API}/organizations/${clerkOrgId}/memberships/${clerkUserId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      throw clerkFout("Clerk-lidmaatschap verwijderen", res.status, await res.text());
    }

    await ctx.runMutation(internal.team.registreerToegangIntrekking, args);
    return { success: true as const };
  },
});
