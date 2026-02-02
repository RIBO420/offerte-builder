"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "sonner";

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

  // Form state
  const [adres, setAdres] = useState(werklocatie?.adres ?? "");
  const [postcode, setPostcode] = useState(werklocatie?.postcode ?? "");
  const [plaats, setPlaats] = useState(werklocatie?.plaats ?? "");
  const [toegangInstructies, setToegangInstructies] = useState(
    werklocatie?.toegangInstructies ?? ""
  );
  const [parkeerInfo, setParkeerInfo] = useState(werklocatie?.parkeerInfo ?? "");
  const [sleutelInfo, setSleutelInfo] = useState(werklocatie?.sleutelInfo ?? "");
  const [contactNaam, setContactNaam] = useState(
    werklocatie?.contactOpLocatie?.naam ?? ""
  );
  const [contactTelefoon, setContactTelefoon] = useState(
    werklocatie?.contactOpLocatie?.telefoon ?? ""
  );
  const [waterAansluiting, setWaterAansluiting] = useState(
    werklocatie?.waterAansluiting ?? false
  );
  const [stroomAansluiting, setStroomAansluiting] = useState(
    werklocatie?.stroomAansluiting ?? false
  );
  const [toiletBeschikbaar, setToiletBeschikbaar] = useState(
    werklocatie?.toiletBeschikbaar ?? false
  );
  const [veiligheidsNotities, setVeiligheidsNotities] = useState(
    werklocatie?.veiligheidsNotities ?? ""
  );
  const [bijzonderheden, setBijzonderheden] = useState(
    werklocatie?.bijzonderheden ?? ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mutations
  const createWerklocatie = useMutation(api.werklocaties.create);
  const updateWerklocatie = useMutation(api.werklocaties.update);
  const deleteWerklocatie = useMutation(api.werklocaties.remove);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adres.trim() || !postcode.trim() || !plaats.trim()) {
      toast.error("Vul minimaal adres, postcode en plaats in");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && werklocatie) {
        await updateWerklocatie({
          id: werklocatie._id,
          adres,
          postcode,
          plaats,
          toegangInstructies: toegangInstructies || undefined,
          parkeerInfo: parkeerInfo || undefined,
          sleutelInfo: sleutelInfo || undefined,
          contactOpLocatie:
            contactNaam || contactTelefoon
              ? {
                  naam: contactNaam || undefined,
                  telefoon: contactTelefoon || undefined,
                }
              : undefined,
          waterAansluiting,
          stroomAansluiting,
          toiletBeschikbaar,
          veiligheidsNotities: veiligheidsNotities || undefined,
          bijzonderheden: bijzonderheden || undefined,
        });
        toast.success("Werklocatie bijgewerkt");
      } else {
        await createWerklocatie({
          projectId,
          adres,
          postcode,
          plaats,
          toegangInstructies: toegangInstructies || undefined,
          parkeerInfo: parkeerInfo || undefined,
          sleutelInfo: sleutelInfo || undefined,
          contactOpLocatie:
            contactNaam || contactTelefoon
              ? {
                  naam: contactNaam || undefined,
                  telefoon: contactTelefoon || undefined,
                }
              : undefined,
          waterAansluiting,
          stroomAansluiting,
          toiletBeschikbaar,
          veiligheidsNotities: veiligheidsNotities || undefined,
          bijzonderheden: bijzonderheden || undefined,
        });
        toast.success("Werklocatie toegevoegd");
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving werklocatie:", error);
      toast.error("Er ging iets mis bij het opslaan");
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
      toast.success("Werklocatie verwijderd");
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting werklocatie:", error);
      toast.error("Er ging iets mis bij het verwijderen");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Adres sectie */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          Adresgegevens
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="adres">Adres *</Label>
            <Input
              id="adres"
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              placeholder="Straatnaam 123"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode *</Label>
            <Input
              id="postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="1234 AB"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plaats">Plaats *</Label>
            <Input
              id="plaats"
              value={plaats}
              onChange={(e) => setPlaats(e.target.value)}
              placeholder="Amsterdam"
              required
            />
          </div>
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              <Label htmlFor="stroom" className="cursor-pointer">
                Stroom
              </Label>
            </div>
            <Switch
              id="stroom"
              checked={stroomAansluiting}
              onCheckedChange={setStroomAansluiting}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Droplet className="h-4 w-4 text-blue-600" />
              <Label htmlFor="water" className="cursor-pointer">
                Water
              </Label>
            </div>
            <Switch
              id="water"
              checked={waterAansluiting}
              onCheckedChange={setWaterAansluiting}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Bath className="h-4 w-4 text-green-600" />
              <Label htmlFor="toilet" className="cursor-pointer">
                Toilet
              </Label>
            </div>
            <Switch
              id="toilet"
              checked={toiletBeschikbaar}
              onCheckedChange={setToiletBeschikbaar}
            />
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="toegang">Toegangsinstructies</Label>
            <Textarea
              id="toegang"
              value={toegangInstructies}
              onChange={(e) => setToegangInstructies(e.target.value)}
              placeholder="Bijv. bel aan bij nr. 123, poort code is 1234..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parkeren">Parkeerinformatie</Label>
            <Textarea
              id="parkeren"
              value={parkeerInfo}
              onChange={(e) => setParkeerInfo(e.target.value)}
              placeholder="Bijv. parkeren op oprit, blauwe zone max 2 uur..."
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sleutel">Sleutelinformatie</Label>
            <Input
              id="sleutel"
              value={sleutelInfo}
              onChange={(e) => setSleutelInfo(e.target.value)}
              placeholder="Bijv. sleutel bij buurman nr. 125"
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
          <div className="space-y-2">
            <Label htmlFor="contactNaam">Naam</Label>
            <Input
              id="contactNaam"
              value={contactNaam}
              onChange={(e) => setContactNaam(e.target.value)}
              placeholder="Naam contactpersoon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactTelefoon">Telefoon</Label>
            <Input
              id="contactTelefoon"
              type="tel"
              value={contactTelefoon}
              onChange={(e) => setContactTelefoon(e.target.value)}
              placeholder="06-12345678"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Veiligheid sectie */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Veiligheid
        </div>
        <div className="space-y-2">
          <Label htmlFor="veiligheid">Veiligheidsnotities</Label>
          <Textarea
            id="veiligheid"
            value={veiligheidsNotities}
            onChange={(e) => setVeiligheidsNotities(e.target.value)}
            placeholder="Bijv. Let op hond, lage takken, ongelijk terrein..."
            rows={2}
            className="border-amber-200 focus:border-amber-400"
          />
        </div>
      </div>

      <Separator />

      {/* Bijzonderheden sectie */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          Bijzonderheden
        </div>
        <div className="space-y-2">
          <Textarea
            id="bijzonderheden"
            value={bijzonderheden}
            onChange={(e) => setBijzonderheden(e.target.value)}
            placeholder="Overige opmerkingen over de locatie..."
            rows={3}
          />
        </div>
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
  );
}
