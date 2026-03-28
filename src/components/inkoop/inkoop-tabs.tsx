"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Inkooporders", href: "/inkoop" },
  { label: "Leveranciers", href: "/leveranciers" },
  { label: "Voorraad", href: "/voorraad" },
];

export function InkoopTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b mb-6">
      <nav className="flex gap-4 -mb-px" aria-label="Inkoop navigatie">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "py-2 px-1 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
