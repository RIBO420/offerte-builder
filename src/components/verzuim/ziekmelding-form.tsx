"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

// ============================================
// ZiekmeldingForm
// ============================================

const ziekmeldingSchema = z.object({
  medewerkerId: z.string().min(1, "Selecteer een medewerker"),
  startDatum: z.string().min(1, "Vul een startdatum in"),
  reden: z.string().optional(),
  notities: z.string().optional(),
});

type ZiekmeldingFormData = z.infer<typeof ziekmeldingSchema>;

interface ZiekmeldingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ZiekmeldingForm({ open, onOpenChange }: ZiekmeldingFormProps) {
  const { user } = useCurrentUser();
  const ziekmelden = useMutation(api.verzuim.ziekmelden);
  const [isLoading, setIsLoading] = useState(false);
  const medewerkers = useQuery(
    api.medewerkers.list,
    user?._id ? { isActief: true } : "skip"
  );
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  const form = useForm<ZiekmeldingFormData>({
    resolver: zodResolver(ziekmeldingSchema),
    defaultValues: {
      medewerkerId: "",
      startDatum: new Date().toISOString().split("T")[0],
      reden: "",
      notities: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        medewerkerId: "",
        startDatum: new Date().toISOString().split("T")[0],
        reden: "",
        notities: "",
      });
    }
  }, [open, form]);

  const handleFormSubmit = async (data: ZiekmeldingFormData) => {
    setIsLoading(true);
    try {
      await ziekmelden({
        medewerkerId: data.medewerkerId as Id<"medewerkers">,
        startDatum: data.startDatum,
        reden: data.reden || undefined,
        notities: data.notities || undefined,
      });
      showSuccessToast("Ziekmelding geregistreerd");
      onOpenChange(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Er is een fout opgetreden"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Ziekmelding registreren</DialogTitle>
          <DialogDescription className="sr-only">
            Formulier voor het registreren van een ziekmelding
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="medewerkerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medewerker</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer medewerker" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {medewerkersList.map((m) => (
                        <SelectItem key={m._id} value={m._id}>
                          {m.naam}
                          {m.functie ? ` — ${m.functie}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDatum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eerste ziektedag</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reden"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reden (optioneel)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Bijv. griep, rugklachten..."
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Let op: medische details zijn privacy-gevoelig.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notities (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Interne notities..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Ziekmelden
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// HerstelmeldingForm
// ============================================

const herstelmeldingSchema = z.object({
  herstelDatum: z.string().min(1, "Vul een hersteldatum in"),
  notities: z.string().optional(),
});

type HerstelmeldingFormData = z.infer<typeof herstelmeldingSchema>;

interface HerstelmeldingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verzuimId: Id<"verzuimregistraties"> | null;
  medewerkerNaam: string;
}

export function HerstelmeldingForm({
  open,
  onOpenChange,
  verzuimId,
  medewerkerNaam,
}: HerstelmeldingFormProps) {
  const herstelmelden = useMutation(api.verzuim.herstelmelden);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<HerstelmeldingFormData>({
    resolver: zodResolver(herstelmeldingSchema),
    defaultValues: {
      herstelDatum: new Date().toISOString().split("T")[0],
      notities: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        herstelDatum: new Date().toISOString().split("T")[0],
        notities: "",
      });
    }
  }, [open, form]);

  const handleFormSubmit = async (data: HerstelmeldingFormData) => {
    if (!verzuimId) return;
    setIsLoading(true);
    try {
      await herstelmelden({
        id: verzuimId,
        herstelDatum: data.herstelDatum,
        notities: data.notities || undefined,
      });
      showSuccessToast("Herstelmelding geregistreerd");
      onOpenChange(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Er is een fout opgetreden"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Herstelmelding — {medewerkerNaam}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulier voor het melden van herstel
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="herstelDatum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hersteldatum</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notities (optioneel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Opmerkingen bij herstel..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Hersteld melden
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
