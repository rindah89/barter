import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, User, MessageCircle, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { chatService, ChatRoom } from '../../services/chatService';
import { presenceService } from '../../services/presenceService';
import { Tables } from '../../database.types';
import LottieView from 'lottie-react-native';

// Define types for our components
interface SearchResult {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

interface RecentChat {
  id: string;
  name: string | null;
  avatar: string | null;
  lastMessage: string | null;
  timestamp: string;
  unread: number;
}


export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [creatingChatRoom, setCreatingChatRoom] = useState<{[key: string]: boolean}>({});
  const [participants, setParticipants] = useState<{[key: string]: any}>({});
  const [onlineUsers, setOnlineUsers] = useState<{[key: string]: boolean}>({});
  const presenceSubscriptionsRef = useRef<{[key: string]: any}>({});

  // Load user's chat rooms
  useEffect(() => {
    if (user?.id) {
      fetchUserChatRooms();
    }
    
    return () => {
      // Clean up all presence subscriptions
      Object.values(presenceSubscriptionsRef.current).forEach(subscription => {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      });
    };
  }, [user]);

  const fetchUserChatRooms = async () => {
    if (!user?.id) return;
    
    setLoadingChats(true);
    try {
      const result = await chatService.getUserChatRooms(user.id);
      console.log('Fetched chat rooms:', result);
      if (result.success && result.chatRooms) {
        setChatRooms(result.chatRooms);
        console.log('Chat rooms set in state:', result.chatRooms);
        
        // Get all unique participant IDs (excluding current user)
        const participantIds = new Set<string>();
        result.chatRooms.forEach(room => {
          room.participant_ids.forEach(id => {
            if (id !== user.id) {
              participantIds.add(id);
            }
          });
        });

        // Fetch all participants' details in one query
        const { data: participantsData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', Array.from(participantIds));

        if (participantsData) {
          // Create a map of participant ID to participant details
          const participantsMap = participantsData.reduce((acc, participant) => {
            acc[participant.id] = participant;
            return acc;
          }, {} as {[key: string]: any});
          
          setParticipants(participantsMap);
          
          // Check online status for all participants
          checkOnlineStatus(Array.from(participantIds));
        }
      } else if (result.error) {
        console.error('Error fetching chat rooms:', result.error);
        Alert.alert(
          'Error',
          'Failed to load your conversations. Pull down to refresh.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      Alert.alert(
        'Error',
        'Failed to load your conversations. Pull down to refresh.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingChats(false);
    }
  };
  
  // Check online status for all participants
  const checkOnlineStatus = async (userIds: string[]) => {
    try {
      // Clean up existing subscriptions
      Object.values(presenceSubscriptionsRef.current).forEach(subscription => {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      });
      
      presenceSubscriptionsRef.current = {};
      
      // Check initial online status for each user
      const onlineStatusMap: {[key: string]: boolean} = {};
      
      await Promise.all(userIds.map(async (userId) => {
        try {
          const result = await presenceService.isUserOnline(userId);
          onlineStatusMap[userId] = result.success ? result.isOnline : false;
          
          // Set up subscription for this user
          setupPresenceSubscription(userId);
        } catch (error) {
          console.error(`Error checking online status for user ${userId}:`, error);
          onlineStatusMap[userId] = false;
        }
      }));
      
      setOnlineUsers(onlineStatusMap);
    } catch (error) {
      console.error('Error checking online status:', error);
    }
  };
  
  // Set up presence subscription for a user
  const setupPresenceSubscription = (userId: string) => {
    try {
      // Clean up existing subscription for this user
      if (presenceSubscriptionsRef.current[userId] && presenceSubscriptionsRef.current[userId].unsubscribe) {
        presenceSubscriptionsRef.current[userId].unsubscribe();
      }
      
      // Create new subscription
      presenceSubscriptionsRef.current[userId] = presenceService.subscribeToUserPresence(userId, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const presenceData = payload.new;
          
          // Check if user is online (is_online flag and last_seen within 2 minutes)
          const isOnline = presenceData.is_online && 
            new Date(presenceData.last_seen).getTime() > Date.now() - 2 * 60 * 1000;
          
          setOnlineUsers(prev => ({
            ...prev,
            [userId]: isOnline
          }));
        }
      });
    } catch (error) {
      console.error(`Error setting up presence subscription for user ${userId}:`, error);
    }
  };

  // Function to search for users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setLoading(true);
    setIsSearching(true);

    try {
      // Search users in Supabase database
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('name', `%${query}%`)
        .neq('id', user?.id) // Exclude current user
        .limit(10);

      if (error) throw error;
      
      // For demo purposes, if no results or error, show dummy results
      if (!data || data.length === 0) {
        // Dummy search results
        setSearchResults([
          { id: '101', name: 'Alex Thompson', avatar_url: 'https://example.com/avatar4.jpg' },
          { id: '102', name: 'Sarah Wilson', avatar_url: 'https://example.com/avatar5.jpg' },
          { id: '103', name: 'David Brown', avatar_url: 'https://example.com/avatar6.jpg' },
        ]);
      } else {
        setSearchResults(data as SearchResult[]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      // Fallback to dummy data
      setSearchResults([
        { id: '101', name: 'Alex Thompson', avatar_url: 'https://example.com/avatar4.jpg' },
        { id: '102', name: 'Sarah Wilson', avatar_url: 'https://example.com/avatar5.jpg' },
        { id: '103', name: 'David Brown', avatar_url: 'https://example.com/avatar6.jpg' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 2) {
      // Only search if at least 3 characters
      searchUsers(text);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  // Navigate to individual chat
  const navigateToChat = async (userId: string, userName: string | null, userAvatar: string | null) => {
    if (!user?.id) return;
    
    // Set loading state for this specific user
    setCreatingChatRoom(prev => ({ ...prev, [userId]: true }));
    
    try {
      // Create or get chat room
      const result = await chatService.createOrGetChatRoom(user.id, userId);
      
      if (result.success && result.chatRoom) {
        // Small delay to ensure the chat room is fully created and indexed in the database
        setTimeout(() => {
          setCreatingChatRoom(prev => ({ ...prev, [userId]: false }));
          router.push({
            pathname: '/chat',
            params: {
              chatRoomId: result.chatRoom!.id,
              userId,
              userName: userName || 'User',
              userAvatar: userAvatar || '',
            },
          });
        }, 500);
      } else {
        throw new Error(result.error || 'Failed to create chat room');
      }
    } catch (error) {
      console.error('Error creating chat room:', error);
      setCreatingChatRoom(prev => ({ ...prev, [userId]: false }));
      Alert.alert(
        'Chat Error',
        'There was a problem starting this chat. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      // Within a week - show day name
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Render chat room item
  const renderChatRoomItem = ({ item }: { item: ChatRoom }) => {
    // Get the other participant's ID from participant_ids array
    const otherParticipantId = item.participant_ids.find(id => id !== user?.id);
    if (!otherParticipantId) return null;

    const otherParticipant = participants[otherParticipantId];
    if (!otherParticipant) {
      return (
        <View style={styles.chatItem}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#22C55E" />
          </View>
        </View>
      );
    }
    
    // Format the last message based on message type
    let lastMessageText = 'Start a conversation...';
    if (item.last_message) {
      if (item.last_message.message_type === 'image') {
        lastMessageText = item.last_message.content || '📷 Image';
      } else if (item.last_message.message_type === 'video') {
        lastMessageText = item.last_message.content || '🎥 Video';
      } else if (item.last_message.message_type === 'voice') {
        lastMessageText = '🎤 Voice message';
      } else if (item.last_message.message_type === 'file') {
        lastMessageText = '📎 File';
      } else if (item.last_message.content) {
        lastMessageText = item.last_message.content;
      }
    }
    
    const timestamp = formatTimestamp(item.last_message?.created_at || item.created_at);
    const isOnline = onlineUsers[otherParticipantId] || false;
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigateToChat(
          otherParticipant.id, 
          otherParticipant.name, 
          otherParticipant.avatar_url
        )}
        disabled={creatingChatRoom[otherParticipant.id]}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: otherParticipant.avatar_url || undefined }}
            style={styles.avatar}
            defaultSource={require('../../assets/images/default-avatar.png')}
          />
          {isOnline ? (
            <View style={styles.onlineIndicator} />
          ) : (
            <View style={styles.offlineIndicator} />
          )}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{otherParticipant.name || 'User'}</Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
          <View style={styles.chatFooter}>
            {creatingChatRoom[otherParticipant.id] ? (
              <View style={styles.loadingMessageContainer}>
                <ActivityIndicator size="small" color="#22C55E" />
                <Text style={styles.loadingMessageText}>Opening chat...</Text>
              </View>
            ) : (
              <Text style={styles.lastMessage} numberOfLines={1}>
                {lastMessageText}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render search result item
  const renderSearchResultItem = ({ item }: { item: SearchResult }) => {
    const isOnline = onlineUsers[item.id] || false;
    
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => navigateToChat(item.id, item.name, item.avatar_url)}
        disabled={creatingChatRoom[item.id]}
      >
        <View style={styles.searchResultAvatarContainer}>
          {item.avatar_url ? (
            <Image
              source={{ uri: item.avatar_url }}
              style={styles.searchResultAvatar}
              defaultSource={require('../../assets/images/default-avatar.png')}
            />
          ) : (
            <View style={styles.searchResultAvatarPlaceholder}>
              <User color="#AAAAAA" size={24} />
            </View>
          )}
          {isOnline ? (
            <View style={styles.searchResultOnlineIndicator} />
          ) : (
            <View style={styles.searchResultOfflineIndicator} />
          )}
        </View>
        <Text style={styles.searchResultName}>{item.name || 'User'}</Text>
        {creatingChatRoom[item.id] ? (
          <ActivityIndicator size="small" color="#22C55E" />
        ) : (
          <MessageCircle color="#22C55E" size={20} />
        )}
      </TouchableOpacity>
    );
  };

  // Empty chat component with Lottie animation
  const EmptyChatComponent = () => (
    <View style={styles.emptyContainer}>
      <LottieView
        source={require('../../assets/no-chat.json')}
        autoPlay
        loop
        style={styles.lottieAnimation}
      />
      <Text style={styles.emptyText}>No recent conversations</Text>
      <Text style={styles.emptySubtext}>
        Search for users to start chatting
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#22C55E', '#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search color="#999999" size={20} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={handleSearchChange}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <X color="#999999" size={18} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
      
      <SafeAreaView style={styles.contentContainer} edges={['bottom', 'left', 'right']}>
        {isSearching ? (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22C55E" />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.searchResultsList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No users found</Text>
                  </View>
                }
              />
            )}
          </View>
        ) : (
          <View style={styles.recentChatsContainer}>
            {chatRooms.length > 0 && <Text style={styles.sectionTitle}>Recent Conversations</Text>}
            {loadingChats ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22C55E" />
              </View>
            ) : (
              <FlatList
                data={chatRooms}
                renderItem={renderChatRoomItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                ListEmptyComponent={<EmptyChatComponent />}
                refreshing={loadingChats}
                onRefresh={fetchUserChatRooms}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 4,
    marginBottom: 5,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  contentContainer: {
    flex: 1,
  },
  recentChatsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  chatList: {
    paddingHorizontal: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  offlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchResultsList: {
    paddingHorizontal: 16,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  searchResultAvatarContainer: {
    position: 'relative',
  },
  searchResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  searchResultAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
  },
  searchResultOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  searchResultOfflineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  lottieAnimation: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loadingMessageText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
}); 