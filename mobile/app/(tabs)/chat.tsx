import React, { useState, useCallback, useRef, useEffect, useMemo, type ComponentType } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Folder, Megaphone, MessageCircle, Send, SquarePen, Users, X } from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { hapticPatterns, tekst } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { TabsContent } from '../../components/ui';
import { Drukvlak, LegeStaat, toonKleuren, type Toon } from '../../components/werk/Bouwstenen';
import { useIsDonker, useVeldKleuren } from '../../components/veld/BuitenModus';
import type { Id } from '../../convex/_generated/dataModel';

type Icoon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Types
type ChannelType = 'team' | 'dm' | 'project' | 'broadcast';

interface DMConversation {
  partnerId: Id<'users'>;
  partnerName: string;
  partnerEmail?: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
}

interface Message {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  message: string;
  createdAt: number;
  isOwn?: boolean;
}

// Map role to Dutch display label
const ROLE_LABELS: Record<string, string> = {
  directie: 'Directie',
  projectleider: 'Projectleider',
  voorman: 'Voorman',
  medewerker: 'Medewerker',
  klant: 'Klant',
};

// Helper function to format timestamps in Dutch
function formatTimestamp(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeString = date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (messageDate.getTime() === today.getTime()) {
    return `vandaag ${timeString}`;
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return `gisteren ${timeString}`;
  } else {
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ` ${timeString}`;
  }
}

// Helper function to get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Vaste toon per naam, zodat iemand overal dezelfde avatarkleur houdt.
const AVATAR_TONEN: Toon[] = ['primair', 'info', 'wachten', 'neutraal'];
function avatarToon(name: string): Toon {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_TONEN[Math.abs(hash) % AVATAR_TONEN.length];
}

// Format short time for channel list items
function formatShortTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeString = date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (messageDate.getTime() === today.getTime()) {
    return timeString;
  }
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// ── Bouwstenen van de chat ──────────────────────────────────────────────────

/** Initialen in een ronde tegel, getint zoals een IcoonTegel. */
function Avatar({ naam, grootte = 40, online, randKleur }: { naam: string; grootte?: number; online?: boolean; randKleur?: string }) {
  const kleuren = useVeldKleuren();
  const { voor, achter } = toonKleuren(kleuren, avatarToon(naam));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: grootte, height: grootte, borderRadius: grootte / 2, backgroundColor: achter, alignItems: 'center', justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={1.2} style={{ color: voor, fontSize: Math.max(12, Math.round(grootte * 0.36)), fontWeight: '600' }}>
          {getInitials(naam)}
        </Text>
      </View>
      {online && (
        <View style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: kleuren.success, borderWidth: 2, borderColor: randKleur ?? kleuren.background }} />
      )}
    </View>
  );
}

/** Ongelezen-telling als gevulde pil. */
function OngelezenPil({ aantal }: { aantal: number }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: kleuren.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text maxFontSizeMultiplier={1.2} style={[tekst.bijschrift, tekst.cijfers, { color: kleuren.primaryForeground, fontWeight: '700' }]}>{aantal}</Text>
    </View>
  );
}

/** Eén berichtbubbel: eigen berichten rechts in primair, anderen links op kaartvlak. */
function Bericht({ isOwn, naam, rol, bericht, tijd }: { isOwn: boolean; naam: string; rol?: string; bericht: string; tijd: number }) {
  const kleuren = useVeldKleuren();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: isOwn ? 'flex-end' : 'flex-start', gap: 8, marginBottom: 8 }}>
      {!isOwn && <Avatar naam={naam} grootte={32} />}
      <View
        style={{
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          gap: 4,
          ...(isOwn
            ? { backgroundColor: kleuren.primary, borderBottomRightRadius: 6 }
            : { backgroundColor: kleuren.card, borderWidth: 1, borderColor: kleuren.border, borderBottomLeftRadius: 6 }),
        }}
      >
        {!isOwn && (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={[tekst.voetnoot, { color: kleuren.primary, fontWeight: '600' }]}>{naam}</Text>
            {rol && (
              <View style={{ backgroundColor: kleuren.primarySoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                <Text style={[tekst.bijschrift, { color: kleuren.primary }]}>{ROLE_LABELS[rol] || rol}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={[tekst.body, { color: isOwn ? kleuren.primaryForeground : kleuren.foreground }]}>{bericht}</Text>
        <Text
          style={[
            tekst.bijschrift,
            tekst.cijfers,
            { fontWeight: '400', textAlign: 'right', color: isOwn ? kleuren.primaryForeground : kleuren.mutedForeground, opacity: isOwn ? 0.72 : 1 },
          ]}
        >
          {formatTimestamp(tijd)}
        </Text>
      </View>
    </View>
  );
}

/** Gespreksregel in de DM-lijst, in de vorm van een LijstRegel. */
function GesprekRegel({ gesprek, onPress }: { gesprek: DMConversation; onPress: () => void }) {
  const kleuren = useVeldKleuren();
  const ongelezen = gesprek.unreadCount > 0;
  return (
    <Drukvlak
      onPress={onPress}
      accessibilityLabel={`${gesprek.partnerName}${ongelezen ? `, ${gesprek.unreadCount} ongelezen` : ''}. ${gesprek.lastMessage}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12 }}
    >
      <Avatar naam={gesprek.partnerName} grootte={44} online randKleur={kleuren.card} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[tekst.kop, { color: kleuren.foreground, flex: 1, fontWeight: ongelezen ? '600' : '500' }]} numberOfLines={1}>
            {gesprek.partnerName}
          </Text>
          <Text style={[tekst.bijschrift, tekst.cijfers, { color: ongelezen ? kleuren.primary : kleuren.mutedForeground, fontWeight: '400' }]}>
            {formatShortTime(gesprek.lastMessageAt)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, flex: 1, fontSize: 14, lineHeight: 19 }]} numberOfLines={1}>
            {gesprek.lastMessage}
          </Text>
          {ongelezen && <OngelezenPil aantal={gesprek.unreadCount} />}
        </View>
      </View>
    </Drukvlak>
  );
}

/** Haarlijn tussen regels in een gegroepeerde lijst, ingesprongen tot na de avatar. */
function RegelScheiding() {
  const kleuren = useVeldKleuren();
  return <View style={{ height: 1, backgroundColor: kleuren.border, marginLeft: 56 }} />;
}

// Wrapper component that handles auth check
export default function ChatScreen() {
  const { isLoading, isUserSynced } = useCurrentUser();
  const kleuren = useVeldKleuren();

  // Show loading while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <ActivityIndicator size="large" color={kleuren.primary} />
          <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <AuthenticatedChatScreen />;
}

// Separate component that only renders when authenticated
function AuthenticatedChatScreen() {
  const kleuren = useVeldKleuren();
  const donker = useIsDonker();
  const { user: currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<ChannelType>('team');
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDMConversation, setSelectedDMConversation] = useState<DMConversation | null>(null);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  // Aparte refs per lijst: één gedeelde ref stond eerder op zowel de team- als de
  // projectlijst, waardoor scrollen naar het nieuwste bericht de verkeerde lijst raakte.
  const teamListRef = useRef<FlatList>(null);
  const projectListRef = useRef<FlatList>(null);
  const dmFlatListRef = useRef<FlatList>(null);

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const teamMessages = useQuery(api.chat.getTeamMessages, { channelType: 'team', limit: 50 });
  const broadcastMessages = useQuery(api.chat.getTeamMessages, { channelType: 'broadcast', limit: 50 });
  const projectMessages = useQuery(api.chat.getTeamMessages, { channelType: 'project', limit: 50 });
  const dmConversations = useQuery(api.chat.getDMConversations);
  const unreadCounts = useQuery(api.chat.getUnreadCounts);
  const dmUsers = useQuery(api.chat.getUsersForDM, activeTab === 'dm' ? {} : 'skip');

  // Query DM messages when a conversation is selected
  const dmMessages = useQuery(
    api.chat.getDirectMessages,
    selectedDMConversation ? { withUserId: selectedDMConversation.partnerId, limit: 50 } : 'skip'
  );

  // Convex mutations
  const sendTeamMessage = useMutation(api.chat.sendTeamMessage);
  const markAsRead = useMutation(api.chat.markTeamMessagesAsRead);
  const sendDirectMessage = useMutation(api.chat.sendDirectMessage);
  const markDMAsRead = useMutation(api.chat.markDMAsRead);

  // Mark messages as read when viewing a channel
  useEffect(() => {
    if (activeTab === 'team' && teamMessages && teamMessages.length > 0) {
      markAsRead({ channelType: 'team' }).catch(console.error);
    } else if (activeTab === 'broadcast' && broadcastMessages && broadcastMessages.length > 0) {
      markAsRead({ channelType: 'broadcast' }).catch(console.error);
    } else if (activeTab === 'project' && projectMessages && projectMessages.length > 0) {
      markAsRead({ channelType: 'project' }).catch(console.error);
    }
  }, [activeTab, teamMessages, broadcastMessages, projectMessages, markAsRead]);

  // Mark DM messages as read when viewing a conversation
  useEffect(() => {
    if (selectedDMConversation && dmMessages && dmMessages.length > 0) {
      markDMAsRead({ fromUserId: selectedDMConversation.partnerId }).catch(console.error);
    }
  }, [selectedDMConversation, dmMessages, markDMAsRead]);

  // Reset selected conversation when switching away from DM tab
  useEffect(() => {
    if (activeTab !== 'dm') {
      setTimeout(() => setSelectedDMConversation(null), 0);
    }
  }, [activeTab]);

  const handleSend = useCallback(async () => {
    if (!message.trim()) return;

    try {
      if (activeTab === 'team' || activeTab === 'broadcast') {
        await sendTeamMessage({
          channelType: activeTab,
          message: message.trim(),
          messageType: 'text',
        });
        teamListRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else if (activeTab === 'dm' && selectedDMConversation) {
        await sendDirectMessage({
          toUserId: selectedDMConversation.partnerId,
          message: message.trim(),
          messageType: 'text',
        });
        dmFlatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else {
        // Projectkanaal is leesgeschiedenis: de webapp behandelt het read-only en
        // convex/chat.ts:68 eist een projectId dat dit scherm niet heeft. Eerder werd
        // hier tóch verstuurd, wat gegarandeerd stil faalde.
        return;
      }
      setMessage('');
    } catch (error) {
      // Was console.error: de gebruiker zag niets gebeuren en bleef het opnieuw proberen.
      const melding =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data: unknown }).data)
          : 'Controleer je verbinding en probeer het opnieuw.';
      Alert.alert('Versturen mislukt', melding);
    }
  }, [message, activeTab, sendTeamMessage, sendDirectMessage, selectedDMConversation]);

  // Handle selecting a DM conversation
  const handleSelectDMConversation = useCallback((conversation: DMConversation) => {
    setSelectedDMConversation(conversation);
    setMessage('');
  }, []);

  // Handle going back to conversation list
  const handleBackToConversations = useCallback(() => {
    setSelectedDMConversation(null);
    setMessage('');
  }, []);

  // Handle selecting a user from the new DM modal
  const handleStartNewDM = useCallback((user: { userId: Id<'users'>; naam: string; email?: string; functie?: string }) => {
    setShowNewDMModal(false);
    // Check if there's already an existing conversation with this user
    const existing = dmConversations?.find((c: DMConversation) => c.partnerId === user.userId);
    if (existing) {
      setSelectedDMConversation(existing);
    } else {
      // Create a temporary DMConversation object to open the thread
      setSelectedDMConversation({
        partnerId: user.userId,
        partnerName: user.naam,
        partnerEmail: user.email,
        lastMessage: '',
        lastMessageAt: Date.now(),
        unreadCount: 0,
      });
    }
    setMessage('');
  }, [dmConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Convex queries auto-refresh, so we just wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Tab configuration with unread badges
  const tabs = [
    {
      key: 'team' as ChannelType,
      label: 'Team',
      badge: unreadCounts?.team || 0,
    },
    {
      key: 'broadcast' as ChannelType,
      label: 'Mededelingen',
      badge: unreadCounts?.broadcast || 0,
    },
    {
      key: 'dm' as ChannelType,
      label: 'DM',
      badge: unreadCounts?.dm || 0,
    },
    {
      key: 'project' as ChannelType,
      label: 'Project',
      badge: unreadCounts?.project || 0,
    },
  ];

  // Render message bubble
  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <Bericht isOwn={!!item.isOwn} naam={item.senderName} rol={item.senderRole} bericht={item.message} tijd={item.createdAt} />
    ),
    []
  );

  // Render DM conversation item
  const renderDMConversation = useCallback(
    ({ item }: { item: DMConversation }) => (
      <GesprekRegel gesprek={item} onPress={() => handleSelectDMConversation(item)} />
    ),
    [handleSelectDMConversation]
  );

  // Render DM message item
  const renderDMMessage = useCallback(
    ({ item }: { item: any }) => {
      // Determine if this message is from the current user
      const isOwn = item.toUserId === selectedDMConversation?.partnerId;
      const senderName = isOwn ? 'Jij' : selectedDMConversation?.partnerName || 'Onbekend';
      return <Bericht isOwn={isOwn} naam={senderName} bericht={item.message} tijd={item.createdAt} />;
    },
    [selectedDMConversation]
  );

  // Berichten voor het actieve tabblad, omgekeerd voor de inverted FlatList.
  //
  // convex/chat.ts:201 levert OPLOPEND (oudste eerst). Een inverted FlatList zet index 0
  // visueel onderaan, dus zonder reverse() stond het oudste bericht onderaan en verscheen
  // een nieuw bericht buiten beeld. De DM-lijst deed dit al goed (:571).
  // Laat convex/chat.ts ongemoeid — de webapp rekent op oplopende volgorde.
  const messages = useMemo(() => {
    const src =
      activeTab === 'team'
        ? teamMessages
        : activeTab === 'broadcast'
          ? broadcastMessages
          : activeTab === 'project'
            ? projectMessages
            : undefined;
    const currentUserId = currentUser?._id;
    return (src ?? [])
      .map((m: any) => ({ ...m, isOwn: m.senderId === currentUserId }))
      .reverse();
  }, [activeTab, teamMessages, broadcastMessages, projectMessages, currentUser?._id]);

  const invertedDMMessages = useMemo(
    () => [...(dmMessages ?? [])].reverse(),
    [dmMessages]
  );
  const isLoading = false; // Never block UI

  // Kanaalkeuze: iOS-segmentbalk met ongelezen-tellingen. Segmenten krijgen de
  // breedte van hun label, zodat "Mededelingen" past zonder zijwaarts te scrollen.
  const renderTabBar = () => (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Kanalen"
      style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: kleuren.muted, borderRadius: 14, padding: 3, minHeight: 44 }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.badge > 0 ? `${tab.label}, ${tab.badge} ongelezen` : tab.label}
            onPress={() => {
              if (isActive) return;
              void hapticPatterns.selection();
              setActiveTab(tab.key);
            }}
            style={{
              flexGrow: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              minHeight: 38,
              paddingHorizontal: 10,
              borderRadius: 11,
              backgroundColor: isActive ? (donker ? kleuren.surfaceElevated : kleuren.card) : 'transparent',
              borderWidth: isActive && donker ? 1 : 0,
              borderColor: kleuren.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isActive && !donker ? 0.08 : 0,
              shadowRadius: 6,
              elevation: isActive && !donker ? 2 : 0,
            }}
          >
            <Text
              numberOfLines={1}
              style={[tekst.voetnoot, { flexShrink: 1, fontWeight: isActive ? '600' : '500', color: isActive ? kleuren.foreground : kleuren.mutedForeground }]}
            >
              {tab.label}
            </Text>
            {tab.badge > 0 && <OngelezenPil aantal={tab.badge} />}
          </Pressable>
        );
      })}
    </View>
  );

  // Empty state renderer
  const renderEmptyState = (icoon: Icoon, title: string, subtitle: string) => (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
      <LegeStaat icoon={icoon} titel={title} uitleg={subtitle} />
    </View>
  );

  // Loading state renderer
  const renderLoadingState = (text: string) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 32 }}>
      <ActivityIndicator size="large" color={kleuren.primary} />
      <Text style={[tekst.sub, { color: kleuren.mutedForeground, textAlign: 'center' }]}>{text}</Text>
    </View>
  );

  const verversen = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kleuren.primary} />;
  const berichtenLijstStijl = { padding: 16, paddingBottom: 8 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: kleuren.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        {selectedDMConversation ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: kleuren.border }}>
            <Drukvlak
              onPress={handleBackToConversations}
              accessibilityLabel="Terug naar gesprekken"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.muted, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={24} color={kleuren.foreground} strokeWidth={2.25} />
            </Drukvlak>
            <Avatar naam={selectedDMConversation.partnerName} grootte={36} online />
            <Text accessibilityRole="header" style={[tekst.kop, { color: kleuren.foreground, flex: 1 }]} numberOfLines={1}>
              {selectedDMConversation.partnerName}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
            <Text accessibilityRole="header" style={[tekst.grootTitel, { color: kleuren.foreground }]}>Chat</Text>
            <Text style={[tekst.sub, { color: kleuren.mutedForeground, marginTop: 2 }]}>Top Tuinen</Text>
          </View>
        )}

        {/* Tabs - hide when viewing a DM conversation */}
        {!selectedDMConversation && renderTabBar()}

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Team Chat */}
          <TabsContent tabKey="team" activeTab={activeTab}>
            {isLoading ? (
              renderLoadingState('Berichten laden...')
            ) : messages.length === 0 ? (
              renderEmptyState(MessageCircle, 'Nog geen berichten', 'Start een gesprek met je team!')
            ) : (
              <FlatList
                ref={teamListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={berichtenLijstStijl}
                showsVerticalScrollIndicator={false}
                refreshControl={verversen}
              />
            )}
          </TabsContent>

          {/* Mededelingen (Broadcast) */}
          <TabsContent tabKey="broadcast" activeTab={activeTab}>
            {isLoading ? (
              renderLoadingState('Mededelingen laden...')
            ) : messages.length === 0 ? (
              renderEmptyState(Megaphone, 'Geen mededelingen', 'Hier verschijnen belangrijke berichten van de directie')
            ) : (
              <FlatList
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={berichtenLijstStijl}
                showsVerticalScrollIndicator={false}
                refreshControl={verversen}
              />
            )}
          </TabsContent>

          {/* DM */}
          <TabsContent tabKey="dm" activeTab={activeTab}>
            {selectedDMConversation ? (
              // Show DM conversation thread
              isLoading ? (
                renderLoadingState('Berichten laden...')
              ) : !dmMessages || dmMessages.length === 0 ? (
                renderEmptyState(MessageCircle, 'Nog geen berichten', `Stuur je eerste bericht naar ${selectedDMConversation.partnerName}`)
              ) : (
                <FlatList
                  ref={dmFlatListRef}
                  data={invertedDMMessages}
                  keyExtractor={(item) => item._id}
                  renderItem={renderDMMessage}
                  inverted
                  contentContainerStyle={berichtenLijstStijl}
                  showsVerticalScrollIndicator={false}
                  refreshControl={verversen}
                />
              )
            ) : (
              // Show conversation list
              <View style={{ flex: 1 }}>
                {isLoading ? (
                  renderLoadingState('Gesprekken laden...')
                ) : !dmConversations || dmConversations.length === 0 ? (
                  renderEmptyState(Users, 'Geen directe berichten', 'Start een privegesprek met een collega')
                ) : (
                  <FlatList
                    data={dmConversations}
                    keyExtractor={(item) => item.partnerId}
                    renderItem={renderDMConversation}
                    ItemSeparatorComponent={RegelScheiding}
                    contentContainerStyle={{
                      marginHorizontal: 16,
                      marginTop: 8,
                      marginBottom: 120,
                      paddingHorizontal: 14,
                      backgroundColor: kleuren.card,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: kleuren.border,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={verversen}
                  />
                )}
                {/* Floating action button for new DM */}
                <Drukvlak
                  onPress={() => setShowNewDMModal(true)}
                  accessibilityLabel="Nieuw gesprek"
                  buitenStijl={{ position: 'absolute', bottom: 100, right: 20 }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: kleuren.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.18,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <SquarePen size={22} color={kleuren.primaryForeground} strokeWidth={2.25} />
                </Drukvlak>
              </View>
            )}
          </TabsContent>

          {/* Project Chat */}
          <TabsContent tabKey="project" activeTab={activeTab}>
            {isLoading ? (
              renderLoadingState('Berichten laden...')
            ) : messages.length === 0 ? (
              renderEmptyState(Folder, 'Geen project berichten', 'Selecteer een project om berichten te zien')
            ) : (
              <FlatList
                ref={projectListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={berichtenLijstStijl}
                showsVerticalScrollIndicator={false}
                refreshControl={verversen}
              />
            )}
          </TabsContent>
        </View>

        {/* Input bar — team/broadcast en een geopend DM-gesprek.
            Het projectkanaal is bewust uitgesloten: dat is leesgeschiedenis (de webapp
            behandelt het read-only) en versturen faalde daar altijd. */}
        {(activeTab === 'team' || activeTab === 'broadcast' || selectedDMConversation) && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 100,
              backgroundColor: kleuren.card,
              borderTopWidth: 1,
              borderTopColor: kleuren.border,
            }}
          >
            <TextInput
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                paddingHorizontal: 16,
                paddingTop: 11,
                paddingBottom: 11,
                borderRadius: 22,
                backgroundColor: kleuren.muted,
                color: kleuren.foreground,
                fontSize: tekst.body.fontSize,
                letterSpacing: tekst.body.letterSpacing,
              }}
              value={message}
              onChangeText={setMessage}
              placeholder="Typ een bericht..."
              placeholderTextColor={kleuren.mutedForeground}
              accessibilityLabel="Bericht"
              multiline
              maxLength={1000}
            />
            <Drukvlak
              onPress={handleSend}
              disabled={!message.trim()}
              accessibilityLabel="Versturen"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Send size={19} color={kleuren.primaryForeground} strokeWidth={2.25} />
            </Drukvlak>
          </View>
        )}
        {/* New DM user selection modal */}
        <Modal
          visible={showNewDMModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowNewDMModal(false)}
        >
          {/* Scrim onder het blad: blijft in beide thema's donker. */}
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: kleuren.background,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                maxHeight: '70%',
                minHeight: 300,
                borderTopWidth: 1,
                borderTopColor: kleuren.border,
              }}
            >
              {/* Modal header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 12, paddingVertical: 10 }}>
                <Text accessibilityRole="header" style={[tekst.titel3, { color: kleuren.foreground }]}>Nieuw gesprek</Text>
                <Drukvlak
                  onPress={() => setShowNewDMModal(false)}
                  accessibilityLabel="Sluiten"
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kleuren.muted, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={20} color={kleuren.foreground} strokeWidth={2.25} />
                </Drukvlak>
              </View>

              {/* User list */}
              {!dmUsers ? (
                <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <ActivityIndicator size="large" color={kleuren.primary} />
                  <Text style={[tekst.sub, { color: kleuren.mutedForeground }]}>Collega&apos;s laden...</Text>
                </View>
              ) : dmUsers.length === 0 ? (
                <View style={{ padding: 16, paddingBottom: 40 }}>
                  <LegeStaat icoon={Users} titel="Geen collega's beschikbaar" uitleg="Er zijn geen andere gebruikers om mee te chatten" />
                </View>
              ) : (
                <FlatList
                  data={dmUsers}
                  keyExtractor={(item) => item.userId}
                  ItemSeparatorComponent={RegelScheiding}
                  contentContainerStyle={{
                    marginHorizontal: 16,
                    marginTop: 4,
                    marginBottom: 40,
                    paddingHorizontal: 14,
                    backgroundColor: kleuren.card,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: kleuren.border,
                  }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <Drukvlak
                      onPress={() => handleStartNewDM(item)}
                      accessibilityLabel={item.functie ? `Gesprek met ${item.naam}, ${item.functie}` : `Gesprek met ${item.naam}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 }}
                    >
                      <Avatar naam={item.naam} grootte={44} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[tekst.kop, { color: kleuren.foreground, fontWeight: '500' }]} numberOfLines={1}>{item.naam}</Text>
                        {item.functie && (
                          <Text style={[tekst.voetnoot, { color: kleuren.mutedForeground, fontSize: 14 }]} numberOfLines={1}>{item.functie}</Text>
                        )}
                      </View>
                      <MessageCircle size={20} color={kleuren.primary} strokeWidth={2} />
                    </Drukvlak>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
