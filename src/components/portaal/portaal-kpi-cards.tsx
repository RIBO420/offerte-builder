import { FileText, FolderOpen, Receipt, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KpiData {
  openOffertes: number;
  lopendeProjecten: number;
  openFacturen: number;
  nieuweBerichten: number;
}

export function PortaalKpiCards({ data }: { data: KpiData }) {
  const items = [
    { label: "Openstaande offertes", value: data.openOffertes, icon: FileText, color: "text-foreground" },
    { label: "Lopende projecten", value: data.lopendeProjecten, icon: FolderOpen, color: "text-primary" },
    { label: "Openstaande facturen", value: data.openFacturen, icon: Receipt, color: "text-status-herinnering-dot" },
    { label: "Nieuwe berichten", value: data.nieuweBerichten, icon: MessageSquare, color: "text-status-gepland-dot" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="p-4 bg-card border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                {item.label}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className={`text-2xl md:text-3xl font-semibold ${item.color}`}>
              {item.value}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
