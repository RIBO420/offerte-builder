import { useState, useMemo, type ReactNode } from 'react';
import {
  View,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/ui/Tekst';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, CircleX, Link, Lock, UserCheck, UserPlus, Users } from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { tekst } from '../../theme';
import { useUserRole } from '../../hooks/use-user-role';
import { useCurrentUser } from '../../hooks/use-current-user';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui';
import { Drukvlak, Kaart, LegeStaat, Scheiding, SectieKop, StatusPil, toonKleuren, type Toon } from '../../components/werk/Bouwstenen';
import { useVeldKleuren } from '../../components/veld/BuitenModus';
import type { Id } from '../../convex/_generated/dataModel';

import { normalizeRole, ROLE_LABELS, USER_ROLES, type UserRole } from '../../lib/roles';

interface User {
  _id: Id<'users'>;
  email: string;
  name: string;
  role: UserRole;
  linkedMedewerkerId?: Id<'medewerkers'>;
  linkedMedewerker?: {
    _id: Id<'medewerkers'>;
    naam: string;
    functie?: string;
  } | null;
  createdAt: number;
}

interface Medewerker {
  _id: Id<'medewerkers'>;
  naam: string;
  email?: string;
  functie?: string;
  isActief: boolean;
  isLinked: boolean;
}

// Role display helpers
const roleConfig = Object.fromEntries(USER_ROLES.map(role => [role, {
  label: ROLE_LABELS[role], toon: role === 'directie' ? 'primair' : role === 'klant' ? 'info' : 'neutraal',
}])) as Record<UserRole, { label: string; toon: Toon }>;

const ROL_UITLEG: Partial<Record<UserRole, string>> = {
  directie: 'Volledige toegang tot alle functies',
  medewerker: 'Alleen eigen uren en projecten',
  klant: 'Toegang via het klantportaal',
  projectleider: 'Projecten en planning beheren',
  voorman: 'Eigen werkdag en ploeg begeleiden',
  onderaannemer_zzp: 'Eigen uren en toegewezen werk',
  materiaalman: 'Materieel en eigen werkdag',
};

/** Keuzeregel in een dialoog: rand en zachte vulling als hij gekozen is. */
function KeuzeRegel({
  gekozen,
  gevaar,
  onPress,
  accessibilityLabel,
  children,
}: {
  gekozen?: boolean;
  gevaar?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  const kleuren = useVeldKleuren();
  return (
    <Drukvlak
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!gekozen }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: gevaar ? kleuren.danger : gekozen ? kleuren.primary : kleuren.border,
        backgroundColor: gevaar ? kleuren.dangerSoft : gekozen ? kleuren.primarySoft : kleuren.card,
      }}
    >
      {children}
      {gekozen && <Check size={20} color={kleuren.primary} strokeWidth={2.25} />}
    </Drukvlak>
  );
}

// User Card Component
function UserCard({
  user,
  medewerkers,
  onRoleChange,
  onLinkMedewerker,
  isCurrentUser,
}: {
  user: User;
  medewerkers: Medewerker[];
  onRoleChange: (userId: Id<'users'>, role: UserRole) => void;
  onLinkMedewerker: (userId: Id<'users'>, medewerkerId?: Id<'medewerkers'>) => void;
  isCurrentUser: boolean;
}) {
  const kleuren = useVeldKleuren();
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const canonicalRole = normalizeRole(user.role);
  const config = canonicalRole === 'onbekend' ? { label: 'Onbekend', toon: 'neutraal' as Toon } : roleConfig[canonicalRole];
  const rolKleur = toonKleuren(kleuren, config.toon);

  // Available medewerkers for linking (active and not linked to someone else)
  const availableMedewerkers = useMemo(() => {
    return medewerkers.filter((m) => m.isActief && (!m.isLinked || user.linkedMedewerkerId?.toString() === m._id.toString()));
  }, [medewerkers, user.linkedMedewerkerId]);

  const rolInhoud = (
    <>
      <Text style={[tekst.voetnoot, { color: rolKleur.voor, fontWeight: '600' }]}>{config.label}</Text>
      {!isCurrentUser && <ChevronDown size={16} color={rolKleur.voor} strokeWidth={2.25} />}
    </>
  );
  const rolStijl = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, alignSelf: 'flex-start' as const, minHeight: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: rolKleur.achter };

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.primarySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>
            {user.name?.slice(0, 2).toUpperCase() || 'U'}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[tekst.kop, { color: kleuren.foreground, flexShrink: 1 }]} numberOfLines={1}>
              {user.name}
            </Text>
            {isCurrentUser && <StatusPil label="Jij" toon="primair" />}
          </View>
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>
            {user.email}
          </Text>
          {user.linkedMedewerker && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Link size={13} color={kleuren.mutedForeground} strokeWidth={2} />
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, flexShrink: 1 }]} numberOfLines={1}>
                {user.linkedMedewerker.naam}
              </Text>
            </View>
          )}
          <View style={{ marginTop: 6 }}>
            {isCurrentUser ? (
              <View style={rolStijl}>{rolInhoud}</View>
            ) : (
              <Drukvlak
                onPress={() => setShowRoleDialog(true)}
                accessibilityLabel={`Rol van ${user.name}: ${config.label}`}
                accessibilityHint="Opent de rolkeuze"
                style={rolStijl}
              >
                {rolInhoud}
              </Drukvlak>
            )}
          </View>
        </View>

        <Drukvlak
          onPress={() => setShowLinkDialog(true)}
          accessibilityLabel={user.linkedMedewerker ? `Gekoppeld aan ${user.linkedMedewerker.naam}, koppeling wijzigen` : 'Medewerker koppelen'}
          style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: kleuren.border, alignItems: 'center', justifyContent: 'center' }}
        >
          {user.linkedMedewerker
            ? <UserCheck size={20} color={kleuren.primary} strokeWidth={2} />
            : <UserPlus size={20} color={kleuren.mutedForeground} strokeWidth={2} />}
        </Drukvlak>
      </View>

      {/* Role Change Dialog */}
      <Dialog visible={showRoleDialog} onClose={() => setShowRoleDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rol wijzigen</DialogTitle>
            <DialogDescription>
              Selecteer een nieuwe rol voor {user.name}
            </DialogDescription>
          </DialogHeader>
          <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
            {(Object.keys(roleConfig) as UserRole[]).map((role) => {
              const roleInfo = roleConfig[role];
              const isSelected = canonicalRole === role;
              return (
                <KeuzeRegel
                  key={role}
                  gekozen={isSelected}
                  accessibilityLabel={roleInfo.label}
                  onPress={() => {
                    onRoleChange(user._id, role);
                    setShowRoleDialog(false);
                  }}
                >
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[tekst.kop, { color: kleuren.foreground, fontWeight: '500' }]}>
                      {roleInfo.label}
                    </Text>
                    <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]}>
                      {ROL_UITLEG[role]}
                    </Text>
                  </View>
                </KeuzeRegel>
              );
            })}
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              title="Annuleren"
              onPress={() => setShowRoleDialog(false)}
              fullWidth
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Medewerker Dialog */}
      <Dialog visible={showLinkDialog} onClose={() => setShowLinkDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Medewerker koppelen</DialogTitle>
            <DialogDescription>
              Koppel {user.name} aan een medewerker profiel
            </DialogDescription>
          </DialogHeader>
          <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 12, maxHeight: 300 }}>
            {/* Unlink option */}
            {user.linkedMedewerker && (
              <KeuzeRegel
                gevaar
                accessibilityLabel="Ontkoppelen"
                onPress={() => {
                  onLinkMedewerker(user._id, undefined);
                  setShowLinkDialog(false);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <CircleX size={20} color={kleuren.danger} strokeWidth={2} />
                  <Text style={[tekst.kop, { color: kleuren.danger, fontWeight: '500' }]}>
                    Ontkoppelen
                  </Text>
                </View>
              </KeuzeRegel>
            )}

            {/* Medewerker options */}
            {availableMedewerkers.map((medewerker) => {
              const isSelected = user.linkedMedewerkerId?.toString() === medewerker._id.toString();
              return (
                <KeuzeRegel
                  key={medewerker._id}
                  gekozen={isSelected}
                  accessibilityLabel={medewerker.functie ? `${medewerker.naam}, ${medewerker.functie}` : medewerker.naam}
                  onPress={() => {
                    onLinkMedewerker(user._id, medewerker._id);
                    setShowLinkDialog(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: kleuren.muted, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={[tekst.bijschrift, { color: kleuren.foreground, fontWeight: '600' }]}>
                        {medewerker.naam?.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[tekst.kop, { color: kleuren.foreground, fontWeight: '500' }]} numberOfLines={1}>
                        {medewerker.naam}
                      </Text>
                      {medewerker.functie && (
                        <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]} numberOfLines={1}>
                          {medewerker.functie}
                        </Text>
                      )}
                    </View>
                  </View>
                </KeuzeRegel>
              );
            })}

            {availableMedewerkers.length === 0 && !user.linkedMedewerker && (
              <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center', paddingVertical: 16 }]}>
                Geen beschikbare medewerkers om te koppelen
              </Text>
            )}
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              title="Annuleren"
              onPress={() => setShowLinkDialog(false)}
              fullWidth
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Main Admin Screen
export default function AdminScreen() {
  const kleuren = useVeldKleuren();
  const { isAdmin, isLoaded: roleLoaded } = useUserRole();
  const { user: currentUser, isLoading: userLoading } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);

  // Queries
  const users = useQuery(api.mobile.adminListAllUsers, roleLoaded && isAdmin ? {} : 'skip');
  const medewerkers = useQuery(api.mobile.adminListMedewerkers, roleLoaded && isAdmin ? {} : 'skip');

  // Mutations
  const updateRole = useMutation(api.mobile.adminUpdateUserRole);
  const linkMedewerker = useMutation(api.mobile.adminLinkUserToMedewerker);

  const isLoading = !roleLoaded || userLoading || users === undefined || medewerkers === undefined;

  const handleRoleChange = async (userId: Id<'users'>, role: UserRole) => {
    try {
      await updateRole({ userId, role });
    } catch (error) {
      Alert.alert(
        'Fout',
        error instanceof Error ? error.message : 'Kon rol niet wijzigen'
      );
    }
  };

  const handleLinkMedewerker = async (userId: Id<'users'>, medewerkerId?: Id<'medewerkers'>) => {
    try {
      await linkMedewerker({ userId, medewerkerId });
    } catch (error) {
      Alert.alert(
        'Fout',
        error instanceof Error ? error.message : 'Kon medewerker niet koppelen'
      );
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Queries will automatically refetch
    setTimeout(() => setRefreshing(false), 500);
  };

  // Access denied for non-admins
  if (roleLoaded && !isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
          <LegeStaat icoon={Lock} titel="Geen toegang" uitleg="Alleen beheerders kunnen deze pagina bekijken" />
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={kleuren.primary} />
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>
            Laden...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const userCount = users?.length || 0;
  const adminCount = users?.filter((u: User) => normalizeRole(u.role) === 'directie').length || 0;
  const medewerkerCount = users?.filter((u: User) => u.role === 'medewerker').length || 0;
  const stats = [
    { label: 'Gebruikers', waarde: userCount },
    { label: 'Beheerders', waarde: adminCount },
    { label: 'Medewerkers', waarde: medewerkerCount },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kleuren.primary}
          />
        }
      >
        {/* Kop */}
        <View>
          <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]}>Gebruikers</Text>
          <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginTop: 2 }]}>Beheer rollen en koppelingen</Text>
        </View>

        {/* Stats Header */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {stats.map(stat => (
            <Kaart key={stat.label} padding={14} style={{ flex: 1, gap: 2 }}>
              <Text style={[tekst.titel2, tekst.cijfers, { color: kleuren.foreground }]}>{stat.waarde}</Text>
              <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground }]} numberOfLines={1}>{stat.label}</Text>
            </Kaart>
          ))}
        </View>

        {/* User List */}
        <SectieKop titel="Alle gebruikers" telling={userCount} />
        {users?.length === 0 ? (
          <LegeStaat icoon={Users} titel="Geen gebruikers gevonden" />
        ) : (
          <Kaart padding={0} style={{ paddingHorizontal: 14, gap: 0 }}>
            {users?.map((user: User, index: number) => (
              <View key={user._id}>
                {index > 0 && <Scheiding />}
                <UserCard
                  user={user}
                  medewerkers={medewerkers || []}
                  onRoleChange={handleRoleChange}
                  onLinkMedewerker={handleLinkMedewerker}
                  isCurrentUser={user._id === currentUser?._id}
                />
              </View>
            ))}
          </Kaart>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
