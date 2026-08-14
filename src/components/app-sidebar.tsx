"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  FileText,
  HardHat,
  Home,
  BookOpen,
  Trees,
  Moon,
  Sun,
  UserPlus,
  Users,
  UsersRound,
  Clock,
  BarChart3,
  LogOut,
  User,
  FolderKanban,
  Wrench,
  Receipt,
  Truck,
  Shield,
  ShieldCheck,
  Calendar,
  CalendarDays,
  Thermometer,
  ClipboardList,
  ShoppingCart,
  DollarSign,
  CheckSquare,
  MessageSquare,
  Mail,
  ScrollText,
  Settings,
  TextQuote,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentUserRole } from "@/hooks/use-users";
import { NotificationCenter } from "@/components/notification-center";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Sidebar: Werk group - daily operational items
const werkItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  // PRD §2.6: veld-weergave (voorman/medewerker) — eigen dag, segmenten
  // bevestigen, taken afronden, meerwerk en route-knop met materiaaldelta
  { title: "Mijn dag", url: "/veld", icon: HardHat },
  // PRD §1.3: Leads (funnel, kanban-bord) en Klanten (bestaande klanten)
  // zijn twee aparte menu-items met elk een eigen teller-badge
  { title: "Leads", url: "/leads", icon: UserPlus },
  { title: "Klanten", url: "/klanten", icon: Users },
  { title: "Projecten", url: "/projecten", icon: FolderKanban },
  { title: "Planning", url: "/planning", icon: Calendar },
  // PRD §2.4: meldingen/cases — intern bord met teller-badge (open cases)
  { title: "Meldingen", url: "/meldingen", icon: Wrench },
  // PRD §2.7: goedkeurings-wachtrij voor uitgaande trigger-mails (kantoor)
  { title: "Concept-mails", url: "/mails", icon: Mail },
  { title: "Uren", url: "/uren", icon: Clock },
  { title: "Rapportages", url: "/rapportages", icon: BarChart3 },
  { title: "Chat", url: "/chat", icon: MessageSquare },
];

// Sidebar: Financieel group
const financieelItems = [
  { title: "Offertes", url: "/offertes", icon: FileText },
  { title: "Contracten", url: "/contracten", icon: ScrollText },
  { title: "Facturen", url: "/facturen", icon: Receipt },
  { title: "Inkoop", url: "/inkoop", icon: ShoppingCart },
  { title: "Archief", url: "/archief", icon: Archive },
];

// Profile menu: Personeel group (admin/directie only)
const personeelMenuItems = [
  { title: "Medewerkers", url: "/medewerkers", icon: UsersRound },
  { title: "Verlof", url: "/verlof", icon: CalendarDays, indent: true },
  { title: "Verzuim", url: "/verzuim", icon: Thermometer, indent: true },
  { title: "Gebruikersbeheer", url: "/gebruikers", icon: Shield },
];

// Profile menu: Assets & Data group (admin/directie only)
const assetsMenuItems = [
  // PRD §3.3: machines én bussen in één module — status (kapot → weekbord),
  // teamkleur, standaardbus, inventaris per bus en vervalitems (APK e.d.)
  { title: "Machinepark", url: "/machinepark", icon: Truck },
  { title: "Wagenparkbeheer", url: "/wagenpark", icon: Truck },
  { title: "Machinebeheer", url: "/instellingen/machines", icon: Wrench },
  { title: "Catalogus onderhoud", url: "/instellingen/catalogus", icon: Trees },
  { title: "Tekstblokken", url: "/instellingen/tekstblokken", icon: TextQuote },
  // PRD §2.7: event → sjabloon → vertraging → ontvanger (records, geen code)
  { title: "Mail-triggers", url: "/instellingen/mailtriggers", icon: Mail },
  { title: "Prijsboek", url: "/prijsboek", icon: BookOpen },
  { title: "Garanties", url: "/garanties", icon: ShieldCheck },
  // "Servicemeldingen" is vervangen door het §2.4-bord "Meldingen" (werkItems)
  { title: "Toolbox", url: "/toolbox", icon: ClipboardList },
];

// "Project Tools" is uit deze sidebar verwijderd (WS6-distill): kosten en
// kwaliteit zijn bereikbaar via de voortgangscards op de projectdetailpagina.
// LET OP: projectSubItems en currentProjectId hieronder staan er nog bewust —
// het volledig verwijderen ervan laat Turbopack (Next 16.1.7, dev) een client-
// module van lucide-react uit de chunkgraph verliezen, waarna élke
// dashboardpagina in de errorboundary valt ("Module ... might have been
// deleted in an HMR update"), ook na een koude build. Empirisch gebisect op
// 14 aug 2026; de `void`-referenties houden lint stil.
const projectSubItems = [
  { title: "Kosten tracking", urlSuffix: "/kosten", icon: DollarSign },
  { title: "Kwaliteit", urlSuffix: "/kwaliteit", icon: CheckSquare },
];
void projectSubItems;

// Actieve staat in merkgroen ("Vakwerk in het groen"): tekst en icoon in
// primary op een lichte primary-tint, met een 2px "grasrand" links als
// inset-shadow — die schuift niet met de layout en blijft ook in de
// ingeklapte 32px-knop zichtbaar. `relative` staat hier zodat de MenuTeller
// zijn stip op de knop kan positioneren (zie MenuTeller-docstring).
const menuKnopKlasse =
  "relative data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/15 data-[active=true]:hover:text-primary data-[active=true]:shadow-[inset_2px_0_0_0_var(--primary)]";


/**
 * Teller bij een menu-item.
 *
 * Uitgeklapt: een badge met het aantal, rechts uitgelijnd.
 * Ingeklapt: een stip rechtsboven op het icoon. In een balk van 48px past geen
 * getal, maar "hier staat iets open" mag je niet kwijtraken. Het aantal blijft
 * leesbaar in de tooltip en voor schermlezers — het getal wordt alleen visueel
 * weggedrukt (`text-[0px]`), niet uit de DOM gehaald.
 *
 * De stip is absoluut gepositioneerd; het icoon blijft daardoor gecentreerd.
 * Dat werkt alleen omdat de knop zelf `relative` krijgt: `SidebarMenuItem` is
 * ook relative, maar die is de volle balkbreedte terwijl de knop ingeklapt
 * 32px is — positioneren op de li zet de stip dus naast het icoon.
 *
 * `stip: false` voor tellers die een totaal tonen in plaats van werkvoorraad.
 * Zo'n stip staat altijd aan en betekent dus niets; ingeklapt laten we die weg.
 */
function MenuTeller({
  aantal,
  klasse,
  stip = true,
}: {
  aantal: number;
  klasse: string;
  stip?: boolean;
}) {
  return (
    <Badge
      className={cn(
        "ml-auto h-5 min-w-5 px-1 text-xs",
        stip
          ? [
              "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:right-0.5 group-data-[collapsible=icon]:top-0.5",
              "group-data-[collapsible=icon]:size-2.5 group-data-[collapsible=icon]:min-w-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[0px]",
              // Randje in de sidebar-kleur: anders loopt de stip visueel vast
              // op een icoon dat er net achter zit.
              "group-data-[collapsible=icon]:ring-2 group-data-[collapsible=icon]:ring-sidebar",
            ]
          : "group-data-[collapsible=icon]:hidden",
        klasse
      )}
    >
      {aantal}
    </Badge>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const [mounted, setMounted] = useState(false);
  const role = useCurrentUserRole();

  // Helper: check if role is directie-level (includes legacy "admin")
  const isDirectieOrAdmin = role === "directie" || role === "admin";
  // Kantoor (PRD §1.2): directie + projectleider — zij zien Leads/Klanten
  const isKantoor = isDirectieOrAdmin || role === "projectleider";

  // Teller-badges (PRD §1.3/§5.1): "Leads" telt actieve funnel-leads,
  // "Klanten" telt echte klanten. Gearchiveerde records en gepromoveerde
  // (gewonnen) of verloren leads tellen niet mee — dit lost het verwarrende
  // gecombineerde aantal op het oude Klanten-item op.
  //
  // Eén gebundelde query i.p.v. vier losse subscriptions per pagina
  // (optimize O9). De rolverdeling zit server-side: interne niet-kantoor-
  // rollen krijgen alleen openMeldingen (rest null); rollen zonder tellers
  // (§2.4-bordrollen uitgezonderd) skippen de query helemaal.
  const isMeldingenRol =
    isKantoor || role === "voorman" || role === "medewerker";
  const tellingen = useQuery(
    api.sidebarTellingen.overzicht,
    isMeldingenRol ? {} : "skip"
  );
  const aantalActieveLeads = tellingen?.actieveLeads ?? undefined;
  const aantalKlanten = tellingen?.klanten ?? undefined;
  const aantalOpenMeldingen = tellingen?.openMeldingen ?? undefined;
  const aantalConceptMails = tellingen?.conceptMails ?? undefined;

  // Close mobile sidebar when navigating to a new page
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  // Filter Werk items based on 7-role model
  const filteredWerkItems = useMemo(() => {
    if (isDirectieOrAdmin || role === "projectleider") {
      return werkItems;
    }
    if (role === "voorman") {
      return werkItems.filter((item) =>
        ["Dashboard", "Mijn dag", "Projecten", "Planning", "Meldingen", "Uren", "Chat"].includes(item.title)
      );
    }
    if (role === "materiaalman") {
      return werkItems.filter((item) =>
        ["Dashboard", "Chat"].includes(item.title)
      );
    }
    if (role === "onderaannemer_zzp") {
      return werkItems.filter((item) =>
        ["Dashboard", "Planning", "Uren", "Chat"].includes(item.title)
      );
    }
    if (role === "medewerker") {
      return werkItems.filter((item) =>
        ["Dashboard", "Mijn dag", "Meldingen", "Uren", "Chat"].includes(item.title)
      );
    }
    // klant/viewer
    return werkItems.filter((item) => item.title === "Dashboard");
  }, [role, isDirectieOrAdmin]);

  // Filter Financieel items based on role
  const filteredFinancieelItems = useMemo(() => {
    if (isDirectieOrAdmin || role === "projectleider") {
      return financieelItems;
    }
    if (role === "materiaalman") {
      return financieelItems.filter((item) => item.title === "Inkoop");
    }
    return [];
  }, [role, isDirectieOrAdmin]);

  // Extract current project ID from pathname if on a project page
  const currentProjectId = useMemo(() => {
    const match = pathname.match(/^\/projecten\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);
  void currentProjectId;

  // Prevent hydration mismatch
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  // Eén plek voor de tellers: welk menu-item, welk aantal, welke kleur. Voorheen
  // stonden dit vier bijna identieke blokken in de JSX.
  //
  // Eén stijl (WS3b): werkvoorraad-tellers (Leads/Meldingen/Concept-mails) in
  // merkgroen — voorheen blauw/amber/groen door elkaar, drie kleuren zonder
  // systeem. Alleen het Klanten-totaal blijft neutraal: dat is een bestandsteller,
  // geen werkvoorraad.
  const werkvoorraadBadge = "bg-primary text-primary-foreground hover:bg-primary";
  const tellers: Record<
    string,
    { aantal: number | undefined; klasse: string; stip?: boolean }
  > = {
    Leads: {
      aantal: aantalActieveLeads,
      klasse: werkvoorraadBadge,
    },
    // Geen stip ingeklapt: dit is een totaal, geen werkvoorraad. Het aantal
    // klanten is nooit nul, dus die stip zou altijd branden zonder iets te
    // melden. Uitgeklapt blijft het getal wel staan.
    Klanten: {
      aantal: aantalKlanten,
      klasse: "bg-secondary text-secondary-foreground",
      stip: false,
    },
    Meldingen: {
      aantal: aantalOpenMeldingen,
      klasse: werkvoorraadBadge,
    },
    "Concept-mails": {
      aantal: aantalConceptMails,
      klasse: werkvoorraadBadge,
    },
  };

  const userInitials = getInitials(user?.fullName || user?.firstName);
  const userDisplayName = user?.fullName || user?.firstName || "Gebruiker";
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  return (
    // collapsible="icon" en niet de standaard "offcanvas": ingeklapt bleef er
    // anders niets over en moest je hem uitklappen om te zien waar je heen kon.
    // Nu blijft er een smalle balk met alleen de iconen staan; de labels zitten
    // in de tooltips die de menu-items al meekregen.
    <Sidebar variant="inset" collapsible="icon" aria-label="Hoofdnavigatie">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                {/* Groene drager onder het witte merkteken: bg-sidebar is licht
                    in light mode, daar zou wit op wit verdwijnen. Bewust een
                    vaste groentint en niet bg-primary — die is in dark mode
                    juist bijna wit. */}
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-green-700">
                  <TopTuinenLogo variant="wit" size={22} className="size-[22px]" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  {/* Merkmoment (WS3b): het woordmerk in het displayfont — de
                      eerste plek waar je het merk ziet, niet zomaar een label. */}
                  <span className="truncate font-display text-[15px] font-semibold tracking-tight" title="Top Tuinen OS">Top Tuinen OS</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Werk - daily operational items */}
        <SidebarGroup>
          <SidebarGroupLabel>Werk</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredWerkItems.map((item) => {
                const teller = tellers[item.title];
                const aantal = teller?.aantal;
                const toonTeller = aantal !== undefined && aantal > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                      // Het aantal mee in de tooltip: ingeklapt is de stip het
                      // enige signaal, en dan wil je alsnog weten om hoeveel
                      // het gaat zonder uit te klappen.
                      tooltip={toonTeller ? `${item.title} (${aantal})` : item.title}
                      className={menuKnopKlasse}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                        {toonTeller && (
                          <MenuTeller
                            aantal={aantal}
                            klasse={teller.klasse}
                            stip={teller.stip}
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financieel - quotes, invoices, procurement */}
        {filteredFinancieelItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Financieel</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredFinancieelItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                        tooltip={item.title}
                        className={menuKnopKlasse}
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Ingeklapt is er geen ruimte voor avatar én bel naast elkaar in
                een balk van 48px; dan onder elkaar, zodat allebei bereikbaar
                blijft. */}
            <div className="flex items-center justify-between px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="flex-1 cursor-pointer">
                    {mounted && isUserLoaded ? (
                      user?.imageUrl ? (
                        <Image
                          src={user.imageUrl}
                          alt={`Profielfoto van ${userDisplayName}`}
                          width={32}
                          height={32}
                          className="size-8 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          {userInitials}
                        </div>
                      )
                    ) : (
                      <div className="size-8 rounded-full bg-muted animate-pulse" />
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium" title={mounted && isUserLoaded ? userDisplayName : undefined}>
                        {mounted && isUserLoaded ? userDisplayName : "Laden..."}
                      </span>
                      <span className="truncate text-xs text-muted-foreground" title={mounted && isUserLoaded && userEmail ? userEmail : undefined}>
                        {mounted && isUserLoaded && userEmail ? userEmail : ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-64">
                  {/* User info header */}
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{userDisplayName}</p>
                    {userEmail && (
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />

                  {/* Persoonlijk */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/profiel" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" aria-hidden="true" />
                        Profiel
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/instellingen" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                        Instellingen
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  {/* Personeel - admin/directie only */}
                  {isDirectieOrAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Personeel</DropdownMenuLabel>
                        {personeelMenuItems.map((item) => (
                          <DropdownMenuItem key={item.title} asChild>
                            <Link
                              href={item.url}
                              className={`cursor-pointer ${item.indent ? "pl-8" : ""}`}
                            >
                              <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {item.title}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}

                  {/* Assets & Data - admin/directie only */}
                  {isDirectieOrAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Assets & Data</DropdownMenuLabel>
                        {assetsMenuItems.map((item) => (
                          <DropdownMenuItem key={item.title} asChild>
                            <Link href={item.url} className="cursor-pointer">
                              <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {item.title}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}

                  {/* Theme + Logout */}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="cursor-pointer"
                    >
                      {mounted && theme === "dark" ? (
                        <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {mounted ? (theme === "dark" ? "Lichte modus" : "Donkere modus") : "Thema"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                      Uitloggen
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <NotificationCenter />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
