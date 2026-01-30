"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface GlassCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
  delay?: number;
}

export function GlassCard({
  icon: Icon,
  title,
  description,
  gradient = "from-emerald-500 to-green-600",
  delay = 0,
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative"
    >
      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-2xl opacity-0 group-hover:opacity-30 blur-xl transition duration-500`}
      />

      {/* Card */}
      <div className="relative h-full p-6 rounded-2xl bg-white/5 dark:bg-black/20 backdrop-blur-xl border border-white/10 dark:border-white/5 overflow-hidden">
        {/* Glass shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Icon container */}
        <motion.div
          className={`relative w-14 h-14 mb-4 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
          whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="w-6 h-6 text-white" />
          
          {/* Icon glow */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-xl blur-lg opacity-50`}
          />
        </motion.div>

        {/* Content */}
        <h3 className="relative text-lg font-semibold text-foreground mb-2 group-hover:text-emerald-400 transition-colors">
          {title}
        </h3>
        <p className="relative text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Hover indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-full group-hover:translate-y-0" />
      </div>
    </motion.div>
  );
}

// Feature highlight card with image/visual
interface FeatureHighlightCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  reversed?: boolean;
  delay?: number;
}

export function FeatureHighlightCard({
  title,
  description,
  children,
  reversed = false,
  delay = 0,
}: FeatureHighlightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
        reversed ? "lg:flex-row-reverse" : ""
      }`}
    >
      {/* Text content */}
      <div className={`space-y-4 ${reversed ? "lg:order-2" : ""}`}>
        <h3 className="text-3xl font-bold tracking-tight">{title}</h3>
        <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Visual content */}
      <motion.div
        className={`relative ${reversed ? "lg:order-1" : ""}`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 dark:from-black/20 dark:to-black/10 backdrop-blur-sm border border-white/10">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Stats card with animated counter
interface StatCardProps {
  value: string;
  suffix?: string;
  label: string;
  description: string;
  delay?: number;
}

export function StatCard({ value, suffix = "", label, description, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.05 }}
      className="group relative p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent dark:from-white/5 dark:to-transparent backdrop-blur-sm border border-white/10"
    >
      {/* Animated border on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative">
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
            {value}
          </span>
          <span className="text-2xl font-bold text-emerald-400">{suffix}</span>
        </div>
        <div className="text-sm font-medium text-foreground mb-1">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </motion.div>
  );
}
