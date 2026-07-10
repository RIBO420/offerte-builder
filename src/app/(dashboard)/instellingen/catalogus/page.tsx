"use client";

/**
 * Catalogusbeheer — bouwstenen en uurtarief (PRD §2.5f + bijlage A).
 *
 * Kantoor-only beheerscherm onder Instellingen: lijst gegroepeerd per
 * categorie, aanmaken/bewerken via formulier met uur/vast-schakelaar,
 * en uurtarief-beheer met ingangsdatum en historie op hetzelfde scherm.
 * Verwijderen = deactiveren; heractiveren kan altijd.
 */

import { useCallback, useMemo, useState } from "react";
import { m } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Edit,
  Loader2,
  MoreHorizontal,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsKantoor } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/format/currency";
import {
  BOUWSTEEN_CATEGORIEEN,
  CATEGORIE_LABELS,
  SOORT_LABELS,
  formatSeizoensvenster,
  type BouwsteenCategorie,
  type BouwsteenSoort,
} from "@/lib/catalogus";
import {
  BouwsteenForm,
  type BouwsteenFormInitial,
  type BouwsteenSubmitData,
} from "@/components/catalogus/bouwsteen-form";
import { UurtariefBeheer } from "@/components/catalogus/uurtarief-beheer";
import { NormuurSuggesties } from "@/components/catalogus/normuur-suggesties";

interface Bouwsteen extends BouwsteenFormInitial {
  _id: Id<"bouwstenen">;
  actief: boolean;
}

function prijsIndicatie(
  b: Bouwsteen,
  uurtarief: number | null
): string {
  if (b.prijsmodel === "vast") {
    return b.vastBedragPerBeurt !== undefined
      ? `${formatCurrency(b.vastBedragPerBeurt)} vast`
      : "—";
  }
  if (b.urenPerBeurt === undefined) return "—";
  if (uurtarief === null) return `${b.urenPerBeurt} uur`;
  return `${formatCurrency(b.urenPerBeurt * uurtarief)} (${String(
    b.urenPerBeurt
  ).replace(".", ",")} u × ${formatCurrency(uurtarief)})`;
}

export default function CatalogusPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isKantoor = useIsKantoor();
  const magBeheren = Boolean(user?._id) && isKantoor;

  const bouwstenen = useQuery(
    api.bouwstenen.list,
    magBeheren ? {} : "skip"
  ) as Bouwsteen[] | undefined;
  const huidigTarief = useQuery(
    api.uurtarieven.getHuidig,
    magBeheren ? {} : "skip"
  );
  const tariefHistorie = useQuery(
    api.uurtarieven.listHistorie,
    magBeheren ? {} : "skip"
  );

  const createBouwsteen = useMutation(api.bouwstenen.create);
  const updateBouwsteen = useMutation(api.bouwstenen.update);
  const setActief = useMutation(api.bouwstenen.setActief);
  const nieuwTarief = useMutation(api.uurtarieven.nieuwTarief);

  const [showForm, setShowForm] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Bouwsteen | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const uurtarief = huidigTarief?.bedrag ?? null;

  const perCategorie = useMemo(() => {
    const groepen = new Map<BouwsteenCategorie, Bouwsteen[]>();
    for (const categorie of BOUWSTEEN_CATEGORIEEN) {
      groepen.set(categorie, []);
    }
    for (const b of bouwstenen ?? []) {
      groepen.get(b.categorie)?.push(b);
    }
    return groepen;
  }, [bouwstenen]);

  const handleSubmit = useCallback(
    async (data: BouwsteenSubmitData) => {
      setIsSaving(true);
      try {
        if (geselecteerd) {
          await updateBouwsteen({ id: geselecteerd._id, ...data });
          toast.success(`Bouwsteen "${data.naam}" bijgewerkt`);
        } else {
          await createBouwsteen(data);
          toast.success(`Bouwsteen "${data.naam}" toegevoegd`);
        }
        setShowForm(false);
        setGeselecteerd(null);
      } catch (error) {
        const bericht =
          error instanceof Error && "data" in error
            ? String((error as { data: unknown }).data)
            : "Fout bij opslaan bouwsteen";
        toast.error(bericht);
        console.error(error);
      } finally {
        setIsSaving(false);
      }
    },
    [geselecteerd, createBouwsteen, updateBouwsteen]
  );

  const handleToggleActief = useCallback(
    async (b: Bouwsteen) => {
      try {
        await setActief({ id: b._id, actief: !b.actief });
        toast.success(
          b.actief
            ? `"${b.naam}" gedeactiveerd — historie blijft bewaard`
            : `"${b.naam}" geactiveerd`
        );
      } catch (error) {
        toast.error("Fout bij wijzigen actief-status");
        console.error(error);
      }
    },
    [setActief]
  );

  const handleNieuwTarief = useCallback(
    async (data: { bedrag: number; ingangsdatum: string }) => {
      await nieuwTarief(data);
    },
    [nieuwTarief]
  );

  const isLoading = isUserLoading || (magBeheren && bouwstenen === undefined);

  if (!isUserLoading && !magBeheren) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <p className="font-medium">Alleen voor kantoor</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Het catalogusbeheer is alleen toegankelijk voor directie en
            projectleiders.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Catalogus onderhoud</h1>
            <p className="text-sm text-muted-foreground">
              Bouwstenen en tarieven beheer je hier in de app — een nieuwe
              bouwsteen is een record, geen code.
            </p>
          </div>
          <Button
            onClick={() => {
              setGeselecteerd(null);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Nieuwe bouwsteen
          </Button>
        </div>

        <UurtariefBeheer
          huidig={huidigTarief ?? null}
          historie={tariefHistorie}
          onNieuwTarief={handleNieuwTarief}
        />

        {/* Nacalculatie-loop (§3.4): suggestie-blok per bouwsteen zodra er
            voldoende echte urendata is — de mens beslist */}
        <NormuurSuggesties />

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          BOUWSTEEN_CATEGORIEEN.map((categorie) => {
            const items = perCategorie.get(categorie) ?? [];
            if (items.length === 0) return null;
            return (
              <Card key={categorie}>
                <CardHeader>
                  <CardTitle>{CATEGORIE_LABELS[categorie]}</CardTitle>
                  <CardDescription>
                    {items.filter((b) => b.actief).length} actief van{" "}
                    {items.length}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Code</TableHead>
                          <TableHead>Naam</TableHead>
                          <TableHead>Soort</TableHead>
                          <TableHead>Frequentie</TableHead>
                          <TableHead>Seizoen</TableHead>
                          <TableHead>Prijsindicatie</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((b) => (
                          <TableRow
                            key={b._id}
                            className={b.actief ? "" : "opacity-50"}
                          >
                            <TableCell>
                              <Badge variant="outline">{b.code}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {b.naam}
                            </TableCell>
                            <TableCell>
                              {SOORT_LABELS[b.soort as BouwsteenSoort] ??
                                b.soort}
                            </TableCell>
                            <TableCell>
                              {b.defaultFrequentiePerJaar !== undefined
                                ? `${b.defaultFrequentiePerJaar}×/jaar`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {formatSeizoensvenster(
                                b.seizoensvensterVan,
                                b.seizoensvensterTot
                              ) ?? "—"}
                            </TableCell>
                            <TableCell>{prijsIndicatie(b, uurtarief)}</TableCell>
                            <TableCell>
                              {b.actief ? (
                                <Badge variant="secondary">Actief</Badge>
                              ) : (
                                <Badge variant="outline">Inactief</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Acties voor ${b.naam}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setGeselecteerd(b);
                                      setShowForm(true);
                                    }}
                                  >
                                    <Edit className="mr-2 size-4" />
                                    Bewerken
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleToggleActief(b)}
                                  >
                                    {b.actief ? (
                                      <>
                                        <Archive className="mr-2 size-4" />
                                        Deactiveren
                                      </>
                                    ) : (
                                      <>
                                        <ArchiveRestore className="mr-2 size-4" />
                                        Activeren
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </m.div>

      <BouwsteenForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setGeselecteerd(null);
        }}
        onSubmit={handleSubmit}
        initial={geselecteerd ?? undefined}
        huidigUurtarief={uurtarief}
        isSaving={isSaving}
      />
    </>
  );
}
