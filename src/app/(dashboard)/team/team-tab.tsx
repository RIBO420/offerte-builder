"use client";

import { useCallback, useMemo, useState } from "react";
import {
  KeyRound,
  Mail,
  MailX,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldMinus,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebounce } from "@/hooks/use-debounce";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { formatCurrency } from "@/lib/format/currency";
import {
  UITNODIGBARE_ROLLEN,
  isUitnodigbareRol,
  rolVanAccount,
  type Teamlid,
  type UitnodigbareRol,
  type useTeam,
} from "@/hooks/use-team";
import type { UserRole } from "@/hooks/use-users";
import { MedewerkerForm, type Medewerker } from "./components/medewerker-form";
import {
  MedewerkerDetailSheet,
  type MedewerkerExtended,
} from "./components/medewerker-detail-sheet";
import { RolBadge, ROL_WEERGAVE } from "./components/rol-weergave";
import { UitnodigenDialog } from "./components/uitnodigen-dialog";

/**
 * De teamtabel: wie werkt hier, en wat mag hij in de app.
 *
 * Het scherm voegt twee lijsten samen die vroeger los stonden — het
 * personeelsdossier (/medewerkers) en het accountbeheer (/gebruikers). De
 * winst zit in de rijactie: uitnodigen, rol wijzigen en toegang intrekken doe
 * je bij de persoon, niet in een tweede scherm waar je hem moet terugzoeken.
 */

// ── Filter ──────────────────────────────────────────────────────────────────

/**
 * Eén keuzelijst over twee assen: dienstverband en app-toegang.
 *
 * Twee losse filters naast elkaar zou preciezer zijn, maar in de praktijk
 * zoek je één ding tegelijk ("wie heeft nog geen account?"). De `SelectGroup`
 * houdt de assen uit elkaar zonder een tweede besturingselement.
 */
export type TeamFilter =
  | "in_dienst"
  | "uit_dienst"
  | "alle"
  | "geen"
  | "uitgenodigd"
  | "actief";

const FILTER_LABEL: Record<TeamFilter, string> = {
  in_dienst: "In dienst",
  uit_dienst: "Uit dienst",
  alle: "Iedereen",
  geen: "Zonder account",
  uitgenodigd: "Uitgenodigd",
  actief: "Met account",
};

function voldoetAanFilter(lid: Teamlid, filter: TeamFilter): boolean {
  switch (filter) {
    case "alle":
      return true;
    case "in_dienst":
      return lid.isActief;
    case "uit_dienst":
      return !lid.isActief;
    // De toegangsfilters gaan over mensen die hier nog werken; een oud-collega
    // zonder account is geen openstaande taak.
    default:
      return lid.isActief && lid.accountStatus === filter;
  }
}

// ── Kolomcellen ─────────────────────────────────────────────────────────────

const CONTRACT_LABEL: Record<string, string> = {
  fulltime: "Fulltime",
  parttime: "Parttime",
  zzp: "ZZP",
  seizoen: "Seizoen",
};

/**
 * Wat deze collega in de app mag.
 *
 * Bij een actief account toont de cel de **rol** en niet het woord "Actief":
 * dát is de vraag die je bij een bestaand account stelt. Of iemand toegang
 * heeft is aan de badge zelf te zien — en de statusfilter dekt die as.
 */
function ToegangCel({ lid }: { lid: Teamlid }) {
  if (lid.accountStatus === "actief" && lid.account) {
    return <RolBadge rol={rolVanAccount(lid.account)} />;
  }

  if (lid.accountStatus === "uitgenodigd") {
    return (
      <Badge
        variant="outline"
        className="max-w-full gap-1 border-status-verzonden-border bg-status-verzonden text-status-verzonden-text"
        title={
          lid.uitnodigingEmail
            ? `Uitgenodigd op ${lid.uitnodigingEmail}`
            : "Uitnodiging verstuurd"
        }
      >
        <Mail className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">Uitgenodigd</span>
      </Badge>
    );
  }

  return (
    <span className="text-sm text-muted-foreground">Geen account</span>
  );
}

// ── Tab ─────────────────────────────────────────────────────────────────────

/** Een bevestiging die eerst uitgelegd wordt en dan pas uitgevoerd. */
interface Bevestiging {
  titel: string;
  uitleg: string;
  knop: string;
  uitvoeren: () => Promise<unknown>;
  gelukt: string;
}

export function TeamTab({
  team,
  magSchrijven,
  filter,
  onFilterChange,
}: {
  team: ReturnType<typeof useTeam>;
  /** Directie schrijft; een projectleider leest mee. */
  magSchrijven: boolean;
  filter: TeamFilter;
  onFilterChange: (filter: TeamFilter) => void;
}) {
  const { teamleden, losseAccounts } = team;

  const [zoek, setZoek] = useState("");
  const zoekterm = useDebounce(zoek, 300);

  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [bewerken, setBewerken] = useState<Teamlid | null>(null);
  const [dossier, setDossier] = useState<Teamlid | null>(null);
  const [uitnodigen, setUitnodigen] = useState<{
    lid: Teamlid;
    herhaling: boolean;
  } | null>(null);
  const [bevestiging, setBevestiging] = useState<Bevestiging | null>(null);
  const [bezig, setBezig] = useState(false);

  const zichtbaar = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    return teamleden.filter((lid) => {
      if (!voldoetAanFilter(lid, filter)) return false;
      if (!term) return true;
      return (
        lid.naam.toLowerCase().includes(term) ||
        (lid.email?.toLowerCase().includes(term) ?? false) ||
        (lid.functie?.toLowerCase().includes(term) ?? false) ||
        (lid.account?.email.toLowerCase().includes(term) ?? false)
      );
    });
  }, [teamleden, filter, zoekterm]);

  /** Eén plek voor "doe het, meld het, en vertel het als het misgaat". */
  const voerUit = useCallback(
    async (actie: () => Promise<unknown>, gelukt: string) => {
      try {
        await actie();
        toast.success(gelukt);
      } catch (error) {
        toast.error(getMutationErrorMessage(error));
      }
    },
    []
  );

  const wijzigRol = useCallback(
    async (lid: Teamlid, rol: UserRole) => {
      if (!lid.account) return;
      await voerUit(
        () => team.wijzigRol(lid.account!.id, rol),
        `${lid.naam} is nu ${ROL_WEERGAVE[rol]?.label ?? rol}`
      );
    },
    [team, voerUit]
  );

  const bevestigEnUitvoeren = useCallback(async () => {
    if (!bevestiging) return;
    setBezig(true);
    try {
      await bevestiging.uitvoeren();
      toast.success(bevestiging.gelukt);
      setBevestiging(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
    } finally {
      setBezig(false);
    }
  }, [bevestiging]);

  const columns: ResponsiveColumn<Teamlid>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        width: "w-[24%]",
        render: (lid) => (
          <span className="block truncate font-medium" title={lid.naam}>
            {lid.naam}
          </span>
        ),
      },
      {
        key: "functie",
        header: "Functie",
        isSecondary: true,
        width: "w-[16%]",
        render: (lid) =>
          lid.functie ? (
            <Badge variant="secondary" className="max-w-full" title={lid.functie}>
              <span className="truncate">{lid.functie}</span>
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "contract",
        header: "Contract",
        showInCard: true,
        mobileLabel: "Contract",
        width: "w-[13%]",
        render: (lid) => (
          <span className="block truncate text-sm">
            {lid.contractType ? CONTRACT_LABEL[lid.contractType] : "—"}
          </span>
        ),
      },
      {
        key: "uurtarief",
        header: "Uurtarief",
        align: "right",
        showInCard: true,
        mobileLabel: "Tarief",
        width: "w-[12%]",
        render: (lid) => (
          <span className="block truncate tabular-nums">
            {typeof lid.uurtarief === "number" ? (
              formatCurrency(lid.uurtarief)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </span>
        ),
      },
      {
        key: "toegang",
        header: "App-toegang",
        showInCard: true,
        mobileLabel: "Toegang",
        width: "w-[17%]",
        render: (lid) => <ToegangCel lid={lid} />,
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        // Alle rijacties in één menu: er zijn er meer dan drie en ze
        // verschillen per accountstatus. Losse knoppen zouden de kolom bij een
        // smal venster laten uitlopen — deze app scrollt nooit zijwaarts.
        width: "w-[56px]",
        allowOverflow: true,
        render: (lid) => (
          <div className="flex items-center justify-end whitespace-nowrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8"
                  aria-label={`Acties voor ${lid.naam}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setDossier(lid)}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Dossier openen
                </DropdownMenuItem>

                {magSchrijven && (
                  <>
                    <DropdownMenuItem onClick={() => setBewerken(lid)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Bewerken
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {lid.accountStatus === "geen" && (
                      <DropdownMenuItem
                        onClick={() =>
                          setUitnodigen({ lid, herhaling: false })
                        }
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Uitnodigen
                      </DropdownMenuItem>
                    )}

                    {lid.accountStatus === "uitgenodigd" && (
                      <>
                        <DropdownMenuItem
                          onClick={() =>
                            setUitnodigen({ lid, herhaling: true })
                          }
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Opnieuw versturen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setBevestiging({
                              titel: "Uitnodiging intrekken",
                              uitleg: `De uitnodiging voor ${lid.naam} vervalt. De link in de e-mail werkt daarna niet meer; je kunt hem later opnieuw uitnodigen.`,
                              knop: "Uitnodiging intrekken",
                              uitvoeren: () => team.trekUitnodigingIn(lid._id),
                              gelukt: `Uitnodiging voor ${lid.naam} ingetrokken`,
                            })
                          }
                        >
                          <MailX className="mr-2 h-4 w-4" />
                          Uitnodiging intrekken
                        </DropdownMenuItem>
                      </>
                    )}

                    {lid.accountStatus === "actief" && lid.account && (
                      <>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Rol wijzigen
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuRadioGroup
                              // Een legacy-rol (`admin`, `viewer`) staat niet
                              // in de lijst: dan is er niets aangevinkt in
                              // plaats van een verkeerd vinkje.
                              value={
                                isUitnodigbareRol(rolVanAccount(lid.account))
                                  ? rolVanAccount(lid.account)
                                  : ""
                              }
                              onValueChange={(waarde) =>
                                void wijzigRol(lid, waarde as UitnodigbareRol)
                              }
                            >
                              {UITNODIGBARE_ROLLEN.map((rol) => (
                                <DropdownMenuRadioItem key={rol} value={rol}>
                                  {ROL_WEERGAVE[rol].label}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem
                          onClick={() =>
                            setBevestiging({
                              titel: "Toegang intrekken",
                              uitleg: `${lid.naam} kan daarna niet meer inloggen op Top Tuinen OS. Het personeelsdossier blijft staan — uren, projecten en certificaten raak je niet kwijt.`,
                              knop: "Toegang intrekken",
                              uitvoeren: () => team.trekToegangIn(lid._id),
                              gelukt: `Toegang van ${lid.naam} ingetrokken`,
                            })
                          }
                        >
                          <ShieldMinus className="mr-2 h-4 w-4" />
                          Toegang intrekken
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />

                    {lid.isActief ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          setBevestiging({
                            titel: "Uit dienst melden",
                            uitleg: `${lid.naam} verdwijnt uit de planning en uit de lijsten met beschikbare collega's. Het dossier blijft bewaard en je kunt hem later weer in dienst melden.`,
                            knop: "Uit dienst melden",
                            uitvoeren: () => team.uitDienst(lid._id),
                            gelukt: `${lid.naam} staat op uit dienst`,
                          })
                        }
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Uit dienst
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() =>
                          void voerUit(
                            () => team.inDienst(lid._id),
                            `${lid.naam} staat weer in dienst`
                          )
                        }
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Weer in dienst
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [magSchrijven, team, voerUit, wijzigRol]
  );

  const heeftTeamleden = teamleden.length > 0;

  return (
    <>
      <SectiePaneel
        titel="Teamleden"
        icoon={<Users className="h-4 w-4" />}
        telling={zichtbaar.length}
        kopbalk
        acties={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={filter}
              onValueChange={(waarde) => onFilterChange(waarde as TeamFilter)}
            >
              <SelectTrigger
                size="sm"
                className="w-[11rem]"
                aria-label="Filter op status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Dienstverband</SelectLabel>
                  <SelectItem value="in_dienst">
                    {FILTER_LABEL.in_dienst}
                  </SelectItem>
                  <SelectItem value="uit_dienst">
                    {FILTER_LABEL.uit_dienst}
                  </SelectItem>
                  <SelectItem value="alle">{FILTER_LABEL.alle}</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>App-toegang</SelectLabel>
                  <SelectItem value="geen">{FILTER_LABEL.geen}</SelectItem>
                  <SelectItem value="uitgenodigd">
                    {FILTER_LABEL.uitgenodigd}
                  </SelectItem>
                  <SelectItem value="actief">{FILTER_LABEL.actief}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <div className="relative w-full @[30rem]/team:w-56">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8"
                placeholder="Zoek op naam of e-mail…"
                aria-label="Zoek in het team"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
              />
            </div>

            {magSchrijven && (
              <Button size="sm" onClick={() => setNieuwOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe collega
              </Button>
            )}
          </div>
        }
        className="@container/team"
      >
        {zichtbaar.length === 0 ? (
          <div className="px-3">
            <EmptyState
              compact
              icon={<Users />}
              title={
                heeftTeamleden
                  ? "Niemand in deze selectie."
                  : "Nog geen collega's."
              }
              description={
                heeftTeamleden
                  ? "Pas de filter of de zoekterm aan."
                  : "Voeg je eerste collega toe; uitnodigen voor de app kan daarna vanuit de rijactie."
              }
              action={
                !heeftTeamleden && magSchrijven
                  ? {
                      label: "Collega toevoegen",
                      onClick: () => setNieuwOpen(true),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <ResponsiveTable
            data={zichtbaar}
            columns={columns}
            keyExtractor={(lid) => lid._id}
            onRowClick={(lid) => setDossier(lid)}
            mobileBreakpoint="md"
          />
        )}
      </SectiePaneel>

      {/* Nieuw dossier */}
      {magSchrijven && (
        <MedewerkerForm
          open={nieuwOpen}
          onOpenChange={setNieuwOpen}
          onSuccess={() => setNieuwOpen(false)}
        />
      )}

      {/* Dossier bewerken */}
      {magSchrijven && (
        <MedewerkerForm
          open={bewerken !== null}
          onOpenChange={(open) => {
            if (!open) setBewerken(null);
          }}
          initialData={bewerken as Medewerker | null}
          onSuccess={() => setBewerken(null)}
        />
      )}

      {/* Dossier lezen */}
      <MedewerkerDetailSheet
        open={dossier !== null}
        onOpenChange={(open) => {
          if (!open) setDossier(null);
        }}
        medewerker={dossier as MedewerkerExtended | null}
        onBewerken={
          magSchrijven && dossier
            ? () => {
                setBewerken(dossier);
                setDossier(null);
              }
            : undefined
        }
      />

      {/* Uitnodigen / opnieuw versturen */}
      {uitnodigen && (
        <UitnodigenDialog
          open
          onOpenChange={(open) => {
            if (!open) setUitnodigen(null);
          }}
          medewerkerNaam={uitnodigen.lid.naam}
          standaardEmail={
            uitnodigen.lid.uitnodigingEmail ?? uitnodigen.lid.email ?? ""
          }
          isHerhaling={uitnodigen.herhaling}
          bestaandeAccounts={losseAccounts}
          onVersturen={async (email, rol) => {
            await team.stuurUitnodiging(uitnodigen.lid._id, email, rol);
            toast.success(`Uitnodiging verstuurd naar ${email}`);
            setUitnodigen(null);
          }}
        />
      )}

      {/* Eén bevestiging voor intrekken en uit dienst melden */}
      <AlertDialog
        open={bevestiging !== null}
        onOpenChange={(open) => {
          if (!open && !bezig) setBevestiging(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bevestiging?.titel}</AlertDialogTitle>
            <AlertDialogDescription>
              {bevestiging?.uitleg}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              disabled={bezig}
              onClick={(e) => {
                // Zelf sluiten pas ná de actie: anders verdwijnt de dialoog
                // terwijl de Clerk-call nog loopt en weet niemand of het lukte.
                e.preventDefault();
                void bevestigEnUitvoeren();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bevestiging?.knop}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
