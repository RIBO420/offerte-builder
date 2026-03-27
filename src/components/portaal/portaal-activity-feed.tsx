import { Card } from "@/components/ui/card";

interface ActivityItem {
  type: "offerte" | "factuur" | "bericht";
  title: string;
  subtitle: string;
  date: number;
  id: string;
}

const dotColors = {
  offerte: "bg-[#4ADE80]",
  factuur: "bg-[#F59E0B]",
  bericht: "bg-[#60A5FA]",
};

export function PortaalActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="p-6 bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Geen recente activiteit.
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-[#1a2e1a] border-gray-200 dark:border-[#2a3e2a]">
      <div className="p-5 pb-3">
        <h3 className="text-[15px] font-semibold text-[#1a2e1a] dark:text-white">
          Recente activiteit
        </h3>
      </div>
      <div className="px-5 pb-5">
        {items.map((item, i) => (
          <div
            key={`${item.type}-${item.id}`}
            className={`flex items-start gap-3 py-3 ${
              i < items.length - 1 ? "border-b border-gray-100 dark:border-[#2a3e2a]" : ""
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColors[item.type]}`} />
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
