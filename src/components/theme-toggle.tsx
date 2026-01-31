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
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [ripple, setRipple] = React.useState<{
    key: number;
    targetTheme: "light" | "dark" | "system";
    x: number;
    y: number;
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
    if (effectiveTheme !== resolvedTheme && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      setRipple({ key: Date.now(), targetTheme: newTheme, x, y });
    }
    setTheme(newTheme);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={buttonRef} variant="ghost" size="icon" className="h-9 w-9 relative">
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
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 100, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            onAnimationComplete={() => setRipple(null)}
            className={`fixed pointer-events-none z-[9999] rounded-full ${
              ripple.targetTheme === "light"
                ? "bg-amber-400/20"
                : "bg-emerald-500/20"
            }`}
            style={{
              width: 20,
              height: 20,
              left: ripple.x - 10,
              top: ripple.y - 10,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export function ThemeToggleSimple() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [ripple, setRipple] = React.useState<{
    key: number;
    targetTheme: "light" | "dark";
    x: number;
    y: number;
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const newTheme = theme === "dark" ? "light" : "dark";
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    setRipple({ key: Date.now(), targetTheme: newTheme, x, y });
    setTheme(newTheme);
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 relative">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
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
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 100, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            onAnimationComplete={() => setRipple(null)}
            className={`fixed pointer-events-none z-[9999] rounded-full ${
              ripple.targetTheme === "light"
                ? "bg-amber-400/20"
                : "bg-emerald-500/20"
            }`}
            style={{
              width: 20,
              height: 20,
              left: ripple.x - 10,
              top: ripple.y - 10,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
