import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useColors } from '../../../theme';
import { useUserRole } from '../../../hooks/use-user-role';
import { useCurrentUser } from '../../../hooks/use-current-user';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../components/ui';
import { spacing } from '../../../theme/spacing';
import { radius } from '../../../theme/radius';
import { typography } from '../../../theme/typography';
import type { Id } from '../../../convex/_generated/dataModel';

type UserRole = 'admin' | 'medewerker' | 'viewer';

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
const roleConfig: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  admin: { label: 'Beheerder', variant: 'default' },
  medewerker: { label: 'Medewerker', variant: 'secondary' },
  viewer: { label: 'Viewer', variant: 'outline' },
};

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
  const colors = useColors();
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const config = roleConfig[user.role] || roleConfig.viewer;

  // Available medewerkers for linking (active and not linked to someone else)
  const availableMedewerkers = useMemo(() => {
    return medewerkers.filter((m) => m.isActief && (!m.isLinked || user.linkedMedewerkerId?.toString() === m._id.toString()));
  }, [medewerkers, user.linkedMedewerkerId]);

  return (
    <>
      <Card style={styles.userCard}>
        <CardContent style={styles.userCardContent}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
                {user.name?.slice(0, 2).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <View style={styles.userNameRow}>
                <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                  {user.name}
                </Text>
                {isCurrentUser && (
                  <Badge variant="outline" size="sm">Jij</Badge>
                )}
              </View>
              <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                {user.email}
              </Text>
              {user.linkedMedewerker && (
                <View style={styles.linkedInfo}>
                  <Feather name="link" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.linkedText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {user.linkedMedewerker.naam}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.userActions}>
            <TouchableOpacity
              style={[styles.roleButton, { backgroundColor: colors.muted }]}
              onPress={() => !isCurrentUser && setShowRoleDialog(true)}
              disabled={isCurrentUser}
              activeOpacity={isCurrentUser ? 1 : 0.7}
            >
              <Badge variant={config.variant} size="md">
                {config.label}
              </Badge>
              {!isCurrentUser && (
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkButton, { borderColor: colors.border }]}
              onPress={() => setShowLinkDialog(true)}
              activeOpacity={0.7}
            >
              <Feather
                name={user.linkedMedewerker ? 'user-check' : 'user-plus'}
                size={18}
                color={user.linkedMedewerker ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog visible={showRoleDialog} onClose={() => setShowRoleDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rol wijzigen</DialogTitle>
            <DialogDescription>
              Selecteer een nieuwe rol voor {user.name}
            </DialogDescription>
          </DialogHeader>
          <View style={styles.roleOptions}>
            {(Object.keys(roleConfig) as UserRole[]).map((role) => {
              const roleInfo = roleConfig[role];
              const isSelected = user.role === role;
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    { borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => {
                    onRoleChange(user._id, role);
                    setShowRoleDialog(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.roleOptionContent}>
                    <Text style={[styles.roleOptionLabel, { color: colors.foreground }]}>
                      {roleInfo.label}
                    </Text>
                    <Text style={[styles.roleOptionDesc, { color: colors.mutedForeground }]}>
                      {role === 'admin' && 'Volledige toegang tot alle functies'}
                      {role === 'medewerker' && 'Alleen eigen uren en projecten'}
                      {role === 'viewer' && 'Alleen lezen, geen wijzigingen'}
                    </Text>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
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
          <View style={styles.medewerkerList}>
            {/* Unlink option */}
            {user.linkedMedewerker && (
              <TouchableOpacity
                style={[styles.medewerkerOption, { borderColor: colors.destructive }]}
                onPress={() => {
                  onLinkMedewerker(user._id, undefined);
                  setShowLinkDialog(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.medewerkerOptionContent}>
                  <Feather name="x-circle" size={20} color={colors.destructive} />
                  <Text style={[styles.medewerkerOptionLabel, { color: colors.destructive }]}>
                    Ontkoppelen
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Medewerker options */}
            {availableMedewerkers.map((medewerker) => {
              const isSelected = user.linkedMedewerkerId?.toString() === medewerker._id.toString();
              return (
                <TouchableOpacity
                  key={medewerker._id}
                  style={[
                    styles.medewerkerOption,
                    { borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => {
                    onLinkMedewerker(user._id, medewerker._id);
                    setShowLinkDialog(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.medewerkerOptionContent}>
                    <View style={[styles.smallAvatar, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.smallAvatarText, { color: colors.foreground }]}>
                        {medewerker.naam?.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.medewerkerOptionLabel, { color: colors.foreground }]}>
                        {medewerker.naam}
                      </Text>
                      {medewerker.functie && (
                        <Text style={[styles.medewerkerOptionDesc, { color: colors.mutedForeground }]}>
                          {medewerker.functie}
                        </Text>
                      )}
                    </View>
                  </View>
                  {isSelected && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {availableMedewerkers.length === 0 && !user.linkedMedewerker && (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
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
  const colors = useColors();
  const { isAdmin, isLoaded: roleLoaded } = useUserRole();
  const { user: currentUser, isLoading: userLoading } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);

  // Queries
  const users = useQuery(api.mobile.adminListAllUsers);
  const medewerkers = useQuery(api.mobile.adminListMedewerkers);

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.accessDenied}>
          <Feather name="lock" size={48} color={colors.mutedForeground} />
          <Text style={[styles.accessDeniedTitle, { color: colors.foreground }]}>
            Geen toegang
          </Text>
          <Text style={[styles.accessDeniedText, { color: colors.mutedForeground }]}>
            Alleen beheerders kunnen deze pagina bekijken
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Laden...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const userCount = users?.length || 0;
  const adminCount = users?.filter((u: User) => u.role === 'admin').length || 0;
  const medewerkerCount = users?.filter((u: User) => u.role === 'medewerker').length || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Stats Header */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{userCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Gebruikers</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{adminCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Beheerders</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{medewerkerCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Medewerkers</Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Gebruikers
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            Beheer rollen en koppelingen
          </Text>
        </View>

        {/* User List */}
        <View style={styles.userList}>
          {users?.map((user: User) => (
            <UserCard
              key={user._id}
              user={user}
              medewerkers={medewerkers || []}
              onRoleChange={handleRoleChange}
              onLinkMedewerker={handleLinkMedewerker}
              isCurrentUser={user._id === currentUser?._id}
            />
          ))}
        </View>

        {users?.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>
              Geen gebruikers gevonden
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  accessDeniedTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
  },
  accessDeniedText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  userList: {
    gap: spacing.sm,
  },
  userCard: {
    paddingVertical: spacing.sm,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  userEmail: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  linkedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  linkedText: {
    fontSize: typography.fontSize.xs,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  linkButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  roleOptions: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  roleOptionDesc: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  medewerkerList: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: 300,
  },
  medewerkerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  medewerkerOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  medewerkerOptionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  medewerkerOptionDesc: {
    fontSize: typography.fontSize.xs,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSize.sm,
  },
});
