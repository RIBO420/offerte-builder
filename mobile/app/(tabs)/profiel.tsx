import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../convex/_generated/api';
import { useTheme, useColors, tekst } from '../../theme';
import { Fingerprint, HelpCircle, Info, KeyRound, LogOut, Mail, Globe, BellRing, MessageCircle, Hammer, Download, BookOpen, Camera } from 'lucide-react-native';
import { Drukvlak, IcoonTegel, Kaart, LijstRegel, Scheiding, SectieKop, Segment } from '../../components/werk/Bouwstenen';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useVeldOpdracht } from '../../hooks/use-veld-opdracht';
import { useUserRole } from '../../hooks/use-user-role';
import { Button, Badge, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui';
import {
  isBiometricAvailable,
  getBiometricType,
  isBiometricEnabled,
  setupBiometric,
  disableBiometric,
  BiometricType,
} from '../../lib/auth/biometric';

// Storage keys
const LANGUAGE_STORAGE_KEY = '@toptuinen_language';

// App version info
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode?.toString() || '1';

// Support URL
const SUPPORT_URL = 'https://toptuinen.nl/support';
const SUPPORT_EMAIL = 'support@toptuinen.nl';

type ThemeMode = 'light' | 'dark' | 'system';

// Wrapper component that handles auth check
export default function ProfielScreen() {
  const kleuren = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Laden…</Text>
        </View>
      </SafeAreaView>
    );
  }
  return <AuthenticatedProfielScreen />;
}

/** Instellingenregel: label links, schakelaar of waarde rechts, 56pt hoog. */
function InstellingRegel({ icoon, toon = 'neutraal', label, uitleg, rechts }: {
  icoon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  toon?: 'primair' | 'info' | 'wachten' | 'neutraal' | 'gemist';
  label: string;
  uitleg?: string;
  rechts: React.ReactNode;
}) {
  const kleuren = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 }}>
      <IcoonTegel icoon={icoon} toon={toon} grootte={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tekst.kop, { color: kleuren.foreground, fontWeight: '500' }]}>{label}</Text>
        {uitleg && <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]}>{uitleg}</Text>}
      </View>
      {rechts}
    </View>
  );
}

// Separate component that only renders when authenticated
function AuthenticatedProfielScreen() {
  const router = useRouter();
  const kleuren = useColors();
  const { mode, setMode, isDark } = useTheme();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { roleDisplayName, roleBadgeVariant } = useUserRole();

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const profile = useQuery(api.mobile.getProfile);
  const updateBiometric = useMutation(api.mobile.updateBiometricSetting);
  const notificationPrefs = useQuery(api.chat.getNotificationPreferences, {});
  const updateNotificationPrefs = useMutation(api.chat.updateNotificationPreferences);

  // Local state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  // Taalvoorkeur wordt wel geladen/bewaard maar (nog) nergens gelezen — alleen NL beschikbaar.
  const [_language, setLanguage] = useState('nl');
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // Notification settings state
  const pushEnabled = notificationPrefs?.enablePushNotifications ?? false;
  const chatEnabled = !!notificationPrefs?.notifyOnTeamChat && !!notificationPrefs?.notifyOnDirectMessage;
  const projectUpdatesEnabled = notificationPrefs?.notifyOnProjectChat ?? false;

  // Initialize biometric state
  useEffect(() => {
    const initBiometric = async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);

      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);

        const enabled = await isBiometricEnabled();
        setBiometricEnabled(enabled);
      }
    };

    initBiometric();
  }, []);

  // Sync biometric state from profile when it loads
  useEffect(() => {
    if (profile?.medewerker?.biometricEnabled !== undefined) {
      const syncBiometricState = async () => {
        const localEnabled = await isBiometricEnabled();
        if (profile.medewerker?.biometricEnabled && !localEnabled && biometricAvailable) {
          // Server says enabled but not locally - could be new device
          // Keep disabled until user explicitly enables
        }
        setBiometricEnabled(localEnabled);
      };
      syncBiometricState();
    }
  }, [profile, biometricAvailable]);

  // Load language preference
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage) {
          setLanguage(savedLanguage);
        }
      } catch (error) {
        console.warn('Failed to load language preference:', error);
      }
    };
    loadLanguage();
  }, []);

  const saveNotificationPrefs = async (prefs: { push: boolean; chat: boolean; projectUpdates: boolean }) => {
    try {
      await updateNotificationPrefs({ enablePushNotifications: prefs.push, notifyOnTeamChat: prefs.chat, notifyOnDirectMessage: prefs.chat, notifyOnBroadcast: prefs.chat, notifyOnProjectChat: prefs.projectUpdates });
    } catch (error) {
      Alert.alert('Voorkeur niet opgeslagen', error instanceof Error ? error.message : 'Probeer het opnieuw zodra je verbinding hebt.');
    }
  };

  // Get user info from Clerk and Convex profile
  const firstName = profile?.naam?.split(' ')[0] || user?.firstName || '';
  const lastName = profile?.naam?.split(' ').slice(1).join(' ') || user?.lastName || '';
  const fullName = profile?.naam || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Gebruiker';
  const email = user?.primaryEmailAddress?.emailAddress || profile?.email || '';
  const functie = profile?.functie || profile?.medewerker?.functie || 'Medewerker';
  const imageUrl = user?.hasImage ? user.imageUrl : undefined;

  // Generate initials
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';

  const { wachtrij, synchroniseer } = useVeldOpdracht();

  const handleSignOut = () => {
    Alert.alert(
      'Uitloggen',
      wachtrij.length > 0
        ? `Er staan nog ${wachtrij.length} opdrachten op dit toestel die niet bevestigd zijn. Ze blijven bewaard voor dit account en deze organisatie. Log later met hetzelfde account in om ze te versturen. Wis of verwijder de app niet voordat de wachtrij leeg is.`
        : 'Weet je zeker dat je wilt uitloggen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        ...(wachtrij.length > 0 ? [{ text: 'Eerst synchroniseren', onPress: () => { void synchroniseer(); } }] : []),
        {
          text: 'Uitloggen',
          style: 'destructive',
          onPress: async () => {
            try {
              // Disable biometric on sign out
              await disableBiometric();
              await signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Uitlog fout:', error);
              Alert.alert('Fout', 'Er ging iets mis bij het uitloggen');
            }
          },
        },
      ]
    );
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (biometricLoading) return;

    setBiometricLoading(true);

    try {
      if (enabled) {
        // Check if biometric is available
        const available = await isBiometricAvailable();
        if (!available) {
          Alert.alert(
            'Niet beschikbaar',
            biometricType === 'face'
              ? 'Face ID is niet beschikbaar op dit apparaat. Controleer of Face ID is ingeschakeld in de instellingen.'
              : 'Biometrische authenticatie is niet beschikbaar op dit apparaat.'
          );
          setBiometricLoading(false);
          return;
        }

        // Get session info from Clerk
        const sessions = await user?.getSessions();
        const activeSession = sessions?.[0];
        const sessionId = activeSession?.id || '';
        const userId = user?.id || '';

        if (!sessionId || !userId) {
          Alert.alert('Fout', 'Kon sessie gegevens niet ophalen. Probeer het opnieuw.');
          setBiometricLoading(false);
          return;
        }

        // Get a token for backup storage
        const sessionToken = sessionId;

        // Setup biometric locally with session ID, token, and user ID
        const success = await setupBiometric(sessionId, sessionToken, userId);

        if (success) {
          setBiometricEnabled(true);
          // Update server
          await updateBiometric({ enabled: true });
        } else {
          Alert.alert('Fout', 'Kon biometrie niet activeren. Probeer het opnieuw.');
        }
      } else {
        // Disable biometric
        await disableBiometric();
        setBiometricEnabled(false);
        // Update server
        await updateBiometric({ enabled: false });
      }
    } catch (error) {
      console.error('Biometric toggle fout:', error);
      Alert.alert('Fout', 'Kon biometrie instelling niet wijzigen');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleContactSupport = async (method: 'email' | 'website') => {
    setShowHelpDialog(false);

    try {
      if (method === 'email') {
        const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=Top Tuinen App Support&body=App versie: ${APP_VERSION} (Build ${BUILD_NUMBER})%0A%0ABeschrijf hier uw vraag:%0A`;
        await Linking.openURL(emailUrl);
      } else {
        await Linking.openURL(SUPPORT_URL);
      }
    } catch {
      Alert.alert('Fout', 'Kon de link niet openen');
    }
  };

  const getBiometricLabel = () => {
    if (biometricType === 'face') return 'Face ID';
    if (biometricType === 'fingerprint') return 'Touch ID';
    return 'Biometrische login';
  };

  const getBiometricDescription = () => {
    if (biometricType === 'face') return 'Log in met gezichtsherkenning';
    if (biometricType === 'fingerprint') return 'Log in met je vingerafdruk';
    return 'Log in met biometrie';
  };

  const groep = { paddingVertical: 2, paddingHorizontal: 14, gap: 0 } as const;

  return (
    <View style={{ flex: 1, backgroundColor: kleuren.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]}>Profiel</Text>

          {/* Wie je bent */}
          <Kaart padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <LinearGradient
              colors={[kleuren.primary, kleuren.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} accessibilityIgnoresInvertColors />
              ) : (
                // Dichte binnencirkel: het verloop mag niet door de initialen schemeren.
                <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: kleuren.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[tekst.titel2, { color: kleuren.primary }]}>{initials}</Text>
                </View>
              )}
            </LinearGradient>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[tekst.titel3, { color: kleuren.foreground }]} numberOfLines={1}>{fullName}</Text>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{email}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                <Badge variant={roleBadgeVariant as any || 'secondary'} size="sm">{roleDisplayName}</Badge>
                {functie && functie !== roleDisplayName && <Badge variant="outline" size="sm">{functie}</Badge>}
              </View>
            </View>
          </Kaart>

          <SectieKop titel="Beveiliging" />
          <Kaart style={groep}>
            <InstellingRegel
              icoon={Fingerprint}
              toon="primair"
              label={getBiometricLabel()}
              uitleg={biometricAvailable ? getBiometricDescription() : 'Niet beschikbaar op dit toestel'}
              rechts={<Switch accessibilityLabel={getBiometricLabel()} value={biometricEnabled} onValueChange={handleBiometricToggle} disabled={!biometricAvailable || biometricLoading} />}
            />
            <Scheiding />
            <LijstRegel icoon={KeyRound} toon="neutraal" titel="Wachtwoord" sub="Instellen of wijzigen" onPress={() => router.push('/werk/account')} />
          </Kaart>

          <SectieKop titel="Meldingen" />
          <Kaart style={groep}>
            <InstellingRegel icoon={BellRing} toon="info" label="Pushmeldingen" rechts={<Switch accessibilityLabel="Pushmeldingen" value={pushEnabled} disabled={!notificationPrefs} onValueChange={(val) => { saveNotificationPrefs({ push: val, chat: chatEnabled, projectUpdates: projectUpdatesEnabled }); }} />} />
            <Scheiding />
            <InstellingRegel icoon={MessageCircle} toon="primair" label="Chatberichten" rechts={<Switch accessibilityLabel="Chatberichten" value={chatEnabled} disabled={!notificationPrefs} onValueChange={(val) => { saveNotificationPrefs({ push: pushEnabled, chat: val, projectUpdates: projectUpdatesEnabled }); }} />} />
            <Scheiding />
            <InstellingRegel icoon={Hammer} toon="neutraal" label="Projectchat" rechts={<Switch accessibilityLabel="Projectchat" value={projectUpdatesEnabled} disabled={!notificationPrefs} onValueChange={(val) => { saveNotificationPrefs({ push: pushEnabled, chat: chatEnabled, projectUpdates: val }); }} />} />
          </Kaart>

          <SectieKop titel="Weergave" />
          <Segment
            label="Thema"
            opties={[{ waarde: 'light', label: 'Licht' }, { waarde: 'dark', label: 'Donker' }, { waarde: 'system', label: 'Systeem' }]}
            waarde={mode}
            onChange={(m) => setMode(m as ThemeMode)}
          />

          <SectieKop titel="App" />
          <Kaart style={groep}>
            <LijstRegel icoon={Camera} toon="neutraal" titel="Foto's van mijn klussen" onPress={() => router.push('/werk/fotos')} />
            <Scheiding />
            <LijstRegel icoon={BookOpen} toon="neutraal" titel="Uitleg opnieuw bekijken" onPress={() => router.push('/werk/intro')} />
            <Scheiding />
            <LijstRegel icoon={Download} toon="neutraal" titel="Installeren en bijwerken" onPress={() => router.push('/werk/app-hulp')} />
            <Scheiding />
            <LijstRegel icoon={HelpCircle} toon="neutraal" titel="Hulp en contact" onPress={() => setShowHelpDialog(true)} />
            <Scheiding />
            <LijstRegel icoon={Info} toon="neutraal" titel="Over de app" sub={`Versie ${APP_VERSION} (build ${BUILD_NUMBER})`} onPress={() => setShowAboutDialog(true)} />
          </Kaart>

          <Drukvlak
            onPress={handleSignOut}
            haptic="press"
            accessibilityLabel="Uitloggen"
            style={{ marginTop: 6, minHeight: 52, borderRadius: 16, backgroundColor: kleuren.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <LogOut size={19} color={kleuren.danger} strokeWidth={2.2} />
            <Text style={[tekst.kop, { color: kleuren.danger }]}>Uitloggen</Text>
          </Drukvlak>
        </ScrollView>

        {/* About Dialog */}
        <Dialog visible={showAboutDialog} onClose={() => setShowAboutDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Over Top Tuinen</DialogTitle>
              <DialogDescription>
                De medewerkers app voor Top Tuinen projectbeheer
              </DialogDescription>
            </DialogHeader>
            <View style={{ paddingHorizontal: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: kleuren.border }}>
                <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Versie</Text>
                <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '500' }]}>{APP_VERSION}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: kleuren.border }}>
                <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Build</Text>
                <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '500' }]}>{BUILD_NUMBER}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: kleuren.border }}>
                <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Platform</Text>
                <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '500' }]}>
                  {Constants.platform?.ios ? 'iOS' : Constants.platform?.android ? 'Android' : 'Unknown'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Expo SDK</Text>
                <Text style={[tekst.sub, { color: kleuren.foreground, fontWeight: '500' }]}>{Constants.expoConfig?.sdkVersion || '54'}</Text>
              </View>
            </View>
            <DialogFooter>
              <Button
                variant="outline"
                title="Sluiten"
                onPress={() => setShowAboutDialog(false)}
                fullWidth
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Help Dialog */}
        <Dialog visible={showHelpDialog} onClose={() => setShowHelpDialog(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Help & Support</DialogTitle>
              <DialogDescription>
                Hoe kunnen we je helpen?
              </DialogDescription>
            </DialogHeader>
            <View style={{ paddingHorizontal: 24, gap: 8 }}>
              <Button
                variant="outline"
                title="Stuur een e-mail"
                onPress={() => handleContactSupport('email')}
                fullWidth
                icon={<Mail size={18} color={kleuren.foreground} strokeWidth={2} />}
              />
              <Button
                variant="outline"
                title="Bezoek onze website"
                onPress={() => handleContactSupport('website')}
                fullWidth
                icon={<Globe size={18} color={kleuren.foreground} strokeWidth={2} />}
              />
            </View>
            <DialogFooter>
              <Button
                variant="ghost"
                title="Annuleren"
                onPress={() => setShowHelpDialog(false)}
                fullWidth
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SafeAreaView>
    </View>
  );
}
