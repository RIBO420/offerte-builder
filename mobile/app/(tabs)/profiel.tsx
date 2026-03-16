import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useQuery, useMutation } from 'convex/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../convex/_generated/api';
import { useTheme, useColors } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { useUserRole, ROLE_BADGE_COLORS } from '../../hooks/use-user-role';
import { Card, CardContent, Button, Badge, Switch, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui';
import { cn } from '../../lib/utils';
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
const NOTIFICATIONS_STORAGE_KEY = '@toptuinen_notifications';

// App version info
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode?.toString() || '1';

// Support URL
const SUPPORT_URL = 'https://toptuinen.nl/support';
const SUPPORT_EMAIL = 'support@toptuinen.nl';

type ThemeMode = 'light' | 'dark' | 'system';

// Theme Selector Component
function ThemeSelector({
  mode,
  onModeChange,
}: {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}) {
  const options: { value: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { value: 'light', label: 'Licht', icon: 'sun' },
    { value: 'dark', label: 'Donker', icon: 'moon' },
    { value: 'system', label: 'Systeem', icon: 'smartphone' },
  ];

  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10, padding: 3 }}>
      {options.map((option) => {
        const isSelected = mode === option.value;
        return (
          <Pressable
            key={option.value}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: isSelected ? '#222222' : 'transparent',
            }}
            onPress={() => onModeChange(option.value)}
          >
            <Feather
              name={option.icon}
              size={14}
              color={isSelected ? '#4ADE80' : '#555555'}
            />
            <Text
              style={{
                fontSize: 12,
                color: isSelected ? '#E8E8E8' : '#555555',
                fontWeight: isSelected ? '600' : '400',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Wrapper component that handles auth check
export default function ProfielScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#555555', fontSize: 14 }}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <AuthenticatedProfielScreen />;
}

// Row component for settings items
function SettingRow({
  label,
  value,
  rightElement,
  isLast = false,
}: {
  label: string;
  value?: string;
  rightElement?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#1A1A1A',
      }}
    >
      <Text style={{ fontSize: 13, color: '#888888' }}>{label}</Text>
      {value !== undefined && (
        <Text style={{ fontSize: 13, color: '#E8E8E8' }}>{value}</Text>
      )}
      {rightElement}
    </View>
  );
}

// Separate component that only renders when authenticated
function AuthenticatedProfielScreen() {
  const router = useRouter();
  const colors = useColors();
  const { mode, setMode } = useTheme();
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut } = useClerk();
  const { roleDisplayName, roleBadgeVariant, roleBadgeColors, isAdmin, isMedewerker, normalizedRole } = useUserRole();

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const profile = useQuery(api.mobile.getProfile);
  const updateBiometric = useMutation(api.mobile.updateBiometricSetting);

  // Local state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [language, setLanguage] = useState('nl');
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // Notification settings state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [projectUpdatesEnabled, setProjectUpdatesEnabled] = useState(true);

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

  // Load notification preferences
  useEffect(() => {
    const loadNotificationPrefs = async () => {
      try {
        const saved = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        if (saved) {
          const prefs = JSON.parse(saved);
          setPushEnabled(prefs.push ?? true);
          setChatEnabled(prefs.chat ?? true);
          setProjectUpdatesEnabled(prefs.projectUpdates ?? true);
        }
      } catch (error) {
        console.warn('Failed to load notification preferences:', error);
      }
    };
    loadNotificationPrefs();
  }, []);

  // Save notification preferences
  const saveNotificationPrefs = async (prefs: { push: boolean; chat: boolean; projectUpdates: boolean }) => {
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.warn('Failed to save notification preferences:', error);
    }
  };

  // Get user info from Clerk and Convex profile
  const firstName = profile?.naam?.split(' ')[0] || user?.firstName || '';
  const lastName = profile?.naam?.split(' ').slice(1).join(' ') || user?.lastName || '';
  const fullName = profile?.naam || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Gebruiker';
  const email = user?.primaryEmailAddress?.emailAddress || profile?.email || '';
  const functie = profile?.functie || profile?.medewerker?.functie || 'Medewerker';
  const imageUrl = user?.imageUrl;

  // Generate initials
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';

  const handleSignOut = () => {
    Alert.alert(
      'Uitloggen',
      'Weet je zeker dat je wilt uitloggen?',
      [
        { text: 'Annuleren', style: 'cancel' },
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

        // Get session token from Clerk
        const token = await user?.getSessions();
        const sessionToken = token?.[0]?.id || 'session_' + Date.now();
        const userId = user?.id || '';

        // Setup biometric locally
        const success = await setupBiometric(sessionToken, userId);

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

  const handleLanguageChange = async () => {
    // For now, only Dutch is supported
    Alert.alert(
      'Taal',
      'Momenteel is alleen Nederlands beschikbaar. Meer talen worden binnenkort toegevoegd.',
      [{ text: 'OK' }]
    );
  };

  const handleOpenHelp = async () => {
    setShowHelpDialog(true);
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
    } catch (error) {
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

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 9, color: '#6B8F6B', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
              TOP TUINEN
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '600', color: '#E8E8E8' }}>
              Profiel
            </Text>
          </View>

          {/* Avatar Section */}
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            {/* Avatar with gradient ring */}
            <View style={{ marginBottom: 12 }}>
              <LinearGradient
                colors={['#2D5A27', '#4ADE80']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: 43,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: 80, height: 80, borderRadius: 40 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: '#1A2E1A',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '700', color: '#E8E8E8' }}>
                      {initials}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>
            {/* Name */}
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#E8E8E8', marginBottom: 8 }}>
              {fullName}
            </Text>
            {/* Role badge */}
            <Badge variant={roleBadgeVariant as any || 'secondary'} size="md">
              {functie}
            </Badge>
          </View>

          {/* ACCOUNT Section */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, color: '#555555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', marginBottom: 8, paddingLeft: 4 }}>
              ACCOUNT
            </Text>
            <View style={{ backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222', borderRadius: 14, overflow: 'hidden' }}>
              <SettingRow
                label="Email"
                value={email}
              />
              <SettingRow
                label="Rol"
                rightElement={
                  <Badge variant={roleBadgeVariant as any || 'secondary'} size="sm">
                    {roleDisplayName}
                  </Badge>
                }
                isLast
              />
            </View>
          </View>

          {/* BEVEILIGING Section */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, color: '#555555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', marginBottom: 8, paddingLeft: 4 }}>
              BEVEILIGING
            </Text>
            <View style={{ backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222', borderRadius: 14, overflow: 'hidden' }}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#888888' }}>{getBiometricLabel()}</Text>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                    disabled={!biometricAvailable || biometricLoading}
                    size="sm"
                  />
                </View>
                <Text style={{ fontSize: 11, color: '#555555', marginTop: 4 }}>
                  {getBiometricDescription()}
                </Text>
              </View>
            </View>
          </View>

          {/* NOTIFICATIES Section */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, color: '#555555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', marginBottom: 8, paddingLeft: 4 }}>
              NOTIFICATIES
            </Text>
            <View style={{ backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222', borderRadius: 14, overflow: 'hidden' }}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#888888' }}>Push notificaties</Text>
                  <Switch
                    value={pushEnabled}
                    onValueChange={(val) => {
                      setPushEnabled(val);
                      saveNotificationPrefs({ push: val, chat: chatEnabled, projectUpdates: projectUpdatesEnabled });
                    }}
                    size="sm"
                  />
                </View>
              </View>
              <View style={{ paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#888888' }}>Chat meldingen</Text>
                  <Switch
                    value={chatEnabled}
                    onValueChange={(val) => {
                      setChatEnabled(val);
                      saveNotificationPrefs({ push: pushEnabled, chat: val, projectUpdates: projectUpdatesEnabled });
                    }}
                    size="sm"
                  />
                </View>
              </View>
              <View style={{ paddingVertical: 14, paddingHorizontal: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#888888' }}>Project updates</Text>
                  <Switch
                    value={projectUpdatesEnabled}
                    onValueChange={(val) => {
                      setProjectUpdatesEnabled(val);
                      saveNotificationPrefs({ push: pushEnabled, chat: chatEnabled, projectUpdates: val });
                    }}
                    size="sm"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* APP Section */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, color: '#555555', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', marginBottom: 8, paddingLeft: 4 }}>
              APP
            </Text>
            <View style={{ backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222', borderRadius: 14, overflow: 'hidden' }}>
              <View style={{ paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' }}>
                <Text style={{ fontSize: 13, color: '#888888', marginBottom: 10 }}>Thema</Text>
                <ThemeSelector mode={mode} onModeChange={setMode} />
              </View>
              <SettingRow
                label="Versie"
                value={`${APP_VERSION} (Build ${BUILD_NUMBER})`}
                isLast
              />
            </View>
          </View>

          {/* Sign Out Button */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Button
              onPress={handleSignOut}
              variant="destructive"
              fullWidth
              title="Uitloggen"
              icon={<Feather name="log-out" size={18} color="#FAFAFA" />}
            />
          </View>
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222222' }}>
                <Text style={{ fontSize: 13, color: '#888888' }}>Versie</Text>
                <Text style={{ fontSize: 13, color: '#E8E8E8', fontWeight: '500' }}>{APP_VERSION}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222222' }}>
                <Text style={{ fontSize: 13, color: '#888888' }}>Build</Text>
                <Text style={{ fontSize: 13, color: '#E8E8E8', fontWeight: '500' }}>{BUILD_NUMBER}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222222' }}>
                <Text style={{ fontSize: 13, color: '#888888' }}>Platform</Text>
                <Text style={{ fontSize: 13, color: '#E8E8E8', fontWeight: '500' }}>
                  {Constants.platform?.ios ? 'iOS' : Constants.platform?.android ? 'Android' : 'Unknown'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ fontSize: 13, color: '#888888' }}>Expo SDK</Text>
                <Text style={{ fontSize: 13, color: '#E8E8E8', fontWeight: '500' }}>{Constants.expoConfig?.sdkVersion || '54'}</Text>
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
                icon={<Feather name="mail" size={18} color="#E8E8E8" />}
              />
              <Button
                variant="outline"
                title="Bezoek onze website"
                onPress={() => handleContactSupport('website')}
                fullWidth
                icon={<Feather name="globe" size={18} color="#E8E8E8" />}
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
