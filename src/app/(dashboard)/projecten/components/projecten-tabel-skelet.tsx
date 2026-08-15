"use client";

/**
 * Het skelet van de projectentabel.
 *
 * Waarom niet de generieke `ListSkeleton`: die tekende vijf losse kaartjes
 * terwijl er een tabel komt. Het scherm sprong dus twee keer — eerst van niets
 * naar kaartjes, daarna van kaartjes naar tabel — en tijdens de schouw las de
 * tussenstaat als een kale, lege pagina.
 *
 * Dit skelet is bewust van dezelfde bouwstenen gemaakt als de echte tabel
 * (`Card`, `Table`, dezelfde vier `TableHead`s met dezelfde teksten). Daardoor
 * zijn de eindafmetingen exact in plaats van nagebouwd: kaartpadding, kopregel
 * van 40px en rijen van 49px komen er gratis uit, en ze blijven kloppen als de
 * tabel ooit een kolom of een andere rijhoogte krijgt. De 49px zit in de
 * `size-8`-tegel plus de `p-2` van de cel — precies wat de echte rij doet.
 *
 * Het aantal rijen komt uit `stats`, de losse teller-query die meestal eerder
 * binnen is dan de gepagineerde lijst. Is die er al, dan staat het skelet exact
 * even hoog als de tabel die eroverheen komt. Zo niet, dan vallen we terug op
 * zes rijen — genoeg om de zone te vullen zonder een lange lijst te suggereren
 * die er misschien niet is.
 *
 * De kolombreedtes zijn een benadering: de tabel is `w-full` met auto-layout,
 * dus de browser verdeelt de overgebleven ruimte over álle cellen en dat kan
 * pas met de echte tekst erin. De verticale maat is wat het scherm laat
 * verspringen; die klopt wél op de pixel.
 */

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";

/** Zonder teller: genoeg rijen om de zone te vullen, niet zoveel dat het liegt. */
const RIJEN_ZONDER_TELLER = 6;
/** De lijst haalt 25 per pagina op; meer skeletrijen zou een sprong terug zijn. */
const RIJEN_MAX = 25;

export function ProjectenTabelSkelet({ aantal }: { aantal?: number }) {
  const rijen =
    aantal === undefined
      ? RIJEN_ZONDER_TELLER
      : Math.min(Math.max(aantal, 1), RIJEN_MAX);

  return (
    <Card
      className="overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Projecten laden…</span>
      <ScrollableTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aangemaakt</TableHead>
              <TableHead>Laatst gewijzigd</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rijen }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                    <Skeleton className="h-4 w-[220px] max-w-full" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-[22px] w-[104px] rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>
    </Card>
  );
}
