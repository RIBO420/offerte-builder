/**
 * Facturatie-engine onderhoud (PRD §2.8) — sluit de keten
 * contract → beurt → uitvoering → factuur.
 *
 * Instroom: afronding.ts (stap 9a) markeert een werkitem klaarVoorFacturatie
 * en roept direct verwerkKlaarVoorFacturatie aan. Per facturatiemodus van
 * het gekoppelde contract (getFacturatiemodus, default per_bezoek):
 *
 * - per_bezoek: één CONCEPT-factuur per klant per uitvoeringsdag; de
 *   afgeronde beurten van die dag worden als regels toegevoegd (bij
 *   deels-uitgevoerd alleen het uitgevoerde deel, §8.8).
 * - maandelijks_verzameld: regel(s) toevoegen aan de open
 *   maandverzamelfactuur van dat contract; bestaat die niet, dan wordt hij
 *   aangemaakt. De maandwissel-cron sluit de maand af (verzamelGesloten).
 * - vast_maandbedrag: GEEN actie vanuit beurten — het termijnschema
 *   (contractFacturen) is het enige spoor; factureerContractTermijnen zet
 *   geplande termijnen om in concept-facturen mét factuurId-terugkoppeling
 *   (dicht het oude dead-end, §2.8 punt 6). De twee sporen sluiten elkaar
 *   per contract uit.
 *
 * Alle concepten landen in de "Te versturen"-wachtrij; kantoor verstuurt
 * (ook in bulk). Uitzondering: contracten met directVersturen=true — dan
 * verstuurt de engine zelf via verstuurFactuurKern. De klantmail blijft
 * ALTIJD achter de mailGuard (sandbox verstuurt nooit); crons mailen dus
 * nooit zelf in concept-modus.
 *
 * Idempotentie: een beurt komt nooit twee keer op een factuur —
 * projecten.factuurId is de vergrendeling (gezet in dezelfde transactie
 * als de factuurregel). Termijnen idem via contractFacturen.factuurId.
 */

import { v, ConvexError } from "convex/values";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { assertKanNaarKlantVersturen } from "./roles";
import { verifyOwnership } from "./auth";
import { getFacturatiemodus } from "./onderhoudscontracten";
import {
  bepaalEngineActie,
  berekenFactuurTotalen,
  bouwRegelsUitTaakAfronding,
  datumVanDienstVan,
  DEFAULT_BTW_ONDERHOUD,
  effectieveStatussen,
  isVerzamelMaandVoorbij,
  magEngineDirectVersturen,
  verzamelMaandVan,
  type TaakPrijsbron,
} from "./facturatieLogica";
import { verstuurFactuurKern } from "./facturen";

const ENGINE_AUTEUR = "Facturatie-engine";

// ── Hulpfuncties ─────────────────────────────────────────────────────────

/** Nieuw factuurnummer via de instellingen-teller van het bedrijf. */
async function volgendFactuurnummer(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<{ factuurnummer: string; instellingen: Doc<"instellingen"> }> {
  const instellingen = await ctx.db
    .query("instellingen")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!instellingen) {
    throw new ConvexError(
      "Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens."
    );
  }
  const volgendNummer = (instellingen.laatsteFactuurNummer ?? 0) + 1;
  const jaar = new Date().getFullYear();
  const prefix = instellingen.factuurNummerPrefix ?? "FAC-";
  await ctx.db.patch(instellingen._id, {
    laatsteFactuurNummer: volgendNummer,
  });
  return {
    factuurnummer: `${prefix}${jaar}-${String(volgendNummer).padStart(3, "0")}`,
    instellingen,
  };
}

function klantSnapshot(klant: Doc<"klanten">) {
  return {
    naam: klant.naam,
    adres: klant.adres,
    postcode: klant.postcode,
    plaats: klant.plaats,
    email: klant.email,
    telefoon: klant.telefoon,
  };
}

function bedrijfSnapshot(instellingen: Doc<"instellingen">) {
  const b = instellingen.bedrijfsgegevens;
  return {
    naam: b.naam,
    adres: b.adres,
    postcode: b.postcode,
    plaats: b.plaats,
    kvk: b.kvk,
    btw: b.btw,
    iban: b.iban,
    email: b.email,
    telefoon: b.telefoon,
  };
}

let regelTeller = 0;
function nieuwRegelId(): string {
  regelTeller = (regelTeller + 1) % 1000;
  return `engine-${Date.now()}-${regelTeller}`;
}

/**
 * Prijsbronnen voor de taken van een beurt: eigen bouwsteenRegels
 * (losse beurt, prijsPerBeurt per regel) of de contractwerkzaamheid
 * (contractbeurt, prijsPerBeurt op contractdatum). Btw per taak uit de
 * bouwsteen (9/21); zonder bouwsteen geldt DEFAULT_BTW_ONDERHOUD.
 */
async function verzamelPrijsbronnen(
  ctx: MutationCtx,
  werkitem: Doc<"projecten">
): Promise<TaakPrijsbron[]> {
  const bronnen: Array<{
    omschrijving: string;
    prijsPerBeurt?: number;
    bouwsteenId?: Id<"bouwstenen">;
  }> = [];

  if (werkitem.bouwsteenRegels && werkitem.bouwsteenRegels.length > 0) {
    for (const regel of werkitem.bouwsteenRegels) {
      bronnen.push({
        omschrijving: regel.omschrijving,
        prijsPerBeurt: regel.prijsPerBeurt,
        bouwsteenId: regel.bouwsteenId,
      });
    }
  } else if (werkitem.contractWerkzaamheidId) {
    const werkzaamheid = await ctx.db.get(werkitem.contractWerkzaamheidId);
    if (werkzaamheid) {
      bronnen.push({
        omschrijving: werkzaamheid.omschrijving,
        prijsPerBeurt: werkzaamheid.prijsPerBeurt,
        bouwsteenId: werkzaamheid.bouwsteenId,
      });
    }
  }

  const bouwsteenCache = new Map<string, Doc<"bouwstenen"> | null>();
  const resultaat: TaakPrijsbron[] = [];
  for (const bron of bronnen) {
    let btwCode: 9 | 21 | undefined;
    if (bron.bouwsteenId) {
      if (!bouwsteenCache.has(bron.bouwsteenId)) {
        bouwsteenCache.set(bron.bouwsteenId, await ctx.db.get(bron.bouwsteenId));
      }
      btwCode = bouwsteenCache.get(bron.bouwsteenId)?.btwCode;
    }
    resultaat.push({
      omschrijving: bron.omschrijving,
      prijsPerBeurt: bron.prijsPerBeurt,
      btwCode,
    });
  }
  return resultaat;
}

/** Herbereken totalen van een factuur na het toevoegen van regels. */
function totalenPatch(
  regels: Array<{ totaal: number; btwCode?: 9 | 21 }>
): Record<string, unknown> {
  const totalen = berekenFactuurTotalen(regels, DEFAULT_BTW_ONDERHOUD);
  return {
    subtotaal: totalen.subtotaal,
    btwPercentage: totalen.btwPercentage,
    btwBedrag: totalen.btwBedrag,
    totaalInclBtw: totalen.totaalInclBtw,
    btwUitsplitsing: totalen.btwUitsplitsing,
  };
}

// ── Kern: beurt → concept-factuur ────────────────────────────────────────

export interface EngineResultaat {
  actie:
    | "per_bezoek"
    | "maandverzameling"
    | "termijnschema"
    | "overgeslagen";
  factuurId: Id<"facturen"> | null;
  reden?: string;
}

/**
 * Verwerk een werkitem dat zojuist klaarVoorFacturatie is geworden (§2.8).
 * Aangeroepen vanuit de afrondingsflow (stap 9a), binnen dezelfde mutatie.
 * Idempotent: een werkitem met factuurId wordt altijd overgeslagen.
 */
export async function verwerkKlaarVoorFacturatie(
  ctx: MutationCtx,
  args: {
    werkitemId: Id<"projecten">;
    auteurId?: Id<"users">;
    auteurNaam?: string;
  }
): Promise<EngineResultaat> {
  const werkitem = await ctx.db.get(args.werkitemId);
  if (!werkitem || !werkitem.klaarVoorFacturatie) {
    return {
      actie: "overgeslagen",
      factuurId: null,
      reden: "werkitem niet gevonden of niet klaar voor facturatie",
    };
  }

  // Idempotentie (§8.8): beurt staat al op een factuur → nooit dubbel
  if (werkitem.factuurId) {
    return {
      actie: "overgeslagen",
      factuurId: werkitem.factuurId,
      reden: "al gefactureerd",
    };
  }

  if (!werkitem.klantId) {
    console.warn(
      `[facturatieEngine] werkitem zonder klant overgeslagen (${args.werkitemId})`
    );
    return { actie: "overgeslagen", factuurId: null, reden: "geen klant" };
  }

  const contract = werkitem.contractId
    ? await ctx.db.get(werkitem.contractId)
    : null;
  const actie = bepaalEngineActie(
    contract ? getFacturatiemodus(contract) : undefined
  );

  // vast_maandbedrag: geen actie vanuit beurten — termijnschema is het spoor
  if (actie === "geen") {
    return { actie: "termijnschema", factuurId: null };
  }

  const datumVanDienst = datumVanDienstVan(werkitem.afgerondOp ?? Date.now());
  const prijsbronnen = await verzamelPrijsbronnen(ctx, werkitem);
  const taken =
    werkitem.taakAfronding && werkitem.taakAfronding.length > 0
      ? werkitem.taakAfronding
      : // Vangnet: geen taak-registratie → hele beurt als één afgeronde taak
        [{ omschrijving: werkitem.naam, status: "afgerond" as const }];

  const nieuweRegels = bouwRegelsUitTaakAfronding(
    taken,
    prijsbronnen,
    datumVanDienst
  ).map((regel) => ({ ...regel, id: nieuwRegelId() }));

  if (nieuweRegels.length === 0) {
    return {
      actie: "overgeslagen",
      factuurId: null,
      reden: "geen afgeronde taken",
    };
  }

  const now = Date.now();
  let factuurId: Id<"facturen">;

  if (actie === "maandverzameling" && contract) {
    // ── maandelijks_verzameld: open verzamelfactuur van contract/maand ──
    const verzamelMaand = verzamelMaandVan(datumVanDienst);
    const bestaande = await ctx.db
      .query("facturen")
      .withIndex("by_contract_verzamelMaand", (q) =>
        q.eq("contractId", contract._id).eq("verzamelMaand", verzamelMaand)
      )
      .collect();
    const open = bestaande.find(
      (f) =>
        f.bron === "engine_maandverzameling" &&
        f.verzamelGesloten !== true &&
        effectieveStatussen(f).documentStatus === "concept"
    );

    if (open) {
      const regels = [...open.regels, ...nieuweRegels];
      await ctx.db.patch(open._id, {
        regels,
        ...totalenPatch(regels),
        werkitemIds: [...(open.werkitemIds ?? []), werkitem._id],
        // datum van dienst = eerste uitvoeringsdag van de maand op de factuur
        datumVanDienst: open.datumVanDienst ?? datumVanDienst,
        updatedAt: now,
      });
      factuurId = open._id;
    } else {
      factuurId = await maakEngineFactuur(ctx, {
        werkitem,
        contract,
        regels: nieuweRegels,
        datumVanDienst,
        bron: "engine_maandverzameling",
        verzamelMaand,
      });
    }
  } else {
    // ── per_bezoek (default, ook losse beurten zonder contract):
    // één concept-factuur per klant per uitvoeringsdag ──
    const vanKlant = await ctx.db
      .query("facturen")
      .withIndex("by_klant", (q) => q.eq("klantId", werkitem.klantId))
      .collect();
    const open = vanKlant.find(
      (f) =>
        f.bron === "engine_per_bezoek" &&
        f.datumVanDienst === datumVanDienst &&
        f.userId.toString() === werkitem.userId.toString() &&
        effectieveStatussen(f).documentStatus === "concept"
    );

    if (open) {
      const regels = [...open.regels, ...nieuweRegels];
      await ctx.db.patch(open._id, {
        regels,
        ...totalenPatch(regels),
        werkitemIds: [...(open.werkitemIds ?? []), werkitem._id],
        updatedAt: now,
      });
      factuurId = open._id;
    } else {
      factuurId = await maakEngineFactuur(ctx, {
        werkitem,
        contract,
        regels: nieuweRegels,
        datumVanDienst,
        bron: "engine_per_bezoek",
      });
    }
  }

  // Idempotentie-vergrendeling: koppel de factuur terug op het werkitem
  await ctx.db.patch(werkitem._id, { factuurId, updatedAt: now });

  // Direct versturen (§2.8): alleen als kantoor de contract-toggle bewust
  // heeft aangezet. Mail blijft achter de mailGuard (sandbox verstuurt nooit).
  if (magEngineDirectVersturen(contract)) {
    const factuur = await ctx.db.get(factuurId);
    if (factuur && effectieveStatussen(factuur).documentStatus === "concept") {
      await verstuurFactuurKern(ctx, factuur, {
        auteurId: args.auteurId,
        auteurNaam: args.auteurNaam ?? ENGINE_AUTEUR,
      });
    }
  }

  return {
    actie: actie === "maandverzameling" ? "maandverzameling" : "per_bezoek",
    factuurId,
  };
}

/** Nieuwe engine-conceptfactuur met alle §2.8-referenties. */
async function maakEngineFactuur(
  ctx: MutationCtx,
  args: {
    werkitem: Doc<"projecten">;
    contract: Doc<"onderhoudscontracten"> | null;
    regels: Array<{
      id: string;
      omschrijving: string;
      hoeveelheid: number;
      eenheid: string;
      prijsPerEenheid: number;
      totaal: number;
      btwCode: 9 | 21;
    }>;
    datumVanDienst: string;
    bron: "engine_per_bezoek" | "engine_maandverzameling";
    verzamelMaand?: string;
  }
): Promise<Id<"facturen">> {
  const { werkitem, contract } = args;
  const klant = await ctx.db.get(werkitem.klantId!);
  if (!klant) {
    throw new ConvexError("Klant niet gevonden voor facturatie");
  }
  const { factuurnummer, instellingen } = await volgendFactuurnummer(
    ctx,
    werkitem.userId
  );
  const totalen = berekenFactuurTotalen(args.regels, DEFAULT_BTW_ONDERHOUD);
  const betalingstermijnDagen = instellingen.standaardBetalingstermijn ?? 14;
  const now = Date.now();

  return await ctx.db.insert("facturen", {
    userId: werkitem.userId,
    projectId: werkitem._id, // werkitems leven in de projecten-tabel
    klantId: werkitem.klantId,
    factuurnummer,
    status: "concept",
    documentStatus: "concept",
    betaalStatus: "open",
    bron: args.bron,
    // Referenties (§2.8): datum van dienst + offerte/contract + werkitem(s)
    datumVanDienst: args.datumVanDienst,
    contractId: contract?._id,
    offerteId: contract?.offerteId ?? werkitem.offerteId,
    werkitemIds: [werkitem._id],
    verzamelMaand: args.verzamelMaand,
    klant: klantSnapshot(klant),
    bedrijf: bedrijfSnapshot(instellingen),
    regels: args.regels,
    subtotaal: totalen.subtotaal,
    btwPercentage: totalen.btwPercentage,
    btwBedrag: totalen.btwBedrag,
    totaalInclBtw: totalen.totaalInclBtw,
    btwUitsplitsing: totalen.btwUitsplitsing,
    factuurdatum: now,
    vervaldatum: now + betalingstermijnDagen * 24 * 60 * 60 * 1000,
    betalingstermijnDagen,
    createdAt: now,
    updatedAt: now,
  });
}

// ── Maandwissel-cron (maandelijks_verzameld) ─────────────────────────────

/**
 * Sluit maandverzamelfacturen van voorbije maanden (§2.8): het concept
 * blijft in de "Te versturen"-wachtrij, maar krijgt een verse factuur-/
 * vervaldatum en verzamelGesloten=true zodat nieuwe beurten een nieuwe
 * verzamelfactuur openen. Contracten met directVersturen=true worden
 * direct verstuurd — mail achter de mailGuard (concept-modus mailt nooit).
 */
export const sluitMaandverzamelfacturen = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Alle open verzamelconcepten (klein aantal: max één per contract/maand)
    const kandidaten = (
      await ctx.db
        .query("facturen")
        .withIndex("by_status", (q) => q.eq("status", "concept"))
        .collect()
    ).filter(
      (f) =>
        f.bron === "engine_maandverzameling" &&
        f.verzamelGesloten !== true &&
        f.verzamelMaand !== undefined &&
        isVerzamelMaandVoorbij(f.verzamelMaand, now)
    );

    let gesloten = 0;
    let directVerstuurd = 0;
    for (const factuur of kandidaten) {
      await ctx.db.patch(factuur._id, {
        verzamelGesloten: true,
        factuurdatum: now,
        vervaldatum: now + factuur.betalingstermijnDagen * 24 * 60 * 60 * 1000,
        updatedAt: now,
      });
      gesloten++;

      const contract = factuur.contractId
        ? await ctx.db.get(factuur.contractId)
        : null;
      if (magEngineDirectVersturen(contract)) {
        const vers = await ctx.db.get(factuur._id);
        if (vers) {
          await verstuurFactuurKern(ctx, vers, { auteurNaam: ENGINE_AUTEUR });
          directVerstuurd++;
        }
      }
    }

    console.log(
      `[facturatieEngine] maandwissel: ${gesloten} verzamelfacturen gesloten, ${directVerstuurd} direct verstuurd`
    );
    return { gesloten, directVerstuurd };
  },
});

// ── Termijnschema-spoor (vast_maandbedrag, §2.8 punt 6) ──────────────────

/**
 * Zet geplande contractFacturen-termijnen om in concept-facturen zodra hun
 * periode begint. Dicht het oude dead-end: factuurId wordt teruggeschreven
 * en de termijnstatus gaat gepland → gefactureerd (→ betaald via de
 * betaal-kern). Alleen voor ACTIEVE contracten met modus vast_maandbedrag —
 * het beurten-spoor doet voor die contracten niets (wederzijds exclusief).
 */
export const factureerContractTermijnen = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const vandaag = datumVanDienstVan(now);

    const geplande = await ctx.db
      .query("contractFacturen")
      .withIndex("by_status", (q) => q.eq("status", "gepland"))
      .collect();

    let gefactureerd = 0;
    let overgeslagen = 0;
    const contractCache = new Map<string, Doc<"onderhoudscontracten"> | null>();

    for (const termijn of geplande) {
      if (termijn.periodeStart > vandaag) continue; // nog niet aan de beurt
      if (termijn.factuurId) {
        overgeslagen++; // idempotentie: al gekoppeld
        continue;
      }

      if (!contractCache.has(termijn.contractId)) {
        contractCache.set(termijn.contractId, await ctx.db.get(termijn.contractId));
      }
      const contract = contractCache.get(termijn.contractId) ?? null;
      if (
        !contract ||
        contract.status !== "actief" ||
        getFacturatiemodus(contract) !== "vast_maandbedrag"
      ) {
        overgeslagen++;
        continue;
      }

      const klant = await ctx.db.get(contract.klantId);
      const instellingen = await ctx.db
        .query("instellingen")
        .withIndex("by_user", (q) => q.eq("userId", termijn.userId))
        .unique();
      if (!klant || !instellingen) {
        console.warn(
          `[facturatieEngine] termijn ${termijn._id} overgeslagen: klant/instellingen ontbreken`
        );
        overgeslagen++;
        continue;
      }

      // Btw van het vaste maandbedrag: uniforme bouwsteen-btw van de
      // contractwerkzaamheden, anders het onderhouds-default (9).
      const werkzaamheden = await ctx.db
        .query("contractWerkzaamheden")
        .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
        .collect();
      const btwCodes = new Set<9 | 21>();
      for (const w of werkzaamheden) {
        if (w.bouwsteenId) {
          const bouwsteen = await ctx.db.get(w.bouwsteenId);
          if (bouwsteen?.btwCode) btwCodes.add(bouwsteen.btwCode);
        }
      }
      const btwCode: 9 | 21 =
        btwCodes.size === 1 ? [...btwCodes][0] : DEFAULT_BTW_ONDERHOUD;

      const volgendNummer = (instellingen.laatsteFactuurNummer ?? 0) + 1;
      const jaar = new Date().getFullYear();
      const prefix = instellingen.factuurNummerPrefix ?? "FAC-";
      await ctx.db.patch(instellingen._id, {
        laatsteFactuurNummer: volgendNummer,
      });

      const regel = {
        id: `termijn-${termijn._id}`,
        omschrijving: `Onderhoudscontract ${contract.contractNummer} — termijn ${termijn.termijnNummer} (${termijn.periodeStart} t/m ${termijn.periodeEinde})`,
        hoeveelheid: 1,
        eenheid: "termijn",
        prijsPerEenheid: termijn.bedrag,
        totaal: termijn.bedrag,
        btwCode,
      };
      const totalen = berekenFactuurTotalen([regel], btwCode);
      const betalingstermijnDagen = instellingen.standaardBetalingstermijn ?? 14;

      const factuurId = await ctx.db.insert("facturen", {
        userId: termijn.userId,
        klantId: contract.klantId,
        factuurnummer: `${prefix}${jaar}-${String(volgendNummer).padStart(3, "0")}`,
        status: "concept",
        documentStatus: "concept",
        betaalStatus: "open",
        bron: "termijnschema",
        datumVanDienst: termijn.periodeStart,
        contractId: contract._id,
        offerteId: contract.offerteId,
        klant: klantSnapshot(klant),
        bedrijf: bedrijfSnapshot(instellingen),
        regels: [regel],
        subtotaal: totalen.subtotaal,
        btwPercentage: totalen.btwPercentage,
        btwBedrag: totalen.btwBedrag,
        totaalInclBtw: totalen.totaalInclBtw,
        btwUitsplitsing: totalen.btwUitsplitsing,
        factuurdatum: now,
        vervaldatum: now + betalingstermijnDagen * 24 * 60 * 60 * 1000,
        betalingstermijnDagen,
        createdAt: now,
        updatedAt: now,
      });

      // Dead-end dichten: factuurId terug + status doorzetten
      await ctx.db.patch(termijn._id, {
        factuurId,
        status: "gefactureerd",
      });
      gefactureerd++;

      if (magEngineDirectVersturen(contract)) {
        const vers = await ctx.db.get(factuurId);
        if (vers) {
          await verstuurFactuurKern(ctx, vers, { auteurNaam: ENGINE_AUTEUR });
        }
      }
    }

    console.log(
      `[facturatieEngine] termijnen: ${gefactureerd} gefactureerd, ${overgeslagen} overgeslagen`
    );
    return { gefactureerd, overgeslagen };
  },
});

// ── Contract-toggle "direct versturen zonder check" (§2.8) ───────────────

/**
 * Zet de directVersturen-toggle op een contract. Bewust achter de
 * capability "versturen naar klant" (alleen kantoor): wie de wachtrij-check
 * mag doen, mag hem ook overslaan — niemand anders.
 */
export const zetDirectVersturen = mutation({
  args: {
    contractId: v.id("onderhoudscontracten"),
    directVersturen: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertKanNaarKlantVersturen(ctx);
    const contract = await ctx.db.get(args.contractId);
    await verifyOwnership(ctx, contract, "contract");
    await ctx.db.patch(args.contractId, {
      directVersturen: args.directVersturen,
      updatedAt: Date.now(),
    });
    return args.contractId;
  },
});
