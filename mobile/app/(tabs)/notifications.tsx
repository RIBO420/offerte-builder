/**
 * Meldingen — alle meldingen van de ingelogde gebruiker, gegroepeerd in
 * "Vandaag" en "Eerder". Zelfde regels als op Home: icoontegel per soort,
 * tikken opent, naar rechts vegen verbergt.
 */

import { useCallback, type ComponentType } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, BellOff, CheckCheck, ChevronLeft, FileText, Hammer, MessageCircle } from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useCurrentUser } from '../../hooks/use-current-user';
import { tekst } from '../../theme';
import { NotificationBanner, SkeletonCard } from '../../components/ui';
import { Drukvlak, IcoonTegel, LegeStaat, SectieKop, type Toon } from '../../components/werk/Bouwstenen';
import { useVeldKleuren } from '../../components/veld/BuitenModus';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function tijdGeleden(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minuten = Math.floor(diff / 60000);
  const uren = Math.floor(diff / 3600000);
  const dagen = Math.floor(diff / 86400000);
  if (minuten < 1) return 'nu';
  if (minuten < 60) return `${minuten} min`;
  if (uren < 24) return `${uren} u`;
  if (dagen < 7) return `${dagen} d`;
  return `${Math.floor(dagen / 7)} w`;
}

/** Zelfde soort→icoon/toon als de meldingen op Home. */
function meldingIcoon(type: string): { icoon: Icoon; toon: Toon } {
  if (type.startsWith('offerte_')) return { icoon: FileText, toon: 'info' };
  if (type.startsWith('chat_')) return { icoon: MessageCircle, toon: 'primair' };
  if (type.startsWith('project_')) return { icoon: Hammer, toon: 'wachten' };
  return { icoon: Bell, toon: 'neutraal' };
}

type NotificationItem = {
  _id: string;
  _creationTime: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  projectId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const kleuren = useVeldKleuren();
  const { isLoading: isUserLoading, isUserSynced } = useCurrentUser();

  const notifications = useQuery(
    api.notifications.list,
    isUserSynced ? { limit: 50 } : 'skip'
  );
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isUserSynced ? {} : 'skip'
  );
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const dismissNotification = useMutation(api.notifications.dismiss);

  const isLoading = isUserLoading || notifications === undefined;
  const totalUnread = unreadCount?.total ?? 0;

  const handleNotificationPress = useCallback(
    (notif: NotificationItem) => {
      // Mark as read
      if (!notif.isRead) {
        markAsRead({ notificationId: notif._id as Id<'notifications'> });
      }

      // Navigate to related content
      if (notif.type === "system_reminder" && notif.metadata?.route === "/uren") {
        router.push({ pathname: "/werk/kantoor-uren", params: { datum: typeof notif.metadata.datum === "string" ? notif.metadata.datum : "" } });
      } else if (notif.projectId) {
        router.push(`/project/${notif.projectId}`);
      }
    },
    [markAsRead, router]
  );

  const handleDismiss = useCallback(
    (notifId: string) => {
      dismissNotification({ notificationId: notifId as Id<'notifications'> });
    },
    [dismissNotification]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead({});
  }, [markAllAsRead]);

  // Vandaag = sinds middernacht op dit toestel.
  const middernacht = new Date();
  middernacht.setHours(0, 0, 0, 0);
  const lijst = (notifications as NotificationItem[] | undefined) ?? [];
  const groepen = [
    { titel: 'Vandaag', items: lijst.filter(m => m._creationTime >= middernacht.getTime()) },
    { titel: 'Eerder', items: lijst.filter(m => m._creationTime < middernacht.getTime()) },
  ].filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            tintColor={kleuren.primary}
            colors={[kleuren.primary]}
          />
        }
      >
        {/* Navigatie */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <Drukvlak
            onPress={() => router.back()}
            accessibilityLabel="Terug"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.muted, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={24} color={kleuren.foreground} strokeWidth={2.25} />
          </Drukvlak>
          {totalUnread > 0 && (
            <Drukvlak
              onPress={handleMarkAllAsRead}
              accessibilityLabel="Alles als gelezen markeren"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: kleuren.primarySoft }}
            >
              <CheckCheck size={18} color={kleuren.primary} strokeWidth={2.25} />
              <Text style={[tekst.sub, { color: kleuren.primary, fontWeight: '600' }]}>Markeer alles</Text>
            </Drukvlak>
          )}
        </View>

        {/* Kop */}
        <View>
          <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]}>Meldingen</Text>
          <Text style={[tekst.sub, tekst.cijfers, { color: kleuren.mutedForeground, marginTop: 2 }]}>
            {totalUnread > 0 ? `${totalUnread} ongelezen` : 'Geen ongelezen meldingen'}
          </Text>
        </View>

        {/* Inhoud */}
        {isLoading ? (
          <View style={{ gap: 8 }}>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </View>
        ) : groepen.length === 0 ? (
          <LegeStaat icoon={BellOff} titel="Geen meldingen" uitleg="Je bent helemaal bij! Nieuwe meldingen verschijnen hier." />
        ) : (
          groepen.map(groep => (
            <View key={groep.titel} style={{ gap: 8 }}>
              <SectieKop titel={groep.titel} telling={groep.items.filter(m => !m.isRead).length} />
              {groep.items.map(item => {
                const { icoon, toon } = meldingIcoon(item.type);
                return (
                  <NotificationBanner
                    key={item._id}
                    icon={<IcoonTegel icoon={icoon} toon={toon} grootte={36} />}
                    title={item.title}
                    subtitle={item.message}
                    time={tijdGeleden(item._creationTime)}
                    isUnread={!item.isRead}
                    onPress={() => handleNotificationPress(item)}
                    onDismiss={() => handleDismiss(item._id)}
                  />
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
