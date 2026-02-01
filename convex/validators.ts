/**
 * Convex Validators for Scope Data
 * 
 * These validators provide runtime type checking for scope data in Convex.
 * They mirror the Zod schemas used in the frontend.
 */

import { v } from "convex/values";

// ==================== COMMON TYPES ====================

export const bereikbaarheidValidator = v.union(
  v.literal("goed"),
  v.literal("beperkt"),
  v.literal("slecht")
);

export const achterstalligingValidator = v.union(
  v.literal("laag"),
  v.literal("gemiddeld"),
  v.literal("hoog")
);

export const intensiteitValidator = v.union(
  v.literal("weinig"),
  v.literal("gemiddeld"),
  v.literal("veel")
);

export const snijwerkValidator = v.union(
  v.literal("laag"),
  v.literal("gemiddeld"),
  v.literal("hoog")
);

// ==================== AANLEG SCOPE VALIDATORS ====================

export const grondwerkValidator = v.object({
  oppervlakte: v.number(),
  diepte: v.union(v.literal("licht"), v.literal("standaard"), v.literal("zwaar")),
  afvoerGrond: v.boolean(),
});

export const bestratingValidator = v.object({
  oppervlakte: v.number(),
  typeBestrating: v.union(v.literal("tegel"), v.literal("klinker"), v.literal("natuursteen")),
  snijwerk: snijwerkValidator,
  onderbouw: v.object({
    type: v.union(v.literal("zandbed"), v.literal("zand_fundering"), v.literal("zware_fundering")),
    dikteOnderlaag: v.number(),
    opsluitbanden: v.boolean(),
  }),
});

export const bordersValidator = v.object({
  oppervlakte: v.number(),
  beplantingsintensiteit: intensiteitValidator,
  bodemverbetering: v.boolean(),
  afwerking: v.union(v.literal("geen"), v.literal("schors"), v.literal("grind")),
});

export const grasValidator = v.object({
  oppervlakte: v.number(),
  type: v.union(v.literal("zaaien"), v.literal("graszoden")),
  ondergrond: v.union(v.literal("bestaand"), v.literal("nieuw")),
  afwateringNodig: v.boolean(),
});

export const houtwerkValidator = v.object({
  typeHoutwerk: v.union(v.literal("schutting"), v.literal("vlonder"), v.literal("pergola")),
  afmeting: v.number(),
  fundering: v.union(v.literal("standaard"), v.literal("zwaar")),
});

export const waterElektraValidator = v.object({
  verlichting: v.union(v.literal("geen"), v.literal("basis"), v.literal("uitgebreid")),
  aantalPunten: v.number(),
  sleuvenNodig: v.boolean(),
});

export const specialsItemValidator = v.object({
  type: v.union(v.literal("jacuzzi"), v.literal("sauna"), v.literal("prefab")),
  omschrijving: v.string(),
});

export const specialsValidator = v.object({
  items: v.array(specialsItemValidator),
});

// Combined aanleg scope data validator
export const aanlegScopeDataValidator = v.object({
  grondwerk: v.optional(grondwerkValidator),
  bestrating: v.optional(bestratingValidator),
  borders: v.optional(bordersValidator),
  gras: v.optional(grasValidator),
  houtwerk: v.optional(houtwerkValidator),
  water_elektra: v.optional(waterElektraValidator),
  specials: v.optional(specialsValidator),
});

// ==================== ONDERHOUD SCOPE VALIDATORS ====================

export const grasOnderhoudValidator = v.object({
  grasAanwezig: v.boolean(),
  grasOppervlakte: v.number(),
  maaien: v.boolean(),
  kantenSteken: v.boolean(),
  verticuteren: v.boolean(),
  afvoerGras: v.boolean(),
});

export const bordersOnderhoudValidator = v.object({
  borderOppervlakte: v.number(),
  onderhoudsintensiteit: intensiteitValidator,
  onkruidVerwijderen: v.boolean(),
  snoeiInBorders: v.union(v.literal("geen"), v.literal("licht"), v.literal("zwaar")),
  bodem: v.union(v.literal("open"), v.literal("bedekt")),
  afvoerGroenafval: v.boolean(),
});

export const heggenOnderhoudValidator = v.object({
  lengte: v.number(),
  hoogte: v.number(),
  breedte: v.number(),
  snoei: v.union(v.literal("zijkanten"), v.literal("bovenkant"), v.literal("beide")),
  afvoerSnoeisel: v.boolean(),
});

export const bomenOnderhoudValidator = v.object({
  aantalBomen: v.number(),
  snoei: v.union(v.literal("licht"), v.literal("zwaar")),
  hoogteklasse: v.union(v.literal("laag"), v.literal("middel"), v.literal("hoog")),
  afvoer: v.boolean(),
});

export const overigeOnderhoudValidator = v.object({
  bladruimen: v.boolean(),
  terrasReinigen: v.boolean(),
  terrasOppervlakte: v.optional(v.number()),
  onkruidBestrating: v.boolean(),
  bestratingOppervlakte: v.optional(v.number()),
  afwateringControleren: v.boolean(),
  aantalAfwateringspunten: v.optional(v.number()),
  overigNotities: v.optional(v.string()),
  overigUren: v.optional(v.number()),
});

// Combined onderhoud scope data validator
export const onderhoudScopeDataValidator = v.object({
  tuinOppervlakte: v.optional(v.number()), // Algemeen tuinoppervlakte voor onderhoud
  gras: v.optional(grasOnderhoudValidator),
  borders: v.optional(bordersOnderhoudValidator),
  heggen: v.optional(heggenOnderhoudValidator),
  bomen: v.optional(bomenOnderhoudValidator),
  overig: v.optional(overigeOnderhoudValidator),
});

// ==================== COMBINED VALIDATOR ====================

// This validator can handle both aanleg and onderhoud scope data
// The discriminant is the offerte type, but for flexibility we allow both
export const scopeDataValidator = v.union(
  aanlegScopeDataValidator,
  onderhoudScopeDataValidator
);

// ==================== USER ROLE VALIDATORS ====================

/**
 * User roles for role-based access control (RBAC)
 *
 * - admin: Full access to all features, can manage users, medewerkers, and all data
 * - medewerker: Limited access, can only see own data, linked to a medewerker profile
 * - viewer: Read-only access to allowed features
 */
export const userRoleValidator = v.union(
  v.literal("admin"),
  v.literal("medewerker"),
  v.literal("viewer")
);
