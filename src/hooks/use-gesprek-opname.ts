"use client";

/**
 * De opnamemechaniek achter "Gesprek opnemen" (klantdossier v7, WS5).
 *
 * Alleen `MediaRecorder`, een teller en het opruimen van de microfoon —
 * bewust zonder kennis van Convex, transcriptie of de UI eromheen. Die keten
 * staat in `GesprekComposer`; hier hoort alleen wat er misgaat aan de kant van
 * de browser.
 *
 * Drie dingen liggen hier vast:
 *
 * 1. **De microfoon gaat altijd weer uit.** Bij stoppen, bij annuleren én bij
 *    unmount (wegnavigeren met de opname aan). Een tab die blijft opnemen
 *    zonder scherm erbij is het ergste wat deze functie kan doen.
 * 2. **Weigert de gebruiker de microfoon, dan is dat geen fout maar een
 *    uitkomst** (`{gestart: false, fout: "geweigerd"}`). De aanroeper maakt er
 *    een rustige melding van, geen foutscherm.
 * 3. **Een opname hoort na 30 minuten te stoppen.** Langer is geen gesprek
 *    meer maar een vergeten tabblad. De grens staat hier (`MAX_OPNAME_SEC`),
 *    het afkappen zelf doet de aanroeper: die moet daarna toch de hele keten
 *    van uploaden en uitwerken in gang zetten.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Harde bovengrens: daarboven kapt de composer de opname af, mét melding. */
export const MAX_OPNAME_SEC = 30 * 60;

/**
 * Opus in een webm-container is klein én door Deepgram gelezen. Safari kent
 * webm niet en valt terug op mp4; wat er ook uitkomt, de container gaat als
 * Content-Type mee naar de transcriptie-action.
 */
const MIME_KANDIDATEN = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export type OpnameStartFout = "geen-ondersteuning" | "geweigerd";

export interface OpnameStartUitkomst {
  gestart: boolean;
  fout?: OpnameStartFout;
}

export interface OpnameOpbrengst {
  blob: Blob;
  /** Afgeronde duur in seconden, minimaal 1. */
  duurSec: number;
}

/** "0:07", "12:03" — zelfde notatie als de tijdlijnbadge. */
export function formatOpnameTijd(seconden: number): string {
  const veilig = Math.max(0, Math.floor(seconden));
  return `${Math.floor(veilig / 60)}:${String(veilig % 60).padStart(2, "0")}`;
}

function kiesMimeType(): string | undefined {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return undefined;
  }
  return MIME_KANDIDATEN.find((kandidaat) =>
    MediaRecorder.isTypeSupported(kandidaat)
  );
}

export function useGesprekOpname() {
  const [seconden, setSeconden] = useState(0);
  const [loopt, setLoopt] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const brokkenRef = useRef<Blob[]>([]);
  const tellerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondenRef = useRef(0);

  /** Teller uit, microfoon uit, recorder los. Mag altijd, ook dubbel. */
  const ruimOp = useCallback(() => {
    if (tellerRef.current !== null) {
      clearInterval(tellerRef.current);
      tellerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((spoor) => spoor.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Wegnavigeren met de opname aan: microfoon uit, opgenomen brokken weg.
  useEffect(() => ruimOp, [ruimOp]);

  const start = useCallback(async (): Promise<OpnameStartUitkomst> => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      return { gestart: false, fout: "geen-ondersteuning" };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Geweigerd, geen microfoon, of een onveilige context (geen https).
      return { gestart: false, fout: "geweigerd" };
    }

    const mimeType = kiesMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
    } catch {
      stream.getTracks().forEach((spoor) => spoor.stop());
      return { gestart: false, fout: "geen-ondersteuning" };
    }

    brokkenRef.current = [];
    recorder.ondataavailable = (gebeurtenis: BlobEvent) => {
      if (gebeurtenis.data && gebeurtenis.data.size > 0) {
        brokkenRef.current.push(gebeurtenis.data);
      }
    };
    // Brokken van een seconde: zo staat er bij een crash of een geforceerde
    // stop tenminste audio klaar in plaats van één nog niet gesloten blok.
    recorder.start(1000);

    recorderRef.current = recorder;
    streamRef.current = stream;
    secondenRef.current = 0;
    setSeconden(0);
    setLoopt(true);

    tellerRef.current = setInterval(() => {
      secondenRef.current += 1;
      setSeconden(secondenRef.current);
    }, 1000);

    return { gestart: true };
  }, []);

  /**
   * Stopt de opname en geeft de audio terug. `null` als er niets bruikbaars
   * is opgenomen — de aanroeper moet dat behandelen als "geen opname", niet
   * als een fout.
   */
  const stop = useCallback(
    () =>
      new Promise<OpnameOpbrengst | null>((resolve) => {
        const recorder = recorderRef.current;
        const duurSec = Math.max(1, secondenRef.current);

        if (tellerRef.current !== null) {
          clearInterval(tellerRef.current);
          tellerRef.current = null;
        }
        setLoopt(false);

        if (!recorder || recorder.state === "inactive") {
          brokkenRef.current = [];
          ruimOp();
          resolve(null);
          return;
        }

        recorder.onstop = () => {
          const type =
            recorder.mimeType || brokkenRef.current[0]?.type || "audio/webm";
          const blob = new Blob(brokkenRef.current, { type });
          brokkenRef.current = [];
          ruimOp();
          resolve(blob.size > 0 ? { blob, duurSec } : null);
        };

        try {
          recorder.stop();
        } catch {
          brokkenRef.current = [];
          ruimOp();
          resolve(null);
        }
      }),
    [ruimOp]
  );

  /** Alles weg zonder audio terug te geven: de opname is nooit gebeurd. */
  const annuleer = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // Al gestopt; ruimOp hieronder doet de rest.
      }
    }
    brokkenRef.current = [];
    setLoopt(false);
    setSeconden(0);
    secondenRef.current = 0;
    ruimOp();
  }, [ruimOp]);

  return { seconden, loopt, start, stop, annuleer };
}
