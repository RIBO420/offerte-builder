"use client";

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
import {
  Clock,
  MoreHorizontal,
  Trash2,
  Loader2,
  Plus,
  Lightbulb,
} from "lucide-react";
import { UrenImport } from "@/components/project/uren-import";
import { UrenEntryData } from "@/components/project/uren-entry-form";
import { scopeLabels, formatDate } from "./utils";

interface UrenRegistratie {
  _id: string;
  medewerker: string;
  uren: number;
  datum: string;
  scope?: string;
  notities?: string;
  bron?: string;
}

interface UrenTabProps {
  isLoading: boolean | null | undefined;
  groupedByDate: [string, UrenRegistratie[]][];
  onShowUrenForm: () => void;
  onDeleteItem: (item: { type: "uren" | "machine"; id: string }) => void;
  onImport: (entries: UrenEntryData[]) => Promise<void>;
  isImporting: boolean;
}

export function UrenTab({
  isLoading,
  groupedByDate,
  onShowUrenForm,
  onDeleteItem,
  onImport,
  isImporting,
}: UrenTabProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (groupedByDate.length > 0) {
    return (
      <div className="space-y-4">
        {groupedByDate.map(([date, items]) => (
          <Card key={date}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {formatDate(date)}
              </CardTitle>
              <CardDescription>
                {items.reduce((sum, i) => sum + i.uren, 0).toFixed(1)}{" "}
                uur door {[...new Set(items.map((i) => i.medewerker))].length}{" "}
                medewerker(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medewerker</TableHead>
                    <TableHead className="text-right">Uren</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Notities</TableHead>
                    <TableHead>Bron</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">
                        {item.medewerker}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.uren.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        {item.scope ? (
                          <Badge variant="outline">
                            {scopeLabels[item.scope] || item.scope}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.notities || undefined}>
                        {item.notities || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.bron === "import"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {item.bron === "import"
                            ? "Import"
                            : "Handmatig"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                onDeleteItem({
                                  type: "uren",
                                  id: item._id,
                                });
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Clock className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">
          Begin met registreren
        </h3>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
          Registreer de gewerkte uren voor dit project. Dit is nodig voor de nacalculatie.
        </p>

        {/* Quick tips */}
        <div className="mt-6 w-full max-w-md space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Tip: Snelle invoer</p>
              <p className="text-muted-foreground">
                Gebruik de snelkeuze knoppen voor veelvoorkomende uren (4, 6, 8 uur) en datums (vandaag, gisteren).
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button
            onClick={onShowUrenForm}
            className="flex-1"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Uren registreren
          </Button>
          <UrenImport onImport={onImport} isImporting={isImporting} />
        </div>
      </CardContent>
    </Card>
  );
}
