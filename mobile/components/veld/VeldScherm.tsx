import React, { Component, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useCurrentUser } from '../../hooks/use-current-user';
import { isInternalRole } from '../../lib/roles';
import { GeenToegang } from '../GeenToegang';
import { Button, OfflineIndicator } from '../ui';
import { tekst } from '../../theme';
import { BuitenModusProvider, useBuitenModus } from './BuitenModus';
import { IcoonTegel } from '../werk/Bouwstenen';

/**
 * Schil van elk werkscherm: de echte iOS-navigatiebalk met grote, inklappende
 * titel (en swipe-terug), themakleuren inclusief buiten-modus, offline-strook
 * en een foutgrens. Android krijgt dezelfde balk met een gewone titel.
 */
export function VeldScherm({
  titel,
  children,
  kop = 'groot',
  rechts,
}: {
  titel: string;
  children: ReactNode;
  /** `groot` voor overzichtsschermen, `klein` voor detail, `geen` voor eigen kop (intro). */
  kop?: 'groot' | 'klein' | 'geen';
  rechts?: () => ReactNode;
}) {
  const { user, role, isLoading } = useCurrentUser();
  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Account laden" /></View>;
  if (!isInternalRole(role)) return <GeenToegang uitleg="Dit scherm is alleen beschikbaar voor medewerkers." />;
  return (
    <BuitenModusProvider userId={user?._id ?? null}>
      <Scherm titel={titel} kop={kop} rechts={rechts}>
        <SchermFoutgrens>{children}</SchermFoutgrens>
      </Scherm>
    </BuitenModusProvider>
  );
}

function Scherm({ titel, kop, rechts, children }: { titel: string; kop: 'groot' | 'klein' | 'geen'; rechts?: () => ReactNode; children: ReactNode }) {
  const { kleuren } = useBuitenModus();
  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background }}>
      <Stack.Screen
        options={{
          headerShown: kop !== 'geen',
          title: titel,
          headerLargeTitleEnabled: kop === 'groot',
          headerBackTitle: 'Terug',
          headerTintColor: kleuren.primary,
          headerStyle: { backgroundColor: kleuren.background },
          headerLargeStyle: { backgroundColor: kleuren.background },
          headerTitleStyle: { color: kleuren.foreground, fontWeight: '600' },
          headerLargeTitleStyle: { color: kleuren.foreground, fontWeight: '700' },
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerRight: rechts,
          contentStyle: { backgroundColor: kleuren.background },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1, backgroundColor: kleuren.background }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: kop === 'geen' ? 0 : 8, gap: 14, paddingBottom: 48 }}
      >
        <OfflineIndicator />
        {children}
      </ScrollView>
    </View>
  );
}

class SchermFoutgrens extends Component<{ children: ReactNode }, { fout: string | null }> {
  state = { fout: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    const melding = error instanceof Error ? error.message.replace(/^.*Uncaught ConvexError:?\s*/, '') : 'Laden is mislukt.';
    return { fout: melding || 'Laden is mislukt.' };
  }
  render() {
    return this.state.fout ? <Fout melding={this.state.fout} opnieuw={() => this.setState({ fout: null })} /> : this.props.children;
  }
}

function Fout({ melding, opnieuw }: { melding: string; opnieuw: () => void }) {
  const { kleuren } = useBuitenModus();
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 12 }}>
      <IcoonTegel icoon={RefreshCw} toon="gemist" grootte={52} />
      <Text style={[tekst.titel3, { color: kleuren.foreground, textAlign: 'center' }]}>Dit scherm kan niet laden</Text>
      <Text accessibilityRole="alert" style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center' }]}>{melding}</Text>
      <Button title="Opnieuw proberen" variant="outline" onPress={opnieuw} />
    </View>
  );
}
