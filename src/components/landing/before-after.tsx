"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, FileSpreadsheet, FileCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { beforeAfterComparison } from "./copy-variants";
import Link from "next/link";

export function BeforeAfterComparison() {
  const [activeTab, setActiveTab] = useState<"before" | "after">("before");

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
            Het verschil
          </span>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
            Stop met het oude, start met het nieuwe
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Zie het verschil tussen offreren zoals je het nu doet, en offreren met Offerte Builder.
          </p>
        </motion.div>

        {/* Mobile Tabs */}
        <div className="md:hidden mb-8">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab("before")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === "before"
                  ? "bg-red-500/10 text-red-600"
                  : "text-muted-foreground"
              }`}
            >
              Hoe het nu gaat
            </button>
            <button
              onClick={() => setActiveTab("after")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === "after"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "text-muted-foreground"
              }`}
            >
              Met Offerte Builder
            </button>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Before Column */}
          <AnimatePresence mode="wait">
            {(activeTab === "before" || typeof window !== "undefined") && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`${activeTab === "after" ? "hidden md:block" : ""}`}
              >
                <div className="relative p-8 rounded-2xl bg-gradient-to-br from-red-500/5 to-red-500/[0.02] border border-red-500/20 h-full">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-red-600">
                        {beforeAfterComparison.before.title}
                      </h3>
                      <p className="text-sm text-red-500/70">
                        {beforeAfterComparison.before.frustration}
                      </p>
                    </div>
                  </div>

                  {/* List */}
                  <ul className="space-y-4">
                    {beforeAfterComparison.before.items.map((item, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <X className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* Visual decoration */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* After Column */}
          <AnimatePresence mode="wait">
            {(activeTab === "after" || typeof window !== "undefined") && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`${activeTab === "before" ? "hidden md:block" : ""}`}
              >
                <div className="relative p-8 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/[0.02] border border-emerald-500/20 h-full">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <FileCheck className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-emerald-600">
                        {beforeAfterComparison.after.title}
                      </h3>
                      <p className="text-sm text-emerald-500/70">
                        {beforeAfterComparison.after.benefit}
                      </p>
                    </div>
                  </div>

                  {/* List */}
                  <ul className="space-y-4">
                    {beforeAfterComparison.after.items.map((item, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-foreground font-medium">{item}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-8 pt-6 border-t border-emerald-500/20">
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                    >
                      <Link href="/sign-up">
                        Start met Offerte Builder
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>

                  {/* Visual decoration */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                      Aanbevolen
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile CTA */}
        <div className="mt-8 md:hidden">
          <Button
            asChild
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600"
          >
            <Link href="/sign-up">
              Start met Offerte Builder
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
