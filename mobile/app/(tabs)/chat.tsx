import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useColors } from '../../theme';
import { useCurrentUser } from '../../hooks/use-current-user';
import { Tabs, TabsContent, Badge } from '../../components/ui';
import { cn } from '@/lib/utils';
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

// Wrapper component that handles auth check
export default function ChatScreen() {
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <View style={styles.loadingInner}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Laden...</Text>
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

  // Render message bubble
  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isOwn = item.isOwn;
      const showAvatar = !isOwn;

      return (
        <View style={[styles.messageBubbleRow, isOwn ? styles.messageBubbleRowOwn : styles.messageBubbleRowOther]}>
          {showAvatar && (
            <View style={[styles.messageAvatar, { backgroundColor: getAvatarColor(item.senderName) }]}>
              <Text style={styles.messageAvatarText}>{getInitials(item.senderName)}</Text>
            </View>
          )}
          <View style={[styles.messageBubble, isOwn ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
            {!isOwn && (
              <Text style={styles.messageSenderName}>{item.senderName}</Text>
            )}
            <Text style={styles.messageText}>{item.message}</Text>
            <Text style={styles.messageTimestamp}>{formatTimestamp(item.createdAt)}</Text>
          </View>
        </View>
      );
    },
    []
  );

  // Render DM conversation item
  const renderDMConversation = useCallback(
    ({ item }: { item: DMConversation }) => {
      return (
        <TouchableOpacity
          style={styles.channelItem}
          activeOpacity={0.7}
          onPress={() => handleSelectDMConversation(item)}
        >
          <View style={styles.channelAvatarContainer}>
            <View style={[styles.channelAvatar, { backgroundColor: getAvatarColor(item.partnerName) }]}>
              <Text style={styles.channelAvatarText}>{getInitials(item.partnerName)}</Text>
            </View>
            {/* Online indicator */}
            <View style={styles.onlineIndicator} />
          </View>
          <View style={styles.channelContent}>
            <View style={styles.channelTopRow}>
              <Text style={styles.channelName} numberOfLines={1}>{item.partnerName}</Text>
              <Text style={styles.channelTime}>{formatShortTime(item.lastMessageAt)}</Text>
            </View>
            <View style={styles.channelBottomRow}>
              <Text style={styles.channelPreview} numberOfLines={1}>{item.lastMessage}</Text>
              {item.unreadCount > 0 && <View style={styles.unreadDot} />}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectDMConversation]
  );

  // Render DM message item
  const renderDMMessage = useCallback(
    ({ item }: { item: any }) => {
      // Determine if this message is from the current user
      const isOwn = item.toUserId === selectedDMConversation?.partnerId;
      const showAvatar = !isOwn;
      const senderName = isOwn ? 'Jij' : selectedDMConversation?.partnerName || 'Onbekend';

      return (
        <View style={[styles.messageBubbleRow, isOwn ? styles.messageBubbleRowOwn : styles.messageBubbleRowOther]}>
          {showAvatar && (
            <View style={[styles.messageAvatar, { backgroundColor: getAvatarColor(senderName) }]}>
              <Text style={styles.messageAvatarText}>{getInitials(senderName)}</Text>
            </View>
          )}
          <View style={[styles.messageBubble, isOwn ? styles.messageBubbleSent : styles.messageBubbleReceived]}>
            {!isOwn && (
              <Text style={styles.messageSenderName}>{senderName}</Text>
            )}
            <Text style={styles.messageText}>{item.message}</Text>
            <Text style={styles.messageTimestamp}>{formatTimestamp(item.createdAt)}</Text>
          </View>
        </View>
      );
    },
    [selectedDMConversation]
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
  const isLoading = false; // Never block UI

  // Custom tab bar renderer
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Empty state renderer
  const renderEmptyState = (icon: string, title: string, subtitle: string) => (
    <View style={styles.emptyState}>
      <Feather name={icon as any} size={48} color="#555555" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  // Loading state renderer
  const renderLoadingState = (text: string) => (
    <View style={styles.emptyState}>
      <ActivityIndicator size="large" color="#4ADE80" />
      <Text style={styles.emptySubtitle}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          {selectedDMConversation ? (
            <>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackToConversations}
              >
                <Feather name="arrow-left" size={24} color="#E8E8E8" />
              </TouchableOpacity>
              <View style={styles.dmHeaderContent}>
                <View style={styles.dmHeaderAvatarContainer}>
                  <View
                    style={[styles.dmHeaderAvatar, { backgroundColor: getAvatarColor(selectedDMConversation.partnerName) }]}
                  >
                    <Text style={styles.dmHeaderAvatarText}>
                      {getInitials(selectedDMConversation.partnerName)}
                    </Text>
                  </View>
                  <View style={styles.onlineIndicatorSmall} />
                </View>
                <Text style={styles.headerTitle}>
                  {selectedDMConversation.partnerName}
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </>
          ) : (
            <>
              <View>
                <Text style={styles.headerTitle}>Chat</Text>
                <Text style={styles.headerSubtitle}>TOP TUINEN</Text>
              </View>
              <TouchableOpacity style={styles.searchButton}>
                <Feather name="search" size={20} color="#555555" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Tabs - hide when viewing a DM conversation */}
        {!selectedDMConversation && renderTabBar()}

        {/* Content */}
        <View style={styles.flex1}>
          {/* Team Chat */}
          <TabsContent tabKey="team" activeTab={activeTab}>
            {isLoading ? (
              renderLoadingState('Berichten laden...')
            ) : messages.length === 0 ? (
              renderEmptyState('message-circle', 'Nog geen berichten', 'Start een gesprek met je team!')
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#4ADE80"
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
                renderLoadingState('Berichten laden...')
              ) : !dmMessages || dmMessages.length === 0 ? (
                renderEmptyState('message-circle', 'Nog geen berichten', `Stuur je eerste bericht naar ${selectedDMConversation.partnerName}`)
              ) : (
                <FlatList
                  ref={dmFlatListRef}
                  data={[...dmMessages].reverse()}
                  keyExtractor={(item) => item._id}
                  renderItem={renderDMMessage}
                  inverted
                  contentContainerStyle={styles.messageList}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor="#4ADE80"
                    />
                  }
                />
              )
            ) : (
              // Show conversation list
              isLoading ? (
                renderLoadingState('Gesprekken laden...')
              ) : !dmConversations || dmConversations.length === 0 ? (
                renderEmptyState('users', 'Geen directe berichten', 'Start een privegesprek met een collega')
              ) : (
                <FlatList
                  data={dmConversations}
                  keyExtractor={(item) => item.partnerId}
                  renderItem={renderDMConversation}
                  contentContainerStyle={styles.conversationList}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor="#4ADE80"
                    />
                  }
                />
              )
            )}
          </TabsContent>

          {/* Project Chat */}
          <TabsContent tabKey="project" activeTab={activeTab}>
            {isLoading ? (
              renderLoadingState('Berichten laden...')
            ) : messages.length === 0 ? (
              renderEmptyState('folder', 'Geen project berichten', 'Selecteer een project om berichten te zien')
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderMessage}
                inverted
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#4ADE80"
                  />
                }
              />
            )}
          </TabsContent>
        </View>

        {/* Input bar - show for team/project channels and when viewing a DM conversation */}
        {(activeTab !== 'dm' || selectedDMConversation) && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Typ een bericht..."
              placeholderTextColor="#555555"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !message.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <Feather
                name="send"
                size={18}
                color={message.trim() ? '#0A0A0A' : '#555555'}
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Layout
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  loadingInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#555555',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E8E8E8',
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#6B8F6B',
    letterSpacing: 2,
    marginTop: 2,
  },
  searchButton: {
    padding: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  dmHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dmHeaderAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  dmHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmHeaderAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#1A2E1A',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
  },
  tabLabelActive: {
    color: '#4ADE80',
  },
  tabBadge: {
    backgroundColor: '#4ADE80',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0A0A0A',
  },

  // Channel / conversation list items
  channelItem: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222222',
    alignItems: 'center',
  },
  channelAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  channelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#111111',
  },
  onlineIndicatorSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#0A0A0A',
  },
  channelContent: {
    flex: 1,
  },
  channelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  channelName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E8E8E8',
    flex: 1,
    marginRight: 8,
  },
  channelTime: {
    fontSize: 9,
    color: '#555555',
  },
  channelBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelPreview: {
    fontSize: 11,
    color: '#888888',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  conversationList: {
    padding: 16,
    paddingBottom: 100,
  },

  // Message bubbles
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  messageBubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  messageBubbleRowOther: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageAvatarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleSent: {
    backgroundColor: '#1A2E1A',
    borderBottomRightRadius: 4,
  },
  messageBubbleReceived: {
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 4,
  },
  messageSenderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B8F6B',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#E8E8E8',
  },
  messageTimestamp: {
    fontSize: 8,
    color: '#555555',
    textAlign: 'right',
    marginTop: 4,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555555',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#555555',
    textAlign: 'center',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 100,
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#222222',
    color: '#E8E8E8',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1A1A1A',
  },
});
