"use client";

// A/B Test Copy Varianten voor de Hero Section
// Gebruik deze om te testen welke message het beste converteert

export type HeroVariant = "pain" | "gain" | "differentiation" | "speed";

interface CopySet {
  badge: string;
  headline: string;
  highlight: string;
  subheadline: string;
  ctaPrimary: string;
  ctaSecondary: string;
  socialProof: string;
}

export const heroCopyVariants: Record<HeroVariant, CopySet> = {
  // Variant A: Pain-focussed
  // Focus op het probleem dat wordt opgelost
  pain: {
    badge: "Stop met offertes die geld kosten",
    headline: "Elke vergeten post in je offerte kost je geld",
    highlight: "geld",
    subheadline: "Ons scope-gedreven systeem zorgt dat je nooit meer een fundering, afvoer of onderbouw vergeet. Bereken alles automatisch met 100+ normuren.",
    ctaPrimary: "Start gratis trial",
    ctaSecondary: "Bekijk hoe het werkt",
    socialProof: "500+ hoveniers besparen al tijd en geld",
  },

  // Variant B: Gain-focussed
  // Focus op het resultaat/benefit
  gain: {
    badge: "Win meer opdrachten",
    headline: "Professionele offertes die meer opdrachten opleveren",
    highlight: "meer opdrachten",
    subheadline: "Met onze scope-gedreven offerte tool maak je foutloze, professionele offertes in minuten. Inclusief 100+ normuren en automatische correctiefactoren.",
    ctaPrimary: "Start gratis trial",
    ctaSecondary: "Zie de mogelijkheden",
    socialProof: "Gemiddeld 30% meer geaccepteerde offertes",
  },

  // Variant C: Differentiation
  // Focus op unieke selling point
  differentiation: {
    badge: "Het enige echte scope-gedreven systeem",
    headline: "Het enige offerte systeem dat écht niets vergeet",
    highlight: "niets vergeet",
    subheadline: "Andere tools zijn spreadsheets met een mooi jasje. Wij werken anders: onze scope-engine vraagt automatisch om álle benodigde details. Geen verrassingen meer achteraf.",
    ctaPrimary: "Ervaar het verschil",
    ctaSecondary: "Bekijk vergelijking",
    socialProof: "Beoordeeld als #1 door hoveniers",
  },

  // Variant D: Speed
  // Focus op snelheid en efficiëntie
  speed: {
    badge: "4x sneller offreren",
    headline: "Van tuinscan naar professionele offerte in 5 minuten",
    highlight: "5 minuten",
    subheadline: "Wat eerder uren kostte, doe je nu in minuten. Selecteer scopes, vul oppervlaktes in, en ontvang een complete calculatie inclusief materialen en arbeid.",
    ctaPrimary: "Probeer het gratis",
    ctaSecondary: "Bekijk demo",
    socialProof: "Bespaar 10+ uur per week aan offreren",
  },
};

// Functie om huidige variant op te halen (kan later gekoppeld worden aan A/B test tool)
export function getCurrentHeroVariant(): HeroVariant {
  // Standaard op 'gain' voor nu
  // Later: (localStorage.getItem('heroVariant') as HeroVariant) || 'gain'
  return "gain";
}

// Feature copy met storytelling elementen - icons worden gemapt in StoryCard
export const featureStories = [
  {
    icon: "Shield",
    title: "Nooit meer iets vergeten",
    headline: "De enige manier om zeker te zijn dat álles in je offerte staat",
    story: "Herinner je die keer dat je een fundering vergat bij een schutting? Of dat je geen afvoerkosten berekende bij grondwerk? Wij ook. Daarom bouwden we een systeem dat automatisch elke benodigde post toevoegt op basis van je geselecteerde scopes.",
    benefit: "Geen verrassingen achteraf. Geen verliesgevende projecten.",
    stat: "0 vergeten posten sinds implementatie",
  },
  {
    icon: "Calculator",
    title: "Slimme berekeningen",
    headline: "Uren berekenen als een ervaren calculator, zonder de ervaring",
    story: "Onze normuren database is gebaseerd op jarenlange data uit de hoveniersbranche. Van ontgraven tot bestraten: we weten precies hoeveel tijd elk klusje kost, inclusief correcties voor slechte bereikbaarheid of complex snijwerk.",
    benefit: "Altijd accurate ureninschattingen, winstgevende prijzen.",
    stat: "100+ normuren beschikbaar",
  },
  {
    icon: "Zap",
    title: "Supersnel offreren",
    headline: "Wat eerder een halve dag kostte, doe je nu in 15 minuten",
    story: "Stel je voor: je staat bij een klant, bekijkt de tuin, en binnen 15 minuten heb je een complete, professionele offerte klaar. Niet meer tot 's avonds laat werken om offertes af te krijgen.",
    benefit: "Meer tijd voor het echte werk, of voor thuis.",
    stat: "4x sneller dan Excel",
  },
  {
    icon: "FileText",
    title: "Professionele PDF's",
    headline: "Offertes die vertrouwen uitstralen en vaker worden geaccepteerd",
    story: "Je offerte is vaak het eerste wat een klant van je ziet. Een rommelige PDF met verkeerde kleuren en ontbrekende details maakt geen goede indruk. Onze templates zijn ontworpen om professionaliteit uit te stralen.",
    benefit: "Betere eerste indruk, hogere acceptatiepercentage.",
    stat: "30% meer geaccepteerde offertes",
  },
  {
    icon: "Clock",
    title: "Realtime inzicht",
    headline: "Altijd overzicht, nooit meer een offerte kwijt",
    story: "Waar was ook alweer die offerte van de familie Jansen? Hebben ze al geantwoord? Met ons dashboard zie je in één oogopslag de status van al je offertes, van concept tot acceptatie.",
    benefit: "Beter opvolgen, meer opdrachten binnenhalen.",
    stat: "Altijd overzicht",
  },
  {
    icon: "TrendingUp",
    title: "Bewuste marges",
    headline: "Weten wat je verdient, voordat je begint",
    story: "Geen gokjes meer over je marge. Bij elke offerte zie je direct kostprijs, verkoopprijs en marge. Zo weet je zeker dat je project winstgevend is, zonder dat je achteraf voor verrassingen komt te staan.",
    benefit: "Altijd winstgevend werken, geen verrassingen.",
    stat: "Volledige inzichtelijkheid",
  },
];

// Objection handling copy
export const objectionHandlers = [
  {
    objection: "Te duur voor een klein bedrijf",
    response: "Voor €49 per maand bespaar je uren werk. Bij 5 offertes per maand ben je al voordeliger uit dan je huidige proces. Plus: 14 dagen gratis proberen, geen creditcard nodig.",
    icon: "PiggyBank",
  },
  {
    objection: "Ik heb geen tijd om iets nieuws te leren",
    response: "De meeste gebruikers maken binnen 30 minuten hun eerste offerte. Onze onboarding helpt je stap voor stap, en onze support staat klaar om te helpen.",
    icon: "Clock",
  },
  {
    objection: "Werkt het ook op mijn telefoon op locatie?",
    response: "Ja! Offerte Builder is een Progressive Web App. Werkt op elk device, ook offline. Maak offertes direct bij de klant op locatie.",
    icon: "Smartphone",
  },
  {
    objection: "Ik ben al gewend aan Excel",
    response: "We kennen het gevoel. Maar stel je voor: geen formules meer die fout gaan, geen vergeten cellen, en offertes die er professioneel uitzien. Binnen een week wil je niet meer terug.",
    icon: "Sheet",
  },
  {
    objection: "Wat als ik vastzit?",
    response: "We begrijpen dat je hulp soms nodig hebt. Daarom bieden we support via chat, email én telefoon. Gemiddelde responstijd: < 5 minuten tijdens kantooruren.",
    icon: "Headphones",
  },
];

// Before/After vergelijking
export const beforeAfterComparison = {
  before: {
    title: "Offreren met Excel/Word",
    items: [
      "Handmatig nadenken over elke post",
      "Gevaar om essentiële onderdelen te vergeten",
      "Overtuigen van je ureninschatting",
      "Altijd verschillende offerte-formaten",
      "Geen inzicht in marge tot na het project",
      "Offertes maken 's avonds laat thuis",
    ],
    frustration: "Stress over vergeten posten",
  },
  after: {
    title: "Offreren met Offerte Builder",
    items: [
      "Systeem vraagt automatisch om alle details",
      "Nooit meer iets vergeten dankzij scope-engine",
      "100+ normuren als solide onderbouwing",
      "Consistente, professionele PDF's",
      "Direct zicht op kosten, opbrengst én marge",
      "Offertes maken op locatie in 15 minuten",
    ],
    benefit: "Zekerheid en tijdwinst",
  },
};

// FAQ data
export const faqData = [
  {
    question: "Hoe werkt de 14 dagen gratis trial?",
    answer: "Je krijgt volledige toegang tot alle features, geen creditcard nodig. Na 14 dagen beslis je zelf of je door wilt gaan. Geen automatische afschrijving.",
  },
  {
    question: "Kan ik mijn eigen prijzen gebruiken?",
    answer: "Absoluut. Je kunt je eigen prijsboek aanmaken of prijslijsten importeren via CSV/Excel. Je bepaalt zelf je inkoop- en verkoopprijzen.",
  },
  {
    question: "Werkt het ook voor onderhoudscontracten?",
    answer: "Ja, we hebben een aparte module voor onderhoud met specifieke normuren voor maaien, snoeien, heggen knippen, etc.",
  },
  {
    question: "Kan ik met meerdere mensen tegelijk werken?",
    answer: "Ja, je kunt meerdere gebruikers toevoegen aan je account. Iedereen werkt met dezelfde templates en prijsboek.",
  },
  {
    question: "Is mijn data veilig?",
    answer: "We gebruiken bank-grade encryptie en je data wordt opgeslagen in EU-datacenters. We maken automatisch back-ups.",
  },
  {
    question: "Wat als ik wil stoppen?",
    answer: "Geen probleem. Je kunt maandelijks opzeggen, geen vragen gesteld. Je data kun je exporteren.",
  },
];

// Trust signals
export const trustSignals = [
  { label: "GDPR Compliant", icon: "Shield" },
  { label: "Nederlands bedrijf", icon: "MapPin" },
  { label: "Support < 5 min", icon: "MessageCircle" },
  { label: "99.9% Uptime", icon: "Activity" },
  { label: "SSL Beveiligd", icon: "Lock" },
  { label: "Automatische back-ups", icon: "Database" },
];

// CTA variaties voor verschillende secties
export const ctaVariants = {
  hero: {
    primary: "Start gratis trial",
    secondary: "Bekijk demo",
  },
  calculator: {
    primary: "Maak volledige offerte",
    secondary: "Bekijk alle features",
  },
  features: {
    primary: "Start vandaag nog",
    secondary: "Lees meer verhalen",
  },
  pricing: {
    primary: "Start 14 dagen gratis",
    secondary: "Vergelijk alle plans",
  },
  footer: {
    primary: "Start nu",
    secondary: "Plan een demo",
  },
};
