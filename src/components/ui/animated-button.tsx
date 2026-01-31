"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";

type ButtonState = "idle" | "loading" | "success" | "error";

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => Promise<void> | void;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  showRipple?: boolean;
  successText?: string;
  errorText?: string;
  loadingText?: string;
}

// Ripple effect component - GPU accelerated with scale transform
function Ripple({ x, y, onComplete, prefersReducedMotion }: { x: number; y: number; onComplete: () => void; prefersReducedMotion: boolean }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, prefersReducedMotion ? 0 : 600);
    return () => clearTimeout(timer);
  }, [onComplete, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <motion.span
      initial={{ scale: 0, opacity: 0.5 }}
      animate={{ scale: 4, opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="absolute rounded-full bg-white/30 pointer-events-none will-change-transform"
      style={{
        left: x,
        top: y,
        width: 100,
        height: 100,
        marginLeft: -50,
        marginTop: -50,
      }}
    />
  );
}

export function AnimatedButton({
  children,
  onClick,
  className,
  variant = "default",
  size = "default",
  disabled = false,
  showRipple = true,
  successText = "Opgeslagen!",
  errorText = "Mislukt",
  loadingText = "Bezig...",
}: AnimatedButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Add ripple - skip for reduced motion
    if (showRipple && buttonRef.current && !prefersReducedMotion) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { x, y, id }]);
    }

    if (!onClick) return;

    setState("loading");

    try {
      await onClick();
      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch (error) {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  const removeRipple = (id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  };

  const getContent = () => {
    switch (state) {
      case "loading":
        return (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText}
          </motion.span>
        );
      case "success":
        return (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="flex items-center gap-2"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
            {successText}
          </motion.span>
        );
      case "error":
        return (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2"
          >
            <motion.div
              animate={{ x: [-2, 2, -2, 2, 0] }}
              transition={{ duration: 0.4 }}
            >
              <X className="h-4 w-4" />
            </motion.div>
            {errorText}
          </motion.span>
        );
      default:
        return (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.span>
        );
    }
  };

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { scale: disabled || state === "loading" ? 1 : 1.02 }}
      whileTap={prefersReducedMotion ? undefined : { scale: disabled || state === "loading" ? 1 : 0.98 }}
    >
      <Button
        ref={buttonRef}
        onClick={handleClick}
        disabled={disabled || state === "loading"}
        variant={state === "error" ? "destructive" : variant}
        size={size}
        className={cn(
          "relative overflow-hidden transition-all duration-200",
          state === "success" && "bg-emerald-600 hover:bg-emerald-700",
          className
        )}
      >
        {/* Ripples - skip for reduced motion */}
        {!prefersReducedMotion && ripples.map((ripple) => (
          <Ripple
            key={ripple.id}
            x={ripple.x}
            y={ripple.y}
            onComplete={() => removeRipple(ripple.id)}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}

        {/* Content */}
        <AnimatePresence mode="wait">
          {getContent()}
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}

// Ghost button with hover fill effect
export function HoverFillButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "relative overflow-hidden group transition-colors duration-300",
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 bg-primary/10"
        initial={{ y: "100%" }}
        whileHover={{ y: 0 }}
        transition={{ duration: 0.2 }}
      />
    </Button>
  );
}

// Button with shine effect
export function ShineButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <Button
      className={cn(
        "relative overflow-hidden group",
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {!prefersReducedMotion && (
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent will-change-transform"
          animate={{ translateX: ["-100%", "100%"] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
            ease: "linear",
          }}
        />
      )}
    </Button>
  );
}

// Icon button with rotation
export function AnimatedIconButton({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { icon: React.ElementType }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { rotate: 90 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
    >
      <Button size="icon" className={className} {...props}>
        <Icon className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
