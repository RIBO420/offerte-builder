"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DemoCalculator } from "@/components/landing/demo-calculator";
import {
  Shovel,
  Trees,
  FileText,
  Calculator,
  CheckCircle,
  ArrowRight,
  Shield,
  Zap,
  Leaf,
  Hammer,
  Fence,
  Droplets,
  Sparkles,
  ChevronDown,
  Quote,
  Building2,
  Users,
  Clock,
  Loader2,
} from "lucide-react";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
};

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.8 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
};

// Scope features for visual showcase
const scopes = [
  {
    icon: Shovel,
    label: "Grondwerk",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  {
    icon: Hammer,
    label: "Bestrating",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  {
    icon: Leaf,
    label: "Borders",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
  },
  {
    icon: Sparkles,
    label: "Gras & Gazon",
    color: "text-green-500",
    bgColor: "bg-green-100",
  },
  {
    icon: Fence,
    label: "Houtwerk",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  {
    icon: Droplets,
    label: "Water & Elektra",
    color: "text-blue-500",
    bgColor: "bg-blue-100",
  },
  {
    icon: Trees,
    label: "Onderhoud",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
];

// Key features
const features = [
  {
    icon: Shield,
    title: "Nooit meer iets vergeten",
    description:
      "Ons scope-gedreven systeem zorgt dat alle noodzakelijke werkzaamheden, materialen en uren automatisch worden meegenomen.",
  },
  {
    icon: Calculator,
    title: "Slimme berekeningen",
    description:
      "Normuren met correctiefactoren voor bereikbaarheid, complexiteit en hoogteverschil. Altijd accurate ureninschatting.",
  },
  {
    icon: Zap,
    title: "Supersnel offreren",
    description:
      "Van scope-selectie naar professionele PDF in minuten. Bespaar uren werk per offerte en reageer sneller op aanvragen.",
  },
  {
    icon: FileText,
    title: "Professionele PDF's",
    description:
      "Stijlvolle offertes met je eigen huisstijl, logo en bedrijfsgegevens. Direct klaar om te versturen naar klanten.",
  },
  {
    icon: Clock,
    title: "Realtime inzicht",
    description:
      "Volg je offertes van concept tot acceptatie. Zie in één oogopslag welke offertes wachten op opvolging.",
  },
  {
    icon: Building2,
    title: "Prijsboek beheer",
    description:
      "Importeer eenvoudig leveranciersprijzen via CSV of Excel. Altijd actuele prijzen in je offertes.",
  },
];

// Testimonials
const testimonials = [
  {
    quote:
      "Eindelijk een offerte systeem dat écht begrijpt wat wij als hovenier nodig hebben. Geen vergeten posten meer!",
    author: "Jan van Berg",
    company: "GroenRijk Hoveniers",
  },
  {
    quote:
      "De scope-gedreven aanpak bespaart ons enorm veel tijd. Wat eerder uren kostte, doen we nu in minuten.",
    author: "Lisa de Vries",
    company: "TuinVisie",
  },
  {
    quote:
      "Onze offertes zien er nu veel professioneler uit. Klanten accepteren vaker omdat alles duidelijk is uitgewerkt.",
    author: "Peter Bakker",
    company: "Bakker Tuinen",
  },
];

// Stats
const stats = [
  { value: "7", label: "Scopes", suffix: "" },
  { value: "100", label: "Normuren", suffix: "+" },
  { value: "50", label: "Correctiefactoren", suffix: "+" },
  { value: "0", label: "Vergeten posten", suffix: "" },
];

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to the dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If signed in, show loading while redirecting
  if (isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20">
              <Trees className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Offerte Builder
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#hoe-het-werkt"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Hoe het werkt
            </Link>
            <Link
              href="#prijzen"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Prijzen
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link href="/sign-in">Inloggen</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Gratis starten</Link>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-green-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-emerald-500/5 to-green-600/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-1.5 backdrop-blur-sm"
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">
                Speciaal ontwikkeld voor hoveniers
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              Offertes maken waarbij{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                niets vergeten
              </span>{" "}
              kan worden
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
            >
              De scope-gedreven offerte tool voor aanleg- en onderhoudsprojecten.
              Bereken automatisch alle werkzaamheden, materialen en uren met
              normuren en correctiefactoren.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                size="lg"
                className="h-12 px-8 text-base shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                asChild
              >
                <Link href="/sign-up">
                  Start gratis trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="#hoe-het-werkt">Bekijk demo</Link>
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-16 grid grid-cols-2 gap-8 border-y py-8 sm:grid-cols-4"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {stat.value}
                    {stat.suffix}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Calculator */}
      <section id="probeer-het-zelf" className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Zelf ervaren hoe snel het werkt
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Geen verplichtingen. Bereken direct een indicatie voor je project.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <DemoCalculator />
          </motion.div>

          {/* Trust badges onder calculator */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Geen creditcard nodig</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>14 dagen gratis proberen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Altijd annuleren</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Visual Scope Showcase */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold tracking-tight">
              Alle scopes onder één dak
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Van grondwerk tot onderhoud, ons systeem dekt alle aspecten van
              hovenierswerk
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-4"
          >
            {scopes.map((scope, index) => (
              <motion.div
                key={scope.label}
                variants={scaleIn}
                className="group"
              >
                <div className="flex items-center gap-3 rounded-xl border bg-background p-4 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${scope.bgColor} ${scope.color}`}
                  >
                    <scope.icon className="h-6 w-6" />
                  </div>
                  <span className="font-medium text-sm pr-2">{scope.label}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Alles wat je nodig hebt voor professionele offertes
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Krachtige features speciaal ontworpen voor de dagelijkse praktijk
              van hoveniersbedrijven
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature, index) => (
              <motion.div key={feature.title} variants={fadeInUp}>
                <Card className="h-full border bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 text-emerald-600 mb-4">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section id="hoe-het-werkt" className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Zo werkt het
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Van start tot professionele offerte in vier simpele stappen
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Kies je scopes",
                description:
                  "Selecteer de werkzaamheden voor je project: grondwerk, bestrating, borders, enz.",
              },
              {
                step: "02",
                title: "Vul de details",
                description:
                  "Geef oppervlaktes, volumes en keuzes op. Het systeem vraagt automatisch om benodigde details.",
              },
              {
                step: "03",
                title: "Review de berekening",
                description:
                  "Controleer de automatisch berekende uren, materialen en totalen.",
              },
              {
                step: "04",
                title: "Genereer PDF",
                description:
                  "Download je professionele offerte direct als PDF, klaar om te versturen.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-5xl font-bold text-emerald-500/20 mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                {index < 3 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-border to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Principle Banner */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-green-700 px-8 py-16 text-center text-white shadow-2xl shadow-emerald-500/20"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-30" />
            <div className="relative">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <blockquote className="mx-auto max-w-3xl text-2xl font-semibold leading-relaxed sm:text-3xl">
                "Als iets nodig is om het werk uit te voeren, mag het nooit
                stilzwijgend ontbreken in de offerte."
              </blockquote>
              <p className="mt-6 text-emerald-100">
                Dit is de absolute kernregel van ons systeem
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Wat hoveniers zeggen
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Ervaringen van collega's die al werken met Offerte Builder
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-3"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full border bg-background/50 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <Quote className="h-8 w-8 text-emerald-500/30 mb-4" />
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white text-sm font-semibold">
                        {testimonial.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {testimonial.author}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="prijzen" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Eenvoudige prijzen
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Geen verborgen kosten, geen verrassingen
            </p>
          </motion.div>

          <div className="mx-auto max-w-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-2 border-emerald-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                  Populair
                </div>
                <CardContent className="p-8">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">Professional</h3>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold">€49</span>
                      <span className="text-muted-foreground">/maand</span>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Alles wat je nodig hebt voor professioneel offreren
                    </p>
                  </div>

                  <ul className="mt-8 space-y-4">
                    {[
                      "Onbeperkt offertes",
                      "Alle 7 scopes",
                      "PDF generatie",
                      "Prijsboek beheer",
                      "Normuren & correctiefactoren",
                      "Email support",
                    ].map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full mt-8 h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                    size="lg"
                    asChild
                  >
                    <Link href="/sign-up">
                      Start 14 dagen gratis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <p className="mt-4 text-xs text-center text-muted-foreground">
                    Geen creditcard nodig. Cancel anytime.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Klaar om nooit meer iets te vergeten?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Start vandaag nog met Offerte Builder en ervaar het verschil van
              scope-gedreven offreren.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 px-8 text-base shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                asChild
              >
                <Link href="/sign-up">
                  Start gratis trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base" asChild>
                <Link href="/sign-in">Ik heb al een account</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                <Trees className="h-4 w-4" />
              </div>
              <span className="font-semibold">Offerte Builder</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Offerte Builder. Alle rechten
              voorbehouden.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Voorwaarden
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
