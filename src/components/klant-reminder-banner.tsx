"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, BellOff, Bell, AlertTriangle } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { useState } from "react";

interface KlantReminderBannerProps {
  klantId: Id<"klanten">;
  telefoon?: string;
  email?: string;
}

export function KlantReminderBanner({
  klantId,
  telefoon,
  email,
}: KlantReminderBannerProps) {
  const reminder = useQuery(api.klanten.getKlantReminder, { id: klantId });
  const snooze = useMutation(api.klanten.snoozeReminder);
  const unsnooze = useMutation(api.klanten.unsnoozeReminder);
  const [isLoading, setIsLoading] = useState(false);

  // No reminder needed or still loading
  if (reminder === undefined || reminder === null) return null;

  // Snoozed state
  if (reminder.type === "snoozed") {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellOff className="h-4 w-4" />
            <span>Herinneringen uitgeschakeld voor deze klant</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              setIsLoading(true);
              try {
                await unsnooze({ id: klantId });
                showSuccessToast("Herinneringen heractiveerd");
              } catch {
                showErrorToast("Fout bij heractiveren");
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Heractiveren
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active reminder
  const message =
    reminder.type === "lead_zonder_offerte"
      ? `Deze lead heeft al ${reminder.dagenOpen} dagen geen offerte ontvangen`
      : `Offerte staat ${reminder.dagenOpen} dagen open zonder reactie`;

  const bgColor =
    reminder.type === "lead_zonder_offerte"
      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50"
      : "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/50";

  const textColor =
    reminder.type === "lead_zonder_offerte"
      ? "text-amber-800 dark:text-amber-200"
      : "text-orange-800 dark:text-orange-200";

  const iconColor =
    reminder.type === "lead_zonder_offerte"
      ? "text-amber-600 dark:text-amber-400"
      : "text-orange-600 dark:text-orange-400";

  return (
    <Card className={`border ${bgColor}`}>
      <CardContent className="py-3 px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div>
              <p className={`text-sm font-medium ${textColor}`}>{message}</p>
              <p className={`text-xs mt-0.5 ${textColor} opacity-75`}>
                {reminder.type === "lead_zonder_offerte"
                  ? "Maak een offerte aan of neem contact op"
                  : "Neem contact op voor een reactie"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-7 sm:ml-0">
            {telefoon && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                asChild
              >
                <a href={`tel:${telefoon}`}>
                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                  Bel klant
                </a>
              </Button>
            )}
            {email && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                asChild
              >
                <a href={`mailto:${email}`}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Stuur herinnering
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={async () => {
                setIsLoading(true);
                try {
                  await snooze({ id: klantId });
                  showSuccessToast("Herinneringen uitgeschakeld voor deze klant");
                } catch {
                  showErrorToast("Fout bij uitschakelen");
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              <BellOff className="mr-1.5 h-3.5 w-3.5" />
              Niet meer herinneren
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
