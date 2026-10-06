import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { VeldScherm } from '../../components/veld/VeldScherm';
import { AanhangerRetourKaart } from '../../components/veld/AanhangerRetourKaart';
import { vandaagAmsterdam } from '../../lib/werk-periode';

/** Aanhangerretour van de ploegdag, geopend vanuit Mijn dag › Afsluiten. */
export default function Aanhanger() {
  const { datum: datumParam, teamId } = useLocalSearchParams<{ datum?: string; teamId?: string }>();
  const datum = datumParam && /^\d{4}-\d{2}-\d{2}$/.test(datumParam) ? datumParam : vandaagAmsterdam();
  return (
    <VeldScherm titel="Aanhanger" kop="groot">
      <AanhangerRetourKaart datum={datum} teamId={teamId || undefined} ingebed />
    </VeldScherm>
  );
}
