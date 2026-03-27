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
    { label: "Openstaande offertes", value: data.openOffertes, icon: FileText, color: "text-[#1a2e1a] dark:text-white" },
    { label: "Lopende projecten", value: data.lopendeProjecten, icon: FolderOpen, color: "text-[#4ADE80]" },
    { label: "Openstaande facturen", value: data.openFacturen, icon: Receipt, color: "text-[#F59E0B]" },
    { label: "Nieuwe berichten", value: data.nieuweBerichten, icon: MessageSquare, color: "text-[#60A5FA]" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="p-4 bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {item.label}
              </span>
              <Icon className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${item.color}`}>
              {item.value}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
