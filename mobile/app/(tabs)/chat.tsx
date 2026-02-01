import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useColors } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { Tabs, TabsContent, Badge } from '../../components/ui';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import type { Id } from '../../convex/_generated/dataModel';

// Types
type ChannelType = 'team' | 'dm' | 'project';

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
  message: string;
  createdAt: number;
  isOwn?: boolean;
}

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

// Helper function to generate consistent color from name
function getAvatarColor(name: string): string {
  const colors = [
    '#2D5A27', // Garden green
    '#8B7355', // Earth brown
    '#3B82F6', // Water blue
    '#9333EA', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Wrapper component that handles auth check
export default function ChatScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, color: colors.mutedForeground }}>Laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return <AuthenticatedChatScreen />;
}

// Separate component that only renders when authenticated
function AuthenticatedChatScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<ChannelType>('team');
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDMConversation, setSelectedDMConversation] = useState<DMConversation | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const dmFlatListRef = useRef<FlatList>(null);

  // These queries will only run when this component is mounted (i.e., when authenticated)
  const teamMessages = useQuery(api.chat.getTeamMessages, { channelType: 'team', limit: 50 });
  const projectMessages = useQuery(api.chat.getTeamMessages, { channelType: 'project', limit: 50 });
  const dmConversations = useQuery(api.chat.getDMConversations);
  const unreadCounts = useQuery(api.chat.getUnreadCounts);

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

  // Get current user ID (from messages)
  const getCurrentUserId = useCallback(() => {
    // We determine the current user by finding messages marked as own
    // or by checking the senderClerkId against current auth
    return null; // Will be determined from message data
  }, []);

  // Mark messages as read when viewing a channel
  useEffect(() => {
    if (activeTab === 'team' && teamMessages && teamMessages.length > 0) {
      markAsRead({ channelType: 'team' }).catch(console.error);
    } else if (activeTab === 'project' && projectMessages && projectMessages.length > 0) {
      markAsRead({ channelType: 'project' }).catch(console.error);
    }
  }, [activeTab, teamMessages, projectMessages, markAsRead]);

  // Mark DM messages as read when viewing a conversation
  useEffect(() => {
    if (selectedDMConversation && dmMessages && dmMessages.length > 0) {
      markDMAsRead({ fromUserId: selectedDMConversation.partnerId }).catch(console.error);
    }
  }, [selectedDMConversation, dmMessages, markDMAsRead]);

  // Reset selected conversation when switching away from DM tab
  useEffect(() => {
    if (activeTab !== 'dm') {
      setSelectedDMConversation(null);
    }
  }, [activeTab]);

  const handleSend = useCallback(async () => {
    if (!message.trim()) return;

    try {
      if (activeTab === 'team' || activeTab === 'project') {
        await sendTeamMessage({
          channelType: activeTab === 'team' ? 'team' : 'project',
          message: message.trim(),
          messageType: 'text',
        });
      } else if (activeTab === 'dm' && selectedDMConversation) {
        await sendDirectMessage({
          toUserId: selectedDMConversation.partnerId,
          message: message.trim(),
          messageType: 'text',
        });
      }
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
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

  // Render message item
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = item.isOwn;
      const showAvatar = !isOwn;

      return (
        <View
          style={[
            styles.messageContainer,
            isOwn ? styles.messageContainerOwn : styles.messageContainerOther,
          ]}
        >
          {showAvatar && (
            <View
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(item.senderName) },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(item.senderName)}</Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isOwn
                ? [styles.messageBubbleOwn, { backgroundColor: colors.scope.borders }]
                : [styles.messageBubbleOther, { backgroundColor: colors.card }],
            ]}
          >
            {!isOwn && (
              <Text style={[styles.senderName, { color: colors.scope.borders }]}>
                {item.senderName}
              </Text>
            )}
            <Text
              style={[
                styles.messageText,
                { color: isOwn ? '#FFFFFF' : colors.foreground },
              ]}
            >
              {item.message}
            </Text>
            <Text
              style={[
                styles.messageTime,
                { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.mutedForeground },
              ]}
            >
              {formatTimestamp(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [colors]
  );

  // Render DM conversation item
  const renderDMConversation = useCallback(
    ({ item }: { item: DMConversation }) => {
      return (
        <TouchableOpacity
          style={[styles.dmItem, { backgroundColor: colors.card }]}
          activeOpacity={0.7}
          onPress={() => handleSelectDMConversation(item)}
        >
          <View
            style={[
              styles.dmAvatar,
              { backgroundColor: getAvatarColor(item.partnerName) },
            ]}
          >
            <Text style={styles.dmAvatarText}>{getInitials(item.partnerName)}</Text>
          </View>
          <View style={styles.dmContent}>
            <View style={styles.dmHeader}>
              <Text style={[styles.dmName, { color: colors.foreground }]}>
                {item.partnerName}
              </Text>
              <Text style={[styles.dmTime, { color: colors.mutedForeground }]}>
                {formatTimestamp(item.lastMessageAt)}
              </Text>
            </View>
            <View style={styles.dmPreviewRow}>
              <Text
                style={[styles.dmPreview, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
              {item.unreadCount > 0 && (
                <Badge variant="destructive" size="sm">
                  {item.unreadCount}
                </Badge>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, handleSelectDMConversation]
  );

  // Render DM message item
  const renderDMMessage = useCallback(
    ({ item }: { item: any }) => {
      // Determine if this message is from the current user
      const isOwn = item.toUserId === selectedDMConversation?.partnerId;
      const showAvatar = !isOwn;
      const senderName = isOwn ? 'Jij' : selectedDMConversation?.partnerName || 'Onbekend';

      return (
        <View
          style={[
            styles.messageContainer,
            isOwn ? styles.messageContainerOwn : styles.messageContainerOther,
          ]}
        >
          {showAvatar && (
            <View
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(senderName) },
              ]}
            >
              <Text style={styles.avatarText}>{getInitials(senderName)}</Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isOwn
                ? [styles.messageBubbleOwn, { backgroundColor: colors.scope.borders }]
                : [styles.messageBubbleOther, { backgroundColor: colors.card }],
            ]}
          >
            {!isOwn && (
              <Text style={[styles.senderName, { color: colors.scope.borders }]}>
                {senderName}
              </Text>
            )}
            <Text
              style={[
                styles.messageText,
                { color: isOwn ? '#FFFFFF' : colors.foreground },
              ]}
            >
              {item.message}
            </Text>
            <Text
              style={[
                styles.messageTime,
                { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.mutedForeground },
              ]}
            >
              {formatTimestamp(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [colors, selectedDMConversation]
  );

  // Get messages for current tab
  const getMessages = () => {
    if (activeTab === 'team') {
      return teamMessages || [];
    } else if (activeTab === 'project') {
      return projectMessages || [];
    }
    return [];
  };

  const messages = getMessages();
  const isLoading =
    (activeTab === 'team' && teamMessages === undefined) ||
    (activeTab === 'project' && projectMessages === undefined) ||
    (activeTab === 'dm' && !selectedDMConversation && dmConversations === undefined) ||
    (activeTab === 'dm' && selectedDMConversation && dmMessages === undefined);

  // Dynamic styles
  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
    },
    inputContainer: {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
    },
    input: {
      backgroundColor: colors.secondary,
      color: colors.foreground,
    },
  };

  return (
    <SafeAreaView
      style={[styles.container, dynamicStyles.container]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Header with tabs */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {selectedDMConversation ? (
            <>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackToConversations}
              >
                <Feather name="arrow-left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <View style={styles.dmHeaderInfo}>
                <View
                  style={[
                    styles.dmHeaderAvatar,
                    { backgroundColor: getAvatarColor(selectedDMConversation.partnerName) },
                  ]}
                >
                  <Text style={styles.dmHeaderAvatarText}>
                    {getInitials(selectedDMConversation.partnerName)}
                  </Text>
                </View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                  {selectedDMConversation.partnerName}
                </Text>
              </View>
              <View style={styles.headerSpacer} />
            </>
          ) : (
            <>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Chat</Text>
              <TouchableOpacity style={styles.searchButton}>
                <Feather name="search" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Tabs - hide when viewing a DM conversation */}
        {!selectedDMConversation && (
          <View style={[styles.tabsContainer, { backgroundColor: colors.card }]}>
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(key) => setActiveTab(key as ChannelType)}
              variant="pills"
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Team Chat */}
          <TabsContent tabKey="team" activeTab={activeTab}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Berichten laden...
                </Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="message-circle" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Nog geen berichten
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Start een gesprek met je team!
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                  />
                }
              />
            )}
          </TabsContent>

          {/* DM */}
          <TabsContent tabKey="dm" activeTab={activeTab}>
            {selectedDMConversation ? (
              // Show DM conversation thread
              isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                    Berichten laden...
                  </Text>
                </View>
              ) : !dmMessages || dmMessages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="message-circle" size={48} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Nog geen berichten
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Stuur je eerste bericht naar {selectedDMConversation.partnerName}
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={dmFlatListRef}
                  data={[...dmMessages].reverse()}
                  keyExtractor={(item) => item._id}
                  renderItem={renderDMMessage}
                  inverted
                  contentContainerStyle={styles.messagesList}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.primary}
                    />
                  }
                />
              )
            ) : (
              // Show conversation list
              isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                    Gesprekken laden...
                  </Text>
                </View>
              ) : !dmConversations || dmConversations.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="users" size={48} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    Geen directe berichten
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Start een privegesprek met een collega
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={dmConversations}
                  keyExtractor={(item) => item.partnerId}
                  renderItem={renderDMConversation}
                  contentContainerStyle={styles.dmList}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.primary}
                    />
                  }
                />
              )
            )}
          </TabsContent>

          {/* Project Chat */}
          <TabsContent tabKey="project" activeTab={activeTab}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Berichten laden...
                </Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="folder" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Geen project berichten
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Selecteer een project om berichten te zien
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                  />
                }
              />
            )}
          </TabsContent>
        </View>

        {/* Input field - show for team/project channels and when viewing a DM conversation */}
        {(activeTab !== 'dm' || selectedDMConversation) && (
          <View style={[styles.inputContainer, dynamicStyles.inputContainer]}>
            <TouchableOpacity
              style={[styles.attachButton, { backgroundColor: colors.secondary }]}
            >
              <Feather name="plus" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              value={message}
              onChangeText={setMessage}
              placeholder="Typ een bericht..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: message.trim()
                    ? colors.scope.borders
                    : colors.muted,
                },
              ]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <Feather
                name="send"
                size={20}
                color={message.trim() ? '#FFFFFF' : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  searchButton: {
    padding: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  dmHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dmHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  dmHeaderAvatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40, // Match the back button width for centering
  },
  tabsContainer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 0,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  messagesList: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  messageContainerOwn: {
    justifyContent: 'flex-end',
  },
  messageContainerOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.sm,
    borderRadius: radius.xl,
  },
  messageBubbleOwn: {
    borderBottomRightRadius: radius.sm,
  },
  messageBubbleOther: {
    borderBottomLeftRadius: radius.sm,
  },
  senderName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
  },
  messageTime: {
    fontSize: typography.fontSize.xs - 1,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  dmList: {
    padding: spacing.md,
  },
  dmItem: {
    flexDirection: 'row',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
  },
  dmAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  dmAvatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  dmContent: {
    flex: 1,
    justifyContent: 'center',
  },
  dmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dmName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  dmTime: {
    fontSize: typography.fontSize.xs,
  },
  dmPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dmPreview: {
    fontSize: typography.fontSize.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    fontSize: typography.fontSize.base,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
