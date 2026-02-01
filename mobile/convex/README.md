# Convex Setup voor Mobile App

Deze folder bevat een symbolische link naar de gegenereerde Convex types van de web app.

## Structuur

```
convex/
├── _generated/  -> ../../convex/_generated (symlink)
└── README.md
```

## Belangrijk

De mobile app deelt dezelfde Convex backend met de web app. Dit betekent:

1. **Schema**: Het schema is al gedefinieerd in `/convex/schema.ts`
2. **Types**: De gegenereerde types in `_generated/` worden gedeeld via een symlink
3. **API**: Gebruik `import { api } from '../convex/_generated/api'` voor type-safe queries

## Types Regenereren

Als het schema wijzigt, voer dan in de root van het project uit:

```bash
npx convex dev
```

Dit update de `_generated/` folder die door beide apps wordt gebruikt.

## Troubleshooting

### Symlink werkt niet op Windows
Op Windows moet je mogelijk de symlink handmatig maken of de _generated folder kopieren:

```bash
# Optie 1: Kopieer de folder
cp -r ../convex/_generated ./convex/

# Optie 2: Maak een junction (Windows)
mklink /J convex\_generated ..\convex\_generated
```

### Types niet gevonden
Zorg ervoor dat je `npx convex dev` hebt uitgevoerd in de root van het project om de types te genereren.
