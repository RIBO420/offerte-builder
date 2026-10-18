import { berekenUrenTotalen, regelMinuten, tijdMinuten, valideerUrenPeriode, verdeelPauzeOverKlanten, type UrenRegel } from "../../convex/lib/urenTotalen";

export type HubExportType = "salaris" | "facturatie" | "jaarrapportage";
export type HubFacturatieInhoud = "alles" | "werk" | "werkpauze";
export interface HubExportRegel extends UrenRegel {
  medewerkerNaam: string;
  klantNaam?: string | null;
  werksoort?: string | null;
}
export interface HubExportBezoek { datum: string; klantId: string; afgerond: boolean; teamNaam?: string }
export interface HubExportAfvoer { id: string; revision: number; datum: string; klantId: string; keuze: string; bedragCent: number | null }
export type Cel = { text: string } | { num: number } | { date: string };
export type WerkbladCellen = Record<string, Cel>;
export type WerkmapCellen = Record<string, WerkbladCellen>;
export interface HubExportOpties { van: string; tot: string; klantId?: string; klantIds?: string[]; medewerkerIds?: string[]; facturatieInhoud?: HubFacturatieInhoud; pauzeDoorbelasten?: boolean; bezoeken?: HubExportBezoek[]; afvoer?: HubExportAfvoer[] }
const blad = (n: number) => `xl/worksheets/sheet${n}.xml`;
const labels: Record<string, string> = { werken: "Werken", reistijd: "Reistijd", pauze: "Pauze", loods: "Loods", laden: "Laden", lossen: "Lossen", afvalverwerker_bes: "Afvalverwerker BES", onderhoud_materiaal: "Onderhoud materiaal", wachten: "Wachten", teammeeting: "Teamoverleg", anders: "Overig" };
const round2 = (n: number) => Math.round(n * 100) / 100;
const tijdCel = (s: string): Cel => ({ num: Math.round(tijdMinuten(s) / 1440 * 1e8) / 1e8 });
function limiet(n: number, max: number, naam: string) { if (n > max) throw new RangeError(`${naam} heeft ruimte voor ${max} regels; er zijn ${n}. Kies een kleinere periode of laat het sjabloon uitbreiden.`); }

/** Source template cell contracts; payroll always sees complete person-days. */
export function bouwHubExport(type: HubExportType, alle: HubExportRegel[], opties: HubExportOpties): WerkmapCellen {
  valideerUrenPeriode(opties.van, opties.tot);
  if (type === "salaris" && (opties.klantId !== undefined || opties.klantIds !== undefined)) throw new Error("Salaris kan niet op klant worden gefilterd; dat zou betaalde dagen inkorten.");
  if (opties.klantId !== undefined && opties.klantIds !== undefined) throw new Error("Gebruik één klantselectie voor de export.");
  const klantIds = opties.klantIds === undefined ? (opties.klantId === undefined ? null : new Set([opties.klantId])) : new Set(opties.klantIds);
  const medewerkerIds = opties.medewerkerIds === undefined ? null : new Set(opties.medewerkerIds);
  if (medewerkerIds?.size === 0) throw new Error("Selecteer ten minste één medewerker, of kies alle medewerkers.");
  if (klantIds?.size === 0) throw new Error("Selecteer ten minste één klant, of kies alle klanten.");
  const jaar = Number(opties.van.slice(0, 4));
  // Select complete person-days first; break allocation retains every customer of those people.
  const periode = alle.filter(r => (!medewerkerIds || medewerkerIds.has(r.medewerkerId)) && (type === "jaarrapportage" ? r.datum.startsWith(`${jaar}-`) : r.datum >= opties.van && r.datum <= opties.tot));
  periode.forEach(regelMinuten);
  // Allocate before customer filtering: a customer must never absorb another customer's break share.
  const pauzes = verdeelPauzeOverKlanten(periode);
  const inhoud = type === "facturatie" ? opties.facturatieInhoud ?? "alles" : "alles";
  const pauzeDoorbelasten = type === "facturatie" && (opties.facturatieInhoud ? inhoud === "werkpauze" : opties.pauzeDoorbelasten === true);
  // A break follows the customer selection: a break booked on a non-selected customer stays out;
  // a break without customer only goes along when that worker did work for a selected customer that day.
  const gekozenWerkdagen = new Set(periode.filter(r => r.categorie === "werken" && r.klantId != null && klantIds?.has(r.klantId)).map(r => `${r.medewerkerId}|${r.datum}`));
  const pauzeHoortBijSelectie = (r: HubExportRegel) => r.klantId != null ? klantIds!.has(r.klantId) : gekozenWerkdagen.has(`${r.medewerkerId}|${r.datum}`);
  const regels = periode
    .filter(r => inhoud === "alles" || r.categorie === "werken" || (inhoud === "werkpauze" && r.categorie === "pauze"))
    .filter(r => !klantIds || (r.klantId != null && klantIds.has(r.klantId)) || (inhoud === "werkpauze" && r.categorie === "pauze" && pauzeHoortBijSelectie(r)))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.beginTijd.localeCompare(b.beginTijd) || a.medewerkerNaam.localeCompare(b.medewerkerNaam));
  if (!regels.length) throw new Error("Geen uren gevonden voor deze selectie.");
  if (type === "salaris") {
    const groepen = new Map<string, HubExportRegel[]>();
    for (const r of regels) groepen.set(r.medewerkerId, [...(groepen.get(r.medewerkerId) ?? []), r]);
    const medewerkers = [...groepen.values()].sort((a, b) => a[0].medewerkerNaam.localeCompare(b[0].medewerkerNaam));
    limiet(medewerkers.length, 25, "Salaris");
    const nl = (s: string) => s.split("-").reverse().join("-");
    const cells: WerkbladCellen = { B2: { text: `${nl(opties.van)} t/m ${nl(opties.tot)}` } };
    medewerkers.forEach((groep, i) => {
      const rij = i + 6, totalen = berekenUrenTotalen(groep);
      cells[`A${rij}`] = { text: groep[0].medewerkerNaam };
      cells[`B${rij}`] = { num: round2(totalen.bronBetaald / 60) };
      cells[`C${rij}`] = { num: round2((totalen.perCategorie.reistijd ?? 0) / 60) };
      cells[`D${rij}`] = { num: new Set(groep.map(r => r.datum)).size };
      cells[`H${rij}`] = { num: round2(totalen.pauze / 60) };
    });
    return { [blad(2)]: cells };
  }
  const registraties: WerkbladCellen = {};
  const klantNamen = new Map<string, string>();
  for (const r of regels) if (r.klantId && r.klantNaam) klantNamen.set(r.klantId, r.klantNaam);
  // The inherited Excel SUMIFS matches names. Refuse ambiguous names rather than merge distinct customers/workers.
  const uniek = (paren: [string, string][], soort: string) => {
    const ids = new Map<string, string>();
    for (const [id, naam] of paren) { if (ids.has(naam) && ids.get(naam) !== id) throw new Error(`Twee ${soort} hebben de naam “${naam}”. Geef ze unieke namen voor deze Excel-export.`); ids.set(naam, id); }
  };
  uniek([...klantNamen], "klanten");
  uniek(regels.map(r => [r.medewerkerId, r.medewerkerNaam]), "medewerkers");
  limiet(regels.length, type === "jaarrapportage" ? 25000 : 3000, type === "jaarrapportage" ? "Jaarrapportage" : "Registraties");
  regels.forEach((r, i) => {
    const rij = i + (type === "jaarrapportage" ? 2 : 5);
    if (type === "jaarrapportage") {
      registraties[`A${rij}`] = { date: r.datum }; registraties[`B${rij}`] = { text: r.medewerkerNaam };
      if (r.klantNaam) registraties[`C${rij}`] = { text: r.klantNaam };
      registraties[`D${rij}`] = { text: labels[r.categorie] ?? r.categorie };
      if (r.werksoort) registraties[`E${rij}`] = { text: r.werksoort };
      registraties[`F${rij}`] = tijdCel(r.beginTijd); registraties[`G${rij}`] = tijdCel(r.eindTijd);
      registraties[`H${rij}`] = { num: regelMinuten(r) / 60 }; // no per-row rounding loss
    } else {
      registraties[`A${rij}`] = { date: r.datum }; registraties[`C${rij}`] = { text: r.medewerkerNaam };
      if (r.klantNaam) registraties[`D${rij}`] = { text: r.klantNaam };
      registraties[`E${rij}`] = { text: labels[r.categorie] ?? r.categorie };
      if (r.werksoort) registraties[`F${rij}`] = { text: r.werksoort };
      registraties[`G${rij}`] = tijdCel(r.beginTijd); registraties[`H${rij}`] = tijdCel(r.eindTijd);
    }
  });
  if (type === "jaarrapportage") {
    const klanten = [...new Set(regels.filter(r => r.categorie === "werken" && r.klantNaam).map(r => r.klantNaam!))].sort();
    const medewerkers = [...new Set(regels.map(r => r.medewerkerNaam))].sort();
    limiet(klanten.length, 150, "Klantmatrix"); limiet(medewerkers.length, 25, "Medewerkermatrix");
    const namen = (lijst: string[]): WerkbladCellen => Object.fromEntries(lijst.map((naam, i) => [`A${i + 7}`, { text: naam }]));
    return { [blad(2)]: registraties, [blad(3)]: { B2: { num: jaar } }, [blad(4)]: namen(klanten), [blad(5)]: namen(medewerkers) };
  }
  const groepen = new Map<string, HubExportRegel[]>();
  for (const r of regels.filter(r => r.categorie === "werken")) { const key = `${r.datum}|${r.klantId ?? ""}`; groepen.set(key, [...(groepen.get(key) ?? []), r]); }
  limiet(groepen.size, 600, "Werkregels");
  const werk: WerkbladCellen = {};
  [...groepen.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([key, groep], i) => {
    const rij = i + 3, r = groep[0];
    werk[`B${rij}`] = { date: r.datum }; werk[`C${rij}`] = { text: r.klantNaam ?? "(geen klant)" };
    const soorten = [...new Set(groep.flatMap(s => s.werksoort ? [s.werksoort] : []))];
    if (soorten.length) werk[`D${rij}`] = { text: soorten.join(" + ") };
    const bezoeken = (opties.bezoeken ?? []).filter(b => b.datum === r.datum && b.klantId === r.klantId);
    const teams = [...new Set(bezoeken.flatMap(b => b.teamNaam ? [b.teamNaam] : []))];
    werk[`E${rij}`] = { text: teams.length ? teams.join(", ") : [...new Set(groep.map(s => s.medewerkerNaam.split(/\s+/)[0]))].join(", ") };
    werk[`F${rij}`] = { num: new Set(groep.map(s => s.medewerkerId)).size };
    if (bezoeken.length) werk[`G${rij}`] = { text: bezoeken.every(b => b.afgerond) ? "Ja" : "Nee" };
    if (pauzeDoorbelasten) {
      const extra = pauzes.get(key) ?? 0, minuten = groep.reduce((n, s) => n + regelMinuten(s), 0) + extra;
      werk[`H${rij}`] = { num: round2(Math.floor(minuten / 60) + minuten % 60 / 100) };
      if (extra) werk[`T${rij}`] = { text: `incl. ${extra} min pauze (naar rato toegerekend)` };
    }
    // Exactly one charge per shared visit record, regardless of crew size.
    const afvoer = [...new Map((opties.afvoer ?? []).filter(a => a.datum === r.datum && a.klantId === r.klantId).map(a => [a.id, a])).values()];
    if (afvoer.some(a => a.bedragCent === null)) throw new Error(`Stortkosten voor ${r.klantNaam ?? "de klant"} op ${r.datum} hebben nog geen vastgesteld bedrag.`);
    const centen = afvoer.reduce((n, a) => n + (a.bedragCent ?? 0), 0);
    if (centen > 0) {
      werk[`O${rij}`] = { num: centen / 100 };
      werk[`S${rij}`] = { text: `Stortkosten € ${(centen / 100).toFixed(2).replace(".", ",")} (${afvoer.map(a => `${a.id} v${a.revision}`).join(", ")})` };
    }
    // Physical return measurements never enter this charge calculation.
  });
  const klanten = [...new Set([...groepen.values()].map(g => g[0].klantNaam ?? "(geen klant)"))].sort();
  limiet(klanten.length, 150, "Te factureren");
  const tarieven: WerkbladCellen = {}, facturen: WerkbladCellen = {};
  klanten.forEach((naam, i) => { tarieven[`A${i + 2}`] = { text: naam }; facturen[`A${i + 7}`] = { text: naam }; });
  return { [blad(2)]: registraties, [blad(3)]: tarieven, [blad(4)]: werk, [blad(5)]: facturen };
}

function escapeXml(s: string) { return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!); }
function kolom(ref: string) { return [...ref.replace(/\d/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0); }
/** Modify input cells only. All formulas, validations, charts and other ZIP entries survive. */
export function vulWerkblad(xml: string, cellen: WerkbladCellen, groeien = false) {
  const perRij = new Map<number, Map<string, Cel>>();
  for (const [ref, waarde] of Object.entries(cellen)) {
    if (!/^[A-Z]+[1-9]\d*$/.test(ref)) throw new Error("Ongeldige celverwijzing");
    const rij = Number(ref.replace(/\D/g, ""));
    const waarden = perRij.get(rij) ?? new Map<string, Cel>(); waarden.set(ref, waarde); perRij.set(rij, waarden);
  }
  // Sparse annual template provides formats in its first rows. Copy those formats
  // when growing data rows, so dates/times never become raw Excel serial numbers.
  const stijlPerKolom = new Map<number, string>();
  for (const match of xml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*\bs="(\d+)"[^>]*>/g)) {
    if (Number(match[1].replace(/\D/g, "")) < 2) continue;
    if (!stijlPerKolom.has(kolom(match[1]))) stijlPerKolom.set(kolom(match[1]), match[2]);
  }
  const maakCel = (ref: string, c: Cel, oud?: string) => {
    if (oud && /<f\b/.test(oud)) throw new Error(`Cel ${ref} bevat een formule en mag niet worden overschreven.`);
    const stijl = oud?.match(/\bs="(\d+)"/)?.[1] ?? (groeien ? stijlPerKolom.get(kolom(ref)) : undefined);
    const getal = "num" in c ? c.num : "date" in c ? (Date.parse(`${c.date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000 : null;
    if (getal !== null && !Number.isFinite(getal)) throw new Error(`Ongeldig getal in ${ref}`);
    const waarde = "text" in c ? `<is><t xml:space="preserve">${escapeXml(c.text)}</t></is>` : `<v>${getal}</v>`;
    return `<c r="${ref}"${stijl ? ` s="${stijl}"` : ""}${"text" in c ? ' t="inlineStr"' : ""}>${waarde}</c>`;
  };
  const rijNummers = [...perRij.keys()].sort((a, b) => a - b);
  let index = 0;
  const nieuweRij = (nummer: number) => {
    if (!groeien) throw new Error(`Rij ${nummer} ontbreekt in het sjabloon.`);
    const waarden = perRij.get(nummer)!;
    return `<row r="${nummer}">${[...waarden].sort(([a], [b]) => kolom(a) - kolom(b)).map(([ref, c]) => maakCel(ref, c)).join("")}</row>`;
  };
  // One pass over worksheet rows; annual exports remain linear rather than doing
  // 200,000 replacements over an ever-growing XML document.
  let resultaat = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, (rijXml: string, nummerTekst: string) => {
    const nummer = Number(nummerTekst);
    let vooraf = "";
    while (index < rijNummers.length && rijNummers[index] < nummer) vooraf += nieuweRij(rijNummers[index++]);
    const waarden = perRij.get(nummer);
    if (!waarden) return vooraf + rijXml;
    index++;
    const refs = [...waarden.keys()].sort((a, b) => kolom(a) - kolom(b));
    let celIndex = 0;
    const ontbrekendeTot = (max: number) => {
      let tekst = "";
      while (celIndex < refs.length && kolom(refs[celIndex]) < max) {
        const ref = refs[celIndex++];
        if (!groeien) throw new Error(`Cel ${ref} ontbreekt in het sjabloon.`);
        tekst += maakCel(ref, waarden.get(ref)!);
      }
      return tekst;
    };
    const gewijzigd = rijXml.replace(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, (oud: string, ref: string) => {
      const prefix = ontbrekendeTot(kolom(ref));
      const c = waarden.get(ref);
      if (!c) return prefix + oud;
      celIndex++;
      return prefix + maakCel(ref, c, oud);
    });
    return vooraf + gewijzigd.replace("</row>", `${ontbrekendeTot(Infinity)}</row>`);
  });
  let achteraf = "";
  while (index < rijNummers.length) achteraf += nieuweRij(rijNummers[index++]);
  resultaat = resultaat.replace("</sheetData>", `${achteraf}</sheetData>`);
  if (groeien && rijNummers.length) resultaat = resultaat.replace(/<dimension ref="([^:"]+):([A-Z]+)(\d+)"\/>/, (oud, begin: string, eindKolom: string, eindRij: string) => {
    const maxRij = Math.max(Number(eindRij), rijNummers[rijNummers.length - 1]);
    return `<dimension ref="${begin}:${eindKolom}${maxRij}"/>`;
  });
  return resultaat;
}

export async function vulHubSjabloon(bytes: ArrayBuffer | Uint8Array, type: HubExportType, cellen: WerkmapCellen): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  for (const [pad, waarden] of Object.entries(cellen)) {
    const bestand = zip.file(pad);
    if (!bestand) throw new Error(`Werkblad ontbreekt: ${pad}`);
    zip.file(pad, vulWerkblad(await bestand.async("string"), waarden, type === "jaarrapportage" && pad === blad(2)));
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function downloadHubExport(type: HubExportType, regels: HubExportRegel[], opties: HubExportOpties) {
  const cellen = bouwHubExport(type, regels, opties);
  const response = await fetch(`/templates/hub/${type}.xlsx`);
  if (!response.ok) throw new Error("Het Excel-sjabloon kon niet worden geladen.");
  const bytes = await vulHubSjabloon(await response.arrayBuffer(), type, cellen);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url;
  link.download = `Top-Tuinen-${type}-${opties.van}-${opties.tot}.xlsx`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Month-sized reads avoid a single whole-year Convex document scan. */
export function exportMaandVensters(van: string, tot: string) {
  valideerUrenPeriode(van, tot);
  const vensters: { van: string; tot: string }[] = [];
  let begin = van;
  while (begin <= tot) {
    const d = new Date(`${begin}T12:00:00Z`);
    const einde = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
    vensters.push({ van: begin, tot: einde < tot ? einde : tot });
    begin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12)).toISOString().slice(0, 10);
  }
  return vensters;
}
