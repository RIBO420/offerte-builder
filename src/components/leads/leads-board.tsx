"use client";

/**
 * Leads-bord (PRD §1.3): het kanban-bord met de lead-funnel.
 * Verplaatst uit de Klanten-tab naar een eigen menu-item /leads —
 * de lead-funnel leeft hier; de klant begint bij promotie (markGewonnen).
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { PipelineStats } from "@/components/leads/pipeline-stats";
import { LeadDetailModal } from "@/components/leads/lead-detail-modal";
import { NieuweLeadDialog } from "@/components/leads/nieuwe-lead-dialog";
import type { Lead } from "@/components/leads/lead-card";
import { LaadIndicator } from "@/components/ui/laad-indicator";

export function LeadsBoard() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nieuweLeadOpen, setNieuweLeadOpen] = useState(false);

  const leads = useQuery(api.configuratorAanvragen.listByPipeline);

  if (leads === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <LaadIndicator formaat="sectie" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setNieuweLeadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe Lead
        </Button>
      </div>

      <KanbanBoard
        leads={leads}
        onLeadClick={(lead) => {
          setSelectedLead(lead);
          setDetailOpen(true);
        }}
      />

      <div className="mt-6">
        <PipelineStats />
      </div>

      <LeadDetailModal
        lead={selectedLead}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLead(null);
        }}
      />

      <NieuweLeadDialog
        open={nieuweLeadOpen}
        onClose={() => setNieuweLeadOpen(false)}
      />
    </>
  );
}
