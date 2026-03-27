"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  MapPin,
  User,
  Zap,
  Droplet,
  Bath,
  AlertTriangle,
  Key,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";

type Werklocatie = {
  _id: Id<"werklocaties">;
  _creationTime: number;
  userId: Id<"users">;
  projectId: Id<"projecten">;
  adres: string;
  postcode: string;
  plaats: string;
  coordinates?: { lat: number; lng: number };
  toegangInstructies?: string;
  parkeerInfo?: string;
  sleutelInfo?: string;
  contactOpLocatie?: { naam?: string; telefoon?: string };
  waterAansluiting?: boolean;
  stroomAansluiting?: boolean;
  toiletBeschikbaar?: boolean;
  veiligheidsNotities?: string;
  bijzonderheden?: string;
  fotos?: Array<{
    url: string;
    beschrijving?: string;
    type?: "voor" | "tijdens" | "na";
    createdAt: number;
  }>;
  createdAt: number;
  updatedAt: number;
};

// Zod schema
const werklocatieFormSchema = z.object({
  adres: z.string().min(1, "Adres is verplicht"),
  postcode: z.string().min(1, "Postcode is verplicht"),
  plaats: z.string().min(1, "Plaats is verplicht"),
  toegangInstructies: z.string().optional(),
  parkeerInfo: z.string().optional(),
  sleutelInfo: z.string().optional(),
  contactNaam: z.string().optional(),
  contactTelefoon: z.string().optional(),
  waterAansluiting: z.boolean(),
  stroomAansluiting: z.boolean(),
  toiletBeschikbaar: z.boolean(),
  veiligheidsNotities: z.string().optional(),
  bijzonderheden: z.string().optional(),
});

type WerklocatieFormData = z.infer<typeof werklocatieFormSchema>;

interface WerklocatieFormProps {
  projectId: Id<"projecten">;
  werklocatie?: Werklocatie | null;
  onSuccess?: () => void;
}

export function WerklocatieForm({
  projectId,
  werklocatie,
  onSuccess,
}: WerklocatieFormProps) {
  const isEditing = !!werklocatie;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mutations
  const createWerklocatie = useMutation(api.werklocaties.create);
  const updateWerklocatie = useMutation(api.werklocaties.update);
  const deleteWerklocatie = useMutation(api.werklocaties.remove);

  const form = useForm<WerklocatieFormData>({
    resolver: zodResolver(werklocatieFormSchema),
    defaultValues: {
      adres: werklocatie?.adres ?? "",
      postcode: werklocatie?.postcode ?? "",
      plaats: werklocatie?.plaats ?? "",
      toegangInstructies: werklocatie?.toegangInstructies ?? "",
      parkeerInfo: werklocatie?.parkeerInfo ?? "",
      sleutelInfo: werklocatie?.sleutelInfo ?? "",
      contactNaam: werklocatie?.contactOpLocatie?.naam ?? "",
      contactTelefoon: werklocatie?.contactOpLocatie?.telefoon ?? "",
      waterAansluiting: werklocatie?.waterAansluiting ?? false,
      stroomAansluiting: werklocatie?.stroomAansluiting ?? false,
      toiletBeschikbaar: werklocatie?.toiletBeschikbaar ?? false,
      veiligheidsNotities: werklocatie?.veiligheidsNotities ?? "",
      bijzonderheden: werklocatie?.bijzonderheden ?? "",
    },
  });

  const handleFormSubmit = async (data: WerklocatieFormData) => {
    setIsSubmitting(true);

    try {
      if (isEditing && werklocatie) {
        await updateWerklocatie({
          id: werklocatie._id,
          adres: data.adres,
          postcode: data.postcode,
          plaats: data.plaats,
          toegangInstructies: data.toegangInstructies || undefined,
          parkeerInfo: data.parkeerInfo || undefined,
          sleutelInfo: data.sleutelInfo || undefined,
          contactOpLocatie:
            data.contactNaam || data.contactTelefoon
              ? {
                  naam: data.contactNaam || undefined,
                  telefoon: data.contactTelefoon || undefined,
                }
              : undefined,
          waterAansluiting: data.waterAansluiting,
          stroomAansluiting: data.stroomAansluiting,
          toiletBeschikbaar: data.toiletBeschikbaar,
          veiligheidsNotities: data.veiligheidsNotities || undefined,
          bijzonderheden: data.bijzonderheden || undefined,
        });
        showSuccessToast("Werklocatie bijgewerkt");
      } else {
        await createWerklocatie({
          projectId,
          adres: data.adres,
          postcode: data.postcode,
          plaats: data.plaats,
          toegangInstructies: data.toegangInstructies || undefined,
          parkeerInfo: data.parkeerInfo || undefined,
          sleutelInfo: data.sleutelInfo || undefined,
          contactOpLocatie:
            data.contactNaam || data.contactTelefoon
              ? {
                  naam: data.contactNaam || undefined,
                  telefoon: data.contactTelefoon || undefined,
                }
              : undefined,
          waterAansluiting: data.waterAansluiting,
          stroomAansluiting: data.stroomAansluiting,
          toiletBeschikbaar: data.toiletBeschikbaar,
          veiligheidsNotities: data.veiligheidsNotities || undefined,
          bijzonderheden: data.bijzonderheden || undefined,
        });
        showSuccessToast("Werklocatie toegevoegd");
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving werklocatie:", error);
      showErrorToast("Er ging iets mis bij het opslaan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!werklocatie) return;

    if (!confirm("Weet je zeker dat je deze werklocatie wilt verwijderen?")) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteWerklocatie({ id: werklocatie._id });
      showSuccessToast("Werklocatie verwijderd");
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting werklocatie:", error);
      showErrorToast("Er ging iets mis bij het verwijderen");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Adres sectie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            Adresgegevens
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="adres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adres *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Straatnaam 123" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="postcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postcode *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="1234 AB" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plaats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plaats *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Amsterdam" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Voorzieningen sectie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" />
            Voorzieningen
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="stroomAansluiting"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <FormLabel htmlFor="stroom" className="cursor-pointer">
                      Stroom
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      id="stroom"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
              )}
            />
            <FormField
              control={form.control}
              name="waterAansluiting"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-blue-600" />
                    <FormLabel htmlFor="water" className="cursor-pointer">
                      Water
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      id="water"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
              )}
            />
            <FormField
              control={form.control}
              name="toiletBeschikbaar"
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Bath className="h-4 w-4 text-green-600" />
                    <FormLabel htmlFor="toilet" className="cursor-pointer">
                      Toilet
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      id="toilet"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Toegang sectie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Key className="h-4 w-4" />
            Toegang
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="toegangInstructies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Toegangsinstructies</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Bijv. bel aan bij nr. 123, poort code is 1234..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parkeerInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parkeerinformatie</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Bijv. parkeren op oprit, blauwe zone max 2 uur..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="sleutelInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sleutelinformatie</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Bijv. sleutel bij buurman nr. 125"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Contact sectie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Contact op locatie
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="contactNaam"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Naam contactpersoon" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactTelefoon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefoon</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="06-12345678"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Veiligheid sectie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            Veiligheid
          </div>
          <FormField
            control={form.control}
            name="veiligheidsNotities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Veiligheidsnotities</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Bijv. Let op hond, lage takken, ongelijk terrein..."
                    rows={2}
                    className="border-amber-200 focus:border-amber-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Bijzonderheden sectie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Bijzonderheden
          </div>
          <FormField
            control={form.control}
            name="bijzonderheden"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Overige opmerkingen over de locatie..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {isEditing && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verwijderen...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Verwijderen
                </>
              )}
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button type="submit" disabled={isSubmitting || isDeleting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opslaan...
                </>
              ) : isEditing ? (
                "Wijzigingen opslaan"
              ) : (
                "Werklocatie toevoegen"
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
