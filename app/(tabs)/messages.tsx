import React, { useState, useEffect } from 'react';
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

  // Load user's chat rooms
  useEffect(() => {
    if (user?.id) {
      fetchUserChatRooms();
    }
  }, [user]);

  const fetchUserChatRooms = async () => {
    if (!user?.id) return;
    
    setLoadingChats(true);
    try {
      const result = await chatService.getUserChatRooms(user.id);
      if (result.success && result.chatRooms) {
        setChatRooms(result.chatRooms);
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoadingChats(false);
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
    // Find the other participant (not the current user)
    const otherParticipant = item.participants.find(p => p.id !== user?.id);
    if (!otherParticipant) return null;
    
    const lastMessage = item.last_message?.content || '';
    const timestamp = formatTimestamp(item.last_message?.created_at || item.created_at);
    
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
        <Image
          source={{ uri: otherParticipant.avatar_url || undefined }}
          style={styles.avatar}
          defaultSource={require('../../assets/images/default-avatar.png')}
        />
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
                {lastMessage || 'Start a conversation...'}
              </Text>
            )}
            {/* Unread count would be implemented here */}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render search result item
  const renderSearchResultItem = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => navigateToChat(item.id, item.name, item.avatar_url)}
      disabled={creatingChatRoom[item.id]}
    >
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
      <Text style={styles.searchResultName}>{item.name || 'User'}</Text>
      {creatingChatRoom[item.id] ? (
        <ActivityIndicator size="small" color="#22C55E" />
      ) : (
        <MessageCircle color="#22C55E" size={20} />
      )}
    </TouchableOpacity>
  );

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
                data={chatRooms.length > 0 ? chatRooms : []}
                renderItem={renderChatRoomItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                ListEmptyComponent={<EmptyChatComponent />}
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
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