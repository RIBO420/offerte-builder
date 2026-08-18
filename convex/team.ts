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

/**
 * "Wat je wilde weghalen, is er al niet meer."
 *
 * Zowel het intrekken van een uitnodiging als het verwijderen van een
 * org-lidmaatschap kan een toestand aantreffen die iemand anders al heeft
 * opgeruimd: handmatig in het Clerk-dashboard, door een eerdere poging die
 * halverwege afbrak, of doordat de uitnodiging inmiddels geaccepteerd is.
 * Clerk antwoordt daarop met 404, en soms met een 400 die het in de body
 * uitlegt. Beide betekenen voor ons hetzelfde: de Clerk-kant is klaar, dus de
 * lokale kant mag door.
 *
 * Hard falen zou het tegenovergestelde doen van wat de gebruiker vroeg: de
 * medewerker blijft dan voor altijd "uitgenodigd" of "actief" in ons scherm,
 * met een knop die het nooit meer kan rechtzetten.
 */
function clerkAlWeg(status: number, body: string): boolean {
  return (
    status === 404 ||
    (status === 400 && /revok|accept|already|not.?found|no.?such/i.test(body))
  );
}

/**
 * Clerk weigert een tweede openstaande uitnodiging voor hetzelfde adres met
 * een 400 `duplicate_record`. Dat is geen fout maar een feit: de uitnodiging
 * die we wilden versturen, bestaat al.
 */
function isDuplicaatUitnodiging(status: number, body: string): boolean {
  return status === 400 && /duplicate|already/i.test(body);
}

/**
 * Zoekt het invitation-id van een openstaande Clerk-uitnodiging op dit adres.
 *
 * Alleen gebruikt op het herstelpad hieronder: Clerk zegt "bestaat al", maar
 * vertelt niet welk id dat is, en zonder id kunnen we hem later niet intrekken.
 * Lukt de lookup niet, dan geeft deze functie `undefined` terug in plaats van
 * te gooien — een ontbrekend id is vervelend, een mislukte uitnodigingsknop is
 * erger.
 */
async function zoekOpenstaandeUitnodiging(
  clerkOrgId: string,
  secret: string,
  email: string
): Promise<string | undefined> {
  const res = await fetch(
    `${CLERK_API}/organizations/${clerkOrgId}/invitations?status=pending&limit=100`,
    { method: "GET", headers: { Authorization: `Bearer ${secret}` } }
  );
  if (!res.ok) {
    console.warn(
      `[team/zoekOpenstaandeUitnodiging] Clerk gaf ${res.status} bij het ophalen van openstaande uitnodigingen`
    );
    return undefined;
  }

  // Clerk geeft afhankelijk van de API-versie een kale array of {data: [...]}.
  const payload = (await res.json()) as
    | Array<{ id?: string; email_address?: string }>
    | { data?: Array<{ id?: string; email_address?: string }> };
  const rijen = Array.isArray(payload) ? payload : (payload.data ?? []);

  return rijen.find(
    (rij) => normaliseerUitnodigingEmail(rij.email_address ?? "") === email
  )?.id;
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
    //
    // `m._id !== args.medewerkerId` is bewust het eerste filter: opnieuw
    // uitnodigen van dezelfde persoon moet altijd mogen. Dat is óók het
    // herstelpad voor een wees-uitnodiging — status "uitgenodigd" zonder
    // `uitnodigingClerkId`, wat betekent dat de Clerk-call slaagde maar de
    // registratie erna niet (of andersom). Zonder deze uitzondering zou zo'n
    // half-afgemaakte uitnodiging zichzelf blokkeren en was de medewerker
    // via dit scherm niet meer te bereiken.
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

/**
 * Schrijft de uitnodiging weg nadat Clerk hem heeft aangenomen.
 *
 * `clerkInvitationId` is optioneel: op het herstelpad (Clerk kende de
 * uitnodiging al, en de lookup naar het bestaande id lukte niet) leggen we de
 * uitnodiging liever zonder id vast dan helemaal niet — anders ziet het scherm
 * niets terwijl er bij Clerk wél een mail is uitgegaan.
 */
export const registreerUitnodiging = internalMutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    email: v.string(),
    rol: userRoleValidator,
    clerkInvitationId: v.optional(v.string()),
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
 *
 * **Zelfherstellend bij een halve poging.** Er zit een venster tussen de
 * geslaagde Clerk-call en `registreerUitnodiging`: breekt het daar af, dan
 * staat er een uitnodiging bij Clerk waar wij niets van weten. Een tweede
 * poging voor dezelfde medewerker + hetzelfde adres loopt dan tegen Clerks
 * eigen duplicaatbewaking aan (400 `duplicate_record`). Die vangen we op als
 * "bestaat al, alleen nog registreren": we zoeken het id van de openstaande
 * uitnodiging op en leggen die alsnog vast. De retry repareert daarmee zichzelf
 * in plaats van de gebruiker een fout te tonen die hij niet kan verhelpen.
 */
export const stuurUitnodiging = action({
  args: {
    medewerkerId: v.id("medewerkers"),
    email: v.string(),
    rol: userRoleValidator,
  },
  // Expliciete return-annotatie: de handler roept via `internal.team` zijn
  // eigen module aan, dus zonder annotatie moet TypeScript het type van deze
  // action kennen om het type van deze action af te leiden. Dat is de bekende
  // Convex-circulariteit (TS7022/7023) — en die maakt niet alleen dit bestand
  // `any`, maar via `api`/`internal` élke useQuery in de web-app.
  handler: async (
    ctx,
    args
  ): Promise<{ clerkInvitationId: string | null }> => {
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
    let clerkInvitationId: string | undefined;
    if (res.ok) {
      clerkInvitationId = ((await res.json()) as { id: string }).id;
    } else {
      const body = await res.text();
      if (!isDuplicaatUitnodiging(res.status, body)) {
        throw clerkFout("Clerk-uitnodiging", res.status, body);
      }
      // Herstelpad: Clerk heeft deze uitnodiging al. De validatie hierboven
      // heeft al vastgesteld dat het adres binnen deze organisatie van niemand
      // anders is, dus dit is onze eigen halve poging — id ophalen en alsnog
      // registreren.
      clerkInvitationId = await zoekOpenstaandeUitnodiging(
        clerkOrgId,
        secret,
        email
      );
      console.warn(
        `[team/stuurUitnodiging] Clerk had al een openstaande uitnodiging op ${email}; lokaal geregistreerd${
          clerkInvitationId ? "" : " zónder invitation-id"
        }`
      );
    }

    await ctx.runMutation(internal.team.registreerUitnodiging, {
      medewerkerId: args.medewerkerId,
      email,
      rol: args.rol,
      clerkInvitationId,
    });

    return { clerkInvitationId: clerkInvitationId ?? null };
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
  // Zie stuurUitnodiging: annotatie verplicht door de zelfverwijzing via
  // `internal.team`.
  handler: async (ctx, args): Promise<{ success: true }> => {
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
        if (!clerkAlWeg(res.status, body)) {
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
 *
 * **Idempotent richting Clerk**, om dezelfde reden als bij het intrekken van een
 * uitnodiging: is het lidmaatschap al elders weggehaald (handmatig in het
 * Clerk-dashboard, of door een eerdere poging die na de DELETE afbrak), dan
 * ontkoppelen we lokaal alsnog. Zou dit hard falen, dan blijft `clerkUserId`
 * hangen en is de medewerker via dit scherm nooit meer los te koppelen —
 * terwijl zijn toegang bij Clerk al weg is. Andere fouten (500, verkeerde
 * sleutel) gooien wél: dan is de Clerk-toestand onbekend en zou lokaal
 * ontkoppelen ten onrechte suggereren dat de toegang eraf is.
 */
export const trekToegangIn = action({
  args: { medewerkerId: v.id("medewerkers") },
  // Zie stuurUitnodiging: annotatie verplicht door de zelfverwijzing via
  // `internal.team`.
  handler: async (ctx, args): Promise<{ success: true }> => {
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
      const body = await res.text();
      if (!clerkAlWeg(res.status, body)) {
        throw clerkFout("Clerk-lidmaatschap verwijderen", res.status, body);
      }
      console.warn(
        `[team/trekToegangIn] Clerk kende het lidmaatschap van ${clerkUserId} niet meer (${res.status}) — lokaal alsnog ontkoppeld`
      );
    }

    await ctx.runMutation(internal.team.registreerToegangIntrekking, args);
    return { success: true as const };
  },
});
