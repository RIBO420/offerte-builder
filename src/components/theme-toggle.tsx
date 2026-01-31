"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [ripple, setRipple] = React.useState<{
    key: number;
    targetTheme: "light" | "dark" | "system";
  } | null>(null);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    // For system theme, determine what it will resolve to
    const effectiveTheme =
      newTheme === "system"
        ? typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : newTheme;

    // Only show ripple if theme is actually changing
    if (effectiveTheme !== resolvedTheme) {
      setRipple({ key: Date.now(), targetTheme: newTheme });
    }
    setTheme(newTheme);
  };

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Wissel thema</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleThemeChange("light")}>
            <Sun className="mr-2 h-4 w-4" />
            Licht
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
            <Moon className="mr-2 h-4 w-4" />
            Donker
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleThemeChange("system")}>
            <span className="mr-2">💻</span>
            Systeem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AnimatePresence>
        {ripple && (
          <motion.div
            key={ripple.key}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 12, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onAnimationComplete={() => setRipple(null)}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full pointer-events-none ${
              ripple.targetTheme === "light"
                ? "border-2 border-amber-400 bg-amber-400/10"
                : "border-2 border-emerald-500 bg-emerald-500/10"
            }`}
            style={{ transformOrigin: "center" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function ThemeToggleSimple() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [ripple, setRipple] = React.useState<{
    key: number;
    targetTheme: "light" | "dark";
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setRipple({ key: Date.now(), targetTheme: newTheme });
    setTheme(newTheme);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 relative overflow-visible">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative overflow-visible"
        onClick={handleToggle}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span className="sr-only">Wissel thema</span>
      </Button>
      <AnimatePresence>
        {ripple && (
          <motion.div
            key={ripple.key}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 12, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onAnimationComplete={() => setRipple(null)}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full pointer-events-none ${
              ripple.targetTheme === "light"
                ? "border-2 border-amber-400 bg-amber-400/10"
                : "border-2 border-emerald-500 bg-emerald-500/10"
            }`}
            style={{ transformOrigin: "center" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
