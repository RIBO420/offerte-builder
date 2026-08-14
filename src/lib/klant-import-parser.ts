/**
 * CSV-parser voor klanten- en leveranciersimport.
 *
 * Uitgangspunt: een export uit een ander pakket is rommelig, en dat mag de
 * import niet blokkeren. Daarom geldt hier één regel — een rij wordt alleen
 * geweigerd als er geen náám uit te halen is. Al het andere (ontbrekende of
 * buitenlandse postcode, onleesbaar e-mailadres, adres zonder plaats) levert
 * een waarschuwing op en de rij komt gewoon binnen. Aanvullen kan later in de
 * app; opnieuw moeten stoeien met een CSV kan niet.
 *
 * Ondersteunde vormen:
 * - Losse kolommen: naam/email/telefoon/straat/huisnummer/postcode/plaats/type
 * - Relatie-export: Type;Klantnummer;Bedrijfsnaam;Voornaam;Achternaam;E-mail;
 *   Categorie;Plaats — waarbij "Plaats" het volledige adres bevat
 *   ("Dijk 24A, 6127 AG Grevenbicht") en "Categorie" klant van leverancier
 *   scheidt.
 */

export type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

/** Klant of leverancier — bepaalt naar welke tabel de rij gaat. */
export type RelatieSoort = "klant" | "leverancier";

export interface ParsedKlantEntry {
  naam: string;
  email?: string;
  telefoon?: string;
  /** Contactpersoon bij een bedrijf (voornaam + achternaam naast de bedrijfsnaam). */
  contactpersoon?: string;
  adres: string;
  postcode: string;
  plaats: string;
  klantType: KlantType;
  soort: RelatieSoort;
  /**
   * Tweede nummer als de export er twee heeft (vast én mobiel). Belandt in de
   * notities; het schema kent één telefoonveld en dat blijft het nummer waar
   * je op belt.
   */
  extraTelefoon?: string;
  website?: string;
  /**
   * Externe referentie uit het bronsysteem. Dit is de sleutel waarop een
   * herhaalde import bestaande relaties terugvindt in plaats van ze dubbel
   * aan te maken — in beide exports uniek (272/272 en 45/45).
   */
  klantnummer?: string;
  /** Wat er aan deze rij mankeerde — getoond in de preview, blokkeert niets. */
  opmerkingen: string[];
}

export interface KlantParseResult {
  entries: ParsedKlantEntry[];
  /** Alleen blokkerende problemen: bestand onleesbaar of rij zonder naam. */
  errors: string[];
  /** Alles wat is rechtgezet of ontbreekt maar de import niet tegenhoudt. */
  warnings: string[];
}

// Kolomnamen die we herkennen (meerdere varianten per veld)
const columnMappings: Record<string, string[]> = {
  naam: ["naam", "name", "klantnaam", "klant", "customer", "relatie"],
  bedrijfsnaam: ["bedrijfsnaam", "bedrijf", "company", "organisatie"],
  voornaam: ["voornaam", "firstname", "first_name", "roepnaam"],
  achternaam: ["achternaam", "lastname", "last_name", "familienaam"],
  email: ["email", "e-mail", "emailadres", "e-mailadres", "mail"],
  telefoon: ["telefoon", "telefoonnummer", "tel", "phone", "mobiel", "gsm"],
  straat: ["straat", "straatnaam", "street", "adres", "address"],
  huisnummer: ["huisnummer", "nummer", "nr", "housenumber", "huis_nr"],
  postcode: ["postcode", "postal", "zip", "zipcode", "postal_code"],
  plaats: ["plaats", "stad", "city", "woonplaats", "town", "gemeente"],
  type: ["type", "klanttype", "klant_type", "soort"],
  categorie: ["categorie", "category", "relatiesoort"],
  klantnummer: ["klantnummer", "relatienummer", "debiteurnummer", "nummer_klant"],
  website: ["website", "site", "url", "homepage"],
};

const VALID_KLANT_TYPES: KlantType[] = ["particulier", "zakelijk", "vve", "gemeente", "overig"];

/** Nederlandse postcode: 4 cijfers + 2 letters. */
const NL_POSTCODE = /^(\d{4})\s*([A-Za-z]{2})(?![A-Za-z])/;
/** Buitenlandse/onvolledige postcode: 4 t/m 6 cijfers (BE 4, NL 4, DE 5). */
const NUMERIEKE_POSTCODE = /^(\d{4,6})(?!\d)/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * HTML-entiteiten die exports vaak achterlaten ("D&#039;Artagnanlaan",
 * "Blok 1,2 &amp; 3") terugvertalen naar leesbare tekst.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function detectSeparator(firstLine: string): string {
  const puntkomma = (firstLine.match(/;/g) || []).length;
  const komma = (firstLine.match(/,/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  if (tab > puntkomma && tab > komma) return "\t";
  return puntkomma >= komma ? ";" : ",";
}

/**
 * Echte CSV-parser met quote-ondersteuning. De oude versie deed `line.split(sep)`
 * en brak op elk veld met de scheidingstekens erin — precies wat er gebeurt bij
 * een adresveld als "Dijk 24A, 6127 AG Grevenbicht".
 */
function splitCSV(text: string, separator: string): string[][] {
  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const teken = text[i];

    if (inQuotes) {
      if (teken === '"') {
        if (text[i + 1] === '"') {
          veld += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        veld += teken;
      }
      continue;
    }

    if (teken === '"') {
      inQuotes = true;
    } else if (teken === separator) {
      rij.push(veld);
      veld = "";
    } else if (teken === "\n") {
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = "";
    } else if (teken !== "\r") {
      veld += teken;
    }
  }

  if (veld || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }

  return rijen.filter((r) => r.some((v) => v.trim()));
}

function parseCSVText(text: string): Record<string, string>[] {
  const cleaned = stripBOM(text);
  const eersteRegel = cleaned.split(/\r?\n/, 1)[0] ?? "";
  const separator = detectSeparator(eersteRegel);
  const rijen = splitCSV(cleaned, separator);

  if (rijen.length < 2) return [];

  const headers = rijen[0].map((h) => decodeEntities(h).trim());

  return rijen.slice(1).map((waarden) => {
    const rij: Record<string, string> = {};
    headers.forEach((header, i) => {
      rij[header] = decodeEntities(waarden[i] ?? "").trim();
    });
    return rij;
  });
}

function findColumn(
  row: Record<string, string>,
  possibleNames: string[]
): string | undefined {
  return findColumns(row, possibleNames)[0];
}

/**
 * Álle kolommen die op een van de namen passen, in bestandsvolgorde.
 *
 * Nodig omdat een export het telefoonnummer over meerdere kolommen kan
 * verdelen. De relatie-export van Top Tuinen heeft "Telefoonnummer" én
 * "Mobiel": bij de klanten staat het nummer in 182 van de 272 gevallen alleen
 * in "Mobiel". Met één kolom pakken verloor je die allemaal.
 */
function findColumns(
  row: Record<string, string>,
  possibleNames: string[]
): string[] {
  const keys = Object.keys(row);
  const lowerKeys = keys.map((k) => k.toLowerCase().trim());
  const gevonden: string[] = [];

  const voegToe = (index: number) => {
    if (index !== -1 && !gevonden.includes(keys[index])) gevonden.push(keys[index]);
  };

  // Exacte treffers eerst: "Telefoonnummer" vóór een kolom die het woord
  // toevallig bevat.
  for (const name of possibleNames) {
    lowerKeys.forEach((k, i) => {
      if (k === name.toLowerCase()) voegToe(i);
    });
  }
  for (const name of possibleNames) {
    lowerKeys.forEach((k, i) => {
      if (k.includes(name.toLowerCase())) voegToe(i);
    });
  }
  return gevonden;
}

function normalizeKlantType(value: string | undefined, naam: string): KlantType {
  // "VvE Kapellerlaan 36-40" is geen gewoon bedrijf — dat scheelt handwerk achteraf.
  if (/^\s*vve\b/i.test(naam) || /\bvve\b/i.test(naam)) return "vve";
  if (/^\s*gemeente\b/i.test(naam)) return "gemeente";

  if (!value) return "particulier";
  const lower = value.toLowerCase().trim();

  if (VALID_KLANT_TYPES.includes(lower as KlantType)) return lower as KlantType;

  const aliases: Record<string, KlantType> = {
    bedrijf: "zakelijk",
    bedrijven: "zakelijk",
    business: "zakelijk",
    company: "zakelijk",
    zakelijk: "zakelijk",
    persoon: "particulier",
    personen: "particulier",
    prive: "particulier",
    privé: "particulier",
    private: "particulier",
    personal: "particulier",
    vereniging: "vve",
    "vereniging van eigenaren": "vve",
    overheid: "gemeente",
    government: "gemeente",
    other: "overig",
    anders: "overig",
  };

  return aliases[lower] ?? "particulier";
}

function normalizeSoort(value: string | undefined): RelatieSoort | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim();
  if (lower.startsWith("lever") || lower.startsWith("suppl") || lower.startsWith("crediteur")) {
    return "leverancier";
  }
  if (lower.startsWith("klant") || lower.startsWith("customer") || lower.startsWith("debiteur")) {
    return "klant";
  }
  return undefined;
}

/** Nederlandse postcode netjes als "1234 AB"; overige codes blijven zoals ze zijn. */
export function formatPostcode(postcode: string): string {
  const cleaned = postcode.replace(/\s/g, "").toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  }
  return postcode.trim();
}

export interface GesplitstAdres {
  adres: string;
  postcode: string;
  plaats: string;
  /** true als er wel een adres is maar geen herkenbare postcode. */
  postcodeOntbreekt: boolean;
  /** true bij een niet-Nederlandse postcode (Duits/Belgisch). */
  buitenlandsePostcode: boolean;
}

/**
 * Haalt adres, postcode en plaats uit één samengesteld veld.
 *
 * Werkt van achteren naar voren: het laatste komma-segment dat met een
 * postcode begint is de postcode+plaats, alles daarvóór is het adres. Zo
 * blijven adressen met extra komma's ("ECI 2, Berkelplein 26 6301 ZE
 * Valkenburg, 6041 MA Roermond") intact en wint de échte postcode van een
 * postcode die toevallig middenin het adres staat.
 */
export function splitsAdresveld(ruw: string): GesplitstAdres {
  const tekst = decodeEntities(ruw ?? "").trim();
  if (!tekst) {
    return {
      adres: "",
      postcode: "",
      plaats: "",
      postcodeOntbreekt: false,
      buitenlandsePostcode: false,
    };
  }

  const segmenten = tekst
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = segmenten.length - 1; i >= 0; i--) {
    const segment = segmenten[i];

    const nl = segment.match(NL_POSTCODE);
    if (nl) {
      return {
        adres: segmenten.slice(0, i).join(", "),
        postcode: `${nl[1]} ${nl[2].toUpperCase()}`,
        plaats: segment.slice(nl[0].length).trim().replace(/^,\s*/, ""),
        postcodeOntbreekt: false,
        buitenlandsePostcode: false,
      };
    }

    const numeriek = segment.match(NUMERIEKE_POSTCODE);
    if (numeriek) {
      const plaats = segment.slice(numeriek[0].length).trim().replace(/^,\s*/, "");
      // Een los getal zonder plaatsnaam is eerder een huisnummer dan een postcode.
      if (!plaats) continue;
      return {
        adres: segmenten.slice(0, i).join(", "),
        postcode: numeriek[1],
        plaats,
        postcodeOntbreekt: false,
        // 4 cijfers zonder letters kan ook een NL-postcode zijn waar de letters
        // ontbreken; alles vanaf 5 cijfers is zeker buitenlands.
        buitenlandsePostcode: numeriek[1].length >= 5,
      };
    }
  }

  // Geen postcode gevonden: laatste segment als plaats, de rest als adres.
  if (segmenten.length >= 2) {
    return {
      adres: segmenten.slice(0, -1).join(", "),
      postcode: "",
      plaats: segmenten[segmenten.length - 1],
      postcodeOntbreekt: true,
      buitenlandsePostcode: false,
    };
  }

  return {
    adres: segmenten[0] ?? "",
    postcode: "",
    plaats: "",
    postcodeOntbreekt: true,
    buitenlandsePostcode: false,
  };
}

/**
 * Verwerkt ingelezen rijen tot importeerbare records.
 */
export function processKlantImportData(
  data: Record<string, string>[]
): KlantParseResult {
  const entries: ParsedKlantEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.length === 0) {
    errors.push("Geen data gevonden in bestand");
    return { entries, errors, warnings };
  }

  const firstRow = data[0];
  const naamCol = findColumn(firstRow, columnMappings.naam);
  const bedrijfsnaamCol = findColumn(firstRow, columnMappings.bedrijfsnaam);
  const voornaamCol = findColumn(firstRow, columnMappings.voornaam);
  const achternaamCol = findColumn(firstRow, columnMappings.achternaam);
  const emailCol = findColumn(firstRow, columnMappings.email);
  const telefoonCols = findColumns(firstRow, columnMappings.telefoon);
  const straatCol = findColumn(firstRow, columnMappings.straat);
  const huisnummerCol = findColumn(firstRow, columnMappings.huisnummer);
  const postcodeCol = findColumn(firstRow, columnMappings.postcode);
  const plaatsCol = findColumn(firstRow, columnMappings.plaats);
  const typeCol = findColumn(firstRow, columnMappings.type);
  const categorieCol = findColumn(firstRow, columnMappings.categorie);
  const klantnummerCol = findColumn(firstRow, columnMappings.klantnummer);
  const websiteCol = findColumn(firstRow, columnMappings.website);

  const heeftNaamBron = Boolean(naamCol || bedrijfsnaamCol || achternaamCol || voornaamCol);
  if (!heeftNaamBron) {
    errors.push(
      "Geen naamkolom gevonden. Verwacht: 'naam', of 'bedrijfsnaam' / 'voornaam' + 'achternaam'."
    );
    return { entries, errors, warnings };
  }

  // Als er geen aparte postcodekolom is, zit het adres vermoedelijk samengevoegd
  // in het plaatsveld; dat splitsen we hieronder per rij.
  const adresIsSamengesteld = !postcodeCol && !straatCol;

  let zonderPostcode = 0;
  let buitenlands = 0;
  let zonderEmail = 0;
  const gezieneSleutels = new Set<string>();
  let dubbelInBestand = 0;

  data.forEach((row, index) => {
    const rowNum = index + 2; // +1 header, +1 voor 1-based
    const lees = (col: string | undefined) => (col ? (row[col] ?? "").trim() : "");
    const opmerkingen: string[] = [];

    // ── Naam ──────────────────────────────────────────────────────────────
    const bedrijfsnaam = lees(bedrijfsnaamCol);
    const voornaam = lees(voornaamCol);
    const achternaam = lees(achternaamCol);
    const persoonsnaam = [voornaam, achternaam].filter(Boolean).join(" ").trim();
    const naam = (bedrijfsnaam || persoonsnaam || lees(naamCol)).trim();

    if (!naam) {
      errors.push(`Rij ${rowNum}: geen naam gevonden, rij overgeslagen`);
      return;
    }

    // Bij een bedrijf is de persoonsnaam de contactpersoon.
    const contactpersoon = bedrijfsnaam && persoonsnaam ? persoonsnaam : undefined;

    // ── Adres ─────────────────────────────────────────────────────────────
    let adres = "";
    let postcode = "";
    let plaats = "";

    if (adresIsSamengesteld) {
      const gesplitst = splitsAdresveld(lees(plaatsCol));
      adres = gesplitst.adres;
      postcode = gesplitst.postcode;
      plaats = gesplitst.plaats;
      if (gesplitst.postcodeOntbreekt) opmerkingen.push("postcode ontbreekt");
      if (gesplitst.buitenlandsePostcode) opmerkingen.push("buitenlandse postcode");
    } else {
      const straat = lees(straatCol);
      const huisnummer = lees(huisnummerCol);
      adres = [straat, huisnummer].filter(Boolean).join(" ");
      const ruwePostcode = lees(postcodeCol);
      plaats = lees(plaatsCol);

      if (ruwePostcode) {
        postcode = formatPostcode(ruwePostcode);
        if (!/^\d{4}\s[A-Z]{2}$/.test(postcode)) {
          if (/^\d{4,6}$/.test(postcode.replace(/\s/g, ""))) {
            opmerkingen.push("buitenlandse postcode");
          } else {
            opmerkingen.push("afwijkende postcode");
          }
        }
      } else {
        opmerkingen.push("postcode ontbreekt");
      }

      // Adres zonder losse plaatskolom: mogelijk zit alles in het adresveld.
      if (!plaats && adres.includes(",")) {
        const gesplitst = splitsAdresveld(adres);
        adres = gesplitst.adres || adres;
        plaats = gesplitst.plaats;
        if (!postcode) postcode = gesplitst.postcode;
      }
    }

    if (!plaats) opmerkingen.push("plaats ontbreekt");
    if (!postcode) zonderPostcode++;
    if (opmerkingen.includes("buitenlandse postcode")) buitenlands++;

    // ── E-mail ────────────────────────────────────────────────────────────
    const ruweEmail = lees(emailCol);
    let email: string | undefined;
    if (ruweEmail) {
      if (EMAIL_REGEX.test(ruweEmail)) {
        email = ruweEmail.toLowerCase();
      } else {
        opmerkingen.push("ongeldig e-mailadres");
        warnings.push(`Rij ${rowNum}: ongeldig e-mailadres "${ruweEmail}", niet overgenomen`);
      }
    } else {
      zonderEmail++;
    }

    // Alle telefoonkolommen langslopen; een export zet het nummer nu eens in
    // "Telefoonnummer" en dan weer in "Mobiel". Identieke nummers tellen één
    // keer, zodat een dubbel ingevulde export geen dubbele notitie oplevert.
    const nummers: string[] = [];
    for (const kolom of telefoonCols) {
      const waarde = lees(kolom);
      if (!waarde) continue;
      const kaal = waarde.replace(/[\s\-.()]/g, "");
      if (!nummers.some((n) => n.replace(/[\s\-.()]/g, "") === kaal)) {
        nummers.push(waarde);
      }
    }
    const telefoon = nummers[0] || undefined;
    const extraTelefoon = nummers[1] || undefined;

    const klantType = normalizeKlantType(lees(typeCol), naam);
    const soort = normalizeSoort(lees(categorieCol)) ?? "klant";
    const klantnummer = lees(klantnummerCol) || undefined;
    const website = lees(websiteCol) || undefined;

    // Dubbelen binnen hetzelfde bestand markeren (e-mail, anders naam+postcode).
    const sleutel = email
      ? `e:${email}`
      : `n:${naam.toLowerCase()}|${postcode.replace(/\s/g, "").toLowerCase()}`;
    if (gezieneSleutels.has(sleutel)) {
      opmerkingen.push("dubbel in bestand");
      dubbelInBestand++;
    } else {
      gezieneSleutels.add(sleutel);
    }

    entries.push({
      naam,
      email,
      telefoon,
      contactpersoon,
      adres,
      postcode,
      plaats,
      klantType,
      soort,
      extraTelefoon,
      website,
      klantnummer,
      opmerkingen,
    });
  });

  // Samenvattende waarschuwingen in plaats van één regel per rij — anders staan
  // er honderd meldingen in beeld en zie je het echte probleem niet meer.
  if (zonderPostcode > 0) {
    warnings.push(
      `${zonderPostcode} ${zonderPostcode === 1 ? "rij heeft" : "rijen hebben"} geen postcode. Deze worden gewoon geïmporteerd; je kunt de postcode later in de app aanvullen.`
    );
  }
  if (buitenlands > 0) {
    warnings.push(
      `${buitenlands} ${buitenlands === 1 ? "rij heeft" : "rijen hebben"} een buitenlandse postcode (Duits/Belgisch). Deze blijft staan zoals hij is.`
    );
  }
  if (zonderEmail > 0) {
    warnings.push(
      `${zonderEmail} ${zonderEmail === 1 ? "rij heeft" : "rijen hebben"} geen e-mailadres. Zonder e-mail kun je geen portaal-uitnodiging versturen.`
    );
  }
  if (dubbelInBestand > 0) {
    warnings.push(
      `${dubbelInBestand} ${dubbelInBestand === 1 ? "rij komt" : "rijen komen"} meerdere keren voor in dit bestand. Alleen de eerste wordt geïmporteerd.`
    );
  }

  return { entries, errors, warnings };
}

export async function parseKlantenFile(file: File): Promise<KlantParseResult> {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (fileExtension !== "csv") {
    return {
      entries: [],
      errors: ["Ongeldig bestandstype. Gebruik een CSV bestand (.csv)"],
      warnings: [],
    };
  }

  try {
    const text = await file.text();
    const data = parseCSVText(text);
    return processKlantImportData(data);
  } catch (error) {
    return {
      entries: [],
      errors: [`Fout bij laden bestand: ${error}`],
      warnings: [],
    };
  }
}

export function getSampleKlantCSV(): string {
  return `Type;Klantnummer;Bedrijfsnaam;Voornaam;Achternaam;E-mail;Categorie;Plaats
Persoon;1001;;Jan;Jansen;jan@voorbeeld.nl;Klant;Hoofdstraat 1, 1234 AB Amsterdam
Persoon;1002;;Els;de Vries;devries@email.nl;Klant;Parkweg 15a, 9012 EF Utrecht
Bedrijf;1003;De Groene Tuin B.V.;Piet;Bakker;info@groen.nl;Klant;Kerkweg 42, 5678 CD Rotterdam
Bedrijf;1004;VvE Zonnedael;;;bestuur@zonnedael.nl;Klant;Zonnebloemstraat 8, 3456 GH Den Haag
Bedrijf;1005;Boomkwekerij Frijns;;;info@frijns.nl;Leverancier;Groot Welsden 30, 6269 EV Margraten`;
}
