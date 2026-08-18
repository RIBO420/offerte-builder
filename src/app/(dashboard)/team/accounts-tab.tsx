"use client";

import { useCallback, useMemo, useState } from "react";
import {
  KeyRound,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
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
import { formatDate } from "@/lib/format/date";
import {
  UITNODIGBARE_ROLLEN,
  isUitnodigbareRol,
  type UitnodigbareRol,
  type useTeam,
} from "@/hooks/use-team";
import type { UserWithDetails } from "@/hooks/use-users";
import { RolBadge, ROL_WEERGAVE } from "./components/rol-weergave";

/**
 * Accounts zónder personeelsdossier.
 *
 * Dit is de restcategorie, geen tweede ingang voor nieuwe collega's: wie hier
 * hoort te werken krijgt een dossier én een uitnodiging via de Team-tab, zodat
 * uren en projecten aan iemand hangen. Wat overblijft is het externe
 * boekhoudaccount, de oud-collega die nog niet is opgeruimd, en de directie die
 * zelf nooit in de urenlijst stond. Daarom precies twee acties: rol wijzigen en
 * verwijderen.
 */
export function AccountsTab({
  team,
}: {
  team: ReturnType<typeof useTeam>;
}) {
  const { losseAccounts } = team;

  const [zoek, setZoek] = useState("");
  const zoekterm = useDebounce(zoek, 300);
  const [verwijderen, setVerwijderen] = useState<UserWithDetails | null>(null);
  const [bezig, setBezig] = useState(false);

  const zichtbaar = useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    if (!term) return losseAccounts;
    return losseAccounts.filter(
      (account) =>
        account.name.toLowerCase().includes(term) ||
        account.email.toLowerCase().includes(term)
    );
  }, [losseAccounts, zoekterm]);

  const wijzigRol = useCallback(
    async (account: UserWithDetails, rol: UitnodigbareRol) => {
      try {
        await team.wijzigRol(account._id, rol);
        toast.success(
          `${account.name} is nu ${ROL_WEERGAVE[rol]?.label ?? rol}`
        );
      } catch (error) {
        toast.error(getMutationErrorMessage(error));
      }
    },
    [team]
  );

  const verwijderBevestigd = useCallback(async () => {
    if (!verwijderen) return;
    setBezig(true);
    try {
      await team.verwijderAccount(verwijderen._id);
      toast.success(`Account van ${verwijderen.name} verwijderd`);
      setVerwijderen(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
    } finally {
      setBezig(false);
    }
  }, [team, verwijderen]);

  const columns: ResponsiveColumn<UserWithDetails>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        width: "w-[26%]",
        render: (account) => (
          <span className="block truncate font-medium" title={account.name}>
            {account.name}
          </span>
        ),
      },
      {
        key: "email",
        header: "E-mail",
        isSecondary: true,
        width: "w-[30%]",
        render: (account) => (
          <span className="block truncate text-sm" title={account.email}>
            {account.email}
          </span>
        ),
      },
      {
        key: "rol",
        header: "Rol",
        showInCard: true,
        mobileLabel: "Rol",
        width: "w-[22%]",
        render: (account) => <RolBadge rol={account.role} />,
      },
      {
        key: "aangemaakt",
        header: "Aangemaakt",
        showInCard: true,
        mobileLabel: "Aangemaakt",
        width: "w-[16%]",
        render: (account) => (
          <span className="block truncate text-sm text-muted-foreground tabular-nums">
            {formatDate(account.createdAt)}
          </span>
        ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        width: "w-[56px]",
        allowOverflow: true,
        render: (account) => (
          <div className="flex items-center justify-end whitespace-nowrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8"
                  aria-label={`Acties voor ${account.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Rol wijzigen
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={isUitnodigbareRol(account.role) ? account.role : ""}
                      onValueChange={(waarde) =>
                        void wijzigRol(account, waarde as UitnodigbareRol)
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

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setVerwijderen(account)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Account verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [wijzigRol]
  );

  return (
    <>
      <SectiePaneel
        titel="Accounts zonder dossier"
        icoon={<ShieldAlert className="h-4 w-4" />}
        telling={zichtbaar.length}
        kopbalk
        acties={
          <div className="relative w-full @[30rem]/accounts:w-56">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Zoek op naam of e-mail…"
              aria-label="Zoek in de accounts"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
            />
          </div>
        }
        className="@container/accounts"
      >
        <p className="px-3 pt-3 text-sm text-muted-foreground">
          Accounts zonder medewerkersdossier. Nieuwe collega&apos;s nodig je uit
          via de Team-tab.
        </p>

        {zichtbaar.length === 0 ? (
          <div className="px-3 pb-1">
            <EmptyState
              compact
              icon={<ShieldAlert />}
              title={
                losseAccounts.length > 0
                  ? "Geen account gevonden."
                  : "Elk account hoort bij een collega."
              }
              description={
                losseAccounts.length > 0
                  ? "Pas de zoekterm aan."
                  : "Er staat niemand los van het personeelsbestand — precies zoals het hoort."
              }
            />
          </div>
        ) : (
          <ResponsiveTable
            data={zichtbaar}
            columns={columns}
            keyExtractor={(account) => account._id}
            mobileBreakpoint="md"
          />
        )}
      </SectiePaneel>

      <AlertDialog
        open={verwijderen !== null}
        onOpenChange={(open) => {
          if (!open && !bezig) setVerwijderen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              {verwijderen
                ? `${verwijderen.name} (${verwijderen.email}) wordt verwijderd uit Top Tuinen OS én uit Clerk. Deze actie kan niet ongedaan worden gemaakt.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bezig}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              disabled={bezig}
              onClick={(e) => {
                e.preventDefault();
                void verwijderBevestigd();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Definitief verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
