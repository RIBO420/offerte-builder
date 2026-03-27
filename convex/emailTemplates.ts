import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireDirectieOrProjectleider } from "./roles";

// ── Trigger types ────────────────────────────────────────────────────
const VALID_TRIGGERS = [
  "offerte_verzonden",
  "factuur_verzonden",
  "herinnering_1",
  "herinnering_2",
  "herinnering_3",
  "aanmaning_1",
  "aanmaning_2",
  "ingebrekestelling",
  "oplevering",
  "contract_verlenging",
] as const;

// ── Variables per trigger type ───────────────────────────────────────
const COMMON_VARIABLES = ["klantNaam", "bedrijfsNaam", "bedrijfsEmail", "bedrijfsTelefoon"];
const OFFERTE_VARIABLES = [...COMMON_VARIABLES, "offerteNummer", "offerteBedrag", "offerteLink", "offerteType", "scopes"];
const FACTUUR_VARIABLES = [...COMMON_VARIABLES, "factuurNummer", "factuurBedrag", "betaalLink", "vervaldatum", "factuurDatum", "iban"];
const PROJECT_VARIABLES = [...COMMON_VARIABLES, "projectNaam", "projectAdres"];

export const TRIGGER_VARIABLE_MAP: Record<string, string[]> = {
  offerte_verzonden: OFFERTE_VARIABLES,
  herinnering_1: OFFERTE_VARIABLES,
  herinnering_2: OFFERTE_VARIABLES,
  herinnering_3: OFFERTE_VARIABLES,
  factuur_verzonden: FACTUUR_VARIABLES,
  aanmaning_1: [...FACTUUR_VARIABLES, "dagenVerlopen"],
  aanmaning_2: [...FACTUUR_VARIABLES, "dagenVerlopen"],
  ingebrekestelling: [...FACTUUR_VARIABLES, "dagenVerlopen"],
  oplevering: PROJECT_VARIABLES,
  contract_verlenging: [...PROJECT_VARIABLES, "contractEinddatum"],
};

// ── Default templates (extracted from hardcoded src/emails/) ─────────
export const DEFAULT_TEMPLATES: Array<{
  naam: string;
  trigger: string;
  onderwerp: string;
  inhoud: string;
}> = [
  {
    naam: "Offerte verzonden",
    trigger: "offerte_verzonden",
    onderwerp: "Offerte {{offerteNummer}} van {{bedrijfsNaam}}",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>Hierbij ontvangt u de offerte voor de werkzaamheden aan uw tuin.</p>
<p>De offerte is als PDF bijgevoegd bij deze email. Heeft u vragen of wilt u de offerte bespreken? Neem dan gerust contact met ons op.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Factuur verzonden",
    trigger: "factuur_verzonden",
    onderwerp: "Factuur {{factuurNummer}} van {{bedrijfsNaam}}",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>Hierbij ontvangt u de factuur voor de uitgevoerde werkzaamheden. Wij danken u voor uw vertrouwen in {{bedrijfsNaam}}.</p>
<p>De factuur is als PDF bijgevoegd bij deze email. Heeft u vragen over deze factuur? Neem dan gerust contact met ons op.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Herinnering offerte (1e)",
    trigger: "herinnering_1",
    onderwerp: "Herinnering: Offerte {{offerteNummer}}",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>We willen u graag herinneren aan de offerte die we eerder hebben gestuurd. We horen graag of u nog vragen heeft.</p>
<p>De offerte blijft geldig tot 30 dagen na verzending.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Herinnering offerte (2e)",
    trigger: "herinnering_2",
    onderwerp: "2e Herinnering: Offerte {{offerteNummer}}",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>We hebben nog geen reactie ontvangen op onze offerte {{offerteNummer}}. Graag horen wij of u interesse heeft of dat er nog vragen zijn.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Herinnering offerte (3e)",
    trigger: "herinnering_3",
    onderwerp: "Laatste herinnering: Offerte {{offerteNummer}}",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>Dit is onze laatste herinnering betreffende offerte {{offerteNummer}}. Mocht u geen interesse meer hebben, dan horen wij dat ook graag zodat wij ons dossier kunnen sluiten.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Betalingsherinnering (1e aanmaning)",
    trigger: "aanmaning_1",
    onderwerp: "1e Aanmaning: Factuur {{factuurNummer}}",
    inhoud: `<p>Geachte {{klantNaam}},</p>
<p>Ondanks onze eerdere herinnering hebben wij nog geen betaling ontvangen voor factuur {{factuurNummer}} ter waarde van {{factuurBedrag}}. De vervaldatum was {{vervaldatum}} ({{dagenVerlopen}} dagen geleden).</p>
<p>Wij verzoeken u vriendelijk om het openstaande bedrag zo spoedig mogelijk te voldoen.</p>
<p>IBAN: {{iban}}<br/>Onder vermelding van: {{factuurNummer}}</p>
<p>Mocht u de betaling inmiddels hebben voldaan, dan kunt u dit schrijven als niet verzonden beschouwen.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Betalingsherinnering (2e aanmaning)",
    trigger: "aanmaning_2",
    onderwerp: "2e Aanmaning: Factuur {{factuurNummer}}",
    inhoud: `<p>Geachte {{klantNaam}},</p>
<p>Tot onze spijt moeten wij constateren dat, ondanks onze eerdere aanmaning, de betaling van factuur {{factuurNummer}} nog steeds niet is ontvangen. Het openstaande bedrag is {{factuurBedrag}}.</p>
<p>Wij verzoeken u met klem het openstaande bedrag binnen 7 dagen te voldoen.</p>
<p>Indien wij binnen 7 dagen geen betaling hebben ontvangen, zijn wij genoodzaakt verdere stappen te ondernemen.</p>
<p>Hoogachtend,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Ingebrekestelling",
    trigger: "ingebrekestelling",
    onderwerp: "Ingebrekestelling: Factuur {{factuurNummer}}",
    inhoud: `<p>Geachte {{klantNaam}},</p>
<p>Ondanks herhaaldelijke aanmaningen hebben wij tot op heden geen betaling ontvangen voor factuur {{factuurNummer}} ter waarde van {{factuurBedrag}}. Bij deze stellen wij u formeel in gebreke conform artikel 6:82 van het Burgerlijk Wetboek.</p>
<p>Indien het volledige bedrag niet binnen 14 dagen na dagtekening op onze rekening is bijgeschreven, zien wij ons genoodzaakt de vordering uit handen te geven aan een incassobureau.</p>
<p>Hoogachtend,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Project opgeleverd",
    trigger: "oplevering",
    onderwerp: "Project {{projectNaam}} opgeleverd",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>Met genoegen kunnen wij u melden dat project {{projectNaam}} op {{projectAdres}} is opgeleverd.</p>
<p>Wij hopen dat u tevreden bent met het resultaat. Mocht u nog vragen of opmerkingen hebben, neem dan gerust contact met ons op.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
  {
    naam: "Contract verlenging",
    trigger: "contract_verlenging",
    onderwerp: "Verlenging onderhoudscontract - {{projectNaam}}",
    inhoud: `<p>Beste {{klantNaam}},</p>
<p>Het onderhoudscontract voor {{projectNaam}} op {{projectAdres}} loopt binnenkort af ({{contractEinddatum}}).</p>
<p>Wij stellen u graag een nieuw voorstel op voor de verlenging van het onderhoud. Neem contact met ons op om de mogelijkheden te bespreken.</p>
<p>Met vriendelijke groet,<br/><strong>{{bedrijfsNaam}}</strong></p>`,
  },
];

// ── Queries ──────────────────────────────────────────────────────────

/** List all templates for the authenticated user */
export const list = query({
  args: {
    trigger: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (args.trigger) {
      return await ctx.db
        .query("emailTemplates")
        .withIndex("by_trigger", (q) =>
          q.eq("userId", userId).eq("trigger", args.trigger!)
        )
        .collect();
    }

    return await ctx.db
      .query("emailTemplates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Get a single template by ID */
export const getById = query({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const template = await ctx.db.get(args.id);

    if (!template || template.userId.toString() !== userId.toString()) {
      throw new ConvexError("Template niet gevonden");
    }

    return template;
  },
});

/** Get the active template for a specific trigger */
export const getByTrigger = query({
  args: { trigger: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const templates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_trigger", (q) =>
        q.eq("userId", userId).eq("trigger", args.trigger)
      )
      .collect();

    // Return the first active template for this trigger
    return templates.find((t) => t.actief) ?? null;
  },
});

/** Get the active template for a trigger (internal — no auth required, for cron jobs/actions) */
export const getByTriggerInternal = internalQuery({
  args: { userId: v.id("users"), trigger: v.string() },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query("emailTemplates")
      .withIndex("by_trigger", (q) =>
        q.eq("userId", args.userId).eq("trigger", args.trigger)
      )
      .collect();

    // Return the first active template for this trigger
    return templates.find((t) => t.actief) ?? null;
  },
});

/** Get available variables for a trigger type */
export const getVariablesForTrigger = query({
  args: { trigger: v.string() },
  handler: async (_ctx, args) => {
    return TRIGGER_VARIABLE_MAP[args.trigger] ?? COMMON_VARIABLES;
  },
});

// ── Mutations ────────────────────────────────────────────────────────

/** Create a new email template */
export const create = mutation({
  args: {
    naam: v.string(),
    trigger: v.string(),
    onderwerp: v.string(),
    inhoud: v.string(),
    actief: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);

    if (!VALID_TRIGGERS.includes(args.trigger as (typeof VALID_TRIGGERS)[number])) {
      throw new ConvexError(`Ongeldige trigger: ${args.trigger}`);
    }

    const variabelen = TRIGGER_VARIABLE_MAP[args.trigger] ?? COMMON_VARIABLES;

    return await ctx.db.insert("emailTemplates", {
      userId: user._id,
      naam: args.naam,
      trigger: args.trigger,
      onderwerp: args.onderwerp,
      inhoud: args.inhoud,
      variabelen,
      actief: args.actief,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Update an existing email template */
export const update = mutation({
  args: {
    id: v.id("emailTemplates"),
    naam: v.optional(v.string()),
    trigger: v.optional(v.string()),
    onderwerp: v.optional(v.string()),
    inhoud: v.optional(v.string()),
    actief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);

    const template = await ctx.db.get(args.id);
    if (!template || template.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Template niet gevonden");
    }

    if (args.trigger && !VALID_TRIGGERS.includes(args.trigger as (typeof VALID_TRIGGERS)[number])) {
      throw new ConvexError(`Ongeldige trigger: ${args.trigger}`);
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.naam !== undefined) updates.naam = args.naam;
    if (args.trigger !== undefined) {
      updates.trigger = args.trigger;
      updates.variabelen = TRIGGER_VARIABLE_MAP[args.trigger] ?? COMMON_VARIABLES;
    }
    if (args.onderwerp !== undefined) updates.onderwerp = args.onderwerp;
    if (args.inhoud !== undefined) updates.inhoud = args.inhoud;
    if (args.actief !== undefined) updates.actief = args.actief;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/** Deactivate (soft delete) a template */
export const remove = mutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);

    const template = await ctx.db.get(args.id);
    if (!template || template.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Template niet gevonden");
    }

    await ctx.db.patch(args.id, {
      actief: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

/** Permanently delete a template */
export const permanentDelete = mutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);

    const template = await ctx.db.get(args.id);
    if (!template || template.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Template niet gevonden");
    }

    await ctx.db.delete(args.id);
  },
});

/** Seed default templates for the authenticated user */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireDirectieOrProjectleider(ctx);

    // Check if user already has templates
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      throw new ConvexError(
        "Er bestaan al templates. Gebruik 'Standaard herstellen' om te resetten."
      );
    }

    const now = Date.now();
    for (const tmpl of DEFAULT_TEMPLATES) {
      const variabelen = TRIGGER_VARIABLE_MAP[tmpl.trigger] ?? COMMON_VARIABLES;
      await ctx.db.insert("emailTemplates", {
        userId: user._id,
        naam: tmpl.naam,
        trigger: tmpl.trigger,
        onderwerp: tmpl.onderwerp,
        inhoud: tmpl.inhoud,
        variabelen,
        actief: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count: DEFAULT_TEMPLATES.length };
  },
});

/** Reset to defaults: delete all existing templates and re-seed */
export const resetToDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireDirectieOrProjectleider(ctx);

    // Delete all existing templates for this user
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const tmpl of existing) {
      await ctx.db.delete(tmpl._id);
    }

    // Re-seed defaults
    const now = Date.now();
    for (const tmpl of DEFAULT_TEMPLATES) {
      const variabelen = TRIGGER_VARIABLE_MAP[tmpl.trigger] ?? COMMON_VARIABLES;
      await ctx.db.insert("emailTemplates", {
        userId: user._id,
        naam: tmpl.naam,
        trigger: tmpl.trigger,
        onderwerp: tmpl.onderwerp,
        inhoud: tmpl.inhoud,
        variabelen,
        actief: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count: DEFAULT_TEMPLATES.length };
  },
});

// ── Template rendering (internal) ────────────────────────────────────

/** Render a template by replacing {{variables}} with actual values */
export const renderTemplate = internalMutation({
  args: {
    templateId: v.id("emailTemplates"),
    variables: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new ConvexError("Template niet gevonden");
    }

    const replaceVariables = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
        return args.variables[key] ?? match;
      });
    };

    return {
      onderwerp: replaceVariables(template.onderwerp),
      inhoud: replaceVariables(template.inhoud),
    };
  },
});
