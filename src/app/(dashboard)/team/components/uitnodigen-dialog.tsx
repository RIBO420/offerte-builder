"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMutationErrorMessage } from "@/lib/error-handling";
import {
  UITNODIGBARE_ROLLEN,
  normaliseerEmail,
  type UitnodigbareRol,
} from "@/hooks/use-team";
import type { UserWithDetails } from "@/hooks/use-users";
import { ROL_WEERGAVE } from "./rol-weergave";

/**
 * Iemand uitnodigen voor Top Tuinen OS.
 *
 * Twee dingen die deze dialoog wél doet en een kaal formulier niet:
 *
 * 1. **Het adres tonen zoals het wordt opgeslagen.** De server trimt en
 *    lowercase't (`normaliseerUitnodigingEmail`); wie "Jan@Firma.NL " typt
 *    krijgt hier meteen te zien dat het `jan@firma.nl` wordt, zodat een
 *    latere melding over "dat adres" over hetzelfde adres gaat.
 * 2. **Waarschuwen dat een bestaand account zijn rol houdt.** `users.upsert`
 *    neemt de uitnodigingsrol alléén over als het account nog de standaardrol
 *    `medewerker` heeft. Zonder deze regel denkt kantoor dat het met een
 *    uitnodiging iemand degradeert of promoveert — dat gebeurt niet.
 *
 * Serverfouten (uniciteit, niet-uitnodigbare rol) blijven ín de dialoog staan:
 * een toast die naast een openstaand formulier wegvalt laat de invoer zonder
 * uitleg achter.
 */
export function UitnodigenDialog({
  open,
  onOpenChange,
  medewerkerNaam,
  standaardEmail,
  standaardRol = "medewerker",
  bestaandeAccounts,
  onVersturen,
  /** "Opnieuw versturen" bij een openstaande uitnodiging. */
  isHerhaling = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medewerkerNaam: string;
  standaardEmail?: string;
  standaardRol?: UitnodigbareRol;
  /** Accounts zonder medewerkersdossier — de bron voor de rol-hint. */
  bestaandeAccounts: UserWithDetails[];
  onVersturen: (email: string, rol: UitnodigbareRol) => Promise<void>;
  isHerhaling?: boolean;
}) {
  const [email, setEmail] = useState(standaardEmail ?? "");
  const [rol, setRol] = useState<UitnodigbareRol>(standaardRol);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  // Bij (her)openen weer beginnen bij de gegevens van déze medewerker; anders
  // staat het adres van de vorige rij nog in het veld.
  useEffect(() => {
    if (open) {
      setEmail(standaardEmail ?? "");
      setRol(standaardRol);
      setFout(null);
      setBezig(false);
    }
  }, [open, standaardEmail, standaardRol]);

  const genormaliseerd = normaliseerEmail(email);
  const wijktAf = genormaliseerd !== email.trim() || email !== email.trim();

  /**
   * Bestaat er al een account op dit adres dat níet aan een medewerker hangt?
   * Dan is dit een bestaande gebruiker en telt zijn huidige rol, niet de rol
   * die je hier kiest.
   */
  const bestaandAccount = useMemo(() => {
    if (!genormaliseerd) return null;
    return (
      bestaandeAccounts.find(
        (account) => normaliseerEmail(account.email) === genormaliseerd
      ) ?? null
    );
  }, [bestaandeAccounts, genormaliseerd]);

  // De standaardrol is de enige die overschreven wordt; elke andere blijft
  // staan. Alleen dán is de melding waar.
  const rolBlijftStaan =
    bestaandAccount !== null && bestaandAccount.role !== "medewerker";

  const kanVersturen = genormaliseerd.length > 0 && !bezig;

  async function versturen() {
    if (!kanVersturen) return;
    setBezig(true);
    setFout(null);
    try {
      await onVersturen(genormaliseerd, rol);
      onOpenChange(false);
    } catch (error) {
      setFout(getMutationErrorMessage(error));
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isHerhaling ? "Uitnodiging opnieuw versturen" : "Uitnodigen voor Top Tuinen OS"}
          </DialogTitle>
          <DialogDescription>
            De collega ontvangt een e-mail en wordt na aanmelden automatisch
            gekoppeld aan het dossier van {medewerkerNaam}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="uitnodiging-email">E-mailadres</Label>
            <Input
              id="uitnodiging-email"
              type="email"
              autoComplete="email"
              required
              placeholder="naam@toptuinen.nl"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFout(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void versturen();
                }
              }}
            />
            {/* Alleen tonen als het ingetypte adres afwijkt van wat er wordt
                opgeslagen — anders is het een echo van het invoerveld. */}
            {wijktAf && genormaliseerd.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Wordt opgeslagen als{" "}
                <span className="font-medium text-foreground">
                  {genormaliseerd}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="uitnodiging-rol">Rol in de app</Label>
            <Select
              value={rol}
              onValueChange={(waarde) => setRol(waarde as UitnodigbareRol)}
            >
              <SelectTrigger id="uitnodiging-rol" className="w-full">
                <SelectValue placeholder="Kies een rol" />
              </SelectTrigger>
              <SelectContent>
                {UITNODIGBARE_ROLLEN.map((waarde) => {
                  const weergave = ROL_WEERGAVE[waarde];
                  const Icoon = weergave.icoon;
                  return (
                    <SelectItem key={waarde} value={waarde}>
                      <span className="flex items-center gap-2">
                        <Icoon className="h-4 w-4" aria-hidden />
                        {weergave.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Bepaalt wat deze collega in Top Tuinen OS mag. Later wijzigen kan
              via de rijactie <span className="font-medium">Rol wijzigen</span>.
            </p>
          </div>

          {rolBlijftStaan && bestaandAccount && (
            <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Er bestaat al een account op {genormaliseerd} met de rol{" "}
                <span className="font-medium">
                  {ROL_WEERGAVE[bestaandAccount.role]?.label ??
                    bestaandAccount.role}
                </span>
                . Die rol blijft staan — een uitnodiging verlaagt of verhoogt
                een bestaand account niet.
              </span>
            </p>
          )}

          {fout && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {fout}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bezig}
          >
            Annuleren
          </Button>
          <Button onClick={versturen} disabled={!kanVersturen}>
            {bezig ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {isHerhaling ? "Opnieuw versturen" : "Uitnodiging versturen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
