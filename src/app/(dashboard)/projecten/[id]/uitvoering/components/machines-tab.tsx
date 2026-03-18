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
  Wrench,
  MoreHorizontal,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { formatCurrency, formatDate } from "./utils";

interface MachineUsageItem {
  _id: string;
  datum: string;
  uren: number;
  kosten: number;
  machine?: {
    naam: string;
    type?: string;
  } | null;
}

interface MachinesTabProps {
  isLoading: boolean | null | undefined;
  machineUsage: MachineUsageItem[];
  onShowMachineForm: () => void;
  onDeleteItem: (item: { type: "uren" | "machine"; id: string }) => void;
}

export function MachinesTab({
  isLoading,
  machineUsage,
  onShowMachineForm,
  onDeleteItem,
}: MachinesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onShowMachineForm}>
          <Plus className="mr-2 h-4 w-4" />
          Machine gebruik toevoegen
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : machineUsage.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Machine gebruik</CardTitle>
            <CardDescription>
              Overzicht van ingezette machines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Machine</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Uren</TableHead>
                  <TableHead className="text-right">Kosten</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machineUsage.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {item.machine?.naam || "Onbekende machine"}
                        </span>
                        {item.machine?.type && (
                          <Badge variant="outline" className="text-xs">
                            {item.machine.type}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.datum)}</TableCell>
                    <TableCell className="text-right">
                      {item.uren.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.kosten)}
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
                                type: "machine",
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
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">
              Geen machine gebruik
            </h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              Registreer het gebruik van machines voor dit project.
            </p>
            <Button
              className="mt-6"
              onClick={onShowMachineForm}
            >
              <Plus className="mr-2 h-4 w-4" />
              Machine gebruik toevoegen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
