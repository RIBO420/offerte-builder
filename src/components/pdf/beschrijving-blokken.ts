/**
 * Artikelbeschrijving (offertetekst uit het prijsboek) → blokken voor de PDF.
 *
 * Puur en zonder @react-pdf-import, zodat het los te testen is. De PDF-laag
 * (artikel-beschrijving-pdf.tsx) rendert alinea's als gedempte kleine tekst
 * met behouden regeleinden en opsommingen met bolletje en inspringing.
 *
 * Herkent twee schrijfwijzen van opsommingen:
 * - gewoon: regels die beginnen met "- ", "• " of "* ";
 * - HERO-export: een los streepje op een eigen regel, dan (lege regels en) de
 *   tekst van het punt — zo komt een HTML-lijst uit HERO's Excel-export.
 */

export type BeschrijvingBlok =
  | { soort: "alinea"; regels: string[] }
  | { soort: "opsomming"; punten: string[] };

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
    if (open.alinea && open.alinea.length > 0) {
      blokken.push({ soort: "alinea", regels: open.alinea });
    }
    open.alinea = null;
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

  const regels = ontsleutel(tekst).replace(/\r\n?/g, "\n").split("\n");
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

    sluitOpsomming();
    (open.alinea ??= []).push(regel);
  }

  sluitAlinea();
  sluitOpsomming();
  return blokken;
}
