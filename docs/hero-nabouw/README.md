# HERO nabouwen in toptuinen.app: lees dit eerst

Deze map beschrijft hoe Top Tuinen nu werkt in HERO Software en wat er in toptuinen.app moet komen. Elk onderdeel bestaat uit twee soorten bestanden:

- `HERO-*-spec.md`: wat er in HERO te zien was (feiten, schermen, data)
- `*-MODULE.md`: de opdracht voor toptuinen.app (wat het moet doen en waarom)

## Uitgangspunten (gelden voor alle bestanden in deze map)

1. **toptuinen.app bestaat al en staat al gedeeltelijk.** Functies uit deze documenten kunnen er al (deels) in zitten: in het roosterprogramma, het factuurprogramma of het offerteprogramma. Kijk eerst wat er is en vul daarna aan. Bouw niets dubbel.
2. **De huidige stack van toptuinen.app is leidend.** Botst iets in deze documenten met de stack of met hoe de app nu werkt, dan gaat de app voor. Geen nieuwe frameworks, databases of externe diensten, tenzij Ricardo daarvoor kiest.
3. **Ricardo (developer) beslist alles en pakt dit vanaf nu op.** Deze documenten beschrijven *wat* het moet doen en *waarom*. Alles wat hier staat als advies, voorstel, datamodel, bibliotheek of [KEUZE], is input voor Ricardo, geen opdracht. Hij beslist.
4. **Eerst in kaart brengen, dan bouwen.** Elke module begint met "stap 0": uitzoeken wat er al in de app zit, en een koppeltabel plus bouwplan aan Ricardo voorleggen.

## Inhoud

| Map | Bestanden | Waarover |
|---|---|---|
| `offerte/` | `OFFERTE-MODULE.md`, `HERO-offerte-spec.md`, `hero-datamodel.json` | Offertes maken: tekstblokken, artikelregels, opslag, btw, PDF |
| `planning/` | `PLANNING-MODULE.md`, `HERO-planning-spec.md`, `hero-planning-datamodel.json` | Planbord: teams, opdrachtenbakje, slepen en vergroten per kwartier, verlof, koppeling met de medewerker-app |
| `documenten/` | `DOCUMENTEN-MODULE.md`, `HERO-documenttypes-spec.md`, `standaardteksten.md` | Alle documentsoorten (aanbetaling, termijn- en eindfactuur, creditfactuur, herinnering, bestelformulier, …), vaste teksten per soort, regels die zorgen dat een document altijd klopt |
| `import/` | `FACTUUR-KLANT-KOPPELING.md` | Fase 5: HERO-facturen automatisch aan de juiste klant koppelen (onderzoek, matchregel `convex/lib/factuurKlantMatch.ts`) |

## Samenhang tussen de modules

```
Offerte ──(geaccepteerd)──► Klus in het opdrachtenbakje ──► Ingepland op het planbord (team + tijd)
   │                                                                │
   ├─► Termijnfactuur 50% ─► Termijn 30% ─► Eindfactuur 20%          ▼
   │        (vervolgdocumenten; som = offertebedrag)          Medewerker-app (wie, waar, wanneer)
   │                                                                │
   └─► Creditfactuur / Herinnering (vanuit een factuur)        Gewerkte uren ──► Factuur / loon

Vaste teksten per documentsoort: documenten/standaardteksten.md
```

## Privacy
In deze bestanden staan geen namen, adressen of telefoonnummers van klanten of medewerkers. In de JSON-voorbeelden zijn id's en namen vervangen door placeholders.
