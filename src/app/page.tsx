"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DemoCalculator } from "@/components/landing/demo-calculator";
import { AnimatedHero } from "@/components/landing/animated-hero";
import { Navigation } from "@/components/landing/navigation";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { GlassCard, StatCard } from "@/components/landing/glass-card";
import { BeforeAfterComparison } from "@/components/landing/before-after";
import { FAQSection } from "@/components/landing/faq-section";
import { StoryCard } from "@/components/landing/story-card";
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
  Quote,
  Clock,
  Loader2,
  TrendingUp,
  Users,
  Target,
  Truck,
  Package,
  BarChart3,
  ClipboardCheck,
  Wallet,
  CalendarDays,
  UserCog,
  Warehouse,
  ShoppingCart,
  GraduationCap,
  Layers,
} from "lucide-react";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Features data met storytelling
const featuresWithStories = [
  {
    icon: Shield,
    title: "Nooit meer iets vergeten",
    headline: "De enige manier om zeker te zijn dat álles in je offerte staat",
    story: "Herinner je die keer dat je een fundering vergat bij een schutting? Of dat je geen afvoerkosten berekende bij grondwerk? Wij ook. Daarom bouwden we een systeem dat automatisch elke benodigde post toevoegt op basis van je geselecteerde scopes.",
    benefit: "Geen verrassingen achteraf. Geen verliesgevende projecten.",
    stat: "0 vergeten posten sinds implementatie",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Calculator,
    title: "100+ Normuren",
    headline: "Uren berekenen als een ervaren calculator, zonder de ervaring",
    story: "Onze normuren database is gebaseerd op jarenlange data uit de hoveniersbranche. Van ontgraven tot bestraten: we weten precies hoeveel tijd elk klusje kost, inclusief correcties voor slechte bereikbaarheid of complex snijwerk.",
    benefit: "Altijd accurate ureninschattingen, winstgevende prijzen.",
    stat: "100+ normuren beschikbaar",
    gradient: "from-blue-500 to-indigo-500",
  },
  {
    icon: Wallet,
    title: "Real-time kosten tracking",
    headline: "Weet tijdens het project precies waar je staat",
    story: "Geen verrassingen meer bij de nacalculatie. Volg je kosten real-time tijdens de uitvoering: arbeidsuren, materialen, machines. Krijg direct een waarschuwing als je budget dreigt te overschrijden.",
    benefit: "Altijd grip op je projectkosten, nooit meer budgetoverschrijdingen.",
    stat: "Live budget monitoring",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    icon: ClipboardCheck,
    title: "Kwaliteitscontroles",
    headline: "Professionele oplevering met QC-checklists en foto's",
    story: "Voor elke scope een checklist, voor en na foto's uploaden, goedkeuring met handtekening. Je klanten zien dat je professioneel werkt, en jij hebt bewijs van je kwaliteit.",
    benefit: "Hogere klanttevredenheid, minder discussies achteraf.",
    stat: "Complete QC workflow",
    gradient: "from-teal-500 to-cyan-500",
  },
  {
    icon: GraduationCap,
    title: "Leren van elk project",
    headline: "Je normuren worden automatisch slimmer",
    story: "Na elk project vergelijk je de voorcalculatie met de werkelijkheid. Het systeem suggereert aanpassingen aan je normuren op basis van echte data. Zo worden je offertes steeds nauwkeuriger.",
    benefit: "Continu verbeteren, steeds betere inschattingen.",
    stat: "Zelflerend systeem",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Zap,
    title: "4x sneller offreren",
    headline: "Wat eerder een halve dag kostte, doe je nu in 15 minuten",
    story: "Stel je voor: je staat bij een klant, bekijkt de tuin, en binnen 15 minuten heb je een complete, professionele offerte klaar. Niet meer tot 's avonds laat werken om offertes af te krijgen.",
    benefit: "Meer tijd voor het echte werk, of voor thuis.",
    stat: "4x sneller dan Excel",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: FileText,
    title: "Professionele PDF's",
    headline: "Offertes die vertrouwen uitstralen en vaker worden geaccepteerd",
    story: "Je offerte is vaak het eerste wat een klant van je ziet. Een rommelige PDF met verkeerde kleuren en ontbrekende details maakt geen goede indruk. Onze templates zijn ontworpen om professionaliteit uit te stralen.",
    benefit: "Betere eerste indruk, hogere acceptatiepercentage.",
    stat: "30% meer geaccepteerde offertes",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: TrendingUp,
    title: "Bewuste marges",
    headline: "Weten wat je verdient, voordat je begint",
    story: "Geen gokjes meer over je marge. Bij elke offerte zie je direct kostprijs, verkoopprijs en marge. Zo weet je zeker dat je project winstgevend is, zonder dat je achteraf voor verrassingen komt te staan.",
    benefit: "Altijd winstgevend werken, geen verrassingen.",
    stat: "Volledige inzichtelijkheid",
    gradient: "from-green-500 to-emerald-500",
  },
];

// Stats data
const stats = [
  { value: "12", suffix: "+", label: "Modules", description: "Complete bedrijfsvoering" },
  { value: "100", suffix: "+", label: "Normuren", description: "Voor accurate berekeningen" },
  { value: "7", suffix: "", label: "Werkscopes", description: "Van grondwerk tot onderhoud" },
  { value: "1", suffix: "", label: "Platform", description: "Alles geintegreerd" },
];

// Additional modules for showcase
const businessModules = [
  { icon: FileText, label: "Offertes", color: "from-emerald-500 to-green-500", description: "Aanleg & onderhoud" },
  { icon: Layers, label: "Projecten", color: "from-blue-500 to-indigo-500", description: "Complete lifecycle" },
  { icon: Users, label: "Klanten", color: "from-violet-500 to-purple-500", description: "CRM & historie" },
  { icon: Wallet, label: "Facturen", color: "from-amber-500 to-orange-500", description: "Automatisch genereren" },
  { icon: UserCog, label: "Medewerkers", color: "from-pink-500 to-rose-500", description: "Teams & certificaten" },
  { icon: Clock, label: "Urenregistratie", color: "from-cyan-500 to-blue-500", description: "Per project & medewerker" },
  { icon: CalendarDays, label: "Planning", color: "from-teal-500 to-emerald-500", description: "Taken & capaciteit" },
  { icon: Truck, label: "Wagenpark", color: "from-slate-500 to-gray-600", description: "APK, onderhoud, km" },
  { icon: Warehouse, label: "Voorraad", color: "from-orange-500 to-red-500", description: "Stock & alerts" },
  { icon: ShoppingCart, label: "Inkoop", color: "from-lime-500 to-green-500", description: "Orders & leveranciers" },
  { icon: BarChart3, label: "Rapportages", color: "from-indigo-500 to-violet-500", description: "KPI's & forecasts" },
  { icon: Package, label: "Prijsboek", color: "from-yellow-500 to-amber-500", description: "Producten & import" },
];

// Testimonials
const testimonials = [
  {
    quote:
      "Van offerte tot factuur, alles in één systeem. De nacalculatie functie heeft ons enorm geholpen om betere inschattingen te maken.",
    author: "Jan van Berg",
    company: "GroenRijk Hoveniers",
    role: "Eigenaar",
  },
  {
    quote:
      "Het wagenpark beheer en de urenregistratie per project geven ons eindelijk inzicht in onze werkelijke kosten. Een gamechanger!",
    author: "Lisa de Vries",
    company: "TuinVisie",
    role: "Office Manager",
  },
  {
    quote:
      "De kwaliteitscontroles met foto's maken een professionele indruk op klanten. En de rapportages helpen ons data-gedreven beslissingen te nemen.",
    author: "Peter Bakker",
    company: "Bakker Tuinen",
    role: "Directeur",
  },
];

// Scopes for showcase
const scopes = [
  { icon: Shovel, label: "Grondwerk", color: "from-amber-500 to-amber-600" },
  { icon: Hammer, label: "Bestrating", color: "from-slate-500 to-slate-600" },
  { icon: Leaf, label: "Borders", color: "from-emerald-500 to-emerald-600" },
  { icon: Sparkles, label: "Gras & Gazon", color: "from-green-500 to-green-600" },
  { icon: Fence, label: "Houtwerk", color: "from-amber-600 to-amber-700" },
  { icon: Droplets, label: "Water & Elektra", color: "from-blue-500 to-blue-600" },
  { icon: Trees, label: "Onderhoud", color: "from-green-600 to-green-700" },
];

export default function LandingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Redirect authenticated users to the dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/offertes");
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
      <ScrollProgress />
      <Navigation />

      {/* Animated Hero Section */}
      <AnimatedHero />

      {/* Stats Section */}
      <section className="py-12 border-y border-white/5 bg-gradient-to-b from-transparent to-white/[0.02]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <StatCard key={stat.label} {...stat} delay={index * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Calculator */}
      <section id="probeer-het-zelf" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <Target className="h-3 w-3" />
              Probeer het direct
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Zelf ervaren hoe snel het werkt
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Geen verplichtingen. Bereken binnen 10 seconden een indicatie voor je project.
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

          {/* Trust badges */}
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

      {/* Story Features */}
      <section id="features" className="py-24 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <Zap className="h-3 w-3" />
              Waarom hoveniers voor ons kiezen
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Gebouwd door hoveniers, voor hoveniers
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              We kennen de struggles van het vak. Daarom bouwden we een systeem dat echt werkt.
            </p>
          </motion.div>

          <div className="space-y-24">
            {featuresWithStories.map((story, index) => (
              <StoryCard
                key={story.title}
                icon={story.icon}
                title={story.title}
                headline={story.headline}
                story={story.story}
                benefit={story.benefit}
                stat={story.stat}
                reversed={index % 2 === 1}
                delay={index * 0.1}
                gradient={story.gradient}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Business Modules Showcase */}
      <section id="modules" className="py-24 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <Layers className="h-3 w-3" />
              Complete bedrijfsvoering
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              12+ modules in één platform
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Van offerte tot factuur, van planning tot voorraad. Alles wat je hoveniersbedrijf nodig heeft.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
          >
            {businessModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.03 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="group"
                >
                  <div className="flex flex-col items-center gap-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 transition-all duration-300 hover:bg-white/10 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10 h-full">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${module.color} shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="font-medium text-sm text-center">{module.label}</span>
                    <span className="text-xs text-muted-foreground text-center">{module.description}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Scopes Showcase */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Alle werkscopes onder één dak
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Van grondwerk tot onderhoud, ons systeem dekt alle aspecten van hovenierswerk
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-4"
          >
            {scopes.map((scope, index) => {
              const Icon = scope.icon;
              return (
                <motion.div
                  key={scope.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="group"
                >
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 transition-all duration-300 hover:bg-white/10 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${scope.color} shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="font-medium text-sm pr-2">{scope.label}</span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section id="hoe-het-werkt" className="py-24 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <Clock className="h-3 w-3" />
              Van offerte tot factuur
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              De complete projectcyclus
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Van eerste klantcontact tot betaalde factuur, alles in één systeem
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
            {[
              {
                step: "01",
                title: "Offerte maken",
                description: "Scope-gedreven offerte met automatische berekeningen",
              },
              {
                step: "02",
                title: "Project starten",
                description: "Geaccepteerde offerte wordt project met planning",
              },
              {
                step: "03",
                title: "Uitvoering",
                description: "Uren registreren, kosten tracken, QC uitvoeren",
              },
              {
                step: "04",
                title: "Nacalculatie",
                description: "Vergelijk planning met werkelijkheid, leer voor volgende keer",
              },
              {
                step: "05",
                title: "Factureren",
                description: "Genereer factuur direct uit projectgegevens",
              },
              {
                step: "06",
                title: "Archiveren",
                description: "Complete projecthistorie voor altijd beschikbaar",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="relative"
              >
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-500/30 to-emerald-500/5 bg-clip-text text-transparent mb-3">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                {index < 5 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Before/After Comparison */}
      <BeforeAfterComparison />

      {/* FAQ Section */}
      <FAQSection />

      {/* Core Principle Banner */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 px-8 py-16 text-center text-white shadow-2xl"
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-20">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                  backgroundSize: "40px 40px",
                }}
              />
            </div>

            {/* Floating orbs */}
            <motion.div
              className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white/10 blur-3xl"
              animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 8, repeat: Infinity }}
            />
            <motion.div
              className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-white/10 blur-3xl"
              animate={{ x: [0, -20, 0], y: [0, -30, 0] }}
              transition={{ duration: 10, repeat: Infinity }}
            />

            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
              >
                <CheckCircle className="h-8 w-8 text-white" />
              </motion.div>
              <blockquote className="mx-auto max-w-3xl text-2xl font-semibold leading-relaxed sm:text-3xl">
                &ldquo;Als iets nodig is om het werk uit te voeren, mag het nooit stilzwijgend ontbreken in de offerte.&rdquo;
              </blockquote>
              <p className="mt-6 text-emerald-100">
                Dit is de absolute kernregel van ons systeem
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <Users className="h-3 w-3" />
              Vertrouwd door hoveniers
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Wat hoveniers zeggen
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Ervaringen van collega&apos;s die al werken met Offerte Builder
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full bg-white/5 backdrop-blur-sm border-white/10 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1">
                  <CardContent className="p-6">
                    <Quote className="h-8 w-8 text-emerald-500/30 mb-4" />
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white text-sm font-semibold">
                        {testimonial.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{testimonial.author}</div>
                        <div className="text-xs text-muted-foreground">
                          {testimonial.role}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="prijzen" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <CheckCircle className="h-3 w-3" />
              Eenvoudige prijzen
            </span>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Transparante prijzen
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
              <Card className="relative overflow-hidden border-2 border-emerald-500/50 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm">
                <div className="absolute top-0 right-0 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                  Populair
                </div>
                <CardContent className="p-8">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">Professional</h3>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                        €49
                      </span>
                      <span className="text-muted-foreground">/maand</span>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Complete bedrijfsvoering voor je hoveniersbedrijf
                    </p>
                  </div>

                  <ul className="mt-8 space-y-3">
                    {[
                      "Onbeperkt offertes & projecten",
                      "Alle 7 werkscopes",
                      "PDF generatie & e-mail",
                      "Complete projectcyclus",
                      "Real-time kosten tracking",
                      "Kwaliteitscontroles (QC)",
                      "Medewerkers & teams",
                      "Urenregistratie",
                      "Planning & capaciteit",
                      "Wagenpark beheer",
                      "Voorraad & inkoop",
                      "Rapportages & KPI's",
                      "Prijsboek met import",
                      "Normuren & correctiefactoren",
                    ].map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full mt-8 h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/20"
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
      <section className="py-24 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Klaar voor complete bedrijfsvoering?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Start vandaag nog met Offerte Builder en ervaar het verschil van een volledig geintegreerd platform voor je hoveniersbedrijf.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 px-8 text-base bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/20"
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
      <footer className="border-t border-white/10 py-12 bg-gradient-to-b from-transparent to-black/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                <Trees className="h-4 w-4" />
              </div>
              <span className="font-semibold">Offerte Builder</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Offerte Builder. Alle rechten voorbehouden.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/voorwaarden" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Voorwaarden
              </Link>
              <Link href="mailto:info@toptuinen.nl" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
