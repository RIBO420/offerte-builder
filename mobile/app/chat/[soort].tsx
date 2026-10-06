import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { MessageCircle } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isInternalRole } from '../../lib/roles';
import { GeenToegang } from '../../components/GeenToegang';
import { LegeStaat } from '../../components/werk/Bouwstenen';
import { BuitenModusProvider, useVeldKleuren } from '../../components/veld/BuitenModus';
import { ChatGesprek } from '../../components/chat/ChatGesprek';
import { isGesprekSoort, VASTE_NAMEN, type GesprekSoort } from '../../components/chat/gesprekken';

/**
 * Eén gesprek, als eigen scherm op de root-stack: native kop met terug-veeg, en
 * zonder zwevende tabbalk zodat de invoer vrij boven toetsenbord en thuisbalk staat.
 *
 *   /chat/team · /chat/mededelingen · /chat/dm?id=<users-id> · /chat/project?id=<projecten-id>
 *
 * `naam` reist mee vanuit de inbox; ontbreekt hij (melding, deeplink), dan zoeken
 * we hem op in de bestaande gespreks- en kanaalqueries.
 */
export default function GesprekScherm() {
  const params = useLocalSearchParams<{ soort?: string; id?: string; naam?: string }>();
  const { user, role, isLoading, isUserSynced } = useCurrentUser();
  const kleuren = useVeldKleuren();

  if (isLoading || !isUserSynced) {
    return (
      <View style={{ flex: 1, backgroundColor: kleuren.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: true, title: params.naam ?? 'Chat', headerBackTitle: 'Chat', headerTintColor: kleuren.primary, headerStyle: { backgroundColor: kleuren.background } }} />
        <ActivityIndicator color={kleuren.primary} accessibilityLabel="Laden" />
      </View>
    );
  }
  if (!isInternalRole(role)) return <GeenToegang uitleg="De chat is alleen beschikbaar voor medewerkers." />;

  const soort = params.soort;
  const id = typeof params.id === 'string' && params.id.length > 0 ? params.id : undefined;
  const geldig = isGesprekSoort(soort) && (soort === 'team' || soort === 'mededelingen' || !!id);

  return (
    <BuitenModusProvider userId={user?._id ? String(user._id) : null}>
      {geldig ? <MetTitel soort={soort} id={id} naam={params.naam} /> : <NietGevonden />}
    </BuitenModusProvider>
  );
}

function MetTitel({ soort, id, naam }: { soort: GesprekSoort; id?: string; naam?: string }) {
  const zoekDM = soort === 'dm' && !naam;
  const zoekProject = soort === 'project' && !naam;
  const gesprekken = useQuery(api.chat.getDMConversations, zoekDM ? {} : 'skip');
  const kanalen = useQuery(api.chat.getChannels, zoekProject ? {} : 'skip');

  let titel = naam;
  if (!titel && soort === 'team') titel = VASTE_NAMEN.team;
  if (!titel && soort === 'mededelingen') titel = VASTE_NAMEN.mededelingen;
  if (!titel && soort === 'dm') titel = gesprekken?.find((g) => g.partnerId === id)?.partnerName ?? 'Gesprek';
  if (!titel && soort === 'project') titel = kanalen?.find((k) => k.projectId === id)?.name ?? 'Project';

  return <ChatGesprek soort={soort} id={id} titel={titel ?? 'Chat'} />;
}

function NietGevonden() {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background, padding: 16, justifyContent: 'center' }}>
      <Stack.Screen options={{ headerShown: true, title: 'Chat', headerBackTitle: 'Chat', headerTintColor: kleuren.primary, headerStyle: { backgroundColor: kleuren.background } }} />
      <LegeStaat icoon={MessageCircle} titel="Gesprek niet gevonden" uitleg="Ga terug naar Chat en kies het gesprek opnieuw." />
    </View>
  );
}
