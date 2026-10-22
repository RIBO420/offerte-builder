import { Card } from "@/components/ui/card";

interface ActivityItem {
  type: "offerte" | "factuur" | "bericht";
  title: string;
  subtitle: string;
  date: number;
  id: string;
}

const dotColors = {
  offerte: "bg-primary",
  factuur: "bg-status-herinnering-dot",
  bericht: "bg-status-gepland-dot",
};

export function PortaalActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="p-6 bg-card border-border">
        <p className="text-sm text-muted-foreground">
          Geen recente activiteit.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <div className="p-5 pb-3">
        <h3 className="text-[15px] font-semibold text-foreground">
          Recente activiteit
        </h3>
      </div>
      <div className="px-5 pb-5">
        {items.map((item, i) => (
          <div
            key={`${item.type}-${item.id}`}
            className={`flex items-start gap-3 py-3 ${
              i < items.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[item.type]}`} />
            <div>
              <p className="text-sm text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.subtitle} &middot;{" "}
                {new Date(item.date).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
