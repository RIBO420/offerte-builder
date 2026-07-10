/**
 * Transactionele mails — trigger-model + concept-wachtrij (PRD §2.7).
 *
 * Dekt:
 * 1. seed-defaults: vijf fase 1-events, idempotent, kantoor-only, alle op
 *    modus "concept" behalve lead_ontvangen ("automatisch", gedocumenteerd);
 * 2. trigger → concept-flow per event (zetTriggerMailKlaar): wachtrij,
 *    vertraging (status "gepland"), dedupe (geen dubbele mails), inactieve
 *    trigger = geen mail;
 * 3. §1.2: goedkeuren vereist de capability *versturen naar klant*
 *    (AuthError voor voorman/medewerker/klant); de cron zet vertraagde
 *    mails alleen KLAAR en verstuurt in concept-modus nooit zelf;
 * 4. MAILVEILIGHEID: automatisch-modus loopt uitsluitend via de verzend-
 *    actie en die is fail-closed — zonder EMAIL_VERZENDEN_ACTIEF="true"
 *    wordt er GEEN fetch naar Resend gedaan, alleen gelogd met status
 *    "onderdrukt (sandbox)" (email_logs + klanttijdlijn kanaal e-mail);
 * 5. inplan-mail-knop (maakInplanConcept): concept met juiste variabelen
 *    ({{beurtnaam}}, {{venster}}, {{klantnaam}}), idempotent per plantaak;
 * 6. offerte-opvolging: integratie met de bestaande offerte_reminders —
 *    één pad per reminder (concept-wachtrij OF bestaand mailpad), geen
 *    dubbele opvolgmails;
 * 7. event-hooks: offerte_verzonden (alleen klanten zonder portaal — geen
 *    dubbele mail naast de portaalnotificatie) en inplanning_bevestigd
 *    (opt-in per klant, default uit).
 *
 * E-mailveiligheid in tests: alles gemockt — vi.fn()-scheduler, gestubde
 * fetch en een niet-gezette EMAIL_VERZENDEN_ACTIEF. Er wordt nergens echt
 * gemaild.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockKlant,
  createMockOfferte,
  type MockCtx,
} from "../../helpers/convex-mock";
import { AuthError } from "../../../../convex/auth";
import {
  MAIL_EVENTS,
  MAIL_TRIGGER_DEFAULTS,
  MAIL_EVENT_LABELS,
  valideerMailTrigger,
  zetTriggerMailKlaar,
  vindBedrijfseigenaarId,
  seedDefaults,
  update as updateTrigger,
} from "../../../../convex/mailTriggers";
import {
  formatDatumNl,
  formatVenster,
  emailLogTypeVoorEvent,
  bewerk,
  keurGoedEnVerstuur,
  verwerp,
  maakInplanConcept,
  verwerkGeplandeMails,
  claimVoorVerzending,
  registreerVerzendResultaat,
  verstuurConceptMail,
} from "../../../../convex/conceptMails";
import {
  renderTemplateString,
  tekstNaarHtmlParagrafen,
  wrapInBrandedLayout,
} from "../../../../convex/lib/mailRender";
import { isEmailVerzendenActief } from "../../../../convex/lib/mailGuard";
import {
  processDueReminders,
  scheduleReminders,
} from "../../../../convex/offerteReminders";
import { updateStatus as offerteUpdateStatus } from "../../../../convex/offertes";
import { updatePlanning } from "../../../../convex/werkitems";
import { create as createConfiguratorAanvraag } from "../../../../convex/configuratorAanvragen";
import {
  MAIL_EVENTS as UI_EVENTS,
  MAIL_EVENT_LABELS as UI_LABELS,
} from "@/lib/mail-triggers";
import type { MutationCtx } from "../../../../convex/_generated/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AnyHandler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Convex registreert de handler op de functie zelf (func._handler). */
function handler(fn: unknown): AnyHandler {
  return (fn as { _handler: AnyHandler })._handler;
}

interface IndexConstraint {
  op: "eq" | "lte" | "gte" | "lt" | "gt";
  field: string;
  value: unknown;
}

/**
 * Index-bewuste variant van de mock-ctx: withIndex(q => q.eq(...).lte(...))
 * filtert echt op de opgegeven velden (de gedeelde helper negeert indexen,
 * wat voor dedupe-/event-lookups te los is).
 */
function createIndexAwareCtx(store: MockConvexStore): MockCtx {
  const ctx = createMockCtx(store);
  ctx.db.query = vi.fn((tableName: string) => {
    let docs = store.getAll(tableName);
    const builder = {
      withIndex: (
        _naam: string,
        fn?: (q: unknown) => unknown
      ) => {
        const constraints: IndexConstraint[] = [];
        const q = {
          eq: (field: string, value: unknown) => {
            constraints.push({ op: "eq", field, value });
            return q;
          },
          lte: (field: string, value: unknown) => {
            constraints.push({ op: "lte", field, value });
            return q;
          },
          gte: (field: string, value: unknown) => {
            constraints.push({ op: "gte", field, value });
            return q;
          },
          lt: (field: string, value: unknown) => {
            constraints.push({ op: "lt", field, value });
            return q;
          },
          gt: (field: string, value: unknown) => {
            constraints.push({ op: "gt", field, value });
            return q;
          },
        };
        if (fn) fn(q);
        docs = docs.filter((doc) =>
          constraints.every((c) => {
            const waarde = doc[c.field] as never;
            switch (c.op) {
              case "eq":
                return waarde === c.value;
              case "lte":
                return waarde <= (c.value as never);
              case "gte":
                return waarde >= (c.value as never);
              case "lt":
                return waarde < (c.value as never);
              case "gt":
                return waarde > (c.value as never);
            }
          })
        );
        return builder;
      },
      filter: () => builder,
      order: () => builder,
      collect: async () => [...docs],
      first: async () => docs[0] ?? null,
      unique: async () => docs[0] ?? null,
      take: async (n: number) => docs.slice(0, n),
    };
    return builder;
  });
  return ctx;
}

/** Ctx + store met precies één ingelogde gebruiker met de gegeven rol. */
function ctxMetRol(role: string) {
  const store = new MockConvexStore();
  const userId = store.insert("users", createMockUser({ role }));
  const ctx = createIndexAwareCtx(store);
  return { ctx, store, userId };
}

/** Seed alle standaardtriggers direct in de store (zonder handler). */
function seedTriggersInStore(store: MockConvexStore) {
  const ids: Record<string, string> = {};
  for (const seed of MAIL_TRIGGER_DEFAULTS) {
    ids[seed.event] = store.insert("mailTriggers", {
      ...seed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return ids;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ─── 1. Domeinconstanten + seed ──────────────────────────────────────────────

describe("MAIL_TRIGGER_DEFAULTS (seed, PRD §2.7)", () => {
  it("dekt precies alle events (fase 1 + debiteurenladder §3.2), elk uniek", () => {
    expect(MAIL_TRIGGER_DEFAULTS.map((t) => t.event).sort()).toEqual(
      [...MAIL_EVENTS].sort()
    );
    expect(new Set(MAIL_TRIGGER_DEFAULTS.map((t) => t.event)).size).toBe(
      MAIL_EVENTS.length
    );
  });

  it("staat op modus 'concept' behalve de onpersoonlijke ontvangstbevestigingen (automatisch, gedocumenteerd)", () => {
    // §1.2: alleen onpersoonlijke bevestigingen mogen default automatisch —
    // de lead-bevestiging (fase 1) en de portaal-meldingbevestiging (§3.1).
    const automatischeEvents = ["lead_ontvangen", "melding_ontvangen"];
    for (const seed of MAIL_TRIGGER_DEFAULTS) {
      if (automatischeEvents.includes(seed.event)) {
        expect(seed.modus).toBe("automatisch");
        // De keuze is gedocumenteerd op het record zelf
        expect(seed.omschrijving).toContain("automatisch");
        expect(seed.omschrijving.toLowerCase()).toContain("mail-guard");
      } else {
        expect(seed.modus).toBe("concept");
      }
    }
  });

  it("documenteert variabelen per sjabloon en gebruikt ze in de inhoud", () => {
    for (const seed of MAIL_TRIGGER_DEFAULTS) {
      expect(seed.variabelen.length).toBeGreaterThan(0);
      const tekst = `${seed.onderwerp}\n${seed.inhoud}`;
      const gebruikt = [...tekst.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      for (const variabele of gebruikt) {
        expect(seed.variabelen).toContain(variabele);
      }
    }
  });

  it("inplan-mail bevat beurt- en venster-variabelen (PRD §2.1)", () => {
    const inplan = MAIL_TRIGGER_DEFAULTS.find(
      (t) => t.event === "inplan_attendering"
    )!;
    expect(inplan.inhoud).toContain("{{beurtnaam}}");
    expect(inplan.inhoud).toContain("{{venster}}");
    expect(inplan.modus).toBe("concept");
  });

  it("UI-constanten (src/lib/mail-triggers) lopen in de pas met convex", () => {
    expect([...UI_EVENTS]).toEqual([...MAIL_EVENTS]);
    for (const event of MAIL_EVENTS) {
      expect(UI_LABELS[event]).toBe(MAIL_EVENT_LABELS[event]);
    }
  });
});

describe("seedDefaults (idempotent, kantoor-only)", () => {
  it("maakt alle triggers aan en slaat ze bij een tweede run over", async () => {
    const { ctx } = ctxMetRol("directie");

    const eerste = (await handler(seedDefaults)(ctx, {})) as {
      aangemaakt: number;
    };
    expect(eerste.aangemaakt).toBe(MAIL_EVENTS.length);

    const tweede = (await handler(seedDefaults)(ctx, {})) as {
      aangemaakt: number;
    };
    expect(tweede.aangemaakt).toBe(0);
  });

  it("weigert niet-kantoor (medewerker → AuthError)", async () => {
    const { ctx } = ctxMetRol("medewerker");
    await expect(handler(seedDefaults)(ctx, {})).rejects.toThrow(AuthError);
  });

  it("update valideert invoer (lege inhoud, negatieve vertraging)", async () => {
    const { ctx, store } = ctxMetRol("directie");
    const ids = seedTriggersInStore(store);
    const id = ids.offerte_verzonden;

    await expect(
      handler(updateTrigger)(ctx, { id, inhoud: "  " })
    ).rejects.toThrow(ConvexError);
    await expect(
      handler(updateTrigger)(ctx, { id, vertragingDagen: -1 })
    ).rejects.toThrow(ConvexError);

    await handler(updateTrigger)(ctx, { id, vertragingDagen: 3, modus: "concept" });
    const trigger = store.getAll("mailTriggers").find((t) => t._id === id)!;
    expect(trigger.vertragingDagen).toBe(3);
  });

  it("valideerMailTrigger: custom-ontvanger vereist geldig e-mailadres", () => {
    expect(() =>
      valideerMailTrigger({ ontvanger: "custom", customEmail: "nope" })
    ).toThrow(ConvexError);
    expect(() =>
      valideerMailTrigger({ ontvanger: "custom", customEmail: "a@b.nl" })
    ).not.toThrow();
    expect(() => valideerMailTrigger({ modus: "spam" })).toThrow(ConvexError);
  });
});

// ─── 2. Render-helpers ───────────────────────────────────────────────────────

describe("mailRender (principe 3: huisstijl in de layout, niet in de tekst)", () => {
  it("renderTemplateString vult variabelen in en laat onbekende staan", () => {
    expect(
      renderTemplateString("Beste {{naam}}, ref {{referentie}} {{x}}", {
        naam: "Jan",
        referentie: "CFG-1",
      })
    ).toBe("Beste Jan, ref CFG-1 {{x}}");
  });

  it("tekstNaarHtmlParagrafen escapet HTML (kantoor-invoer is nooit HTML)", () => {
    const html = tekstNaarHtmlParagrafen("Alinea 1 <script>\n\nAlinea 2");
    expect(html).toContain("&lt;script&gt;");
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("wrapInBrandedLayout zet de body in de huisstijl-layout", () => {
    const html = wrapInBrandedLayout({
      bedrijfsNaam: "Top Tuinen",
      bedrijfsEmail: "info@toptuinen.nl",
      bedrijfsTelefoon: "0123",
      title: "Testmail",
      bodyHtml: "<p>Inhoud</p>",
    });
    expect(html).toContain("Top Tuinen");
    expect(html).toContain("<p>Inhoud</p>");
    expect(html).toContain("Met vriendelijke groet");
  });

  it("formatVenster maakt een leesbare periode-tekst", () => {
    expect(formatDatumNl("2026-03-15")).toBe("15 maart 2026");
    expect(formatVenster("2026-03-15", "2026-04-01")).toBe(
      "van 15 maart 2026 tot 1 april 2026"
    );
    expect(formatVenster("2026-03-15", undefined)).toBe("vanaf 15 maart 2026");
    expect(formatVenster(undefined, undefined)).toBe("die wij voorstellen");
  });

  it("emailLogTypeVoorEvent mapt events op het bestaande email_logs-patroon", () => {
    expect(emailLogTypeVoorEvent("offerte_verzonden")).toBe("offerte_verzonden");
    expect(emailLogTypeVoorEvent("offerte_opvolging")).toBe("herinnering");
    expect(emailLogTypeVoorEvent("lead_ontvangen")).toBe("lead_ontvangen");
    expect(emailLogTypeVoorEvent("iets_nieuws")).toBe("trigger_mail");
  });
});

// ─── 3. Trigger → concept-flow (zetTriggerMailKlaar) ─────────────────────────

describe("zetTriggerMailKlaar (trigger-motor)", () => {
  it("doet niets zonder trigger-record of met inactieve trigger", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");

    const zonder = await zetTriggerMailKlaar(ctx as unknown as MutationCtx, {
      event: "offerte_verzonden",
      userId: userId as never,
      ontvangerEmail: "klant@test.nl",
      ontvangerNaam: "Klant",
      variabelen: {},
    });
    expect(zonder).toEqual({ aangemaakt: false, reden: "geen_trigger" });

    seedTriggersInStore(store);
    for (const trigger of store.getAll("mailTriggers")) {
      store.patch(trigger._id, { actief: false });
    }
    const inactief = await zetTriggerMailKlaar(ctx as unknown as MutationCtx, {
      event: "offerte_verzonden",
      userId: userId as never,
      ontvangerEmail: "klant@test.nl",
      ontvangerNaam: "Klant",
      variabelen: {},
    });
    expect(inactief).toEqual({ aangemaakt: false, reden: "trigger_inactief" });
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("concept-modus: mail in de wachtrij, variabelen gerenderd, NIETS ingepland voor verzending", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    seedTriggersInStore(store);

    const resultaat = await zetTriggerMailKlaar(ctx as unknown as MutationCtx, {
      event: "offerte_verzonden",
      userId: userId as never,
      ontvangerEmail: "jan@devries.nl",
      ontvangerNaam: "Jan de Vries",
      variabelen: {
        klantnaam: "Jan de Vries",
        offerteNummer: "OFF-2026-042",
        offerteBedrag: "€ 4.356,00",
        offerteLink: "https://app.toptuinen.nl/offerte/tok",
      },
      dedupeSleutel: "offerte_verzonden:offertes:1",
    });

    expect(resultaat.aangemaakt).toBe(true);
    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].status).toBe("wachtrij");
    expect(mails[0].modus).toBe("concept");
    expect(mails[0].onderwerp).toContain("OFF-2026-042");
    expect(mails[0].inhoud).toContain("Jan de Vries");
    expect(mails[0].inhoud).toContain("https://app.toptuinen.nl/offerte/tok");
    // Concept-modus: kantoor keurt goed — er wordt niets ingepland/verstuurd
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("dedupe: zelfde sleutel = geen tweede mail (idempotent)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    seedTriggersInStore(store);
    const args = {
      event: "offerte_verzonden",
      userId: userId as never,
      ontvangerEmail: "jan@devries.nl",
      ontvangerNaam: "Jan",
      variabelen: {},
      dedupeSleutel: "offerte_verzonden:offertes:1",
    };

    const eerste = await zetTriggerMailKlaar(
      ctx as unknown as MutationCtx,
      args
    );
    const tweede = await zetTriggerMailKlaar(
      ctx as unknown as MutationCtx,
      args
    );
    expect(eerste.aangemaakt).toBe(true);
    expect(tweede).toEqual({ aangemaakt: false, reden: "duplicaat" });
    expect(store.getAll("conceptMails")).toHaveLength(1);
  });

  it("automatisch-modus zonder vertraging plant de verzend-actie in (die achter de guard zit)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    seedTriggersInStore(store);

    const resultaat = await zetTriggerMailKlaar(ctx as unknown as MutationCtx, {
      event: "lead_ontvangen",
      userId: userId as never,
      ontvangerEmail: "lead@test.nl",
      ontvangerNaam: "Lead",
      variabelen: { naam: "Lead", referentie: "CFG-1" },
    });

    expect(resultaat.aangemaakt).toBe(true);
    const mails = store.getAll("conceptMails");
    expect(mails[0].modus).toBe("automatisch");
    expect(mails[0].status).toBe("wachtrij");
    // Alleen de interne verzend-actie wordt ingepland — geen directe fetch
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("vertragingDagen > 0: status 'gepland', ook in automatisch-modus wordt niets ingepland", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const ids = seedTriggersInStore(store);
    store.patch(ids.lead_ontvangen, { vertragingDagen: 2 });

    await zetTriggerMailKlaar(ctx as unknown as MutationCtx, {
      event: "lead_ontvangen",
      userId: userId as never,
      ontvangerEmail: "lead@test.nl",
      ontvangerNaam: "Lead",
      variabelen: {},
    });

    const mails = store.getAll("conceptMails");
    expect(mails[0].status).toBe("gepland");
    expect(mails[0].geplandOp).toBeGreaterThan(Date.now() + 1.5 * 86400000);
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("forceerConcept overschrijft automatisch-modus (persoonlijke mails, §1.2)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    seedTriggersInStore(store);

    await zetTriggerMailKlaar(ctx as unknown as MutationCtx, {
      event: "lead_ontvangen",
      userId: userId as never,
      ontvangerEmail: "lead@test.nl",
      ontvangerNaam: "Lead",
      variabelen: {},
      forceerConcept: true,
    });

    expect(store.getAll("conceptMails")[0].modus).toBe("concept");
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("vindBedrijfseigenaarId vindt de directie-gebruiker (multi-tenant scope)", async () => {
    const store = new MockConvexStore();
    store.insert("users", createMockUser({ role: "medewerker", clerkId: "x" }));
    const directieId = store.insert(
      "users",
      createMockUser({ role: "directie", clerkId: "y" })
    );
    const ctx = createIndexAwareCtx(store);
    expect(
      await vindBedrijfseigenaarId(ctx as unknown as MutationCtx)
    ).toBe(directieId);
  });
});

// ─── 4. Wachtrij: bewerken, goedkeuren (§1.2), verwerpen, cron ───────────────

function storeMetConceptMail(
  role: string,
  overrides: Record<string, unknown> = {}
) {
  const { ctx, store, userId } = ctxMetRol(role);
  const klantId = store.insert("klanten", createMockKlant(userId));
  const mailId = store.insert("conceptMails", {
    userId,
    event: "offerte_verzonden",
    klantId,
    ontvangerEmail: "jan@devries.nl",
    ontvangerNaam: "Jan de Vries",
    onderwerp: "Uw offerte OFF-2026-001",
    inhoud: "Beste Jan,\n\nUw offerte staat klaar.",
    geplandOp: Date.now(),
    status: "wachtrij",
    modus: "concept",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  store.patch(mailId, overrides);
  return { ctx, store, userId, klantId, mailId };
}

describe("Concept-mails-wachtrij (§2.7 + kantoor↔klant-regel §1.2)", () => {
  it("bewerk wijzigt alleen inhoudsvelden en weigert afgehandelde mails", async () => {
    const { ctx, store, mailId } = storeMetConceptMail("directie");

    await handler(bewerk)(ctx, {
      id: mailId,
      onderwerp: "Aangepast onderwerp",
      inhoud: "Aangepaste inhoud",
    });
    const mail = store.getAll("conceptMails")[0];
    expect(mail.onderwerp).toBe("Aangepast onderwerp");

    store.patch(mailId, { status: "verzonden" });
    await expect(
      handler(bewerk)(ctx, { id: mailId, onderwerp: "Nogmaals" })
    ).rejects.toThrow(ConvexError);
  });

  it("goedkeuren + versturen vereist kantoor: AuthError voor voorman/medewerker/klant", async () => {
    for (const rol of ["voorman", "medewerker", "klant"]) {
      const { ctx, mailId } = storeMetConceptMail(rol);
      await expect(
        handler(keurGoedEnVerstuur)(ctx, { id: mailId })
      ).rejects.toThrow(AuthError);
    }
  });

  it("goedkeuren door kantoor plant de verzend-actie in en stempelt de behandelaar", async () => {
    const { ctx, store, mailId, userId } = storeMetConceptMail("directie");

    await handler(keurGoedEnVerstuur)(ctx, { id: mailId });

    const mail = store.getAll("conceptMails")[0];
    expect(mail.behandeldDoorId).toBe(userId);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);

    // Een al afgehandelde mail kan niet opnieuw
    store.patch(mailId, { status: "verzonden" });
    await expect(
      handler(keurGoedEnVerstuur)(ctx, { id: mailId })
    ).rejects.toThrow(ConvexError);
  });

  it("verwerpen zet de status op 'verworpen' zonder iets in te plannen", async () => {
    const { ctx, store, mailId } = storeMetConceptMail("projectleider");
    await handler(verwerp)(ctx, { id: mailId });
    expect(store.getAll("conceptMails")[0].status).toBe("verworpen");
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("cron: due 'gepland' → wachtrij; concept-modus verstuurt NOOIT, automatisch plant de actie in", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const basis = {
      userId,
      event: "offerte_opvolging",
      ontvangerEmail: "jan@devries.nl",
      ontvangerNaam: "Jan",
      onderwerp: "Opvolging",
      inhoud: "Inhoud",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const dueConcept = store.insert("conceptMails", {
      ...basis,
      geplandOp: Date.now() - 1000,
      status: "gepland",
      modus: "concept",
    });
    const dueAutomatisch = store.insert("conceptMails", {
      ...basis,
      geplandOp: Date.now() - 1000,
      status: "gepland",
      modus: "automatisch",
    });
    const nietDue = store.insert("conceptMails", {
      ...basis,
      geplandOp: Date.now() + 86400000,
      status: "gepland",
      modus: "concept",
    });

    const resultaat = (await handler(verwerkGeplandeMails)(ctx, {})) as {
      naarWachtrij: number;
      automatischIngepland: number;
    };

    expect(resultaat.naarWachtrij).toBe(2);
    expect(resultaat.automatischIngepland).toBe(1);
    const byId = (id: string) =>
      store.getAll("conceptMails").find((m) => m._id === id)!;
    expect(byId(dueConcept).status).toBe("wachtrij");
    expect(byId(dueAutomatisch).status).toBe("wachtrij");
    expect(byId(nietDue).status).toBe("gepland");
    // Alleen de automatisch-mail krijgt een verzend-actie (achter de guard)
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });
});

// ─── 5. Mail-guard: zonder EMAIL_VERZENDEN_ACTIEF gaat er NIETS extern ───────

describe("Mail-guard-dekking (fail-closed, EMAIL_VERZENDEN_ACTIEF)", () => {
  it("guard is fail-closed: alleen exact 'true' activeert verzenden", () => {
    expect(isEmailVerzendenActief({})).toBe(false);
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "false" })).toBe(false);
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "TRUE" })).toBe(false);
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "1" })).toBe(false);
    expect(isEmailVerzendenActief({ EMAIL_VERZENDEN_ACTIEF: "true" })).toBe(true);
  });

  it("verstuurConceptMail doet ZONDER guard geen enkele fetch en logt 'onderdrukt (sandbox)'", async () => {
    vi.stubEnv("EMAIL_VERZENDEN_ACTIEF", "false");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch mag niet gebeuren"));

    const concept = {
      _id: "conceptMails:1",
      userId: "users:1",
      event: "lead_ontvangen",
      ontvangerEmail: "lead@test.nl",
      ontvangerNaam: "Lead",
      onderwerp: "Ontvangstbevestiging",
      inhoud: "Beste lead",
      status: "wachtrij",
      modus: "automatisch",
      geplandOp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const mutaties: Array<{ args: Record<string, unknown> }> = [];
    const actionCtx = {
      runMutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        mutaties.push({ args });
        // eerste aanroep = claimVoorVerzending → geef het concept terug
        return mutaties.length === 1 ? concept : undefined;
      }),
      runQuery: vi.fn(async () => null),
    };

    const resultaat = (await handler(verstuurConceptMail)(actionCtx, {
      conceptMailId: concept._id,
    })) as { success: boolean; error?: string };

    expect(resultaat).toEqual({ success: false, error: "email_sandbox" });
    expect(fetchSpy).not.toHaveBeenCalled();
    // Guard-resultaat wordt geregistreerd (claim + registreerVerzendResultaat)
    expect(mutaties).toHaveLength(2);
    expect(mutaties[1].args.status).toBe("onderdrukt (sandbox)");
  });

  it("claim beschermt tegen dubbel versturen; registreer logt email_logs + tijdlijn (kanaal email)", async () => {
    const { ctx, store, mailId, klantId } = storeMetConceptMail("directie");

    const claim1 = await handler(claimVoorVerzending)(ctx, {
      conceptMailId: mailId,
    });
    const claim2 = await handler(claimVoorVerzending)(ctx, {
      conceptMailId: mailId,
    });
    expect(claim1).not.toBeNull();
    expect(claim2).toBeNull(); // al onderweg — geen dubbele verzending

    await handler(registreerVerzendResultaat)(ctx, {
      conceptMailId: mailId,
      status: "onderdrukt (sandbox)",
      foutmelding: "EMAIL_VERZENDEN_ACTIEF staat niet op 'true'",
    });

    const mail = store.getAll("conceptMails")[0];
    expect(mail.status).toBe("onderdrukt (sandbox)");

    // email_logs volgens het bestaande patroon — óók bij onderdrukking
    const logs = store.getAll("email_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("onderdrukt (sandbox)");
    expect(logs[0].type).toBe("offerte_verzonden");

    // Klanttijdlijn: kanaal e-mail, met de sandbox-status in de tekst
    const tijdlijn = store.getAll("klantTijdlijn");
    expect(tijdlijn).toHaveLength(1);
    expect(tijdlijn[0].kanaal).toBe("email");
    expect(tijdlijn[0].eventType).toBe("mail_verzonden");
    expect(tijdlijn[0].klantId).toBe(klantId);
    expect(tijdlijn[0].tekst).toContain("onderdrukt (sandbox)");
  });

  it("registreer 'verzonden' logt de tijdlijn met status verzonden", async () => {
    const { ctx, store, mailId } = storeMetConceptMail("directie");
    await handler(registreerVerzendResultaat)(ctx, {
      conceptMailId: mailId,
      status: "verzonden",
      resendId: "re_123",
    });
    expect(store.getAll("conceptMails")[0].status).toBe("verzonden");
    expect(store.getAll("conceptMails")[0].resendId).toBe("re_123");
    expect(store.getAll("klantTijdlijn")[0].tekst).toContain("verzonden");
  });
});

// ─── 6. Inplan-mail vanuit de plantaak (§2.1/§2.7) ───────────────────────────

function storeMetPlantaak(role = "directie") {
  const { ctx, store, userId } = ctxMetRol(role);
  const klantId = store.insert(
    "klanten",
    createMockKlant(userId, { naam: "Fam. Jansen", email: "jansen@test.nl" })
  );
  const beurtId = store.insert("projecten", {
    userId,
    klantId,
    naam: "Snoeibeurt",
    type: "onderhoudsbeurt",
    status: "gepland",
    volgendeVoorzieneDatum: "2026-04-01",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const meldingId = store.insert("servicemeldingen", {
    userId,
    klantId,
    beschrijving: "Snoeibeurt (Fam. Jansen) inplannen",
    isGarantie: false,
    status: "nieuw",
    prioriteit: "normaal",
    kosten: 0,
    taaksoort: "plantaak",
    werkitemId: beurtId,
    deadline: "2026-03-15",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  seedTriggersInStore(store);
  return { ctx, store, userId, klantId, beurtId, meldingId };
}

describe("maakInplanConcept (inplan-mail-knop op het meldingen-bord)", () => {
  it("zet een concept klaar met beurt-/venster-variabelen; kantoor keurt goed in de wachtrij", async () => {
    const { ctx, store, meldingId, klantId, beurtId } = storeMetPlantaak();

    const resultaat = (await handler(maakInplanConcept)(ctx, {
      meldingId,
    })) as { conceptMailId: string };
    expect(resultaat.conceptMailId).toBeDefined();

    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].status).toBe("wachtrij");
    expect(mails[0].modus).toBe("concept"); // forceerConcept — nooit automatisch
    expect(mails[0].event).toBe("inplan_attendering");
    expect(mails[0].klantId).toBe(klantId);
    expect(mails[0].werkitemId).toBe(beurtId);
    expect(mails[0].meldingId).toBe(meldingId);
    expect(mails[0].ontvangerEmail).toBe("jansen@test.nl");
    // Variabelen gerenderd: beurtnaam + venster + klantnaam
    expect(mails[0].onderwerp).toContain("Snoeibeurt");
    expect(mails[0].inhoud).toContain("Fam. Jansen");
    expect(mails[0].inhoud).toContain("van 15 maart 2026 tot 1 april 2026");
    // Er wordt vanuit de knop niets verstuurd of ingepland
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    // En de case-thread krijgt een systeemcomment
    expect(
      store
        .getAll("meldingComments")
        .some((c) => String(c.tekst).includes("Inplan-mail klaargezet"))
    ).toBe(true);
  });

  it("is idempotent per plantaak (tweede klik → nette fout, geen dubbele mail)", async () => {
    const { ctx, store, meldingId } = storeMetPlantaak();
    await handler(maakInplanConcept)(ctx, { meldingId });
    await expect(
      handler(maakInplanConcept)(ctx, { meldingId })
    ).rejects.toThrow(ConvexError);
    expect(store.getAll("conceptMails")).toHaveLength(1);
  });

  it("weigert niet-plantaken, klanten zonder e-mail en niet-kantoor-rollen", async () => {
    const { ctx, store, meldingId, klantId } = storeMetPlantaak();

    store.patch(klantId, { email: undefined });
    await expect(
      handler(maakInplanConcept)(ctx, { meldingId })
    ).rejects.toThrow(ConvexError);

    store.patch(klantId, { email: "jansen@test.nl" });
    store.patch(meldingId, { taaksoort: "melding" });
    await expect(
      handler(maakInplanConcept)(ctx, { meldingId })
    ).rejects.toThrow(ConvexError);

    const { ctx: veldCtx, meldingId: veldMelding } =
      storeMetPlantaak("medewerker");
    await expect(
      handler(maakInplanConcept)(veldCtx, { meldingId: veldMelding })
    ).rejects.toThrow(AuthError);
  });
});

// ─── 7. Offerte-opvolging: bestaande reminders, geen dubbele mails ───────────

function storeMetDueReminder(triggerModus?: "concept" | "automatisch" | "uit") {
  const { ctx, store, userId } = ctxMetRol("directie");
  const klantId = store.insert("klanten", createMockKlant(userId));
  const offerteId = store.insert(
    "offertes",
    createMockOfferte(userId, klantId, {
      status: "verzonden",
      klant: {
        naam: "Jan de Vries",
        adres: "Tulpstraat 12",
        postcode: "1234 AB",
        plaats: "Amsterdam",
        email: "jan@devries.nl",
      },
      shareToken: "tok123",
    })
  );
  store.insert("offerte_reminders", {
    offerteId,
    userId,
    type: "niet_bekeken",
    scheduledAt: Date.now() - 1000,
    status: "pending",
  });
  if (triggerModus && triggerModus !== "uit") {
    const ids = seedTriggersInStore(store);
    store.patch(ids.offerte_opvolging, { modus: triggerModus });
  } else if (triggerModus === "uit") {
    const ids = seedTriggersInStore(store);
    store.patch(ids.offerte_opvolging, { actief: false });
  }
  // processDueReminders roept intern notifications aan via ctx.runMutation
  (ctx as unknown as { runMutation: unknown }).runMutation = vi.fn(
    async () => undefined
  );
  return { ctx, store, userId, offerteId, klantId };
}

describe("offerte_opvolging — integratie met offerte_reminders (geen dubbele mails)", () => {
  it("trigger op 'concept' (default): due reminder zet een concept-mail klaar en verstuurt niets", async () => {
    const { ctx, store, offerteId } = storeMetDueReminder("concept");

    const resultaat = (await handler(processDueReminders)(ctx, {})) as {
      processedCount: number;
    };
    expect(resultaat.processedCount).toBe(1);

    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].event).toBe("offerte_opvolging");
    expect(mails[0].offerteId).toBe(offerteId);
    expect(mails[0].status).toBe("wachtrij");
    expect(mails[0].onderwerp).toContain("OFF-2026-001");
    // Bestaand direct-mailpad wordt NIET ook nog ingepland (geen dubbele mail)
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    // Reminder is afgehandeld — een tweede run doet niets meer
    const tweede = (await handler(processDueReminders)(ctx, {})) as {
      processedCount: number;
    };
    expect(tweede.processedCount).toBe(0);
    expect(store.getAll("conceptMails")).toHaveLength(1);
  });

  it("trigger op 'automatisch': het bestaande herinnerings-pad (achter de guard), géén concept-mail", async () => {
    const { ctx, store } = storeMetDueReminder("automatisch");
    await handler(processDueReminders)(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("zonder trigger-record blijft het bestaande gedrag intact (backwards compatible)", async () => {
    const { ctx, store } = storeMetDueReminder(undefined);
    await handler(processDueReminders)(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });

  it("trigger inactief: alleen interne notificatie, geen klant-mail in welk pad dan ook", async () => {
    const { ctx, store } = storeMetDueReminder("uit");
    await handler(processDueReminders)(ctx, {});
    expect(store.getAll("conceptMails")).toHaveLength(0);
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("scheduleReminders blijft idempotent (geen dubbele pending reminders)", async () => {
    const { ctx, store, userId } = ctxMetRol("directie");
    const klantId = store.insert("klanten", createMockKlant(userId));
    const offerteId = store.insert(
      "offertes",
      createMockOfferte(userId, klantId, { status: "verzonden" })
    );

    await handler(scheduleReminders)(ctx, { offerteId });
    const eerste = store.getAll("offerte_reminders").length;
    await handler(scheduleReminders)(ctx, { offerteId });
    expect(store.getAll("offerte_reminders")).toHaveLength(eerste);
    expect(eerste).toBe(3); // dag 3/7/14
  });
});

// ─── 8. Event-hooks: offerte_verzonden + inplanning_bevestigd + lead ─────────

describe("Event-hooks (additief op bestaande flows)", () => {
  it("offerte → verzonden: concept-mail voor klant ZONDER portaal (mét portaal: alleen de portaalnotificatie — geen dubbele mail)", async () => {
    // Klant zonder portaal → concept-mail
    {
      const { ctx, store, userId } = ctxMetRol("directie");
      seedTriggersInStore(store);
      const klantId = store.insert(
        "klanten",
        createMockKlant(userId, { portalEnabled: false })
      );
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, klantId, { status: "concept", bron: "vrij" })
      );
      await handler(offerteUpdateStatus)(ctx, {
        id: offerteId,
        status: "verzonden",
      });
      const mails = store.getAll("conceptMails");
      expect(mails).toHaveLength(1);
      expect(mails[0].event).toBe("offerte_verzonden");
      expect(mails[0].status).toBe("wachtrij");
    }
    // Klant mét portaal → géén concept-mail (portaalpad bestaat al)
    {
      const { ctx, store, userId } = ctxMetRol("directie");
      seedTriggersInStore(store);
      const klantId = store.insert(
        "klanten",
        createMockKlant(userId, { portalEnabled: true })
      );
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, klantId, { status: "concept", bron: "vrij" })
      );
      await handler(offerteUpdateStatus)(ctx, {
        id: offerteId,
        status: "verzonden",
      });
      expect(store.getAll("conceptMails")).toHaveLength(0);
    }
  });

  it("inplannen werkitem: concept alleen bij klant-opt-in (inplanBevestigingsMail, default uit)", async () => {
    // Default (uit): geen concept
    {
      const { ctx, store, userId } = ctxMetRol("directie");
      seedTriggersInStore(store);
      const klantId = store.insert("klanten", createMockKlant(userId));
      const werkitemId = store.insert("projecten", {
        userId,
        klantId,
        naam: "Voorjaarsbeurt",
        type: "onderhoudsbeurt",
        status: "gepland",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await handler(updatePlanning)(ctx, {
        id: werkitemId,
        geplandeStart: "2026-05-14",
      });
      expect(store.getAll("conceptMails")).toHaveLength(0);
    }
    // Opt-in: concept met datum-variabele
    {
      const { ctx, store, userId } = ctxMetRol("directie");
      seedTriggersInStore(store);
      const klantId = store.insert(
        "klanten",
        createMockKlant(userId, { inplanBevestigingsMail: true })
      );
      const teamId = store.insert("teams", {
        userId,
        naam: "Team Groen",
        createdAt: Date.now(),
      });
      const werkitemId = store.insert("projecten", {
        userId,
        klantId,
        naam: "Voorjaarsbeurt",
        type: "onderhoudsbeurt",
        status: "gepland",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await handler(updatePlanning)(ctx, {
        id: werkitemId,
        geplandeStart: "2026-05-14",
        teamId,
      });
      const mails = store.getAll("conceptMails");
      expect(mails).toHaveLength(1);
      expect(mails[0].event).toBe("inplanning_bevestigd");
      expect(mails[0].status).toBe("wachtrij");
      expect(mails[0].onderwerp).toContain("14 mei 2026");
      expect(mails[0].inhoud).toContain("Team Groen");
      // Concept-modus: niets ingepland voor verzending
      expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
    }
  });

  it("nieuwe configurator-aanvraag: lead_ontvangen-bevestiging via het trigger-model (automatisch = via verzend-actie achter de guard)", async () => {
    const { ctx, store } = ctxMetRol("directie");
    seedTriggersInStore(store);

    await handler(createConfiguratorAanvraag)(ctx, {
      type: "gazon",
      klantNaam: "Piet Lead",
      klantEmail: "Piet@Lead.nl",
      klantTelefoon: "0612345678",
      klantAdres: "Straat 1",
      klantPostcode: "1234ab",
      klantPlaats: "Utrecht",
      specificaties: {
        oppervlakte: 50,
        typeGras: "sport",
        ondergrond: "zand",
        drainage: false,
        opsluitbanden: false,
        opsluitbandenMeters: 0,
        poortbreedte: 100,
      },
      indicatiePrijs: 1000,
    });

    const mails = store.getAll("conceptMails");
    expect(mails).toHaveLength(1);
    expect(mails[0].event).toBe("lead_ontvangen");
    expect(mails[0].ontvangerEmail).toBe("piet@lead.nl");
    expect(mails[0].modus).toBe("automatisch");
    expect(mails[0].inhoud).toContain("Piet Lead");
    expect(mails[0].onderwerp).toContain("CFG-");
    // Automatisch = verzend-actie ingepland; die zit achter de mail-guard
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });
});
