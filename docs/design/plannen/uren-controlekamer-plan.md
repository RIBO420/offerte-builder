# Plan: urenpagina-redesign — de Controlekamer met Ploegenfilm

**Besluiten Ricardo (17 aug 2026):** concept **B + C** — de Controlekamer als hoofdscherm, de Ploegenfilm als dag-doorklik. Verder: "akkoord" = **logboek-kwijting** (geen schemastatus), **één route met drie rolgezichten**, urenpagina **geldvrij**. Weekritme als hartslag, de dag als beoordelingseenheid.

**Onderbouwing:** `uren-redesign-onderzoek-ux.md` (visie + wat-niet-te-doen) en de technische inventarisatie (twee engines, herbruikbare bouwstenen, stille risico's). Visuele referenties: `scratchpad/uren-huidig-desktop.png|mobiel.png` (huidige staat) en `scratchpad/uren-concepten-vergelijking.html` (goedgekeurde mockup).

---

## 1. Het scherm in één alinea

`/uren` wordt per rol een ander gezicht op dezelfde route. **Kantoor** ziet de Controlekamer: een weekkop die samenvat ("3 dagen wachten op je blik, 2 mensen zijn achter"), daaronder *Wie is achter?* (mensen + ontbrekende dagen), *Wat wijkt af?* (wachtrij van dagkaarten met dagbalk + één afwijkingszin + acties In orde / Corrigeren / Dag heropenen), *Wat kan door?* (stille meerderheid, uitklapbaar, "Alles akkoord" + export die pas primair kleurt als de lijsten leeg zijn), en een archiefblok. Elke dagkaart en elke archiefdag heeft een doorklik **"Bekijk deze dag als film"** → de Ploegenfilm: filmstrip-dagkiezer, per ploeg een hoofdstuk met de dagbalken van alle leden op dezelfde tijd-as, en het dagtotaal als zin. **Voorman** ziet de ploegdag van vandaag (voorstellen bevestigen voor de hele ploeg, afwijking per man). **Medewerker** ziet zijn eigen week als zeven dagbalken met status.

## 2. Datacontract (vast — backend en UI bouwen hier onafhankelijk tegenaan)

Nieuw bestand `convex/urenControle.ts`; alle types exporteren.

```ts
// getControleWeek({ weekStart: string /* YYYY-MM-DD, maandag */ })
interface ControleWeek {
  weekStart: string; weekLabel: string;           // "Week 33 · 10 t/m 16 augustus"
  achter: { medewerkerId; naam; ploegLabel: string | null; ontbrekendeDagen: string[] }[];
  afwijkend: DagKaart[];                          // gesorteerd: oudste eerst
  stil: DagSamenvatting[];                        // ingediend, geen afwijking, nog niet gekweten
  gekweten: number;                               // al akkoord dit venster
  totalen: { uren: number; indirect: number; ingediend: number; open: number };
}
interface DagKaart extends DagSamenvatting {
  redenen: AfwijkingsReden[];                     // ≥1
  segmenten: DagSegment[];
}
interface DagSamenvatting {
  medewerkerId; naam; datum: string; totaalUren: number;
  status: "open" | "ingediend"; segmenten: DagSegment[];
}
interface DagSegment { beginTijd: string; eindTijd: string; categorie: SegmentCategorie; label?: string }
type AfwijkingsReden =
  | { type: "lange_dag"; uren: number }           // > 9,5 u werken
  | { type: "geen_pauze"; uren: number }          // > 5,5 u zonder pauze
  | { type: "zonder_werkitem" }                   // werken-segment zonder klus
  | { type: "gat"; vanTijd: string; totTijd: string; minuten: number } // > 60 min binnen 07–17
  | { type: "handmatig_ipv_voorstel" }
  | { type: "heropend" };

// getDagFilm({ datum: string })
interface DagFilm {
  datum: string; dagLabel: string;
  strip: { datum: string; status: "compleet" | "open" | "afwijkend" }[]; // laatste 10 werkdagen
  ploegen: { naam: string; voermanNaam?: string; busLabel?: string; stops: string[];
             leden: DagSamenvatting[] }[];
  los: DagSamenvatting[];                          // niet in een ploeg die dag
  totaalZin: { uren: number; indirect: number; nietIngediend: number };
}

// keurDagGoed({ medewerkerId, datum })  → urenLogboek-entry "dag_akkoord"
// keurWeekGoed({ weekStart })           → alle stille dagen in één keer
// getMijnWeek({ weekStart }) → DagSamenvatting[7] + correcties uit logboek (medewerker-gezicht)
// getPloegDag({ datum })     → hergebruik getVeldDag-onderliggend per teamlid (voorman-gezicht)
```

Afwijkingsregels: hardcoded in `convex/lib/urenAfwijkingen.ts` (pure functies, unit-testbaar). Kwijting is idempotent; een gekweten dag verdwijnt uit *stil*. `urenLogboek.actie` krijgt `"dag_akkoord"` erbij (additieve union).

## 3. Werkstromen

**WS-A · Backend (blokkeert niets van WS-B, contract staat hierboven vast):**
`urenControle.ts` + `lib/urenAfwijkingen.ts` + logboek-uitbreiding; weekgrenzen Europe/Amsterdam (maandag); efficiënt via `by_user_datum`/`by_medewerker_datum` — géén full scans. Daarnaast de opruimronde uit de inventarisatie: (1) `listGlobalPaginated` (dood) verwijderen; (2) rolmodel gelijktrekken — projectleider ziet bedrijfsbreed in lijst én export (zelfde kantoor-eis als exportUren); (3) tenant-lekken dichten in `export.ts` `exportMedewerkers` (r±330) en `voormanDashboard.ts` (r±40); (4) `getGlobalStats` laten meebewegen met periode of laten vervallen. Unit-tests voor afwijkingsregels (elk type, grensgevallen), kwijting, weekgrenzen, tenant-scope. **Oude engine blijft ongemoeid**: `exportUren`, nacalculatie en project-uren draaien door op `urenRegistraties`; op het scherm worden de twee bronnen nooit opgeteld.

**WS-B · Dagbalk + Controlekamer-UI (kantoor-gezicht):**
`src/components/uren/dagbalk.tsx` — één component, maten `hero` (22px, met tijd-as 06–18) en `mini` (10px); kleuren per categorie via nieuwe tokens naast de bestaande statuskleuren (werken=primary, reistijd=blauw, pauze=gedempt, indirect=loofgroen-gedempt, gat=gearceerd amber); nooit breder dan de container (schaal, geen scroll); toegankelijk (title/aria per segment, kleur nooit enige drager — categorie ook als tekst in de inspector). Pagina-herbouw `src/app/(dashboard)/uren/page.tsx`: kop-als-samenvatting + weeknavigatie + ExportDropdown, de drie vraagblokken als `SectiePaneel kopbalk`, archiefblok (compacte dagenlijst met periode-kiezer; aparte, nooit opgetelde sectie "projectregistraties" op de oude lijst in compacte vorm), daginspector als Sheet met segmentenlijst + correcties + logboek (hergebruik `segmenten-lijst`-patronen), lege staten per blok (leeg = goed nieuws: "Iedereen is bij."). `loading.tsx` mee. StatusDomain "uren" (concept/bevestigd/ingediend) in `src/lib/constants/statuses.ts`. Mag tegen het contract in §2 bouwen vóórdat WS-A af is (types lokaal spiegelen, daarna importeren).

**WS-C · Ploegenfilm + rolgezichten (start ná A en B):**
`?dag=YYYY-MM-DD&weergave=film` deeplinkbaar via `useTabState`-patroon; filmstrip (10 werkdagen, wrap — geen zijwaartse scroll), ploeg-hoofdstukken met gedeelde tijd-as, klik op segment → inspector; doorklik vanaf elke dagkaart. Voorman-gezicht: ploegdag vandaag, "Ploegdag bevestigen voor N man" (per lid `bevestigAlleVoorstellen`, rolcheck via bestaande veldLogica), afwijking per man → veld-flow. Medewerker-gezicht: eigen week, zeven dagbalken, indienstatus, kantoorcorrecties zichtbaar. Componenttests voor de drie gezichten + afwijkingskaart-acties.

**Integratieronde (ikzelf):** visuele schouw met verse screenshots (zelfde headless-recept), drie sloten, dev/prod-synchronisatie en push na akkoord.

## 4. Regels en valkuilen (uit onderzoek §6 — bindend)

Geen twee waarheden (bronnen nooit optellen) · geen statkaarten zonder vraag · geen timer · geen goedkeuring per segment · geen grid dat stiekem scrolt · geen filterbatterij (de structuur ís het filter) · geen strafbank (amber, geen ranglijsten) · geen extra verplichte velden bij invoer · motion alleen REVEAL_KLASSE · SectiePaneel boven Card · container-queries · alle drie sloten voor elke commit-ronde · pathspec-scoped commits · geen prod-deploys door agents.
