"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Trash2,
  CalendarIcon,
  Building2,
  FolderKanban,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { nanoid } from "nanoid";

// Currency formatter
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

// Zod schema for form validation
const regelSchema = z.object({
  id: z.string(),
  productId: z.string().optional(),
  omschrijving: z.string().min(1, "Omschrijving is verplicht"),
  hoeveelheid: z.number().min(0.01, "Hoeveelheid moet groter dan 0 zijn"),
  eenheid: z.string().min(1, "Eenheid is verplicht"),
  prijsPerEenheid: z.number().min(0, "Prijs moet 0 of hoger zijn"),
  totaal: z.number(),
});

const formSchema = z.object({
  leverancierId: z.string().min(1, "Selecteer een leverancier"),
  projectId: z.string().optional(),
  verwachteLevertijd: z.date().optional(),
  notities: z.string().optional(),
  regels: z.array(regelSchema).min(1, "Voeg minimaal 1 regel toe"),
});

type FormData = z.infer<typeof formSchema>;

interface InkooporderFormProps {
  mode: "create" | "edit";
  inkooporderId?: Id<"inkooporders">;
  defaultValues?: Partial<FormData>;
}

export function InkooporderForm({
  mode,
  inkooporderId,
  defaultValues,
}: InkooporderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const leveranciers = useQuery(api.leveranciers.list, {});
  const projecten = useQuery(api.projecten.list, {});
  const producten = useQuery(api.producten.list, {});

  // Mutations
  const createInkooporder = useMutation(api.inkooporders.create);
  const updateInkooporder = useMutation(api.inkooporders.update);

  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leverancierId: defaultValues?.leverancierId || "",
      projectId: defaultValues?.projectId || "",
      verwachteLevertijd: defaultValues?.verwachteLevertijd,
      notities: defaultValues?.notities || "",
      regels: defaultValues?.regels || [
        {
          id: nanoid(),
          omschrijving: "",
          hoeveelheid: 1,
          eenheid: "stuk",
          prijsPerEenheid: 0,
          totaal: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "regels",
  });

  // Calculate total
  const totaal = useMemo(() => {
    const regels = form.watch("regels");
    return regels.reduce((sum, regel) => sum + (regel.totaal || 0), 0);
  }, [form.watch("regels")]);

  // Update regel totaal when hoeveelheid or prijs changes
  const updateRegelTotaal = useCallback(
    (index: number, hoeveelheid: number, prijsPerEenheid: number) => {
      const totaal = hoeveelheid * prijsPerEenheid;
      form.setValue(`regels.${index}.totaal`, totaal);
    },
    [form]
  );

  // Add new regel
  const addRegel = useCallback(() => {
    append({
      id: nanoid(),
      omschrijving: "",
      hoeveelheid: 1,
      eenheid: "stuk",
      prijsPerEenheid: 0,
      totaal: 0,
    });
  }, [append]);

  // Select product from prijsboek
  const selectProduct = useCallback(
    (index: number, productId: string) => {
      const product = producten?.find((p) => p._id === productId);
      if (product) {
        form.setValue(`regels.${index}.productId`, productId);
        form.setValue(`regels.${index}.omschrijving`, product.productnaam);
        form.setValue(`regels.${index}.eenheid`, product.eenheid);
        form.setValue(`regels.${index}.prijsPerEenheid`, product.inkoopprijs);
        const hoeveelheid = form.getValues(`regels.${index}.hoeveelheid`);
        form.setValue(`regels.${index}.totaal`, hoeveelheid * product.inkoopprijs);
      }
    },
    [form, producten]
  );

  // Submit handler
  const onSubmit = async (data: FormData) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Transform regels for API
      const regels = data.regels.map((regel) => ({
        id: regel.id,
        productId: regel.productId ? (regel.productId as Id<"producten">) : undefined,
        omschrijving: regel.omschrijving,
        hoeveelheid: regel.hoeveelheid,
        eenheid: regel.eenheid,
        prijsPerEenheid: regel.prijsPerEenheid,
        totaal: regel.totaal,
      }));

      if (mode === "create") {
        const id = await createInkooporder({
          leverancierId: data.leverancierId as Id<"leveranciers">,
          projectId: data.projectId ? (data.projectId as Id<"projecten">) : undefined,
          regels,
          notities: data.notities,
          verwachteLevertijd: data.verwachteLevertijd?.getTime(),
        });
        toast.success("Inkooporder aangemaakt");
        router.push(`/inkoop/${id}`);
      } else if (mode === "edit" && inkooporderId) {
        await updateInkooporder({
          id: inkooporderId,
          leverancierId: data.leverancierId as Id<"leveranciers">,
          projectId: data.projectId ? (data.projectId as Id<"projecten">) : undefined,
          regels,
          notities: data.notities,
          verwachteLevertijd: data.verwachteLevertijd?.getTime(),
        });
        toast.success("Inkooporder bijgewerkt");
        router.push(`/inkoop/${inkooporderId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Er ging iets mis";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = leveranciers === undefined || projecten === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Leverancier & Project Selection */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Leverancier
              </CardTitle>
              <CardDescription>Selecteer de leverancier voor deze order</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="leverancierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leverancier *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer leverancier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leveranciers && Array.isArray(leveranciers) && leveranciers.map((lev) => (
                          <SelectItem key={lev._id} value={lev._id}>
                            {lev.naam}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5" />
                Project
              </CardTitle>
              <CardDescription>Optioneel: koppel aan een project</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer project (optioneel)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Geen project</SelectItem>
                        {projecten?.map((proj) => (
                          <SelectItem key={proj._id} value={proj._id}>
                            {proj.naam}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Koppel de inkooporder aan een project voor betere tracking
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        {/* Expected Delivery */}
        <Card>
          <CardHeader>
            <CardTitle>Leveringsdetails</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="verwachteLevertijd"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Verwachte leverdatum</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "d MMMM yyyy", { locale: nl })
                          ) : (
                            <span>Selecteer datum</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notities</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Eventuele opmerkingen voor de leverancier..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Order Lines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Orderregels
                </CardTitle>
                <CardDescription>Voeg producten toe aan de inkooporder</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addRegel}>
                <Plus className="mr-2 h-4 w-4" />
                Regel toevoegen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Product</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead className="w-[100px]">Aantal</TableHead>
                    <TableHead className="w-[100px]">Eenheid</TableHead>
                    <TableHead className="w-[120px]">Prijs/eenheid</TableHead>
                    <TableHead className="w-[120px] text-right">Totaal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Select
                          value={form.watch(`regels.${index}.productId`) || ""}
                          onValueChange={(value) => selectProduct(index, value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Uit prijsboek..." />
                          </SelectTrigger>
                          <SelectContent>
                            {producten?.map((product) => (
                              <SelectItem key={product._id} value={product._id}>
                                {product.productnaam}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`regels.${index}.omschrijving`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Omschrijving"
                                  className="h-9"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`regels.${index}.hoeveelheid`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  {...field}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    const prijs = form.getValues(
                                      `regels.${index}.prijsPerEenheid`
                                    );
                                    updateRegelTotaal(index, value, prijs);
                                  }}
                                  className="h-9"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`regels.${index}.eenheid`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="stuk">stuk</SelectItem>
                                    <SelectItem value="m2">m2</SelectItem>
                                    <SelectItem value="m3">m3</SelectItem>
                                    <SelectItem value="m1">m1</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="liter">liter</SelectItem>
                                    <SelectItem value="pallet">pallet</SelectItem>
                                    <SelectItem value="zak">zak</SelectItem>
                                    <SelectItem value="doos">doos</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`regels.${index}.prijsPerEenheid`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  {...field}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    field.onChange(value);
                                    const hoeveelheid = form.getValues(
                                      `regels.${index}.hoeveelheid`
                                    );
                                    updateRegelTotaal(index, hoeveelheid, value);
                                  }}
                                  className="h-9"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(form.watch(`regels.${index}.totaal`) || 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      Totaal
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      {formatCurrency(totaal)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {form.formState.errors.regels?.message && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.regels.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Annuleren
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Inkooporder aanmaken" : "Wijzigingen opslaan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default InkooporderForm;
