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

// Wrapper component that handles auth check
export default function ChatScreen() {
  const colors = useColors();
  const { isLoading, isUserSynced } = useCurrentUser();

  // Show loading while auth is loading or user not synced
  if (isLoading || !isUserSynced) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-4 text-muted-foreground">Laden...</Text>
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
          className={cn(
            "flex-row mb-2 items-end",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          {showAvatar && (
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: getAvatarColor(item.senderName) }}
            >
              <Text className="text-xs font-semibold text-white">{getInitials(item.senderName)}</Text>
            </View>
          )}
          <View
            className={cn(
              "max-w-[75%] p-3 rounded-2xl",
              isOwn ? "bg-accent rounded-br" : "bg-card rounded-bl"
            )}
          >
            {!isOwn && (
              <Text className="text-xs font-semibold mb-1" style={{ color: colors.scope.borders }}>
                {item.senderName}
              </Text>
            )}
            <Text
              className={cn(
                "text-base leading-normal",
                isOwn ? "text-white" : "text-foreground"
              )}
            >
              {item.message}
            </Text>
            <Text
              className={cn(
                "text-xs mt-1 text-right",
                isOwn ? "text-white/70" : "text-muted-foreground"
              )}
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
          className="flex-row bg-card p-4 mb-2 rounded-lg"
          activeOpacity={0.7}
          onPress={() => handleSelectDMConversation(item)}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center mr-4"
            style={{ backgroundColor: getAvatarColor(item.partnerName) }}
          >
            <Text className="text-lg font-semibold text-white">{getInitials(item.partnerName)}</Text>
          </View>
          <View className="flex-1 justify-center">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-base font-semibold text-foreground">
                {item.partnerName}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {formatTimestamp(item.lastMessageAt)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text
                className="text-sm text-muted-foreground flex-1 mr-3"
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
          className={cn(
            "flex-row mb-2 items-end",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          {showAvatar && (
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: getAvatarColor(senderName) }}
            >
              <Text className="text-xs font-semibold text-white">{getInitials(senderName)}</Text>
            </View>
          )}
          <View
            className={cn(
              "max-w-[75%] p-3 rounded-2xl",
              isOwn ? "bg-accent rounded-br" : "bg-card rounded-bl"
            )}
          >
            {!isOwn && (
              <Text className="text-xs font-semibold mb-1" style={{ color: colors.scope.borders }}>
                {senderName}
              </Text>
            )}
            <Text
              className={cn(
                "text-base leading-normal",
                isOwn ? "text-white" : "text-foreground"
              )}
            >
              {item.message}
            </Text>
            <Text
              className={cn(
                "text-xs mt-1 text-right",
                isOwn ? "text-white/70" : "text-muted-foreground"
              )}
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

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      edges={['top']}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Header with tabs */}
        <View className="flex-row items-center justify-between px-4 py-2 bg-card border-b border-border">
          {selectedDMConversation ? (
            <>
              <TouchableOpacity
                className="p-2 -mr-1"
                onPress={handleBackToConversations}
              >
                <Feather name="arrow-left" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <View className="flex-1 flex-row items-center">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: getAvatarColor(selectedDMConversation.partnerName) }}
                >
                  <Text className="text-xs font-semibold text-white">
                    {getInitials(selectedDMConversation.partnerName)}
                  </Text>
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {selectedDMConversation.partnerName}
                </Text>
              </View>
              <View className="w-10" />
            </>
          ) : (
            <>
              <Text className="text-2xl font-bold text-foreground">Chat</Text>
              <TouchableOpacity className="p-2">
                <Feather name="search" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Tabs - hide when viewing a DM conversation */}
        {!selectedDMConversation && (
          <View className="py-2 bg-card">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(key) => setActiveTab(key as ChannelType)}
              variant="pills"
            />
          </View>
        )}

        {/* Content */}
        <View className="flex-1">
          {/* Team Chat */}
          <TabsContent tabKey="team" activeTab={activeTab}>
            {isLoading ? (
              <View className="flex-1 justify-center items-center gap-4">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-base text-muted-foreground">
                  Berichten laden...
                </Text>
              </View>
            ) : messages.length === 0 ? (
              <View className="flex-1 justify-center items-center px-8 gap-2">
                <Feather name="message-circle" size={48} color={colors.mutedForeground} />
                <Text className="text-lg font-semibold text-foreground mt-2">
                  Nog geen berichten
                </Text>
                <Text className="text-base text-muted-foreground text-center">
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
                contentContainerClassName="p-4 pb-2"
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
                <View className="flex-1 justify-center items-center gap-4">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="text-base text-muted-foreground">
                    Berichten laden...
                  </Text>
                </View>
              ) : !dmMessages || dmMessages.length === 0 ? (
                <View className="flex-1 justify-center items-center px-8 gap-2">
                  <Feather name="message-circle" size={48} color={colors.mutedForeground} />
                  <Text className="text-lg font-semibold text-foreground mt-2">
                    Nog geen berichten
                  </Text>
                  <Text className="text-base text-muted-foreground text-center">
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
                  contentContainerClassName="p-4 pb-2"
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
                <View className="flex-1 justify-center items-center gap-4">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text className="text-base text-muted-foreground">
                    Gesprekken laden...
                  </Text>
                </View>
              ) : !dmConversations || dmConversations.length === 0 ? (
                <View className="flex-1 justify-center items-center px-8 gap-2">
                  <Feather name="users" size={48} color={colors.mutedForeground} />
                  <Text className="text-lg font-semibold text-foreground mt-2">
                    Geen directe berichten
                  </Text>
                  <Text className="text-base text-muted-foreground text-center">
                    Start een privegesprek met een collega
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={dmConversations}
                  keyExtractor={(item) => item.partnerId}
                  renderItem={renderDMConversation}
                  contentContainerClassName="p-4"
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
              <View className="flex-1 justify-center items-center gap-4">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text className="text-base text-muted-foreground">
                  Berichten laden...
                </Text>
              </View>
            ) : messages.length === 0 ? (
              <View className="flex-1 justify-center items-center px-8 gap-2">
                <Feather name="folder" size={48} color={colors.mutedForeground} />
                <Text className="text-lg font-semibold text-foreground mt-2">
                  Geen project berichten
                </Text>
                <Text className="text-base text-muted-foreground text-center">
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
                contentContainerClassName="p-4 pb-2"
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
          <View className="flex-row items-end bg-card border-t border-border p-2 pb-24 gap-2">
            <TouchableOpacity
              className="w-10 h-10 rounded-full items-center justify-center bg-secondary"
            >
              <Feather name="plus" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TextInput
              className="flex-1 min-h-[40px] max-h-[120px] px-4 py-2 rounded-full bg-secondary text-foreground text-base"
              value={message}
              onChangeText={setMessage}
              placeholder="Typ een bericht..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{
                backgroundColor: message.trim()
                  ? colors.scope.borders
                  : colors.muted,
              }}
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
