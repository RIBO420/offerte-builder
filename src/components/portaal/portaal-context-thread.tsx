"use client";

/**
 * Klantthread bij een werkitem of melding (PRD §3.1, portaalkant).
 * De klant leest en schrijft in de eigen thread (klant→kantoor mag altijd);
 * berichten van kantoor verschijnen hier ook. Toegang wordt server-side
 * afgedwongen (requireKlant + klantHeeftToegangTotThread).
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PortaalChatMessages } from "./portaal-chat-messages";

interface PortaalContextThreadProps {
  werkitemId?: Id<"projecten">;
  meldingId?: Id<"servicemeldingen">;
}

export function PortaalContextThread({
  werkitemId,
  meldingId,
}: PortaalContextThreadProps) {
  const [opening, setOpening] = useState(false);

  const threadId = useQuery(api.portaal.getThreadVoorContext, {
    werkitemId,
    meldingId,
  });
  const messages = useQuery(
    api.chatThreads.listMessages,
    threadId ? { threadId } : "skip"
  );
  const openWerkitemThread = useMutation(api.portaal.openThreadVoorWerkitem);
  const openMeldingThread = useMutation(api.portaal.openThreadVoorMelding);

  const handleStart = async () => {
    setOpening(true);
    try {
      if (werkitemId) {
        await openWerkitemThread({ werkitemId });
      } else if (meldingId) {
        await openMeldingThread({ meldingId });
      }
    } catch {
      toast.error("Gesprek starten is niet gelukt");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
      <CardHeader>
        <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#4ADE80]" />
          Berichten over {werkitemId ? "deze werkzaamheden" : "deze melding"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {threadId === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : threadId === null ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Heeft u een vraag of opmerking? Start een gesprek — wij reageren
              zo snel mogelijk.
            </p>
            <Button
              className="mt-4 bg-[#4ADE80] hover:bg-[#3BC96F] text-black"
              onClick={handleStart}
              disabled={opening}
            >
              {opening ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-1.5" />
              )}
              Gesprek starten
            </Button>
          </div>
        ) : (
          <div className="h-[420px] border border-gray-200 dark:border-[#2a3e2a] rounded-lg overflow-hidden">
            <PortaalChatMessages threadId={threadId} messages={messages} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
