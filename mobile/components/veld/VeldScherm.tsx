import React, { Component, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isInternalRole } from '../../lib/roles';
import { GeenToegang } from '../GeenToegang';
import { Button, OfflineIndicator } from '../ui';
import { BuitenModusProvider, useBuitenModus } from './BuitenModus';

export function VeldScherm({ titel, children }: { titel: string; children: ReactNode }) {
  const { user, role, isLoading } = useCurrentUser();
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Account laden" /></View>;
  if (!isInternalRole(role)) return <GeenToegang uitleg="Dit scherm is alleen beschikbaar voor medewerkers." />;
  return <BuitenModusProvider userId={user?._id ?? null}><Scherm titel={titel}><SchermFoutgrens>{children}</SchermFoutgrens></Scherm></BuitenModusProvider>;
}

function Scherm({ titel, children }: { titel: string; children: ReactNode }) {
  const { kleuren } = useBuitenModus();
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }}>
    <OfflineIndicator />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
      <View style={{ alignItems: 'flex-start' }}><Button title="Terug" variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} /></View>
      <Text accessibilityRole="header" style={{ color: kleuren.foreground, fontSize: 24, fontWeight: '600' }}>{titel}</Text>
      {children}
    </ScrollView>
  </SafeAreaView>;
}

class SchermFoutgrens extends Component<{ children: ReactNode }, { fout: string | null }> {
  state = { fout: null as string | null };
  static getDerivedStateFromError(error: unknown) { return { fout: error instanceof Error ? error.message : 'Laden is mislukt.' }; }
  render() { return this.state.fout ? <Fout melding={this.state.fout} opnieuw={() => this.setState({ fout: null })} /> : this.props.children; }
}
function Fout({ melding, opnieuw }: { melding: string; opnieuw: () => void }) {
  const { kleuren } = useBuitenModus();
  return <View style={{ gap: 12 }}><Text accessibilityRole="alert" style={{ color: kleuren.foreground }}>{melding}</Text><Button title="Opnieuw proberen" variant="outline" onPress={opnieuw} /></View>;
}
