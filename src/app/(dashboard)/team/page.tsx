"use client";

import { Suspense, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PaginaReveal } from "@/components/pagina-reveal";
import { RequireRole } from "@/components/require-admin";
import { Cel, Cijferstrip } from "@/components/ui/cijferstrip";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabState } from "@/hooks/use-tab-state";
import { useTeam } from "@/hooks/use-team";
import { useIsAdmin } from "@/hooks/use-users";
import { AccountsTab } from "./accounts-tab";
import { TeamTab, type TeamFilter } from "./team-tab";

/**
 * `/team` — het personeelsbestand en de app-toegang in één scherm.
 *
 * Vervangt `/medewerkers` (wie werkt hier) en `/gebruikers` (wie mag inloggen).
 * Die twee stonden los, terwijl kantoor er één vraag aan stelt: kan deze
 * collega bij zijn uren? Wie ze apart houdt, moet dezelfde persoon twee keer
 * opzoeken en kan hem in het ene scherm uitnodigen zonder dat het andere het
 * weet.
 *
 * Rollen: directie én projectleider komen binnen (RequireRole), maar alleen
 * directie schrijft. Een projectleider die het team leest heeft geen knoppen
 * die hij toch niet mag indrukken — niet gerenderd is duidelijker dan
 * uitgegrijsd. De Accounts-tab bestaat voor hem niet: die gaat over toegang
 * verlenen en intrekken.
 */

type TeamPaginaTab = "team" | "accounts";

function TeamPaginaInhoud() {
  const team = useTeam();
  const isDirectie = useIsAdmin();
  const [tab, setTab] = useTabState("team");
  const [filter, setFilter] = useState<TeamFilter>("in_dienst");

  const stats = useMemo(() => {
    const inDienst = team.teamleden.filter((lid) => lid.isActief);
    return {
      inDienst: inDienst.length,
      metAccount: inDienst.filter((lid) => lid.accountStatus === "actief")
        .length,
      uitgenodigd: inDienst.filter((lid) => lid.accountStatus === "uitgenodigd")
        .length,
      zonderAccount: inDienst.filter((lid) => lid.accountStatus === "geen")
        .length,
    };
  }, [team.teamleden]);

  // Een niet-directie die `?tab=accounts` in de URL plakt, hoort gewoon het
  // team te zien in plaats van een leeg blad.
  const actieveTab: TeamPaginaTab =
    tab === "accounts" && isDirectie ? "accounts" : "team";

  /** Een cijfer aanklikken zet de filter en brengt je terug naar de tabel. */
  function toonSelectie(nieuw: TeamFilter) {
    setFilter(nieuw);
    if (actieveTab !== "team") setTab("team");
  }

  if (team.isLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center">
          <LaadIndicator formaat="pagina" tekst="Team laden…" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />

      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Team
              </h1>
              <p className="text-muted-foreground">
                Personeelsdossiers en toegang tot Top Tuinen OS
              </p>
            </div>
          </div>
        </div>

        <Cijferstrip
          label="Kerncijfers van het team"
          className="@container/teamcijfers"
          kolommen="grid-cols-1 @[26rem]/teamcijfers:grid-cols-3"
        >
          <Cel
            label="In dienst"
            format="number"
            waarde={stats.inDienst}
            onClick={() => toonSelectie("in_dienst")}
            actief={actieveTab === "team" && filter === "in_dienst"}
            voet={
              <span className="text-muted-foreground">
                collega&apos;s op de loonlijst
              </span>
            }
          />
          <Cel
            label="Met account"
            format="number"
            waarde={stats.metAccount}
            onClick={() => toonSelectie("actief")}
            actief={actieveTab === "team" && filter === "actief"}
            voet={
              <span className="text-muted-foreground">
                {stats.zonderAccount > 0
                  ? `${stats.zonderAccount} nog zonder toegang`
                  : "iedereen kan inloggen"}
              </span>
            }
          />
          <Cel
            label="Uitgenodigd"
            format="number"
            waarde={stats.uitgenodigd}
            onClick={() => toonSelectie("uitgenodigd")}
            actief={actieveTab === "team" && filter === "uitgenodigd"}
            voet={
              <span className="text-muted-foreground">
                {stats.uitgenodigd > 0
                  ? "wacht op aanmelden"
                  : "geen openstaande uitnodiging"}
              </span>
            }
          />
        </Cijferstrip>

        {isDirectie && (
          <Tabs
            value={actieveTab}
            onValueChange={(waarde) => setTab(waarde)}
          >
            <TabsList>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="accounts">
                Accounts ({team.losseAccounts.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {actieveTab === "accounts" ? (
          <AccountsTab team={team} />
        ) : (
          <TeamTab
            team={team}
            magSchrijven={isDirectie}
            filter={filter}
            onFilterChange={setFilter}
          />
        )}
      </PaginaReveal>
    </>
  );
}

export default function TeamPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      {/* useTabState leest `?tab=` — zonder Suspense klapt de statische
          prerender van deze route om in een build-fout. */}
      <Suspense fallback={null}>
        <TeamPaginaInhoud />
      </Suspense>
    </RequireRole>
  );
}
