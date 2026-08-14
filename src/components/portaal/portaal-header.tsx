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
    <header className="bg-[#1a2e1a] dark:bg-[#0a150a] px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white hover:bg-[#2a3e2a]"
          onClick={onMenuToggle}
          aria-label="Menu openen"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* De balk is in beide thema's donkergroen, dus altijd de witte variant. */}
        <TopTuinenLogo variant="wit" size={32} className="w-8 h-8 shrink-0" priority />
        <span className="text-white font-semibold text-base">Top Tuinen</span>
        <span className="text-[#4ADE80] text-xs opacity-70 hidden sm:inline">
          Klantenportaal
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-gray-300 hover:text-white hover:bg-[#2a3e2a]"
          aria-label={theme === "light" ? "Donker thema activeren" : "Licht thema activeren"}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
        {klantNaam && (
          <span className="text-gray-300 text-sm hidden sm:inline">
            {klantNaam}
          </span>
        )}
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
