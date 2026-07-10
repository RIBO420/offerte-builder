"use client";

/**
 * Aanmaak-dialoog voor een melding (PRD §2.4) met de routing-defaults:
 * - klacht        → eigenaar = een kantoor-gebruiker (kiezer met default);
 * - serviceverzoek → vlag "beoordelen voor planning-wachtrij";
 * - schade        → kantoor + verzekeringsvlag.
 * Eigenaar is precies één en verplicht (default: de aanmaker).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MeldingType = "serviceverzoek" | "klacht" | "schade";
type MeldingKanaal = "telefoon" | "whatsapp" | "email" | "portaal" | "intern";

const ROUTING_HINT: Record<MeldingType, string> = {
  serviceverzoek:
    "Wordt gemarkeerd als 'beoordelen voor de planning-wachtrij'.",
  klacht: "De eigenaar moet een kantoor-gebruiker zijn.",
  schade:
    "De eigenaar moet kantoor zijn; de verzekeringsvlag wordt automatisch gezet.",
};

interface NieuweMeldingDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NieuweMeldingDialog({ open, onClose }: NieuweMeldingDialogProps) {
  const klanten = useQuery(api.klanten.list, open ? {} : "skip");
  const eigenaren = useQuery(
    api.servicemeldingen.listEigenaarKandidaten,
    open ? {} : "skip"
  );
  const createMelding = useMutation(api.servicemeldingen.create);

  const [klantId, setKlantId] = useState<string>("");
  const [type, setType] = useState<MeldingType>("serviceverzoek");
  const [kanaal, setKanaal] = useState<MeldingKanaal>("telefoon");
  const [beschrijving, setBeschrijving] = useState("");
  const [prioriteit, setPrioriteit] = useState("normaal");
  const [eigenaarId, setEigenaarId] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [bezig, setBezig] = useState(false);

  // Klacht/schade → alleen kantoor-gebruikers in de kiezer (routing-default)
  const eigenaarKandidaten = (eigenaren ?? []).filter(
    (e) => type === "serviceverzoek" || e.isKantoor
  );

  function reset() {
    setKlantId("");
    setType("serviceverzoek");
    setKanaal("telefoon");
    setBeschrijving("");
    setPrioriteit("normaal");
    setEigenaarId("");
    setDeadline("");
  }

  async function handleSubmit() {
    if (!klantId) {
      showErrorToast("Kies een klant");
      return;
    }
    if (!beschrijving.trim()) {
      showErrorToast("Omschrijving is verplicht");
      return;
    }
    setBezig(true);
    try {
      await createMelding({
        klantId: klantId as Id<"klanten">,
        beschrijving: beschrijving.trim(),
        prioriteit: prioriteit as "laag" | "normaal" | "hoog" | "urgent",
        type,
        kanaal,
        // Leeg = server-default: de aanmaker wordt eigenaar
        eigenaarId: eigenaarId ? (eigenaarId as Id<"users">) : undefined,
        deadline: deadline || undefined,
      });
      showSuccessToast("Melding aangemaakt");
      reset();
      onClose();
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Aanmaken mislukt"
      );
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuwe melding</DialogTitle>
          <DialogDescription>
            Serviceverzoek, klacht of schade — met precies één eigenaar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="melding-klant">Klant *</Label>
            <Select value={klantId} onValueChange={setKlantId}>
              <SelectTrigger id="melding-klant">
                <SelectValue placeholder="Kies een klant" />
              </SelectTrigger>
              <SelectContent>
                {(klanten ?? []).map((k) => (
                  <SelectItem key={k._id} value={k._id}>
                    {k.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="melding-type">Type *</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as MeldingType)}
              >
                <SelectTrigger id="melding-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serviceverzoek">Serviceverzoek</SelectItem>
                  <SelectItem value="klacht">Klacht</SelectItem>
                  <SelectItem value="schade">Schade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="melding-kanaal">Kanaal</Label>
              <Select
                value={kanaal}
                onValueChange={(v) => setKanaal(v as MeldingKanaal)}
              >
                <SelectTrigger id="melding-kanaal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telefoon">Telefoon</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="portaal">Portaal</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{ROUTING_HINT[type]}</p>

          <div className="space-y-2">
            <Label htmlFor="melding-omschrijving">Omschrijving *</Label>
            <Textarea
              id="melding-omschrijving"
              value={beschrijving}
              onChange={(e) => setBeschrijving(e.target.value)}
              placeholder="Wat is er aan de hand?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="melding-eigenaar">Eigenaar</Label>
              <Select value={eigenaarId} onValueChange={setEigenaarId}>
                <SelectTrigger id="melding-eigenaar">
                  <SelectValue placeholder="Ikzelf (default)" />
                </SelectTrigger>
                <SelectContent>
                  {eigenaarKandidaten.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="melding-prioriteit">Prioriteit</Label>
              <Select value={prioriteit} onValueChange={setPrioriteit}>
                <SelectTrigger id="melding-prioriteit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="laag">Laag</SelectItem>
                  <SelectItem value="normaal">Normaal</SelectItem>
                  <SelectItem value="hoog">Hoog</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="melding-deadline">Deadline (optioneel)</Label>
            <Input
              id="melding-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={bezig}>
            Annuleren
          </Button>
          <Button onClick={handleSubmit} disabled={bezig}>
            {bezig ? "Aanmaken..." : "Melding aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
