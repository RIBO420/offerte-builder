/**
 * Veld-demo voor de Expo-app: één geloofwaardige werkweek voor één gekoppelde
 * medewerker. Alleen de ontwikkeldeployment (affable-rook-669).
 *
 * Wat er komt (zie `vullen`):
 *  - "Ploeg Noord": de medewerker + drie demo-collega's (medewerkers + users
 *    met `demo_veld_…`-clerkId's, zodat ze in de chat kunnen schrijven);
 *  - een bus en een aanhanger, demo-bouwstenen met normuren;
 *  - klussen ma 5 t/m vr 9 okt en ma 12 okt 2026 bij Limburgse demo-klanten;
 *  - maandag 5 okt: segmenten bevestigd en de dag ingediend, bezoekmeldingen
 *    (afronding + afvoer), aanhangerretour;
 *  - dinsdag 6 okt: drie klussen, niets bevestigd (de voorstellen volgen uit
 *    de dagkaart, dus "Alles bevestigen" verschijnt vanzelf);
 *  - teamchat, mededelingen, een DM met de directie, projectchat, meldingen
 *    en protocollen.
 *
 * Opruimen: elk document staat in `demoSeed`, dus `npm run seed:clear` haalt
 * het allemaal weg — samen met de kantoor-demo van `convex/demoSeed.ts`.
 * Volgorde bij opnieuw vullen: eerst `npm run seed:demo` (die weigert zodra er
 * al iets in `demoSeed` staat), daarna deze.
 *
 * Contactgegevens: uitsluitend `@voorbeeld.test` en `069…` — zie de uitleg
 * bovenin `convex/demoSeed.ts`. Foto's ontbreken bewust: `werkbezoekFotos`
 * vraagt een echt opslagbestand; de foto-taak is daarom gedelegeerd aan de
 * voorman, zodat de ingediende maandag voor de medewerker compleet is.
 */
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { DataModel, Doc, Id, TableNames } from "./_generated/dataModel";
import type { DocumentByName, WithoutSystemFields } from "convex/server";
import { ConvexError, v } from "convex/values";
import { adresRegel } from "./lib/adres";
import { dagkaartVoorstellen, segmentenVoorDag, teamVanMedewerkerOpDag } from "./urenSegmenten";
import { duurAfwijking, filterVoorstellen } from "./veldLogica";

const TEAM_NAAM = "Ploeg Noord";

function guard() {
  if (process.env.CONVEX_CLOUD_URL !== "https://affable-rook-669.convex.cloud") {
    throw new ConvexError("De veld-demo mag uitsluitend in affable-rook-669 draaien");
  }
}

async function voegToe<T extends TableNames>(
  ctx: MutationCtx,
  run: number,
  tabel: T,
  doc: WithoutSystemFields<DocumentByName<DataModel, T>>
): Promise<Id<T>> {
  const id = await ctx.db.insert(tabel, doc);
  await ctx.db.insert("demoSeed", { tabel, documentId: id, geseedOp: run });
  return id;
}

/** Europe/Amsterdam is in oktober UTC+2 (zomertijd tot 25 okt 2026). */
function tijdstip(datum: string, tijd: string): number {
  const [j, m, d] = datum.split("-").map(Number);
  const [u, min] = tijd.split(":").map(Number);
  return Date.UTC(j, m - 1, d, u - 2, min);
}

function telefoon(index: number): string {
  return `0692${String(100100 + index * 413).padStart(6, "0")}`;
}

// ============================================================
// Vaste inhoud
// ============================================================

const COLLEGAS = [
  { sleutel: "jeroen", naam: "Jeroen Vaessen", functie: "Voorman", rol: "voorman" as const },
  { sleutel: "luuk", naam: "Luuk Hendrix", functie: "Hovenier", rol: "medewerker" as const },
  { sleutel: "bram", naam: "Bram Janssen", functie: "Leerling-hovenier", rol: "medewerker" as const },
];

type BouwsteenSpec = {
  code: string;
  naam: string;
  categorie: Doc<"bouwstenen">["categorie"];
  soort: Doc<"bouwstenen">["soort"];
  urenPerBeurt: number;
};
const BOUWSTENEN: BouwsteenSpec[] = [
  { code: "HG", naam: "Haag snoeien", categorie: "heggen_bomen", soort: "terugkerend", urenPerBeurt: 3 },
  { code: "BW", naam: "Borders wieden", categorie: "borders_beplanting", soort: "terugkerend", urenPerBeurt: 2 },
  { code: "GV", naam: "Gazon verticuteren", categorie: "gras_gazon", soort: "terugkerend", urenPerBeurt: 1.5 },
  { code: "GB", naam: "Gazon bemesten (najaar)", categorie: "gras_gazon", soort: "terugkerend", urenPerBeurt: 0.5 },
  { code: "BR", naam: "Blad ruimen en afvoeren", categorie: "seizoen", soort: "terugkerend", urenPerBeurt: 1.5 },
  { code: "BB", naam: "Bloembakken winterklaar", categorie: "borders_beplanting", soort: "terugkerend", urenPerBeurt: 1 },
  { code: "PL", naam: "Beplanting zetten", categorie: "borders_beplanting", soort: "eenmalig", urenPerBeurt: 2.5 },
  { code: "OA", naam: "Bestrating opbreken en afvoeren", categorie: "bestrating_terras", soort: "eenmalig", urenPerBeurt: 2 },
  { code: "KH", naam: "Klinkers (her)straten", categorie: "bestrating_terras", soort: "eenmalig", urenPerBeurt: 4 },
  { code: "GG", naam: "Grond afgraven en afvoeren", categorie: "bestrating_terras", soort: "eenmalig", urenPerBeurt: 3 },
];

type KlantSpec = {
  sleutel: string;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  klantType: "particulier" | "zakelijk" | "vve";
  pipelineStatus: "in_uitvoering" | "onderhoud";
  contactpersoon?: string;
  bijzonderheden?: string;
};
const KLANTEN: KlantSpec[] = [
  { sleutel: "dohmen", naam: "Fam. Dohmen", adres: "Kollenbergweg 31", postcode: "6131 HR", plaats: "Sittard", klantType: "particulier", pipelineStatus: "in_uitvoering", bijzonderheden: "Hond los in de achtertuin — poort altijd dichtdoen" },
  { sleutel: "molenbeek", naam: "VvE Park Molenbeek", adres: "Molenbeekpark 1", postcode: "6163 HA", plaats: "Geleen", klantType: "vve", pipelineStatus: "onderhoud", contactpersoon: "Dhr. Coumans (beheerder)", bijzonderheden: "Sleutel van de tuinberging bij de beheerder, Molenbeekpark 14" },
  { sleutel: "hermans", naam: "Hermans", adres: "Akerstraat 112", postcode: "6417 BN", plaats: "Heerlen", klantType: "particulier", pipelineStatus: "onderhoud", bijzonderheden: "Sleutel bij de buren, nr. 14" },
  { sleutel: "smeets", naam: "Bakkerij Smeets", adres: "Markt 7", postcode: "6161 GE", plaats: "Geleen", klantType: "zakelijk", pipelineStatus: "onderhoud", contactpersoon: "Mevr. Smeets", bijzonderheden: "Niet laden of lossen voor de winkel tussen 7:30 en 10:00" },
  { sleutel: "notermans", naam: "Fam. Notermans", adres: "Heerderweg 87", postcode: "6224 LH", plaats: "Maastricht", klantType: "particulier", pipelineStatus: "in_uitvoering" },
  { sleutel: "kurvers", naam: "Fam. Kurvers", adres: "Prins Mauritslaan 9", postcode: "6191 EA", plaats: "Beek", klantType: "particulier", pipelineStatus: "onderhoud" },
  { sleutel: "lemmens", naam: "Fam. Lemmens", adres: "Bergerweg 140", postcode: "6135 AG", plaats: "Sittard", klantType: "particulier", pipelineStatus: "onderhoud", bijzonderheden: "Bellen bij aankomst, de bel doet het niet" },
  { sleutel: "willems", naam: "Fam. Willems", adres: "Heirstraat 22", postcode: "6171 VD", plaats: "Stein", klantType: "particulier", pipelineStatus: "onderhoud" },
  { sleutel: "baandert", naam: "Huisartsenpraktijk De Baandert", adres: "Baandertlaan 12", postcode: "6132 AL", plaats: "Sittard", klantType: "zakelijk", pipelineStatus: "onderhoud", contactpersoon: "Praktijkmanager" },
  { sleutel: "coenen", naam: "Fam. Coenen", adres: "Holstraat 5", postcode: "6121 KT", plaats: "Born", klantType: "particulier", pipelineStatus: "onderhoud" },
];

type KlusSpec = {
  sleutel: string;
  naam: string;
  klant: string;
  categorie: "aanleg" | "onderhoud";
  start: string;
  eind?: string;
  van: string;
  tot: string;
  taken: { code?: string; omschrijving: string }[];
  instructie?: string;
  uitgevoerd?: boolean;
};
const KLUSSEN: KlusSpec[] = [
  // ── Maandag 5 oktober (afgerond en ingediend) ──
  { sleutel: "kurvers", naam: "Onderhoudsbeurt Fam. Kurvers", klant: "kurvers", categorie: "onderhoud", start: "2026-10-05", van: "07:20", tot: "10:00", uitgevoerd: true,
    taken: [{ code: "HG", omschrijving: "Haag snoeien 40 m" }, { code: "BW", omschrijving: "Borders wieden" }, { code: "BR", omschrijving: "Blad ruimen voortuin" }] },
  { sleutel: "smeets1", naam: "Onderhoud Bakkerij Smeets", klant: "smeets", categorie: "onderhoud", start: "2026-10-05", van: "10:20", tot: "12:00", uitgevoerd: true,
    instructie: "Eerst de bloembakken aan de straatkant, vóór de drukte van 11:00.",
    taken: [{ code: "BB", omschrijving: "Bloembakken winterklaar maken (6 st.)" }, { code: "BW", omschrijving: "Borders wieden langs de parkeerplaats" }] },
  { sleutel: "hermans1", naam: "Gazonbeurt Hermans", klant: "hermans", categorie: "onderhoud", start: "2026-10-05", van: "12:50", tot: "15:20", uitgevoerd: true,
    taken: [{ code: "GV", omschrijving: "Gazon verticuteren 180 m²" }, { code: "GB", omschrijving: "Gazon bemesten" }, { code: "HG", omschrijving: "Haag snoeien achtertuin 25 m" }] },
  // ── Dinsdag 6 oktober (vandaag) ──
  { sleutel: "dohmen1", naam: "Terras herstraten Fam. Dohmen", klant: "dohmen", categorie: "aanleg", start: "2026-10-06", van: "07:20", tot: "11:40",
    instructie: "Klinkers in keperverband, gelijk aan de voortuin. Zand ligt op de oprit. Oude tegels op een pallet bij de schuur — de klant hergebruikt ze.",
    taken: [{ code: "OA", omschrijving: "Oude tegels opbreken 15 m²" }, { code: "KH", omschrijving: "Klinkers herstraten 12 m²" }, { omschrijving: "Opsluitbanden stellen 9 m" }] },
  { sleutel: "molenbeek", naam: "Najaarsonderhoud VvE Park Molenbeek", klant: "molenbeek", categorie: "onderhoud", start: "2026-10-06", van: "12:30", tot: "14:30",
    instructie: "Groenafval in de container bij blok C, niet in de kliko's van de bewoners.",
    taken: [{ code: "HG", omschrijving: "Haag snoeien binnentuin 60 m" }, { code: "BR", omschrijving: "Blad ruimen gemeenschappelijke tuin" }, { code: "BW", omschrijving: "Borders wieden bij de entree" }] },
  { sleutel: "lemmens", naam: "Gazonbeurt Fam. Lemmens", klant: "lemmens", categorie: "onderhoud", start: "2026-10-06", van: "14:50", tot: "15:50",
    taken: [{ code: "GV", omschrijving: "Gazon verticuteren 120 m²" }, { code: "GB", omschrijving: "Gazon bemesten" }] },
  // ── Woensdag 7 en donderdag 8 oktober ──
  { sleutel: "notermans", naam: "Voortuin aanleggen Fam. Notermans", klant: "notermans", categorie: "aanleg", start: "2026-10-07", eind: "2026-10-08", van: "07:20", tot: "14:00",
    instructie: "Check eerst de KLIC-tekening in de bus: de gasleiding loopt langs de linkergevel. Plantlijst ligt bij de klant op tafel.",
    taken: [{ code: "GG", omschrijving: "Grond afgraven en afvoeren 6 m³" }, { code: "KH", omschrijving: "Klinkers straten tuinpad 14 m²" }, { code: "PL", omschrijving: "Beplanting zetten (32 st.)" }] },
  { sleutel: "willems", naam: "Blad ruimen Fam. Willems", klant: "willems", categorie: "onderhoud", start: "2026-10-07", van: "14:50", tot: "15:50",
    taken: [{ code: "BR", omschrijving: "Blad ruimen en afvoeren" }] },
  { sleutel: "baandert", naam: "Onderhoud Huisartsenpraktijk De Baandert", klant: "baandert", categorie: "onderhoud", start: "2026-10-08", van: "14:50", tot: "16:00",
    instructie: "Patiënteningang vrijhouden. Bladblazer pas na 15:30, dan is het spreekuur voorbij.",
    taken: [{ code: "BW", omschrijving: "Borders wieden voorzijde" }, { code: "HG", omschrijving: "Haag snoeien parkeerplaats 30 m" }] },
  // ── Vrijdag 9 oktober (om 13:00 stoppen, teamuitje) ──
  { sleutel: "coenen", naam: "Onderhoudsbeurt Fam. Coenen", klant: "coenen", categorie: "onderhoud", start: "2026-10-09", van: "07:20", tot: "10:20",
    taken: [{ code: "HG", omschrijving: "Haag snoeien 35 m" }, { code: "BW", omschrijving: "Borders wieden" }, { code: "BR", omschrijving: "Blad ruimen" }] },
  { sleutel: "smeets2", naam: "Bloembollen planten Bakkerij Smeets", klant: "smeets", categorie: "onderhoud", start: "2026-10-09", van: "10:40", tot: "12:00",
    taken: [{ code: "PL", omschrijving: "Bloembollen planten in de bakken (200 st.)" }] },
  // ── Maandag 12 oktober ──
  { sleutel: "dohmen2", naam: "Borders inplanten Fam. Dohmen", klant: "dohmen", categorie: "aanleg", start: "2026-10-12", van: "07:20", tot: "11:40",
    instructie: "Planten worden om 7:00 bij de loods geleverd; neem ze mee in de bus.",
    taken: [{ code: "PL", omschrijving: "Vaste planten zetten (45 st.)" }, { omschrijving: "Boomschors aanbrengen 6 m²" }] },
  { sleutel: "hermans2", naam: "Haag snoeien Hermans", klant: "hermans", categorie: "onderhoud", start: "2026-10-12", van: "12:30", tot: "14:30",
    taken: [{ code: "HG", omschrijving: "Haag snoeien zijtuin 50 m" }, { code: "BR", omschrijving: "Blad ruimen" }] },
];

const PROTOCOLLEN = [
  { titel: "Ongeval of letsel op de klus", spoed: true, volgorde: 0,
    wanneer: "Iemand raakt gewond, ook als het klein lijkt.",
    stappen: ["Zorg dat de plek veilig is: machines uit, verkeer afzetten.", "Verleen eerste hulp; de verbandtrommel ligt achter de bestuurdersstoel.", "Bel bij twijfel direct de huisartsenpost of de hulpdiensten.", "Meld het daarna bij kantoor en schrijf op wat er gebeurde."],
    contactNaam: "Kantoor Top Tuinen", contactTelefoon: telefoon(20) },
  { titel: "Werken met de kettingzaag", spoed: false, volgorde: 1,
    wanneer: "Voor elke klus waarbij je de kettingzaag gebruikt.",
    waarschuwing: "Nooit zagen boven schouderhoogte of alleen op de klus.",
    stappen: ["Draag zaagbroek, helm met gelaatsscherm, gehoorbescherming en handschoenen.", "Controleer kettingspanning, kettingrem en olie voordat je start.", "Start de zaag op de grond met de kettingrem erop.", "Houd twee armlengtes afstand tot collega's en zet de valzone af.", "Na gebruik: ketting schoonmaken en de zaag in de koffer terug in de bus."] },
  { titel: "Graven bij kabels en leidingen", spoed: false, volgorde: 2,
    wanneer: "Bij elk graafwerk dieper dan een schop.",
    stappen: ["Bekijk de KLIC-melding in de bus of vraag hem op bij kantoor.", "Graaf binnen 1 meter van een leiding alleen met de hand.", "Raak je een leiding: stop, afstand houden en bel kantoor."] },
  { titel: "Einde werkdag: loods en aanhanger", spoed: false, volgorde: 3,
    wanneer: "Elke dag bij terugkomst in de loods.",
    stappen: ["Meld in de app hoe vol de aanhanger terugkomt.", "Groenafval in de groene bak, grond en puin apart.", "Machines schoonmaken en tanken voor de volgende dag.", "Controleer of al je uren bevestigd zijn en dien de dag in."] },
];

const PROTOCOL_CONTACTEN = [
  { naam: "Kantoor (planning)", telefoon: telefoon(20), spoed: false, volgorde: 0 },
  { naam: "Jeroen Vaessen (voorman)", telefoon: telefoon(1), spoed: false, volgorde: 1 },
  { naam: "Storingsdienst machines", telefoon: telefoon(21), spoed: true, volgorde: 2 },
];

// ============================================================
// Vullen
// ============================================================

export const vullen = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    guard();
    const user = await ctx.db.get(args.userId);
    if (!user?.orgId || !user.linkedMedewerkerId) throw new ConvexError("Kies een bestaand, gekoppeld medewerkeraccount");
    const orgId = user.orgId;
    const medewerkerId = user.linkedMedewerkerId;
    const medewerker = await ctx.db.get(medewerkerId);
    if (!medewerker || medewerker.orgId !== orgId) throw new ConvexError("Medewerker hoort niet bij deze organisatie");
    const org = await ctx.db.get(orgId);
    const directie = org?.eigenaarUserId ? await ctx.db.get(org.eigenaarUserId) : null;
    if (!directie) throw new ConvexError("De organisatie heeft geen directie-account (eigenaarUserId)");

    const teams = await ctx.db.query("teams").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
    if (teams.some((t) => t.naam === TEAM_NAAM)) {
      throw new ConvexError(`"${TEAM_NAAM}" bestaat al. Ruim eerst op met \`npm run seed:clear\` en vul opnieuw.`);
    }
    const huidigTeam = await teamVanMedewerkerOpDag(ctx.db, orgId, medewerkerId, "2026-10-06");
    if (huidigTeam) throw new ConvexError(`De medewerker zit al in "${huidigTeam.naam}"; de veld-demo verwacht een medewerker zonder ploeg.`);

    const run = Date.now();
    const nu = run;
    const MA = "2026-10-05";
    const DI = "2026-10-06";

    // ── Collega's: medewerker + user (voor chat-auteurschap) ─────────────
    const collegaMw: Record<string, Id<"medewerkers">> = {};
    const collegaUser: Record<string, Doc<"users">> = {};
    for (const [i, c] of COLLEGAS.entries()) {
      const clerkId = `demo_veld_${c.sleutel}`;
      const email = `${c.naam.toLowerCase().replace(/[^a-z]+/g, ".")}@voorbeeld.test`;
      const mwId = await voegToe(ctx, run, "medewerkers", {
        orgId, naam: c.naam, email, telefoon: telefoon(i + 1), functie: c.functie, contractType: "fulltime",
        isActief: true, status: "active", clerkUserId: clerkId,
        beschikbaarheid: { werkdagen: [1, 2, 3, 4, 5], urenPerWeek: 40, maxUrenPerDag: 9 },
        createdAt: nu, updatedAt: nu,
      });
      const userId = await voegToe(ctx, run, "users", {
        clerkId, email, name: c.naam, role: c.rol, linkedMedewerkerId: mwId, orgId, createdAt: nu,
      });
      collegaMw[c.sleutel] = mwId;
      collegaUser[c.sleutel] = (await ctx.db.get(userId))!;
    }
    const ploeg = [medewerkerId, collegaMw.jeroen, collegaMw.luuk, collegaMw.bram];

    // ── Materieel + ploeg ────────────────────────────────────────────────
    const busId = await voegToe(ctx, run, "voertuigen", {
      orgId, kenteken: "VTK-82-N", merk: "Mercedes-Benz", model: "Sprinter dubbele cabine", type: "bus", kleur: "wit", status: "actief", createdAt: nu, updatedAt: nu,
    });
    const aanhangerId = await voegToe(ctx, run, "voertuigen", {
      orgId, kenteken: "WX-38-TJ", merk: "Humbaur", model: "Kipper 2,7 t", type: "aanhanger", status: "actief", createdAt: nu, updatedAt: nu,
    });
    const teamId = await voegToe(ctx, run, "teams", {
      orgId, naam: TEAM_NAAM, beschrijving: "Onderhoud en kleine aanleg in de Westelijke Mijnstreek", leden: ploeg,
      kleur: "#0d9488", standaardVoertuigId: busId, isActief: true, createdAt: nu, updatedAt: nu,
    });
    await ctx.db.patch(busId, { teamId });
    await ctx.db.patch(aanhangerId, { teamId });

    // ── Bouwstenen met normuren ──────────────────────────────────────────
    const bouwsteen: Record<string, Id<"bouwstenen">> = {};
    for (const b of BOUWSTENEN) {
      bouwsteen[b.code] = await voegToe(ctx, run, "bouwstenen", {
        orgId, code: b.code, naam: b.naam, categorie: b.categorie, soort: b.soort, prijsmodel: "uren",
        urenPerBeurt: b.urenPerBeurt, btwCode: 21, actief: true, createdAt: nu, updatedAt: nu,
      });
    }

    // ── Klanten ──────────────────────────────────────────────────────────
    const klanten: Record<string, { id: Id<"klanten">; spec: KlantSpec }> = {};
    for (const [i, k] of KLANTEN.entries()) {
      const id = await voegToe(ctx, run, "klanten", {
        orgId, naam: k.naam, adres: k.adres, postcode: k.postcode, plaats: k.plaats,
        email: `${k.naam.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@voorbeeld.test`,
        telefoon: telefoon(30 + i), klantType: k.klantType, pipelineStatus: k.pipelineStatus,
        contactpersoon: k.contactpersoon, bijzonderheden: k.bijzonderheden,
        createdAt: nu - 120 * 86400000, updatedAt: nu - 7 * 86400000,
      });
      klanten[k.sleutel] = { id, spec: k };
    }

    // ── Klussen ──────────────────────────────────────────────────────────
    const klus: Record<string, { id: Id<"projecten">; spec: KlusSpec; klantId: Id<"klanten"> }> = {};
    const aanhangerGeclaimd = new Set<string>();
    for (const [i, s] of KLUSSEN.entries()) {
      const k = klanten[s.klant];
      const regels = s.taken.map((t) => ({ bouwsteenId: t.code ? bouwsteen[t.code] : undefined, omschrijving: t.omschrijving }));
      const onderhoud = s.categorie === "onderhoud";
      const afgerondOp = s.uitgevoerd ? tijdstip(s.start, s.tot) + 10 * 60000 : undefined;
      const id = await voegToe(ctx, run, "projecten", {
        orgId, type: onderhoud ? "onderhoudsbeurt" : "project", uitvoeringCategorie: s.categorie, urenBron: "segmenten",
        klantId: k.id, naam: s.naam,
        status: s.uitgevoerd ? (onderhoud ? "uitgevoerd" : "afgerond") : "gepland",
        geplandeStart: s.start, geplandeEind: s.eind ?? s.start, teamId,
        volgordeBinnenDag: i + 1, geplandeStartTijd: s.van, geplandeEindTijd: s.tot,
        adres: adresRegel(k.spec), uitvoeringsInstructie: s.instructie, bouwsteenRegels: regels,
        toegewezenMedewerkerIds: ploeg, toegewezenVoertuigen: [busId, aanhangerId],
        ...(s.uitgevoerd
          ? { taakAfronding: regels.map((r) => ({ ...r, status: "afgerond" as const })), klaarVoorFacturatie: true, afgerondOp }
          : {}),
        createdAt: nu - 21 * 86400000, updatedAt: s.uitgevoerd ? afgerondOp! : nu - 3 * 86400000,
      });
      klus[s.sleutel] = { id, spec: s, klantId: k.id };
      // Eén aanhangerclaim per dag (eerste klus), zoals de planner hem zet
      for (const datum of dagenVan(s.start, s.eind ?? s.start)) {
        if (aanhangerGeclaimd.has(datum)) continue;
        aanhangerGeclaimd.add(datum);
        await voegToe(ctx, run, "middelReserveringen", {
          orgId, middelType: "voertuig", voertuigId: aanhangerId, middelSleutel: `voertuig:${aanhangerId}`, werkitemId: id, datum, createdAt: nu - 3 * 86400000,
        });
      }
    }

    // ── Maandag: segmenten (ingediend) ───────────────────────────────────
    const ingediendOp = tijdstip(MA, "16:34");
    type Seg = { cat: Doc<"urenSegmenten">["categorie"]; van: string; tot: string; klus?: string; gepland?: [string, string]; reden?: string; notitie?: string };
    const maandag: Seg[] = [
      { cat: "reistijd", van: "07:00", tot: "07:25" },
      { cat: "werken", van: "07:25", tot: "10:05", klus: "kurvers", gepland: ["07:20", "10:00"] },
      { cat: "reistijd", van: "10:05", tot: "10:25" },
      { cat: "werken", van: "10:25", tot: "12:00", klus: "smeets1", gepland: ["10:20", "12:00"] },
      { cat: "pauze", van: "12:00", tot: "12:30" },
      { cat: "reistijd", van: "12:30", tot: "12:50" },
      { cat: "werken", van: "12:50", tot: "15:45", klus: "hermans1", gepland: ["12:50", "15:20"], reden: "Gazon was nog nat, verticuteren ging trager" },
      { cat: "reistijd", van: "15:45", tot: "16:05" },
      { cat: "loods", van: "16:05", tot: "16:30", notitie: "Aanhanger geleegd, verticuteermachine schoongemaakt" },
    ];
    for (const s of maandag) {
      const k = s.klus ? klus[s.klus] : undefined;
      const afwijking = s.gepland
        ? (() => {
            const a = duurAfwijking({ beginTijd: s.van, eindTijd: s.tot }, { beginTijd: s.gepland[0], eindTijd: s.gepland[1] });
            return { geplandeBeginTijd: s.gepland[0], geplandeEindTijd: s.gepland[1], afwijkingMinuten: a.minuten, afwijkingReden: a.redenNodig ? s.reden : undefined, afwijkingOvergeslagen: false };
          })()
        : {};
      const bevestigdOp = tijdstip(MA, s.tot) + 5 * 60000;
      await voegToe(ctx, run, "urenSegmenten", {
        orgId, medewerkerId, datum: MA, categorie: s.cat, beginTijd: s.van, eindTijd: s.tot,
        werkitemId: k?.id, klantId: k?.klantId, status: "ingediend",
        bron: s.cat === "loods" ? "handmatig" : "voorstel", notitie: s.notitie,
        werksoort: s.cat === "werken" ? "Tuinonderhoud" : undefined, ...afwijking,
        ingevoerdDoor: user._id, createdAt: bevestigdOp, updatedAt: ingediendOp,
      });
    }
    await voegToe(ctx, run, "urenDagen", {
      orgId, medewerkerId, datum: MA, status: "ingediend", revisie: maandag.length + 1, ingediendOp, createdAt: tijdstip(MA, "07:30"), updatedAt: ingediendOp,
    });
    await voegToe(ctx, run, "urenLogboek", {
      orgId, medewerkerId, datum: MA, actie: "dag_ingediend", details: `Dag ${MA} ingediend (${maandag.length} segmenten)`, door: user._id, createdAt: ingediendOp,
    });

    // ── Maandag: bezoekmeldingen, afvoer, foto-delegatie, retour ─────────
    const afvoer: Record<string, Doc<"werkbezoekAfvoer">["keuze"]> = { kurvers: "half", smeets1: "geen", hermans1: "kwart" };
    for (const sleutel of ["kurvers", "smeets1", "hermans1"]) {
      const k = klus[sleutel];
      const op = tijdstip(MA, k.spec.tot) + 5 * 60000;
      await voegToe(ctx, run, "werkbezoekAntwoorden", { orgId, werkitemId: k.id, datum: MA, afgerond: true, revision: 1, door: user._id, createdAt: op, updatedAt: op });
      await voegToe(ctx, run, "werkbezoekAfvoer", { orgId, werkitemId: k.id, datum: MA, keuze: afvoer[sleutel], revision: 1, door: user._id, createdAt: op, updatedAt: op });
      await voegToe(ctx, run, "werkbezoekDelegaties", { orgId, werkitemId: k.id, datum: MA, onderdeel: "foto", medewerkerId, naarMedewerkerId: collegaMw.jeroen, door: user._id, createdAt: op - 60000 });
    }
    const retourOp = tijdstip(MA, "16:10");
    const retourWaarden = {
      orgId, retourId: `team:${teamId}:${MA}:retour:1`, datum: MA, teamId, verantwoordelijkeMedewerkerId: medewerkerId, voertuigId: aanhangerId,
      keuze: "half" as const, waargenomenOp: retourOp, gemeldDoor: user._id, laatstGewijzigdDoor: user._id,
      notitie: "Groenafval Kurvers en Hermans, gestort in de groene bak", revision: 1, createdAt: retourOp, updatedAt: retourOp,
    };
    const retourId = await voegToe(ctx, run, "aanhangerRetouren", retourWaarden);
    await voegToe(ctx, run, "aanhangerRetourHistorie", { orgId, retourId, revision: 1, door: user._id, reden: "Retour gemeld", na: JSON.stringify(retourWaarden), createdAt: retourOp });

    // ── Protocollen ──────────────────────────────────────────────────────
    for (const p of PROTOCOLLEN) {
      const op = p.titel === "Werken met de kettingzaag" ? tijdstip(MA, "13:05") : nu - 40 * 86400000;
      await voegToe(ctx, run, "protocollen", {
        orgId, titel: p.titel, wanneer: p.wanneer, stappen: p.stappen, waarschuwing: p.waarschuwing, doelgroepen: [],
        contactNaam: p.contactNaam, contactTelefoon: p.contactTelefoon, spoed: p.spoed, volgorde: p.volgorde,
        actief: true, revision: 1, door: directie._id, createdAt: op, updatedAt: op,
      });
    }
    for (const c of PROTOCOL_CONTACTEN) {
      await voegToe(ctx, run, "protocolContacten", { orgId, ...c, actief: true, revision: 1, door: directie._id, createdAt: nu - 40 * 86400000, updatedAt: nu - 40 * 86400000 });
    }

    // ── Chat ─────────────────────────────────────────────────────────────
    // Berichten van vandaag nooit in de toekomst: schuif ze zo nodig terug
    // tot vlak voor nu, met behoud van de volgorde.
    const vandaagLaatst = (planning: number, rang: number) => Math.min(planning, nu - rang * 3 * 60000);
    const auteur = (sleutel: string) => (sleutel === "ik" ? user : sleutel === "directie" ? directie : collegaUser[sleutel]);
    let berichten = 0;
    const schrijf = async (m: { van: string; op: number; tekst: string; kanaal: "team" | "project" | "broadcast"; project?: string; gelezen: boolean }) => {
      const a = auteur(m.van);
      const p = m.project ? klus[m.project] : undefined;
      const readBy = [a.clerkId];
      if (m.gelezen && a._id !== user._id) readBy.push(user.clerkId);
      await voegToe(ctx, run, "team_messages", {
        senderId: a._id, senderName: a.name, senderClerkId: a.clerkId, senderRole: a.role ?? "medewerker", orgId,
        channelType: m.kanaal, projectId: p?.id, channelName: m.kanaal === "project" && p ? p.spec.naam : m.kanaal,
        message: m.tekst, messageType: m.kanaal === "broadcast" ? "announcement" : "text",
        isRead: readBy.length > 1, readBy, createdAt: m.op,
      });
      berichten++;
    };
    const team = [
      { van: "jeroen", op: tijdstip(MA, "06:41"), tekst: "Morgen mannen. 7:15 bij de loods, we beginnen bij Kurvers in Beek.", gelezen: true },
      { van: "luuk", op: tijdstip(MA, "07:02"), tekst: "Wie heeft de bladblazer? Ligt niet in de bus.", gelezen: true },
      { van: "bram", op: tijdstip(MA, "07:04"), tekst: "Staat nog in de loods achter de kliko's, ik pak hem.", gelezen: true },
      { van: "ik", op: tijdstip(MA, "12:03"), tekst: "Smeets is klaar, bakken staan er weer netjes bij. Op weg naar Hermans.", gelezen: true },
      { van: "jeroen", op: tijdstip(MA, "15:52"), tekst: "Hermans ook af. Aanhanger is half vol, die legen we straks bij de loods.", gelezen: true },
      { van: "jeroen", op: tijdstip(MA, "18:47"), tekst: "Morgen weer 7:15 bij de loods. Eerst het terras bij Dohmen in Sittard.", gelezen: true },
      { van: "luuk", op: tijdstip(MA, "20:16"), tekst: "Bij Dohmen staat de poort vaak open, hond binnen houden!", gelezen: false },
      { van: "bram", op: vandaagLaatst(tijdstip(DI, "06:38"), 3), tekst: "Ben iets later, rond 7:25 bij de loods. Sorry.", gelezen: false },
      { van: "jeroen", op: vandaagLaatst(tijdstip(DI, "06:44"), 2), tekst: "Geen probleem. Neem jij de verticuteermachine mee voor Lemmens vanmiddag?", gelezen: false },
      { van: "bram", op: vandaagLaatst(tijdstip(DI, "06:46"), 1), tekst: "Komt goed.", gelezen: false },
    ];
    for (const m of team) await schrijf({ ...m, kanaal: "team" });
    await schrijf({ van: "directie", kanaal: "broadcast", op: tijdstip(MA, "08:30"), gelezen: false,
      tekst: "Vrijdag stoppen we om 13:00 in verband met het teamuitje. Om 13:30 verzamelen bij de loods, daarna karten en samen eten. Partners zijn welkom bij het eten." });
    await schrijf({ van: "directie", kanaal: "broadcast", op: tijdstip(MA, "13:10"), gelezen: true,
      tekst: "Nieuwe veiligheidsinstructie voor de kettingzaag staat in Protocollen. Lees hem even door voordat je deze week gaat zagen." });
    await schrijf({ van: "directie", kanaal: "project", project: "dohmen1", op: tijdstip(MA, "16:22"), gelezen: true,
      tekst: "Meneer Dohmen vraagt of de oude tegels achter de schuur mogen blijven liggen, hij wil ze zelf hergebruiken." });
    await schrijf({ van: "jeroen", kanaal: "project", project: "dohmen1", op: tijdstip(MA, "16:40"), gelezen: true,
      tekst: "Prima, we stapelen ze op een pallet naast de schuur." });
    await schrijf({ van: "luuk", kanaal: "project", project: "dohmen1", op: tijdstip(MA, "19:05"), gelezen: false,
      tekst: "Ik heb nog 20 opsluitbanden in de loods liggen, die neem ik morgen mee." });

    // DM: een medewerker mag alleen de directie (eigenaar) berichten sturen
    const dms = [
      { van: directie, naar: user, op: tijdstip(MA, "16:51"), tekst: "Hoi Ricardo, dank voor het snelle indienen vandaag. Wil je morgen bij Dohmen een paar foto's van het terras maken voordat jullie beginnen?", gelezen: true },
      { van: user, naar: directie, op: tijdstip(MA, "17:06"), tekst: "Doe ik. Ligt het zand er al?", gelezen: true },
      { van: directie, naar: user, op: tijdstip(MA, "17:19"), tekst: "Ja, staat sinds vanmiddag op de oprit. De container wordt donderdag opgehaald.", gelezen: false },
    ];
    for (const d of dms) {
      await voegToe(ctx, run, "direct_messages", {
        orgId, fromUserId: d.van._id, fromClerkId: d.van.clerkId, toUserId: d.naar._id, toClerkId: d.naar.clerkId,
        message: d.tekst, messageType: "text", isRead: d.gelezen, readAt: d.gelezen ? d.op + 10 * 60000 : undefined, createdAt: d.op,
      });
    }

    // ── Meldingen voor de medewerker ─────────────────────────────────────
    const meldingen = [
      { type: "project_status_update" as const, op: tijdstip(MA, "10:02"), gelezen: true, title: "Planning gewijzigd",
        message: "Blad ruimen bij Fam. Willems schuift van vrijdag naar woensdagmiddag.", project: "willems" },
      { type: "chat_broadcast" as const, op: tijdstip(MA, "08:30"), gelezen: false, title: "Nieuwe mededeling",
        message: "Vrijdag stoppen we om 13:00 in verband met het teamuitje.", senderName: directie.name },
      { type: "project_assignment" as const, op: tijdstip(MA, "14:12"), gelezen: false, title: "Je bent ingepland",
        message: "Woensdag en donderdag: voortuin aanleggen bij Fam. Notermans in Maastricht.", project: "notermans" },
      { type: "system_reminder" as const, op: ingediendOp + 60000, gelezen: true, title: "Dag ingediend",
        message: "Je uren van maandag 5 oktober zijn ingediend. Dank je!" },
    ];
    for (const m of meldingen) {
      const p = m.project ? klus[m.project] : undefined;
      await voegToe(ctx, run, "notifications", {
        userId: user._id, orgId, type: m.type, title: m.title, message: m.message,
        projectId: p?.id, projectNaam: p?.spec.naam, klantNaam: p ? klanten[p.spec.klant].spec.naam : undefined,
        senderName: m.senderName, isRead: m.gelezen, isDismissed: false, readAt: m.gelezen ? m.op + 30 * 60000 : undefined,
        triggeredBy: "systeem", createdAt: m.op,
      });
    }

    const registraties = await ctx.db.query("demoSeed").withIndex("by_geseedOp", (q) => q.eq("geseedOp", run)).collect();
    const perTabel: Record<string, number> = {};
    for (const r of registraties) perTabel[r.tabel] = (perTabel[r.tabel] ?? 0) + 1;
    return { geseedOp: run, teamId, klussen: KLUSSEN.length, berichten, totaal: registraties.length, perTabel };
  },
});

function dagenVan(start: string, eind: string): string[] {
  const dagen: string[] = [];
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= eind; d.setUTCDate(d.getUTCDate() + 1)) {
    dagen.push(d.toISOString().slice(0, 10));
  }
  return dagen;
}

// ============================================================
// Controle (read-only)
// ============================================================

export const controle = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    guard();
    const user = await ctx.db.get(args.userId);
    if (!user?.orgId || !user.linkedMedewerkerId) throw new ConvexError("Kies een gekoppeld account");
    const orgId = user.orgId, medewerkerId = user.linkedMedewerkerId;
    const dagen = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"];
    const perDag = [];
    for (const datum of dagen) {
      const team = await teamVanMedewerkerOpDag(ctx.db, orgId, medewerkerId, datum);
      const segmenten = await segmentenVoorDag(ctx.db, orgId, medewerkerId, datum);
      const afgeleid = await dagkaartVoorstellen(ctx.db, orgId, team?._id, datum, medewerkerId);
      const dag = await ctx.db.query("urenDagen").withIndex("by_medewerker_datum", (q) => q.eq("medewerkerId", medewerkerId).eq("datum", datum)).unique();
      perDag.push({
        datum, team: team?.naam ?? null, dagStatus: dag?.status ?? "open",
        stops: afgeleid.stops.map((s) => `${s.naam} (${s.taken.length} taken)`),
        segmenten: segmenten.length, voorstellen: filterVoorstellen(afgeleid.voorstellen, segmenten).length,
      });
    }
    const team = await ctx.db.query("team_messages").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
    const ongelezen = team.filter((m) => m.senderId !== user._id && !(m.readBy ?? []).includes(user.clerkId));
    const dms = (await ctx.db.query("direct_messages").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()).filter((d) => d.fromClerkId === user.clerkId || d.toClerkId === user.clerkId);
    const meldingen = await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return {
      perDag,
      chat: {
        team: team.filter((m) => m.channelType === "team").length,
        mededelingen: team.filter((m) => m.channelType === "broadcast").length,
        project: team.filter((m) => m.channelType === "project").length,
        ongelezenKanalen: ongelezen.length,
        dm: dms.length,
        dmOngelezen: dms.filter((d) => d.toClerkId === user.clerkId && !d.isRead).length,
      },
      meldingen: { totaal: meldingen.length, ongelezen: meldingen.filter((m) => !m.isRead).length },
    };
  },
});
