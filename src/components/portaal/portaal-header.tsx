"use client";

import { UserButton } from "@clerk/nextjs";
import { Sun, Moon, Menu } from "lucide-react";
import { usePortaalTheme } from "./portaal-theme-provider";
import { Button } from "@/components/ui/button";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";

interface PortaalHeaderProps {
  klantNaam?: string;
  onMenuToggle?: () => void;
}

export function PortaalHeader({ klantNaam, onMenuToggle }: PortaalHeaderProps) {
  const { theme, toggleTheme } = usePortaalTheme();

  return (
    // Warm zwarte merkbalk in beide thema's (huisstijl okt 2026): de
    // zijbalktokens blijven warm zwart en mosgroen, ook in licht.
    <header className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onMenuToggle}
          aria-label="Menu openen"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* Witte boom in een mosgroene cirkel, met het woordmerk ernaast. */}
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary">
          <TopTuinenLogo variant="wit" size={28} className="size-6" priority />
        </span>
        <span className="text-sidebar-accent-foreground font-semibold text-sm uppercase tracking-[0.12em]">
          Top Tuinen
        </span>
        <span className="text-sidebar-foreground/70 text-[11px] uppercase tracking-[0.16em] hidden sm:inline">
          Klantenportaal
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          aria-label={theme === "light" ? "Donker thema activeren" : "Licht thema activeren"}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
        {klantNaam && (
          <span className="text-sidebar-foreground text-sm hidden sm:inline">
            {klantNaam}
          </span>
        )}
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
