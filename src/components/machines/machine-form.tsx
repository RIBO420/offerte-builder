"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X } from "lucide-react";

// All available scopes
const availableScopes = [
  // Aanleg scopes
  { id: "grondwerk", label: "Grondwerk", category: "aanleg" },
  { id: "bestrating", label: "Bestrating", category: "aanleg" },
  { id: "borders", label: "Borders", category: "aanleg" },
  { id: "gras", label: "Gazon", category: "aanleg" },
  { id: "houtwerk", label: "Houtwerk", category: "aanleg" },
  { id: "water_elektra", label: "Water/Elektra", category: "aanleg" },
  { id: "specials", label: "Specials", category: "aanleg" },
  // Onderhoud scopes
  { id: "gras_onderhoud", label: "Gras Onderhoud", category: "onderhoud" },
  { id: "borders_onderhoud", label: "Borders Onderhoud", category: "onderhoud" },
  { id: "heggen", label: "Heggen", category: "onderhoud" },
  { id: "bomen", label: "Bomen", category: "onderhoud" },
  { id: "overig", label: "Overig", category: "onderhoud" },
];

export interface MachineFormData {
  naam: string;
  type: "intern" | "extern";
  tarief: number;
  tariefType: "uur" | "dag";
  gekoppeldeScopes: string[];
}

interface Machine extends MachineFormData {
  _id: string;
  isActief: boolean;
}

// Zod schema
const machineFormSchema = z.object({
  naam: z.string().min(1, "Naam is verplicht"),
  type: z.enum(["intern", "extern"]),
  tarief: z.number().min(0, "Tarief moet 0 of hoger zijn"),
  tariefType: z.enum(["uur", "dag"]),
  gekoppeldeScopes: z.array(z.string()),
});

type MachineFormSchemaData = z.infer<typeof machineFormSchema>;

interface MachineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine?: Machine | null;
  onSubmit: (data: MachineFormData) => Promise<void>;
  isLoading?: boolean;
}

const defaultFormData: MachineFormSchemaData = {
  naam: "",
  type: "intern",
  tarief: 0,
  tariefType: "dag",
  gekoppeldeScopes: [],
};

export function MachineForm({
  open,
  onOpenChange,
  machine,
  onSubmit,
  isLoading = false,
}: MachineFormProps) {
  const form = useForm<MachineFormSchemaData>({
    resolver: zodResolver(machineFormSchema),
    defaultValues: defaultFormData,
  });

  // Reset form when dialog opens/closes or machine changes
  useEffect(() => {
    if (machine) {
      setTimeout(
        () =>
          form.reset({
            naam: machine.naam,
            type: machine.type,
            tarief: machine.tarief,
            tariefType: machine.tariefType,
            gekoppeldeScopes: machine.gekoppeldeScopes,
          }),
        0
      );
    } else {
      setTimeout(() => form.reset(defaultFormData), 0);
    }
  }, [machine, open, form]);

  const handleFormSubmit = async (data: MachineFormSchemaData) => {
    await onSubmit(data);
  };

  const toggleScope = (scopeId: string) => {
    const current = form.getValues("gekoppeldeScopes");
    const newScopes = current.includes(scopeId)
      ? current.filter((s) => s !== scopeId)
      : [...current, scopeId];
    form.setValue("gekoppeldeScopes", newScopes);
  };

  const removeScope = (scopeId: string) => {
    const current = form.getValues("gekoppeldeScopes");
    form.setValue(
      "gekoppeldeScopes",
      current.filter((s) => s !== scopeId)
    );
  };

  const gekoppeldeScopes = form.watch("gekoppeldeScopes");
  const tariefType = form.watch("tariefType");

  const aanlegScopes = availableScopes.filter((s) => s.category === "aanleg");
  const onderhoudScopes = availableScopes.filter(
    (s) => s.category === "onderhoud"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {machine ? "Machine bewerken" : "Nieuwe machine"}
          </DialogTitle>
          <DialogDescription>
            {machine
              ? "Pas de gegevens van de machine aan"
              : "Voeg een machine toe aan je machinepark"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)}>
            <div className="grid gap-4 py-4">
              {/* Naam */}
              <FormField
                control={form.control}
                name="naam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naam</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Bijv. Minikraan, Trilplaat"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Type en Tarief Type */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="intern">Intern (eigen)</SelectItem>
                          <SelectItem value="extern">Extern (huur)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === "intern"
                          ? "Eigen materieel"
                          : "Gehuurd materieel"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tariefType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tarief type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="uur">Per uur</SelectItem>
                          <SelectItem value="dag">Per dag</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tarief */}
              <FormField
                control={form.control}
                name="tarief"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Tarief ({tariefType === "uur" ? "per uur" : "per dag"})
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">
                          &euro;
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-7"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gekoppelde Scopes */}
              <div className="grid gap-2">
                <FormLabel>Gekoppelde scopes</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Selecteer de werkzaamheden waarvoor deze machine automatisch
                  wordt voorgesteld
                </p>

                {/* Selected scopes */}
                {gekoppeldeScopes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {gekoppeldeScopes.map((scopeId) => {
                      const scope = availableScopes.find((s) => s.id === scopeId);
                      return (
                        <Badge
                          key={scopeId}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeScope(scopeId)}
                        >
                          {scope?.label || scopeId}
                          <X className="ml-1 h-3 w-3" />
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Aanleg scopes */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Aanleg
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {aanlegScopes.map((scope) => (
                      <div key={scope.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`scope-${scope.id}`}
                          checked={gekoppeldeScopes.includes(scope.id)}
                          onCheckedChange={() => toggleScope(scope.id)}
                        />
                        <label
                          htmlFor={`scope-${scope.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {scope.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Onderhoud scopes */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Onderhoud
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {onderhoudScopes.map((scope) => (
                      <div key={scope.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`scope-${scope.id}`}
                          checked={gekoppeldeScopes.includes(scope.id)}
                          onCheckedChange={() => toggleScope(scope.id)}
                        />
                        <label
                          htmlFor={`scope-${scope.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {scope.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {machine ? "Bijwerken" : "Toevoegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
