"use client";

import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nieuwe Onderhoud Offerte</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-1 items-center justify-center"
      >
        <div className="relative flex flex-col items-center gap-4">
          {/* Gradient background glow */}
          <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-green-100/60 via-emerald-100/40 to-teal-100/60 dark:from-green-900/30 dark:via-emerald-900/20 dark:to-teal-900/30 blur-2xl" />

          {/* Pulsing glow effect behind icon */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute h-16 w-16 rounded-full bg-gradient-to-br from-green-400/40 to-emerald-400/40 dark:from-green-500/30 dark:to-emerald-500/30 blur-xl"
          />

          {/* Icon container with scale animation */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border border-green-200 dark:border-green-800/50 shadow-lg shadow-green-500/10"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </motion.div>
          </motion.div>

          {/* Loading text with fade */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="relative text-center"
          >
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Wizard laden...</p>
            <p className="text-xs text-muted-foreground mt-1">Even geduld alstublieft</p>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
