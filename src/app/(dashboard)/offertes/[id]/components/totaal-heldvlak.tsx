import { formatCurrency } from "@/lib/format";

/** Doelmarge, gelijk aan de default van `MargeIndicator`. */
const DOEL_MARGE = 20;
/** De balk loopt van 0 tot 50% marge, net als `MargeIndicator`. */
const SCHAAL = 50;

const pct = (n: number) =>
  `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(n)}%`;

interface TotaalHeldvlakProps {
  totalen: {
    marge: number;
    margePercentage: number;
    totaalExBtw: number;
    btw: number;
    totaalInclBtw: number;
  };
}

/**
 * Het totaal als heldvlak: mosgroen in licht én donker. `sidebar-primary` is
 * het enige merktoken dat in beide modi mosgroen blijft (`primary` wordt in
 * donker lichte olijf). Labels in champagne (`sidebar-ring`, 4,9:1 op
 * mosgroen), bedragen in warm wit (`sidebar-primary-foreground`, 8,6:1).
 * Vervangt de TotalenCard; de opbouw materiaal/arbeid/subtotaal staat onder
 * de regels.
 */
export function TotaalHeldvlak({ totalen }: TotaalHeldvlakProps) {
  const btwPct =
    totalen.totaalExBtw > 0 ? Math.round((totalen.btw / totalen.totaalExBtw) * 100) : null;
  const balk = (Math.min(Math.max(totalen.margePercentage, 0), SCHAAL) / SCHAAL) * 100;

  return (
    <section
      aria-label="Totaal"
      className="@container/totaal flex flex-col gap-3.5 rounded-lg bg-sidebar-primary px-4 pt-4 pb-3.5 text-sidebar-primary-foreground"
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.08em] text-sidebar-ring uppercase">
          Totaal incl. btw
        </p>
        <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] @xs/totaal:text-4xl">
          {formatCurrency(totalen.totaalInclBtw)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2.5 border-t border-sidebar-primary-foreground/15 pt-3 text-[13px]">
        <div className="min-w-0">
          <dt className="text-sidebar-ring">Excl. btw</dt>
          <dd className="text-[15px] font-semibold tabular-nums">
            {formatCurrency(totalen.totaalExBtw)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sidebar-ring">Btw{btwPct !== null ? ` ${btwPct}%` : ""}</dt>
          <dd className="text-[15px] font-semibold tabular-nums">{formatCurrency(totalen.btw)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
          <span className="text-sidebar-ring">Marge</span>
          <span className="tabular-nums">
            <b className="font-semibold">{pct(totalen.margePercentage)}</b>
            <span className="text-sidebar-ring">
              {" "}
              · {formatCurrency(totalen.marge)} · doel {DOEL_MARGE}%
            </span>
          </span>
        </div>
        <div
          role="meter"
          aria-label="Marge ten opzichte van het doel"
          aria-valuemin={0}
          aria-valuemax={SCHAAL}
          aria-valuenow={totalen.margePercentage}
          aria-valuetext={`${pct(totalen.margePercentage)}, doel ${DOEL_MARGE}%`}
          className="relative h-1.5 rounded-full bg-sidebar-primary-foreground/15"
        >
          <span
            className="block h-full rounded-full bg-sidebar-ring"
            style={{ width: `${balk}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute -top-[3px] h-3 w-0.5 rounded-full bg-sidebar-primary-foreground"
            style={{ left: `${(DOEL_MARGE / SCHAAL) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
