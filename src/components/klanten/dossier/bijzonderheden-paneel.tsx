"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Info, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SectieLegeStaat, SectiePaneel } from "@/components/ui/sectie-paneel";
import { TextareaWithCount } from "@/components/ui/textarea-with-count";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "../../../../convex/_generated/api";
import type { KlantInstellingenGegevens } from "./tab-instellingen";

/** Wat de server ook aanhoudt (`klanten.update`). */
const BIJZONDERHEDEN_MAX = 2000;

/**
 * De vaste uitleg bij het bijzonderheden-blok. Eén zin, letterlijk zoals hij
 * met kantoor is afgesproken: hij zegt zowel wát erin hoort als voor wie.
 */
const BIJZONDERHEDEN_UITLEG =
  "Vaste bijzonderheden die elke collega moet weten: sleutel, hond, toegang, vaste werkzaamheden.";

/* ── Bijzonderheden ───────────────────────────────────────────────────────── */

/**
 * Eén tekstvak met de vaste dingen die bij deze klant gelden: sleutel, hond,
 * toegang, vaste werkzaamheden. Bewust géén notitieveld met datums — dat is de
 * tijdlijn. Dit is wat er ook over een jaar nog waar is, en het staat daarom
 * ook als strook boven Actueel.
 *
 * Alleen intern: de tekst verschijnt nergens in het klantportaal, in een PDF
 * of in een mail.
 *
 * Los geëxporteerd zodat de componenttest hem zonder de hele tab kan renderen.
 */
export function BijzonderhedenPaneel({
  klant,
  magBewerken,
}: {
  klant: Pick<KlantInstellingenGegevens, "_id" | "bijzonderheden">;
  magBewerken: boolean;
}) {
  const updateKlant = useMutation(api.klanten.update);
  const [bewerken, setBewerken] = useState(false);
  const [tekst, setTekst] = useState(klant.bijzonderheden ?? "");
  const [bezig, setBezig] = useState(false);

  const opgeslagen = klant.bijzonderheden?.trim() ?? "";

  const begin = () => {
    setTekst(klant.bijzonderheden ?? "");
    setBewerken(true);
  };

  const opslaan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bezig) return;
    setBezig(true);
    try {
      // Lege string wist, net als bij e-mail en telefoon; de server knipt
      // hem er dan uit.
      await updateKlant({ id: klant._id, bijzonderheden: tekst.trim() });
      showSuccessToast("Bijzonderheden bijgewerkt");
      setBewerken(false);
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Bijwerken mislukt"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <SectiePaneel
      titel="Bijzonderheden"
      icoon={<Info />}
      kopbalk
      acties={
        magBewerken && !bewerken && opgeslagen ? (
          <Button variant="outline" size="sm" onClick={begin}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Wijzigen
          </Button>
        ) : undefined
      }
    >
      {bewerken ? (
        <form onSubmit={opslaan} className="space-y-3 px-3 py-3">
          <div className="space-y-1.5">
            <Label htmlFor="ki-bijzonderheden">Bijzonderheden</Label>
            <TextareaWithCount
              id="ki-bijzonderheden"
              rows={5}
              maxLength={BIJZONDERHEDEN_MAX}
              placeholder="Sleutel ligt onder de mat achter; hond loopt los."
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {BIJZONDERHEDEN_UITLEG}
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBewerken(false)}
              disabled={bezig}
            >
              Annuleren
            </Button>
            <Button type="submit" size="sm" disabled={bezig}>
              {bezig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </form>
      ) : opgeslagen ? (
        // `whitespace-pre-line`: kantoor typt hier regels onder elkaar
        // (sleutel, hond, toegang) en die volgorde is de leesbaarheid.
        <p className="px-3 py-3 text-sm whitespace-pre-line">{opgeslagen}</p>
      ) : (
        <>
          <SectieLegeStaat
            tekst="Nog niets vastgelegd."
            hint={BIJZONDERHEDEN_UITLEG}
          />
          {magBewerken && (
            <div className="px-3 pb-3">
              <Button variant="outline" size="sm" onClick={begin}>
                Bijzonderheden toevoegen
              </Button>
            </div>
          )}
        </>
      )}
    </SectiePaneel>
  );
}
