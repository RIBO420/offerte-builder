import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Validators voor nieuwe velden
const specialisatieValidator = v.object({
  scope: v.string(),
  niveau: v.union(v.literal("junior"), v.literal("midlevel"), v.literal("senior")),
  gecertificeerd: v.optional(v.boolean()),
});

const certificaatValidator = v.object({
  naam: v.string(),
  uitgifteDatum: v.number(),
  vervaldatum: v.optional(v.number()),
  documentUrl: v.optional(v.string()),
});

const beschikbaarheidValidator = v.object({
  werkdagen: v.array(v.number()),
  urenPerWeek: v.number(),
  maxUrenPerDag: v.number(),
});

const adresValidator = v.object({
  straat: v.string(),
  postcode: v.string(),
  plaats: v.string(),
});

const noodcontactValidator = v.object({
  naam: v.string(),
  telefoon: v.string(),
  relatie: v.string(),
});

// Haal alle medewerkers op voor de ingelogde gebruiker
// Optionele filter op isActief status
export const list = query({
  args: {
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Als isActief filter meegegeven, gebruik de samengestelde index
    if (args.isActief !== undefined) {
      return await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", userId).eq("isActief", args.isActief!)
        )
        .collect();
    }

    // Anders haal alle medewerkers op
    return await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Haal een enkele medewerker op (met eigenaarschap verificatie)
export const get = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const medewerker = await ctx.db.get(args.id);

    if (!medewerker) return null;
    if (medewerker.userId.toString() !== userId.toString()) {
      return null;
    }

    return medewerker;
  },
});

// Haal alleen actieve medewerkers op (voor dropdowns/selecties)
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", userId).eq("isActief", true)
      )
      .collect();
  },
});

// Maak een nieuwe medewerker aan
export const create = mutation({
  args: {
    naam: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()),
    uurtarief: v.optional(v.number()),
    notities: v.optional(v.string()),
    specialisaties: v.optional(v.array(specialisatieValidator)),
    certificaten: v.optional(v.array(certificaatValidator)),
    beschikbaarheid: v.optional(beschikbaarheidValidator),
    contractType: v.optional(
      v.union(
        v.literal("fulltime"),
        v.literal("parttime"),
        v.literal("zzp"),
        v.literal("seizoen")
      )
    ),
    adres: v.optional(adresValidator),
    noodcontact: v.optional(noodcontactValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("medewerkers", {
      userId,
      naam: args.naam,
      email: args.email,
      telefoon: args.telefoon,
      functie: args.functie,
      uurtarief: args.uurtarief,
      notities: args.notities,
      specialisaties: args.specialisaties,
      certificaten: args.certificaten,
      beschikbaarheid: args.beschikbaarheid,
      contractType: args.contractType,
      adres: args.adres,
      noodcontact: args.noodcontact,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Type definities voor update
type Specialisatie = {
  scope: string;
  niveau: "junior" | "midlevel" | "senior";
  gecertificeerd?: boolean;
};

type Certificaat = {
  naam: string;
  uitgifteDatum: number;
  vervaldatum?: number;
  documentUrl?: string;
};

type Beschikbaarheid = {
  werkdagen: number[];
  urenPerWeek: number;
  maxUrenPerDag: number;
};

type Adres = {
  straat: string;
  postcode: string;
  plaats: string;
};

type Noodcontact = {
  naam: string;
  telefoon: string;
  relatie: string;
};

// Werk een medewerker bij (met eigenaarschap verificatie)
export const update = mutation({
  args: {
    id: v.id("medewerkers"),
    naam: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()),
    uurtarief: v.optional(v.number()),
    notities: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
    specialisaties: v.optional(v.array(specialisatieValidator)),
    certificaten: v.optional(v.array(certificaatValidator)),
    beschikbaarheid: v.optional(beschikbaarheidValidator),
    contractType: v.optional(
      v.union(
        v.literal("fulltime"),
        v.literal("parttime"),
        v.literal("zzp"),
        v.literal("seizoen")
      )
    ),
    adres: v.optional(adresValidator),
    noodcontact: v.optional(noodcontactValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    // Bouw update object expliciet (geen dynamic object access)
    const updateData: {
      naam?: string;
      email?: string;
      telefoon?: string;
      functie?: string;
      uurtarief?: number;
      notities?: string;
      isActief?: boolean;
      specialisaties?: Specialisatie[];
      certificaten?: Certificaat[];
      beschikbaarheid?: Beschikbaarheid;
      contractType?: "fulltime" | "parttime" | "zzp" | "seizoen";
      adres?: Adres;
      noodcontact?: Noodcontact;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.naam !== undefined) updateData.naam = args.naam;
    if (args.email !== undefined) updateData.email = args.email;
    if (args.telefoon !== undefined) updateData.telefoon = args.telefoon;
    if (args.functie !== undefined) updateData.functie = args.functie;
    if (args.uurtarief !== undefined) updateData.uurtarief = args.uurtarief;
    if (args.notities !== undefined) updateData.notities = args.notities;
    if (args.isActief !== undefined) updateData.isActief = args.isActief;
    if (args.specialisaties !== undefined) updateData.specialisaties = args.specialisaties;
    if (args.certificaten !== undefined) updateData.certificaten = args.certificaten;
    if (args.beschikbaarheid !== undefined) updateData.beschikbaarheid = args.beschikbaarheid;
    if (args.contractType !== undefined) updateData.contractType = args.contractType;
    if (args.adres !== undefined) updateData.adres = args.adres;
    if (args.noodcontact !== undefined) updateData.noodcontact = args.noodcontact;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Soft delete: zet isActief op false (met eigenaarschap verificatie)
export const remove = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Permanent verwijderen (met eigenaarschap verificatie)
export const hardDelete = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ============================================
// Uitgebreide queries en mutations
// ============================================

// Haal medewerker op met gewerkte uren statistieken
export const getWithStats = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const medewerker = await ctx.db.get(args.id);

    if (!medewerker) return null;
    if (medewerker.userId.toString() !== userId.toString()) {
      return null;
    }

    // Haal alle urenregistraties op voor deze medewerker
    const alleUrenRegistraties = await ctx.db
      .query("urenRegistraties")
      .collect();

    // Filter op medewerker naam (urenRegistraties gebruikt medewerker naam, niet ID)
    const medewerkerUren = alleUrenRegistraties.filter(
      (ur) => ur.medewerker === medewerker.naam
    );

    // Bereken totaal gewerkte uren
    const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);

    // Uren per maand (laatste 12 maanden)
    const now = new Date();
    const urenPerMaand: { maand: string; uren: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const maandStr = date.toISOString().slice(0, 7); // YYYY-MM
      const maandUren = medewerkerUren
        .filter((ur) => ur.datum.startsWith(maandStr))
        .reduce((sum, ur) => sum + ur.uren, 0);
      urenPerMaand.push({
        maand: maandStr,
        uren: maandUren,
      });
    }

    // Unieke projecten
    const uniekeProjectIds = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))];

    return {
      ...medewerker,
      stats: {
        totaalUren,
        aantalRegistraties: medewerkerUren.length,
        aantalProjecten: uniekeProjectIds.length,
        urenPerMaand,
        gemiddeldeUrenPerRegistratie: medewerkerUren.length > 0
          ? Math.round((totaalUren / medewerkerUren.length) * 100) / 100
          : 0,
      },
    };
  },
});

// Haal medewerkers op met prestatie metrics
export const getMedewerkersMetPrestaties = query({
  args: {
    periode: v.optional(v.object({
      van: v.number(), // timestamp
      tot: v.number(), // timestamp
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Haal alle actieve medewerkers op
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", userId).eq("isActief", true)
      )
      .collect();

    // Haal alle urenregistraties op
    let urenRegistraties = await ctx.db.query("urenRegistraties").collect();

    // Filter op periode indien opgegeven
    if (args.periode) {
      const vanDatum = new Date(args.periode.van).toISOString().slice(0, 10);
      const totDatum = new Date(args.periode.tot).toISOString().slice(0, 10);
      urenRegistraties = urenRegistraties.filter(
        (ur) => ur.datum >= vanDatum && ur.datum <= totDatum
      );
    }

    // Haal projecten op voor efficiëntie berekening
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const afgerondeProjecten = projecten.filter(
      (p) => p.status === "afgerond" || p.status === "nacalculatie_compleet" || p.status === "gefactureerd"
    );

    // Haal voorcalculaties op voor norm uren
    const voorcalculaties = await ctx.db.query("voorcalculaties").collect();

    // Bereken prestaties per medewerker
    const medewerkersMetPrestaties = medewerkers.map((medewerker) => {
      const medewerkerUren = urenRegistraties.filter(
        (ur) => ur.medewerker === medewerker.naam
      );

      const totaalUren = medewerkerUren.reduce((sum, ur) => sum + ur.uren, 0);
      const aantalProjecten = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))].length;

      // Bereken efficiëntie ratio (werkelijke uren vs norm uren)
      let efficiëntieRatio: number | null = null;
      let totaalNormUren = 0;
      let totaalWerkelijkeUren = 0;

      const medewerkerProjectIds = [...new Set(medewerkerUren.map((ur) => ur.projectId.toString()))];

      for (const projectIdStr of medewerkerProjectIds) {
        const project = afgerondeProjecten.find((p) => p._id.toString() === projectIdStr);
        if (project) {
          const voorcalc = voorcalculaties.find(
            (vc) => vc.projectId?.toString() === projectIdStr || vc.offerteId?.toString() === project.offerteId.toString()
          );
          if (voorcalc) {
            // Proportioneel deel van norm uren (gebaseerd op bijdrage aan project)
            const projectUren = medewerkerUren
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            const totaalProjectUren = urenRegistraties
              .filter((ur) => ur.projectId.toString() === projectIdStr)
              .reduce((sum, ur) => sum + ur.uren, 0);

            if (totaalProjectUren > 0) {
              const proportie = projectUren / totaalProjectUren;
              totaalNormUren += voorcalc.normUrenTotaal * proportie;
              totaalWerkelijkeUren += projectUren;
            }
          }
        }
      }

      if (totaalNormUren > 0) {
        efficiëntieRatio = Math.round((totaalNormUren / totaalWerkelijkeUren) * 100) / 100;
      }

      // Uren per scope
      const urenPerScope: Record<string, number> = {};
      for (const ur of medewerkerUren) {
        if (ur.scope) {
          urenPerScope[ur.scope] = (urenPerScope[ur.scope] || 0) + ur.uren;
        }
      }

      return {
        medewerker: {
          _id: medewerker._id,
          naam: medewerker.naam,
          functie: medewerker.functie,
          contractType: medewerker.contractType,
        },
        prestaties: {
          totaalUren,
          aantalProjecten,
          efficiëntieRatio, // > 1 = sneller dan norm, < 1 = langzamer dan norm
          urenPerScope,
          gemiddeldeUrenPerProject: aantalProjecten > 0
            ? Math.round((totaalUren / aantalProjecten) * 100) / 100
            : 0,
        },
      };
    });

    // Sorteer op totaal uren (meest actieve eerst)
    return medewerkersMetPrestaties.sort(
      (a, b) => b.prestaties.totaalUren - a.prestaties.totaalUren
    );
  },
});

// Zoek medewerkers op specialisatie/scope
export const getBySpecialisatie = query({
  args: {
    scope: v.string(),
    minimumNiveau: v.optional(v.union(
      v.literal("junior"),
      v.literal("midlevel"),
      v.literal("senior")
    )),
    alleenGecertificeerd: v.optional(v.boolean()),
    alleenActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Haal medewerkers op
    let medewerkers;
    if (args.alleenActief !== false) {
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", userId).eq("isActief", true)
        )
        .collect();
    } else {
      medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    }

    // Niveau volgorde voor filtering
    const niveauVolgorde = { junior: 1, midlevel: 2, senior: 3 };
    const minimumNiveauWaarde = args.minimumNiveau
      ? niveauVolgorde[args.minimumNiveau]
      : 0;

    // Filter op specialisatie
    const gefilterdeM = medewerkers.filter((m) => {
      if (!m.specialisaties) return false;

      const matchendeSpec = m.specialisaties.find((s) => {
        // Check scope match
        if (s.scope.toLowerCase() !== args.scope.toLowerCase()) return false;

        // Check minimum niveau
        if (niveauVolgorde[s.niveau] < minimumNiveauWaarde) return false;

        // Check certificering indien vereist
        if (args.alleenGecertificeerd && !s.gecertificeerd) return false;

        return true;
      });

      return matchendeSpec !== undefined;
    });

    // Return met relevante specialisatie info
    return gefilterdeM.map((m) => {
      const relevantSpec = m.specialisaties?.find(
        (s) => s.scope.toLowerCase() === args.scope.toLowerCase()
      );
      return {
        ...m,
        relevanteSpecialisatie: relevantSpec,
      };
    });
  },
});

// Update of voeg certificaat toe
export const updateCertificaat = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    certificaat: certificaatValidator,
    actie: v.union(v.literal("toevoegen"), v.literal("bijwerken"), v.literal("verwijderen")),
    certificaatIndex: v.optional(v.number()), // Index voor bijwerken/verwijderen
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    const certificaten = medewerker.certificaten || [];

    switch (args.actie) {
      case "toevoegen":
        certificaten.push(args.certificaat);
        break;

      case "bijwerken":
        if (args.certificaatIndex === undefined || args.certificaatIndex < 0 || args.certificaatIndex >= certificaten.length) {
          throw new Error("Ongeldige certificaat index");
        }
        certificaten[args.certificaatIndex] = args.certificaat;
        break;

      case "verwijderen":
        if (args.certificaatIndex === undefined || args.certificaatIndex < 0 || args.certificaatIndex >= certificaten.length) {
          throw new Error("Ongeldige certificaat index");
        }
        certificaten.splice(args.certificaatIndex, 1);
        break;
    }

    await ctx.db.patch(args.medewerkerId, {
      certificaten,
      updatedAt: Date.now(),
    });

    return args.medewerkerId;
  },
});

// Check certificaten die (bijna) verlopen
export const checkVervaldataCertificaten = query({
  args: {
    dagenVoorwaarschuwing: v.optional(v.number()), // Default: 30 dagen
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const waarschuwingsDagen = args.dagenVoorwaarschuwing || 30;
    const waarschuwingsDrempel = Date.now() + (waarschuwingsDagen * 24 * 60 * 60 * 1000);

    // Haal alle actieve medewerkers op
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", userId).eq("isActief", true)
      )
      .collect();

    const resultaten: {
      medewerker: { _id: typeof medewerkers[0]["_id"]; naam: string };
      certificaat: { naam: string; vervaldatum: number };
      status: "verlopen" | "bijna_verlopen";
      dagenTotVerval: number;
    }[] = [];

    const now = Date.now();

    for (const medewerker of medewerkers) {
      if (!medewerker.certificaten) continue;

      for (const cert of medewerker.certificaten) {
        if (!cert.vervaldatum) continue; // Permanente certificaten overslaan

        const dagenTotVerval = Math.floor(
          (cert.vervaldatum - now) / (24 * 60 * 60 * 1000)
        );

        if (cert.vervaldatum < now) {
          // Verlopen
          resultaten.push({
            medewerker: { _id: medewerker._id, naam: medewerker.naam },
            certificaat: { naam: cert.naam, vervaldatum: cert.vervaldatum },
            status: "verlopen",
            dagenTotVerval,
          });
        } else if (cert.vervaldatum < waarschuwingsDrempel) {
          // Bijna verlopen
          resultaten.push({
            medewerker: { _id: medewerker._id, naam: medewerker.naam },
            certificaat: { naam: cert.naam, vervaldatum: cert.vervaldatum },
            status: "bijna_verlopen",
            dagenTotVerval,
          });
        }
      }
    }

    // Sorteer: verlopen eerst, dan op dagen tot verval
    return resultaten.sort((a, b) => {
      if (a.status === "verlopen" && b.status !== "verlopen") return -1;
      if (a.status !== "verlopen" && b.status === "verlopen") return 1;
      return a.dagenTotVerval - b.dagenTotVerval;
    });
  },
});
