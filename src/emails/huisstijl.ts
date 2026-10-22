/**
 * Huisstijl voor e-mails (huisstijlgids okt 2026).
 *
 * E-mailclients kennen geen oklch en geen CSS-variabelen, dus hier staan de
 * kleuren als hex. De merkkleuren komen letterlijk uit de gids; de afgeleide
 * tinten (tekst, lijnen, vlakken, statussen) zijn de hex-omrekening van de
 * app-tokens in `src/app/globals.css` (:root), zodat mail en app hetzelfde
 * lezen.
 *
 * Spelregels uit de gids: warm zwart en mosgroen dragen het ontwerp, goud is
 * accent (alleen als lijn, nooit als tekst op licht: 2,6:1), warm wit draagt
 * de informatie.
 */
export const kleur = {
  // Merkpalet (gids)
  warmZwart: "#0F0F0D",
  warmWit: "#F5F3F0",
  goud: "#A89968",
  champagne: "#C9B89D",
  olijf: "#4A5D45",
  mos: "#3A4A36",

  // Tekst — gemeten op warm wit
  tekst: "#0F0F0D", // 17,3:1
  tekstZacht: "#5F5D56", // 6,0:1 — lopende tekst, labels
  tekstZwak: "#6E6C66", // 4,7:1 — kleine bijschriften

  // Vlakken en lijnen
  achtergrond: "#ECE8E1", // rond de mail en in de voet
  kaart: "#FBFAF7", // kaders binnen de mail
  lijn: "#E3DED4", // champagnetint

  // Succes / bevestiging: mosgroen getint
  mosVlak: "#EBF3E9",
  mosLijn: "#C4D3C0",

  // Wachten / let op (oker, 72°)
  wachtVlak: "#FAEAD8",
  wachtLijn: "#DDBE9A",
  wachtAccent: "#9F6700",
  wachtTekst: "#583400",

  // Dringender (amber, 58°)
  actiefVlak: "#FDE8DA",
  actiefLijn: "#E3BB9E",
  actiefAccent: "#A8601E",

  // Negatief / te laat (terracottarood)
  negatief: "#A44130", // 5,6:1
  negatiefVlak: "#FFE6E2",
  negatiefLijn: "#E9B6AF",
} as const;

/** Outfit als de ontvanger hem heeft, anders een rustige systeemletter. */
export const letter = "Outfit, 'Helvetica Neue', Arial, sans-serif";

/** Kopbalk: warm zwart met een gouden accentlijn eronder. */
export const kopBalk = {
  backgroundColor: kleur.warmZwart,
  borderBottom: `3px solid ${kleur.goud}`,
  padding: "24px 32px",
};

/** Woordmerk in de kopbalk: kapitalen met ruime letterspatiëring. */
export const woordmerk = {
  color: kleur.warmWit,
  fontFamily: letter,
  fontSize: "18px",
  fontWeight: "600" as const,
  letterSpacing: "0.12em",
  lineHeight: "24px",
  margin: "0",
  textTransform: "uppercase" as const,
};

/** Hoofdknop: mosgroen met warm-witte tekst (8,6:1). */
export const knop = {
  backgroundColor: kleur.mos,
  borderRadius: "6px",
  color: kleur.warmWit,
  display: "inline-block",
  fontFamily: letter,
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "14px 32px",
  textDecoration: "none",
};
