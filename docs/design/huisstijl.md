# Huisstijl (okt 2026)

Bron: de huisstijlgids die Top Tuinen op 18 oktober 2026 aanleverde ("Eén
herkenbare lijn"). Vervangt de "Loof & Leem"-richting uit het designprogramma
van augustus. Tokens staan in `src/app/globals.css`; mobiel spiegelt ze in
`mobile/theme/colors.ts`.

## Gidskleuren

| Naam | Hex | Rol |
|---|---|---|
| Warm zwart | `#0F0F0D` | draagt het ontwerp: zijbalk, merkvlakken, donkere modus |
| Warm wit | `#F5F3F0` | draagt de informatie: achtergrond in licht |
| Mosgroen | `#3A4A36` | merk: knoppen, actief, heldvlak |
| Olijfgroen | `#4A5D45` | hover van mosgroen, focusring |
| Champagne | `#C9B89D` | actief in de zijbalk, labels op mosgroen, hovertint |
| Zacht goud | `#A89968` | accent: vandaag, voortgang, accentlijnen |

## Regels

- **Goud is geen tekstkleur op licht** (2,6:1). Als vulling op licht een
  diepere tint (`accent-warm`, 3,2:1); tekst in goudtoon via een donkere variant.
- **Mosgroen haalt op warm zwart maar 2:1.** In donker is de knopkleur lichte
  olijf `#A3B595`; mosgroen komt daar alleen terug als vlak (kerncijfers, logodrager).
- **Statussen botsen niet met merk of accent.** Succes 158° (los van mosgroen
  139°), wachten 72° en actief 58° (los van goud 93°), negatief 27°,
  informatie 250°. Zelfde receptuur per rol (vlak/tekst/rand/stip).
- **Zijbalk is warm zwart in licht én donker.** De tokenscope
  `[data-slot="sidebar"]` in globals.css geeft gewone tokens daarbinnen hun
  donkere tegenhanger; actief = champagne, logodrager = mosgroen (`sidebar-primary`).
- **Werkvlakken** (`surface-primair`, `surface-aandacht`) stappen ≥1,15:1 van de
  pagina af — bewaakt door `src/__tests__/design/werkvlak-contrast.test.ts`.

## Letter

- **Outfit** voor alles (tekst 400, koppen/namen/knoppen 600). Variabel font,
  dus `font-medium` (500) rendert nog; de gids noemt alleen 400 en 600 — wil je
  strikt zijn, zet `--font-weight-medium` op 600.
- `font-mono` is ook Outfit, met tabelcijfers (codes, bedragen). Geen derde familie.
- **Playfair Display** (`font-sfeer`) alleen voor grote, sfeervolle koppen:
  inloggen, portaal, configurator. Nooit in werkschermen.

## Woordmerk

Boomlogo in een mosgroene drager. Klantgericht: "TOP TUINEN" in kapitalen,
letterspatiëring ~0,12em, ondertitel "COMPLETE TUINAANLEG". Intern blijft de
productnaam "Top Tuinen OS" (naamregel in CLAUDE.md).
