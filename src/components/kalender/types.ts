import * as React from "react"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Capaciteit = "vol" | "beperkt" | "beschikbaar"

export interface BeschikbaarheidItem {
  datum: string // ISO date, e.g. "2026-03-15"
  capaciteit: Capaciteit
  opmerking?: string
}

export interface BeschikbaarheidsKalenderProps {
  beschikbaarheid?: BeschikbaarheidItem[]
  onDatumSelect?: (datum: Date) => void
  selectedDatum?: Date
  minDatum?: Date
  maxDatum?: Date
  mode?: "selectie" | "overzicht"
  geblokkeerdeDagen?: number[]
  className?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isoNaarDatum(iso: string): Date {
  const [jaar, maand, dag] = iso.split("-").map(Number)
  return new Date(jaar, maand - 1, dag)
}

export function datumNaarIso(datum: Date): string {
  const j = datum.getFullYear()
  const m = String(datum.getMonth() + 1).padStart(2, "0")
  const d = String(datum.getDate()).padStart(2, "0")
  return `${j}-${m}-${d}`
}

export function formateerDatumKort(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function formateerDatumVolledig(datum: Date): string {
  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// ---------------------------------------------------------------------------
// Capaciteit configuratie
// ---------------------------------------------------------------------------

export const CAPACITEIT_CONFIG: Record<
  Capaciteit,
  {
    dagKlasse: string
    stip: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    ringKlasse: string
  }
> = {
  beschikbaar: {
    dagKlasse:
      "bg-status-geaccepteerd text-status-geaccepteerd-text hover:bg-status-geaccepteerd-border/40",
    stip: "bg-status-geaccepteerd-dot",
    label: "Beschikbaar",
    icon: CheckCircle2,
    ringKlasse: "ring-2 ring-status-geaccepteerd-dot ring-offset-1",
  },
  beperkt: {
    dagKlasse:
      "bg-status-herinnering text-status-herinnering-text hover:bg-status-herinnering-border/40",
    stip: "bg-status-herinnering-dot",
    label: "Beperkt beschikbaar",
    icon: AlertCircle,
    ringKlasse: "ring-2 ring-status-herinnering-dot ring-offset-1",
  },
  vol: {
    dagKlasse:
      "bg-status-vervallen text-status-vervallen-text cursor-not-allowed opacity-70",
    stip: "bg-status-vervallen-dot",
    label: "Volledig bezet",
    icon: XCircle,
    ringKlasse: "ring-2 ring-status-vervallen-dot ring-offset-1",
  },
}

// ---------------------------------------------------------------------------
// useBeschikbaarheid – mock-data hook (vervang later door Convex query)
// ---------------------------------------------------------------------------

/* eslint-disable react-hooks/purity -- Mock data generator, will be replaced by Convex query */
export function useBeschikbaarheid(): BeschikbaarheidItem[] {
  return React.useMemo(() => {
    const items: BeschikbaarheidItem[] = []
    const vandaag = new Date()
    vandaag.setHours(0, 0, 0, 0)

    const eindDatum = new Date(vandaag)
    eindDatum.setMonth(eindDatum.getMonth() + 3)

    const capaciteiten: Capaciteit[] = [
      "beschikbaar",
      "beschikbaar",
      "beschikbaar",
      "beperkt",
      "beperkt",
      "vol",
    ]

    const opmerkingen: Record<Capaciteit, string[]> = {
      beschikbaar: [
        "Volledig team beschikbaar",
        "Ruime planning mogelijk",
        "Meerdere projecten starten",
      ],
      beperkt: [
        "Slechts 1 team beschikbaar",
        "Beperkte capaciteit, snel boeken",
        "Nog 2 plekken vrij",
      ],
      vol: [
        "Volledig volgeboekt",
        "Geen ruimte meer beschikbaar",
        "Alle teams ingepland",
      ],
    }

    const cursor = new Date(vandaag)
    cursor.setDate(cursor.getDate() + 1) // begin morgen

    while (cursor <= eindDatum) {
      const dagVanDeWeek = cursor.getDay()
      const isWeekend = dagVanDeWeek === 0 || dagVanDeWeek === 6

      if (!isWeekend) {
        const cap = capaciteiten[
          Math.floor(Math.random() * capaciteiten.length)
        ] as Capaciteit
        const opmerkingenVoorCap = opmerkingen[cap]
        const opmerking =
          Math.random() > 0.35
            ? opmerkingenVoorCap[
                Math.floor(Math.random() * opmerkingenVoorCap.length)
              ]
            : undefined

        items.push({
          datum: cursor.toISOString().split("T")[0],
          capaciteit: cap,
          opmerking,
        })
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    return items
  }, [])
}
/* eslint-enable react-hooks/purity */
