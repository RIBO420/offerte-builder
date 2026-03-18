"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  User,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

interface KlantDetailsCardProps {
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
}

export function KlantDetailsCard({ klant }: KlantDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Klantgegevens
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Naam
          </p>
          <p className="text-lg font-semibold">{klant.naam}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Adres
          </p>
          <p className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {klant.adres}, {klant.postcode}{" "}
            {klant.plaats}
          </p>
        </div>
        {klant.email && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              E-mail
            </p>
            <p className="flex items-center gap-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {klant.email}
            </p>
          </div>
        )}
        {klant.telefoon && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Telefoon
            </p>
            <p className="flex items-center gap-1">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {klant.telefoon}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
