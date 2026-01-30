"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StoryCardProps {
  icon: LucideIcon;
  title: string;
  headline: string;
  story: string;
  benefit: string;
  stat: string;
  reversed?: boolean;
  delay?: number;
  gradient?: string;
}

export function StoryCard({
  icon: Icon,
  title,
  headline,
  story,
  benefit,
  stat,
  reversed = false,
  delay = 0,
  gradient = "from-emerald-500 to-green-600",
}: StoryCardProps) {
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
      <div className={`space-y-6 ${reversed ? "lg:order-2" : ""}`}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: delay + 0.1 }}
          className="inline-flex"
        >
          <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${gradient} bg-opacity-10 text-white text-xs font-medium`}>
            {title}
          </span>
        </motion.div>

        {/* Headline */}
        <h3 className="text-3xl font-bold tracking-tight leading-tight">
          {headline}
        </h3>

        {/* Story */}
        <p className="text-lg text-muted-foreground leading-relaxed">
          {story}
        </p>

        {/* Benefit */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradient} mt-2`} />
          <p className="text-emerald-400 font-medium">{benefit}</p>
        </div>

        {/* Stat */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {stat}
        </div>
      </div>

      {/* Visual */}
      <motion.div
        className={`relative ${reversed ? "lg:order-1" : ""}`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`absolute -inset-4 bg-gradient-to-r ${gradient} opacity-10 rounded-3xl blur-2xl`} />
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
          {/* Icon container */}
          <motion.div
            className={`relative w-32 h-32 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl`}
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 2, -2, 0],
            }}
            transition={{ 
              duration: 6, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          >
            <Icon className="h-16 w-16 text-white" />
            
            {/* Glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl blur-xl opacity-50`} />
          </motion.div>

          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/5" />
          <div className="absolute bottom-8 left-8 w-8 h-8 rounded-full bg-white/5" />
          <div className="absolute top-1/2 right-8 w-4 h-4 rounded-full bg-emerald-500/30" />
        </div>
      </motion.div>
    </motion.div>
  );
}

// Compact story card for grids
interface CompactStoryCardProps {
  icon: LucideIcon;
  title: string;
  story: string;
  stat: string;
  delay?: number;
}

export function CompactStoryCard({
  icon: Icon,
  title,
  story,
  stat,
  delay = 0,
}: CompactStoryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="group relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-emerald-500/30 transition-all duration-300"
    >
      {/* Hover glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500" />
      
      <div className="relative">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-4 shadow-lg">
          <Icon className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <h4 className="font-semibold mb-2">{title}</h4>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {story}
        </p>

        {/* Stat */}
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {stat}
        </div>
      </div>
    </motion.div>
  );
}
