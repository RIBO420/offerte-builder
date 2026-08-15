"use client";

/**
 * Leads-pagina (PRD §1.3): eigen menu-item voor de lead-funnel (kanban-bord),
 * gescheiden van /klanten (bestaande klanten). Lead → kolom Gewonnen =
 * promotie naar klantrecord + eerste werkitem (configuratorAanvragen.markGewonnen).
 */

import { PaginaReveal } from "@/components/pagina-reveal";
import { RequireRole } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { LeadsBoard } from "@/components/leads/leads-board";

function LeadsPageContent() {
  return (
    <>
      <PageHeader />
      <PaginaReveal
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Leads</h1>
            <p className="text-muted-foreground">
              Potentiële klanten — gewonnen leads worden automatisch klant
            </p>
          </div>
        </div>

        <LeadsBoard />
      </PaginaReveal>
    </>
  );
}

export default function LeadsPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <LeadsPageContent />
    </RequireRole>
  );
}
