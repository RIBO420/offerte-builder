"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  Car,
  Key,
  Phone,
  User,
  Zap,
  Droplet,
  Bath,
  AlertTriangle,
  ImageIcon,
  Edit,
  Plus,
  FileText,
} from "lucide-react";
import { WerklocatieForm } from "./werklocatie-form";
import { WerklocatieFotoGallery } from "./werklocatie-foto-gallery";

interface WerklocatieCardProps {
  projectId: Id<"projecten">;
}

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

export function WerklocatieCard({ projectId }: WerklocatieCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Fetch werklocatie for this project
  const werklocatie = useQuery(api.werklocaties.getByProject, {
    projectId,
  }) as Werklocatie | null | undefined;

  // Loading state
  if (werklocatie === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Werklocatie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No werklocatie exists yet
  if (!werklocatie) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Werklocatie
          </CardTitle>
          <CardDescription>
            Voeg locatie-informatie toe voor dit project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="rounded-full bg-muted p-4">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Nog geen werklocatie informatie toegevoegd.
              </p>
              <p className="text-sm text-muted-foreground">
                Voeg adres, toegangsinstructies en voorzieningen toe.
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Werklocatie toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Werklocatie toevoegen</DialogTitle>
                  <DialogDescription>
                    Voeg informatie toe over de werklocatie voor dit project.
                  </DialogDescription>
                </DialogHeader>
                <WerklocatieForm
                  projectId={projectId}
                  onSuccess={() => setIsDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Count photos by type
  const fotoCount = werklocatie.fotos?.length ?? 0;
  const fotosByType = {
    voor: werklocatie.fotos?.filter((f) => f.type === "voor").length ?? 0,
    tijdens: werklocatie.fotos?.filter((f) => f.type === "tijdens").length ?? 0,
    na: werklocatie.fotos?.filter((f) => f.type === "na").length ?? 0,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Werklocatie
        </CardTitle>
        <CardDescription>
          {werklocatie.adres}, {werklocatie.postcode} {werklocatie.plaats}
        </CardDescription>
        <CardAction>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Bewerken
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Werklocatie bewerken</DialogTitle>
                <DialogDescription>
                  Pas de werklocatie informatie aan.
                </DialogDescription>
              </DialogHeader>
              <WerklocatieForm
                projectId={projectId}
                werklocatie={werklocatie}
                onSuccess={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Utilities Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Voorzieningen</h4>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={werklocatie.stroomAansluiting ? "default" : "outline"}
              className={werklocatie.stroomAansluiting ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/30" : "text-muted-foreground"}
            >
              <Zap className="mr-1 h-3 w-3" />
              Stroom {werklocatie.stroomAansluiting ? "beschikbaar" : "niet beschikbaar"}
            </Badge>
            <Badge
              variant={werklocatie.waterAansluiting ? "default" : "outline"}
              className={werklocatie.waterAansluiting ? "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/30" : "text-muted-foreground"}
            >
              <Droplet className="mr-1 h-3 w-3" />
              Water {werklocatie.waterAansluiting ? "beschikbaar" : "niet beschikbaar"}
            </Badge>
            <Badge
              variant={werklocatie.toiletBeschikbaar ? "default" : "outline"}
              className={werklocatie.toiletBeschikbaar ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/30" : "text-muted-foreground"}
            >
              <Bath className="mr-1 h-3 w-3" />
              Toilet {werklocatie.toiletBeschikbaar ? "beschikbaar" : "niet beschikbaar"}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Access Information */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Toegang */}
          {werklocatie.toegangInstructies && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 text-muted-foreground" />
                Toegang
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {werklocatie.toegangInstructies}
              </p>
            </div>
          )}

          {/* Parkeren */}
          {werklocatie.parkeerInfo && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Car className="h-4 w-4 text-muted-foreground" />
                Parkeren
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {werklocatie.parkeerInfo}
              </p>
            </div>
          )}

          {/* Sleutel */}
          {werklocatie.sleutelInfo && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 text-muted-foreground" />
                Sleutel
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {werklocatie.sleutelInfo}
              </p>
            </div>
          )}
        </div>

        {/* Contact op locatie */}
        {werklocatie.contactOpLocatie && (werklocatie.contactOpLocatie.naam || werklocatie.contactOpLocatie.telefoon) && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Contact op locatie</h4>
              <div className="flex flex-wrap gap-4">
                {werklocatie.contactOpLocatie.naam && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {werklocatie.contactOpLocatie.naam}
                  </div>
                )}
                {werklocatie.contactOpLocatie.telefoon && (
                  <a
                    href={`tel:${werklocatie.contactOpLocatie.telefoon}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {werklocatie.contactOpLocatie.telefoon}
                  </a>
                )}
              </div>
            </div>
          </>
        )}

        {/* Veiligheidsnotities */}
        {werklocatie.veiligheidsNotities && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Veiligheidsnotities
              </div>
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {werklocatie.veiligheidsNotities}
              </div>
            </div>
          </>
        )}

        {/* Bijzonderheden */}
        {werklocatie.bijzonderheden && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Bijzonderheden
              </div>
              <p className="text-sm text-muted-foreground">
                {werklocatie.bijzonderheden}
              </p>
            </div>
          </>
        )}

        {/* Foto's */}
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Foto&apos;s ({fotoCount})
            </div>
            {fotoCount > 0 && (
              <div className="flex gap-1">
                {fotosByType.voor > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Voor: {fotosByType.voor}
                  </Badge>
                )}
                {fotosByType.tijdens > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Tijdens: {fotosByType.tijdens}
                  </Badge>
                )}
                {fotosByType.na > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Na: {fotosByType.na}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {fotoCount > 0 ? (
            <>
              {/* Preview of first 4 photos */}
              <div className="grid grid-cols-4 gap-2">
                {werklocatie.fotos?.slice(0, 4).map((foto, index) => (
                  <div
                    key={index}
                    className="relative aspect-square overflow-hidden rounded-md bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setIsGalleryOpen(true)}
                  >
                    <img
                      src={foto.url}
                      alt={foto.beschrijving || `Foto ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {foto.type && (
                      <Badge
                        variant="secondary"
                        className="absolute bottom-1 left-1 text-xs px-1 py-0"
                      >
                        {foto.type}
                      </Badge>
                    )}
                    {index === 3 && fotoCount > 4 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-medium">
                        +{fotoCount - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsGalleryOpen(true)}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Alle foto&apos;s bekijken
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nog geen foto&apos;s toegevoegd. Gebruik de bewerk knop om foto&apos;s toe te voegen.
            </p>
          )}
        </div>

        {/* Photo Gallery Dialog */}
        <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Foto&apos;s werklocatie</DialogTitle>
              <DialogDescription>
                {werklocatie.adres}, {werklocatie.postcode} {werklocatie.plaats}
              </DialogDescription>
            </DialogHeader>
            <WerklocatieFotoGallery
              werklocatieId={werklocatie._id}
              fotos={werklocatie.fotos ?? []}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
