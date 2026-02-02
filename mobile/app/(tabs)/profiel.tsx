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

// App version info
const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode?.toString() || '1';

// Support URL
const SUPPORT_URL = 'https://toptuinen.nl/support';
const SUPPORT_EMAIL = 'support@toptuinen.nl';

type ThemeMode = 'light' | 'dark' | 'system';

type SettingItem = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  disabled?: boolean;
};

// Theme Selector Component
function ThemeSelector({
  mode,
  onModeChange,
}: {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}) {
  const colors = useColors();

  const options: { value: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { value: 'light', label: 'Licht', icon: 'sun' },
    { value: 'dark', label: 'Donker', icon: 'moon' },
    { value: 'system', label: 'Systeem', icon: 'smartphone' },
  ];

  return (
    <View className="flex-row bg-muted rounded-lg p-1">
      {options.map((option) => {
        const isSelected = mode === option.value;
        return (
          <Pressable
            key={option.value}
            className={cn(
              "flex-1 flex-row items-center justify-center gap-1.5 py-2.5 px-3 rounded-md",
              isSelected && "bg-background"
            )}
            onPress={() => onModeChange(option.value)}
          >
            <Feather
              name={option.icon}
              size={16}
              color={isSelected ? colors.primary : colors.mutedForeground}
            />
            <Text
              className={cn(
                "text-sm",
                isSelected ? "text-foreground font-semibold" : "text-muted-foreground"
              )}
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
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted-foreground">Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <AuthenticatedProfielScreen />;
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
      // Sync local biometric state if server says it's enabled
      // but local storage might have been cleared
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
    return 'Biometrie';
  };

  const getBiometricIcon = (): keyof typeof Feather.glyphMap => {
    if (biometricType === 'face') return 'eye';
    return 'smartphone';
  };

  const settingsSections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'user',
          label: 'Profiel bewerken',
          onPress: () => Alert.alert('Binnenkort', 'Profiel bewerken wordt binnenkort toegevoegd'),
        },
        {
          icon: 'bell',
          label: 'Notificaties',
          onPress: () => Alert.alert('Binnenkort', 'Notificatie-instellingen worden binnenkort toegevoegd'),
        },
        {
          icon: 'lock',
          label: 'Privacy',
          onPress: () => Alert.alert('Binnenkort', 'Privacy-instellingen worden binnenkort toegevoegd'),
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          icon: 'globe',
          label: 'Taal',
          value: 'Nederlands',
          onPress: handleLanguageChange,
        },
        {
          icon: getBiometricIcon(),
          label: getBiometricLabel(),
          toggle: true,
          toggleValue: biometricEnabled,
          onToggle: handleBiometricToggle,
          disabled: !biometricAvailable || biometricLoading,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle',
          label: 'Help & Support',
          onPress: handleOpenHelp,
        },
        {
          icon: 'info',
          label: 'Over de app',
          onPress: () => setShowAboutDialog(true),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View className="items-center py-4 px-6 bg-card border-b border-border">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="w-20 h-20 rounded-full mb-3" />
          ) : (
            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3">
              <Text className="text-2xl font-semibold text-primary-foreground">{initials}</Text>
            </View>
          )}
          <Text className="text-xl font-bold text-foreground">{fullName}</Text>
          {/* Role Badge */}
          <View
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-full mt-2"
            style={{ backgroundColor: roleBadgeColors.background }}
          >
            <Feather
              name={isAdmin ? 'shield' : 'user'}
              size={12}
              color={roleBadgeColors.text}
            />
            <Text className="text-xs font-semibold" style={{ color: roleBadgeColors.text }}>
              {functie}
            </Text>
          </View>
          <Text className="text-sm text-muted-foreground mt-1">{email}</Text>
        </View>

        {/* Theme Section - Special inline design */}
        <View className="mb-4 mt-4">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-2">
            Weergave
          </Text>
          <View className="bg-card mx-4 rounded-xl overflow-hidden border border-border p-4">
            <View className="flex-row items-center gap-2 mb-4">
              <View className="w-9 h-9 rounded-md bg-muted items-center justify-center">
                <Feather name="moon" size={18} color={colors.foreground} />
              </View>
              <Text className="text-base text-foreground">Thema</Text>
            </View>
            <ThemeSelector mode={mode} onModeChange={setMode} />
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} className="mb-4">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 mb-2">
              {section.title}
            </Text>
            <View className="bg-card mx-4 rounded-xl overflow-hidden border border-border">
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  className={cn(
                    "flex-row items-center justify-between py-3.5 px-4",
                    itemIndex < section.items.length - 1 && "border-b border-border"
                  )}
                  onPress={item.onPress}
                  disabled={(!item.onPress && !item.toggle) || item.disabled}
                  activeOpacity={item.toggle ? 1 : 0.7}
                >
                  <View className="flex-row items-center gap-2 flex-1">
                    <View
                      className={cn(
                        "w-9 h-9 rounded-md items-center justify-center",
                        item.danger ? "bg-destructive/20" : "bg-muted"
                      )}
                    >
                      <Feather
                        name={item.icon}
                        size={18}
                        color={item.danger ? colors.destructive : item.disabled ? colors.mutedForeground : colors.foreground}
                      />
                    </View>
                    <Text
                      className={cn(
                        "text-base",
                        item.danger && "text-destructive",
                        item.disabled ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    {item.value && (
                      <Text className="text-sm text-muted-foreground">{item.value}</Text>
                    )}
                    {item.toggle && (
                      <Switch
                        value={item.toggleValue ?? false}
                        onValueChange={item.onToggle ?? (() => {})}
                        disabled={item.disabled}
                      />
                    )}
                    {item.onPress && !item.danger && !item.toggle && (
                      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <View className="px-4 mt-2">
          <Button
            onPress={handleSignOut}
            variant="destructive"
            fullWidth
            title="Uitloggen"
            icon={<Feather name="log-out" size={18} color={colors.destructiveForeground} />}
          />
        </View>

        {/* Footer */}
        <View className="items-center py-6 px-4">
          <Text className="text-xs text-muted-foreground mb-1">Top Tuinen Medewerkers App</Text>
          <Text className="text-xs text-muted-foreground opacity-60">Versie {APP_VERSION} (Build {BUILD_NUMBER})</Text>
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
          <View className="px-6">
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-sm text-muted-foreground">Versie</Text>
              <Text className="text-sm text-foreground font-medium">{APP_VERSION}</Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-sm text-muted-foreground">Build</Text>
              <Text className="text-sm text-foreground font-medium">{BUILD_NUMBER}</Text>
            </View>
            <View className="flex-row justify-between py-2 border-b border-border">
              <Text className="text-sm text-muted-foreground">Platform</Text>
              <Text className="text-sm text-foreground font-medium">
                {Constants.platform?.ios ? 'iOS' : Constants.platform?.android ? 'Android' : 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-muted-foreground">Expo SDK</Text>
              <Text className="text-sm text-foreground font-medium">{Constants.expoConfig?.sdkVersion || '54'}</Text>
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
          <View className="px-6 gap-2">
            <Button
              variant="outline"
              title="Stuur een e-mail"
              onPress={() => handleContactSupport('email')}
              fullWidth
              icon={<Feather name="mail" size={18} color={colors.foreground} />}
            />
            <Button
              variant="outline"
              title="Bezoek onze website"
              onPress={() => handleContactSupport('website')}
              fullWidth
              icon={<Feather name="globe" size={18} color={colors.foreground} />}
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
  );
}

