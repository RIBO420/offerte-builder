"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "./utils";

interface Machine {
  _id: string;
  naam: string;
  tarief: number;
  tariefType: string;
}

interface MachineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMachine: string;
  onSelectedMachineChange: (value: string) => void;
  machineDate: string;
  onMachineDateChange: (value: string) => void;
  machineUren: string;
  onMachineUrenChange: (value: string) => void;
  onSubmit: () => void;
  isSaving: boolean;
  machines: Machine[];
}

export function MachineFormDialog({
  open,
  onOpenChange,
  selectedMachine,
  onSelectedMachineChange,
  machineDate,
  onMachineDateChange,
  machineUren,
  onMachineUrenChange,
  onSubmit,
  isSaving,
  machines,
}: MachineFormDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Machine gebruik registreren</AlertDialogTitle>
          <AlertDialogDescription>
            Registreer het gebruik van een machine voor dit project
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Machine</label>
            <Select value={selectedMachine} onValueChange={onSelectedMachineChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine._id} value={machine._id}>
                    {machine.naam} ({formatCurrency(machine.tarief)}/
                    {machine.tariefType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Datum</label>
            <input
              type="date"
              value={machineDate}
              onChange={(e) => onMachineDateChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Uren gebruikt</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={machineUren}
              onChange={(e) => onMachineUrenChange(e.target.value)}
              placeholder="8"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Toevoegen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
