import React from 'react';
import { Text } from 'react-native';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { api } from '../../../convex/_generated/api';
import { useVeldCache } from '../../../hooks/use-veld-cache';
import { VeldScherm } from '../../../components/veld/VeldScherm';
import { useVeldKleuren } from '../../../components/veld/BuitenModus';
import { KlantblokKaart } from '../../../components/veld/KlantblokKaart';
import { BezoekKaart, type WerkbezoekDagData } from '../../../components/veld/WerkbezoekDag';
import { Kaart, LegeStaat } from '../../../components/werk/Bouwstenen';
import { vandaagAmsterdam } from '../../../lib/werk-periode';
import { tekst } from '../../../theme';
import type { VeldDagData } from '../../../types/veld';

/**
 * Eén klus van je dag: wat er moet gebeuren (taken, instructie, route,
 * afronden, meerwerk) en wat je meldt voor je vertrekt (terugmelden, afval,
 * foto's). Mijn dag toont per klus alleen een regel en linkt hierheen.
 */
export default function KlusScherm() {
  const { id, datum: datumParam, naam } = useLocalSearchParams<{ id: string; datum?: string; naam?: string }>();
  const datum = datumParam && /^\d{4}-\d{2}-\d{2}$/.test(datumParam) ? datumParam : vandaagAmsterdam();
  return (
    <VeldScherm titel={naam || 'Klus'} kop="groot">
      <KlusInhoud id={id} datum={datum} />
    </VeldScherm>
  );
}

function KlusInhoud({ id, datum }: { id: string; datum: string }) {
  const kleuren = useVeldKleuren();
  const liveDag = useQuery(api.urenSegmenten.getVeldDag, { datum }) as VeldDagData | null | undefined;
  const { data: dag } = useVeldCache(`dag:${datum}`, liveDag);
  const bezoekLive = useQuery(api.werkbezoek.getVoorDag, { datum }) as WerkbezoekDagData | undefined;
  const { data: bezoekDag } = useVeldCache(`bezoeken:${datum}`, bezoekLive);

  if (dag === undefined || bezoekDag === undefined) {
    return <Kaart variant="stil"><Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Klus laden…</Text></Kaart>;
  }
  const stop = dag?.stops.find(s => String(s.werkitemId) === id);
  const bezoek = bezoekDag?.bezoeken.find(b => String(b.werkitemId) === id);
  if (!stop && !bezoek) {
    return <LegeStaat icoon={SearchX} titel="Klus niet gevonden" uitleg="Deze klus staat niet (meer) op je dag. Ga terug naar Mijn dag." />;
  }
  const magBewerken = !!dag && dag.dagStatus !== 'ingediend';
  return (
    <>
      {stop && <KlantblokKaart stop={stop} datum={datum} magBewerken={magBewerken} ingebed />}
      {bezoek && <BezoekKaart bezoek={bezoek} datum={datum} ingebed />}
    </>
  );
}
