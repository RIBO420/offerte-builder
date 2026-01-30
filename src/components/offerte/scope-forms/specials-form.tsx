"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { Sparkles, Plus, Trash2 } from "lucide-react";
import { specialsSchema, type SpecialsFormData } from "@/lib/validations/aanleg-scopes";
import type { SpecialsData } from "@/types/offerte";

interface SpecialsFormProps {
  data: SpecialsData;
  onChange: (data: SpecialsData) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
}

type SpecialItemType = "jacuzzi" | "sauna" | "prefab";

export function SpecialsForm({ data, onChange, onValidationChange }: SpecialsFormProps) {
  const [newItemType, setNewItemType] = useState<SpecialItemType>("prefab");
  const [newItemOmschrijving, setNewItemOmschrijving] = useState("");

  const form = useForm<SpecialsFormData>({
    resolver: zodResolver(specialsSchema),
    defaultValues: data,
    mode: "onBlur",
  });

  const { formState: { errors, isValid }, watch, control } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  // Watch for changes and sync with parent
  useEffect(() => {
    const subscription = watch((values) => {
      if (values.items !== undefined) {
        onChange({
          items: (values.items ?? []).map(item => ({
            type: item?.type ?? "prefab",
            omschrijving: item?.omschrijving ?? "",
          })),
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Notify parent of validation state changes (only when errors object changes)
  useEffect(() => {
    if (onValidationChange) {
      const errorMessages: Record<string, string> = {};
      if (errors.items) {
        if (errors.items.message) {
          errorMessages["items"] = errors.items.message;
        }
        if (Array.isArray(errors.items)) {
          errors.items.forEach((itemError, index) => {
            if (itemError?.type?.message) {
              errorMessages[`items.${index}.type`] = itemError.type.message;
            }
            if (itemError?.omschrijving?.message) {
              errorMessages[`items.${index}.omschrijving`] = itemError.omschrijving.message;
            }
          });
        }
      }
      onValidationChange(isValid, errorMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(errors), isValid]);

  const addItem = () => {
    if (!newItemOmschrijving.trim()) return;
    append({
      type: newItemType,
      omschrijving: newItemOmschrijving.trim(),
    });
    setNewItemOmschrijving("");
  };

  const getTypeLabel = (type: SpecialItemType) => {
    switch (type) {
      case "jacuzzi":
        return "Jacuzzi";
      case "sauna":
        return "Sauna";
      case "prefab":
        return "Prefab element";
      default:
        return type;
    }
  };

  return (
    <Form {...form}>
      <form>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Specials</CardTitle>
            </div>
            <CardDescription>
              Bijzondere elementen zoals jacuzzi, sauna of prefab constructies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bestaande items */}
            {fields.length > 0 && (
              <div className="space-y-3">
                <FormLabel>Toegevoegde items</FormLabel>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                          {getTypeLabel(field.type)}
                        </span>
                        <span className="text-sm">{field.omschrijving}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation message for items array */}
            {errors.items?.message && (
              <p className="text-sm text-destructive">{errors.items.message}</p>
            )}

            {/* Nieuw item toevoegen */}
            <div className="space-y-4 rounded-lg border border-dashed p-4">
              <FormLabel className="text-base font-medium">Nieuw item toevoegen</FormLabel>
              <div className="grid gap-4 md:grid-cols-2">
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={newItemType}
                    onValueChange={(v) => setNewItemType(v as SpecialItemType)}
                  >
                    <FormControl>
                      <SelectTrigger id="special-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="jacuzzi">Jacuzzi</SelectItem>
                      <SelectItem value="sauna">Sauna</SelectItem>
                      <SelectItem value="prefab">Prefab element</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>

                <FormItem>
                  <FormLabel>Omschrijving</FormLabel>
                  <FormControl>
                    <Input
                      id="special-omschrijving"
                      value={newItemOmschrijving}
                      onChange={(e) => setNewItemOmschrijving(e.target.value)}
                      placeholder="Bijv. 'Lay-Z-Spa Helsinki'"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addItem();
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                disabled={!newItemOmschrijving.trim()}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Item toevoegen
              </Button>
            </div>

            {fields.length === 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                Voeg bijzondere elementen toe die alleen plaatsing en voorbereiding vereisen.
                De kosten voor materiaal/aanschaf worden apart gespecificeerd.
              </div>
            )}

            {fields.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <div className="font-medium mb-1">Inbegrepen per item:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Voorbereiding ondergrond</li>
                  <li>Plaatsingsuren</li>
                  <li>Aansluiten (indien van toepassing)</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
