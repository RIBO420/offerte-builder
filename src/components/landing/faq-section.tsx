"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle } from "lucide-react";
import { faqData, objectionHandlers } from "./copy-variants";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [openObjection, setOpenObjection] = useState<number | null>(null);

  return (
    <section className="py-24 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
            <MessageCircle className="h-3 w-3" />
            Vragen & Twijfels
          </span>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
            Veelgestelde vragen
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Alles wat je wilt weten voordat je start. Staat je vraag er niet tussen? 
            We helpen je graag.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* FAQ Column */}
          <div>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-sm">
                Q
              </span>
              Praktische vragen
            </h3>
            <div className="space-y-4">
              {faqData.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-white/10 rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm"
                >
                  <button
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="font-medium pr-4">{faq.question}</span>
                    <motion.div
                      animate={{ rotate: openIndex === index ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 text-muted-foreground text-sm leading-relaxed">
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Objections Column */}
          <div>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 text-sm">
                !
              </span>
              Jouw twijfels, onze antwoorden
            </h3>
            <div className="space-y-4">
              {objectionHandlers.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-white/10 rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm"
                >
                  <button
                    onClick={() => setOpenObjection(openObjection === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">"</span>
                      <span className="font-medium italic text-muted-foreground pr-4">
                        {item.objection}
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: openObjection === index ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openObjection === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 text-sm leading-relaxed">
                          <span className="text-emerald-400 font-medium">Antwoord: </span>
                          <span className="text-muted-foreground">{item.response}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Contact CTA */}
            <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20">
              <h4 className="font-semibold mb-2">Nog vragen?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                We begrijpen dat je wellicht nog specifieke vragen hebt. 
                Onze support staat voor je klaar.
              </p>
              <div className="flex gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link href="mailto:support@toptuinen.nl">Chat met ons</Link>
                </Button>
                <Button asChild size="sm" className="bg-gradient-to-r from-emerald-600 to-green-600">
                  <Link href="/sign-up">Start gratis trial</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
