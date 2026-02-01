import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { typography } from '../../theme/typography';
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
    <View style={[styles.themeSelector, { backgroundColor: colors.muted }]}>
      {options.map((option) => {
        const isSelected = mode === option.value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.themeOption,
              isSelected && { backgroundColor: colors.background },
            ]}
            onPress={() => onModeChange(option.value)}
          >
            <Feather
              name={option.icon}
              size={16}
              color={isSelected ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.themeOptionText,
                { color: isSelected ? colors.foreground : colors.mutedForeground },
                isSelected && { fontWeight: typography.fontWeight.semibold },
              ]}
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground }}>Laden...</Text>
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

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    profileHeader: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.card,
      marginBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatarLarge: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatarImage: {
      width: 96,
      height: 96,
      borderRadius: 48,
      marginBottom: spacing.md,
    },
    avatarText: {
      fontSize: typography.fontSize['3xl'],
      fontWeight: typography.fontWeight.semibold,
      color: colors.primaryForeground,
    },
    userName: {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    userEmail: {
      fontSize: typography.fontSize.sm,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
    sectionTitle: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionContent: {
      backgroundColor: colors.card,
      marginHorizontal: spacing.lg,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
    },
    settingItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingIconDanger: {
      backgroundColor: `${colors.destructive}20`,
    },
    settingLabel: {
      fontSize: typography.fontSize.base,
      color: colors.foreground,
    },
    settingLabelDanger: {
      color: colors.destructive,
    },
    settingLabelDisabled: {
      color: colors.mutedForeground,
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    settingValue: {
      fontSize: typography.fontSize.sm,
      color: colors.mutedForeground,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    footerText: {
      fontSize: typography.fontSize.xs,
      color: colors.mutedForeground,
      marginBottom: spacing.xs,
    },
    footerVersion: {
      fontSize: typography.fontSize.xs,
      color: colors.mutedForeground,
      opacity: 0.6,
    },
    themeSectionContent: {
      backgroundColor: colors.card,
      marginHorizontal: spacing.lg,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    themeSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    aboutDialogRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    aboutDialogLabel: {
      fontSize: typography.fontSize.sm,
      color: colors.mutedForeground,
    },
    aboutDialogValue: {
      fontSize: typography.fontSize.sm,
      color: colors.foreground,
      fontWeight: typography.fontWeight.medium,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={dynamicStyles.profileHeader}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={dynamicStyles.avatarImage} />
          ) : (
            <View style={dynamicStyles.avatarLarge}>
              <Text style={dynamicStyles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={dynamicStyles.userName}>{fullName}</Text>
          {/* Role and Function Badges */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: roleBadgeColors.background }
              ]}
            >
              <Feather
                name={isAdmin ? 'shield' : 'user'}
                size={12}
                color={roleBadgeColors.text}
              />
              <Text style={[styles.roleBadgeText, { color: roleBadgeColors.text }]}>
                {roleDisplayName}
              </Text>
            </View>
            <Badge variant="secondary" size="md">
              {functie}
            </Badge>
          </View>
          <Text style={dynamicStyles.userEmail}>{email}</Text>
        </View>

        {/* Theme Section - Special inline design */}
        <View style={styles.section}>
          <Text style={dynamicStyles.sectionTitle}>Weergave</Text>
          <View style={dynamicStyles.themeSectionContent}>
            <View style={dynamicStyles.themeSectionHeader}>
              <View style={dynamicStyles.settingIcon}>
                <Feather name="moon" size={18} color={colors.foreground} />
              </View>
              <Text style={dynamicStyles.settingLabel}>Thema</Text>
            </View>
            <ThemeSelector mode={mode} onModeChange={setMode} />
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>{section.title}</Text>
            <View style={dynamicStyles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    dynamicStyles.settingItem,
                    itemIndex < section.items.length - 1 && dynamicStyles.settingItemBorder,
                  ]}
                  onPress={item.onPress}
                  disabled={(!item.onPress && !item.toggle) || item.disabled}
                  activeOpacity={item.toggle ? 1 : 0.7}
                >
                  <View style={dynamicStyles.settingLeft}>
                    <View
                      style={[
                        dynamicStyles.settingIcon,
                        item.danger && dynamicStyles.settingIconDanger,
                      ]}
                    >
                      <Feather
                        name={item.icon}
                        size={18}
                        color={item.danger ? colors.destructive : item.disabled ? colors.mutedForeground : colors.foreground}
                      />
                    </View>
                    <Text
                      style={[
                        dynamicStyles.settingLabel,
                        item.danger && dynamicStyles.settingLabelDanger,
                        item.disabled && dynamicStyles.settingLabelDisabled,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <View style={dynamicStyles.settingRight}>
                    {item.value && (
                      <Text style={dynamicStyles.settingValue}>{item.value}</Text>
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
        <View style={styles.logoutSection}>
          <Button
            onPress={handleSignOut}
            variant="destructive"
            fullWidth
            title="Uitloggen"
            icon={<Feather name="log-out" size={18} color={colors.destructiveForeground} />}
          />
        </View>

        {/* Footer */}
        <View style={dynamicStyles.footer}>
          <Text style={dynamicStyles.footerText}>Top Tuinen Medewerkers App</Text>
          <Text style={dynamicStyles.footerVersion}>Versie {APP_VERSION} (Build {BUILD_NUMBER})</Text>
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
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={dynamicStyles.aboutDialogRow}>
              <Text style={dynamicStyles.aboutDialogLabel}>Versie</Text>
              <Text style={dynamicStyles.aboutDialogValue}>{APP_VERSION}</Text>
            </View>
            <View style={dynamicStyles.aboutDialogRow}>
              <Text style={dynamicStyles.aboutDialogLabel}>Build</Text>
              <Text style={dynamicStyles.aboutDialogValue}>{BUILD_NUMBER}</Text>
            </View>
            <View style={dynamicStyles.aboutDialogRow}>
              <Text style={dynamicStyles.aboutDialogLabel}>Platform</Text>
              <Text style={dynamicStyles.aboutDialogValue}>
                {Constants.platform?.ios ? 'iOS' : Constants.platform?.android ? 'Android' : 'Unknown'}
              </Text>
            </View>
            <View style={[dynamicStyles.aboutDialogRow, { borderBottomWidth: 0 }]}>
              <Text style={dynamicStyles.aboutDialogLabel}>Expo SDK</Text>
              <Text style={dynamicStyles.aboutDialogValue}>{Constants.expoConfig?.sdkVersion || '54'}</Text>
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
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
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

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  logoutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  themeSelector: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  themeOptionText: {
    fontSize: typography.fontSize.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  roleBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
});
