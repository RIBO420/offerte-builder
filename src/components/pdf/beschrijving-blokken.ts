/**
 * Artikelbeschrijving (offertetekst uit het prijsboek) → blokken voor de PDF.
 *
 * Puur en zonder @react-pdf-import, zodat het los te testen is. De PDF-laag
 * (artikel-beschrijving-pdf.tsx) rendert alinea's als gedempte kleine tekst
 * met behouden regeleinden en opsommingen met bolletje en inspringing.
 *
 * Herkent drie schrijfwijzen van opsommingen:
 * - gewoon: regels die beginnen met "- ", "• " of "* ";
 * - HERO-export: een los streepje op een eigen regel, dan (lege regels en) de
 *   tekst van het punt — zo komt een HTML-lijst uit HERO's Excel-export;
 * - in de lopende tekst: "staffel: • Minder dan ¼ … • Tussen …".
 *
 * Verder, zodat een beschrijving geen grote hoop tekst wordt:
 * - een zin die zonder punt aan een opsommingspunt vastzit ("… afvoeren De
 *   afvoerkosten worden …") begint weer op een eigen regel;
 * - een korte regel die eindigt op ":" wordt een kopje ("De prijs is inclusief:");
 * - een lange alinea zonder eigen regeleinden wordt op zinsgrenzen opgedeeld.
 */

export type BeschrijvingBlok =
  | { soort: "alinea"; regels: string[] }
  | { soort: "kop"; tekst: string }
  | { soort: "opsomming"; punten: string[] };

/** Langer dan dit (tekens) en zonder regeleinden: opdelen op zinsgrenzen. */
const LANGE_ALINEA = 300;
/** Streeflengte van een stuk na het opdelen. */
const STUK = 220;
/** Een kopje is kort en eindigt op een dubbele punt. */
const MAX_KOP = 80;

/**
 * Zinsbegin dat zonder punt aan de vorige tekst vastzit: kleine letter of
 * cijfer, spatie, een gangbaar Nederlands zinsbegin en daarna een woord met
 * kleine letter. Dan is er een regeleinde verloren gegaan in de export.
 */
const VASTGEPLAKTE_ZIN =
  /([a-z0-9€%)]) (?=(?:De|Het|Wij|Deze|Dit|Daarnaast|Hierbij|Om|Onze|Tevens|Vervolgens|Ondanks|Dankzij|Hiermee|Zo) [a-z])/g;

/** Opsommingstekens midden in een regel naar het begin van een eigen regel. */
function normaliseer(tekst: string): string {
  return tekst
    .replace(/([^\n\s])[ \t\u00a0]*•[ \t\u00a0]*/g, "$1\n• ")
    .replace(VASTGEPLAKTE_ZIN, "$1\n");
}

/** Lange alinea op zinsgrenzen in stukken van ongeveer STUK tekens. */
function deelOp(regel: string): string[] {
  if (regel.length <= LANGE_ALINEA) return [regel];
  // Zinsgrens = leesteken, spatie, hoofdletter ("ca. 88 m²" breekt dus niet)
  const zinnen = regel.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const stukken: string[] = [];
  let huidig = "";
  for (const zin of zinnen) {
    if (huidig && huidig.length + zin.length + 1 > STUK) {
      stukken.push(huidig);
      huidig = "";
    }
    huidig = huidig ? `${huidig} ${zin}` : zin;
  }
  if (huidig) stukken.push(huidig);
  return stukken;
}

const ENTITEITEN: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#039;": "'",
  "&nbsp;": " ",
};

/** Losse HTML-entiteiten die soms nog in HERO-teksten staan. */
function ontsleutel(tekst: string): string {
  return tekst
    .replace(/&(?:amp|lt|gt|quot|apos|#0?39|nbsp);/g, (m) => ENTITEITEN[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

/** Alleen een opsommingsteken op de regel (HERO-schrijfwijze). */
const LOS_TEKEN = /^[-•*]$/;
/** Opsommingsteken gevolgd door tekst; bij "•" mag de spatie ontbreken. */
const PUNT = /^(?:[-*][ \t]+|•[ \t]*)(\S.*)$/;

export function beschrijvingNaarBlokken(
  tekst: string | null | undefined
): BeschrijvingBlok[] {
  if (!tekst || !tekst.trim()) return [];

  const blokken: BeschrijvingBlok[] = [];
  // Lopende blokken in één object: TS volgt toewijzingen in closures niet
  const open: { alinea: string[] | null; opsomming: string[] | null } = {
    alinea: null,
    opsomming: null,
  };
  /** Los teken gezien: de volgende niet-lege regel is de tekst van het punt. */
  let wachtOpPunt = false;
  /** Lege regel sinds het laatste punt (dan is een ingesprongen regel géén vervolg). */
  let legeRegelNaPunt = false;

  const sluitAlinea = () => {
    const regels = open.alinea;
    open.alinea = null;
    if (!regels || regels.length === 0) return;
    if (regels.length === 1) {
      const [regel] = regels;
      if (regel.endsWith(":") && regel.length <= MAX_KOP) {
        blokken.push({ soort: "kop", tekst: regel });
        return;
      }
      for (const stuk of deelOp(regel)) blokken.push({ soort: "alinea", regels: [stuk] });
      return;
    }
    blokken.push({ soort: "alinea", regels });
  };
  const sluitOpsomming = () => {
    if (open.opsomming && open.opsomming.length > 0) {
      blokken.push({ soort: "opsomming", punten: open.opsomming });
    }
    open.opsomming = null;
  };
  const voegPuntToe = (punt: string) => {
    sluitAlinea();
    (open.opsomming ??= []).push(punt);
    legeRegelNaPunt = false;
  };

  const regels = normaliseer(ontsleutel(tekst).replace(/\r\n?/g, "\n")).split("\n");
  for (const ruw of regels) {
    const regel = ruw.replace(/[ \t\u00a0]+/g, " ").trim();

    if (regel === "") {
      if (wachtOpPunt) continue;
      sluitAlinea();
      if (open.opsomming) legeRegelNaPunt = true;
      continue;
    }

    if (LOS_TEKEN.test(regel)) {
      sluitAlinea();
      wachtOpPunt = true;
      continue;
    }

    const punt = PUNT.exec(regel);
    if (punt) {
      wachtOpPunt = false;
      voegPuntToe(punt[1]);
      continue;
    }

    if (wachtOpPunt) {
      wachtOpPunt = false;
      voegPuntToe(regel);
      continue;
    }

    // Ingesprongen regel direct onder een punt: vervolg van dat punt
    if (open.opsomming && !legeRegelNaPunt && /^[ \t]/.test(ruw)) {
      open.opsomming[open.opsomming.length - 1] += ` ${regel}`;
      continue;
    }

    // Korte "Iets: waarde"-regel direct onder een opsomming hoort er nog bij
    // ("Meer dan 1 volle aanhanger: in overleg" na een staffel)
    if (
      open.opsomming &&
      !legeRegelNaPunt &&
      regel.length <= 90 &&
      /^[^:]{2,45}: \S/.test(regel)
    ) {
      voegPuntToe(regel);
      continue;
    }

    sluitOpsomming();
    (open.alinea ??= []).push(regel);
  }

  sluitAlinea();
  sluitOpsomming();
  return blokken;
}
