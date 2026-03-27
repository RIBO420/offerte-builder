"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ImageOff,
  ExternalLink,
  Info,
  AlertTriangle,
} from "lucide-react";

export function Stap3FotoUpload() {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-xl">Foto&#39;s van uw tuin</CardTitle>
        <CardDescription>
          Upload foto&#39;s van uw huidige tuin zodat wij een accurate beoordeling
          kunnen maken. Minimaal 2 foto&#39;s zijn nodig.
        </CardDescription>
      </CardHeader>

      {/* Upload zone — placeholder */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <ImageOff className="h-7 w-7 text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-600">Foto upload wordt binnenkort toegevoegd</p>
            <p className="text-sm text-muted-foreground mt-1">
              U kunt foto&#39;s later per e-mail sturen naar info@toptuinen.nl
            </p>
          </div>
          <Badge variant="outline" className="text-gray-500 border-gray-300 mt-2">
            Binnenkort beschikbaar
          </Badge>
        </div>
      </div>

      {/* Instructies */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-blue-900">Tips voor goede foto&#39;s</p>
              <ul className="text-sm text-blue-800 space-y-1 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">1.</span>
                  Maak een overzichtsfoto van de gehele tuin
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">2.</span>
                  Foto van de poort / doorgang naar de tuin
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">3.</span>
                  Foto&#39;s van de huidige ondergrond (gras, tegels, e.d.)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">4.</span>
                  Eventuele probleemgebieden (waterplassen, kale plekken)
                </li>
              </ul>
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 mt-1"
                onClick={(e) => e.preventDefault()}
              >
                Bekijk hoe u correct opmeet
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Let op:</span> De foto&#39;s zijn niet verplicht
          voor het indienen van uw aanvraag, maar helpen ons bij een nauwkeurigere
          beoordeling en snellere afhandeling.
        </p>
      </div>
    </div>
  );
}
