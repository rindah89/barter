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
import { ChevronLeft, Search, User, MessageCircle, X, Image as ImageIcon, Mic, Video as VideoIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { chatService, ChatRoom as ChatRoomType } from '../services/chatService';
import { Tables } from '../database.types';

// Define types
type Profile = Tables<'profiles'>;

// Dummy data for demonstration
const recentChats = [
  { id: '1', name: 'John Doe', avatar: 'https://example.com/avatar1.jpg', lastMessage: 'Hey, are you interested in trading?', timestamp: '10:30 AM', unread: 2 },
  { id: '2', name: 'Jane Smith', avatar: 'https://example.com/avatar2.jpg', lastMessage: 'I like your vintage camera!', timestamp: 'Yesterday', unread: 0 },
  { id: '3', name: 'Mike Johnson', avatar: 'https://example.com/avatar3.jpg', lastMessage: 'When can we meet for the trade?', timestamp: 'Monday', unread: 1 },
];

export default function ChatSelectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoomType[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isInitiatingChat, setIsInitiatingChat] = useState<string | null>(null);

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
      // In a real app, you would search users in your Supabase database
      // This is a simplified example
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
        setSearchResults(data);
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

  // Fetch User Chat Rooms
  useEffect(() => {
    if (user?.id) {
      fetchChatRooms(user.id);
    }
  }, [user]);

  const fetchChatRooms = async (userId: string) => {
    setIsLoadingChats(true);
    try {
      const result = await chatService.getUserChatRooms(userId);
      if (result.success && result.chatRooms) {
        setChatRooms(result.chatRooms);
      } else {
        console.error('Failed to fetch chat rooms:', result.error);
        // Handle error display if needed
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Navigate to individual chat
  const navigateToChat = (roomId: string) => {
    // Navigate using only the roomId
    router.push({
      pathname: '/chat' as any,
      params: { roomId: roomId },
    });
  };

  // Function to render the last message preview
  const renderLastMessagePreview = (chatRoom: ChatRoomType) => {
    if (!chatRoom.last_message) {
      return <Text style={styles.lastMessage}>No messages yet</Text>;
    }

    const message = chatRoom.last_message;
    
    // Handle different message types
    if (message.is_deleted) {
      return <Text style={styles.lastMessage}>This message was deleted</Text>;
    }
    
    switch (message.message_type) {
      case 'text':
        return <Text style={styles.lastMessage} numberOfLines={1}>{message.content}</Text>;
      case 'image':
        return (
          <View style={styles.mediaPreview}>
            <ImageIcon size={16} color="#666666" />
            <Text style={styles.lastMessage}> Photo</Text>
          </View>
        );
      case 'video':
        return (
          <View style={styles.mediaPreview}>
            <VideoIcon size={16} color="#666666" />
            <Text style={styles.lastMessage}> Video</Text>
          </View>
        );
      case 'voice':
        return (
          <View style={styles.mediaPreview}>
            <Mic size={16} color="#666666" />
            <Text style={styles.lastMessage}> Voice Message</Text>
          </View>
        );
      default:
        return <Text style={styles.lastMessage}>Message</Text>;
    }
  };

  // Render recent chat item
  const renderRecentChatItem = ({ item }: { item: ChatRoomType }) => {
    // Determine if it's a group chat
    const isGroupChat = item.participants.length > 2;
    // Find the other participant(s) excluding the current user
    const otherParticipants = item.participants.filter(p => p.id !== user?.id);
    
    // Determine display name and avatar
    let displayName = 'Unknown Chat';
    let displayAvatar = null;
    let avatarArray: (string | null)[] = [];

    if (isGroupChat) {
      displayName = otherParticipants.map(p => p.name?.split(' ')[0] || 'User').join(', '); // e.g., John, Jane
      displayName = `You, ${displayName}`; // Add "You"
      avatarArray = otherParticipants.slice(0, 3).map(p => p.avatar_url); // Max 3 avatars for display
    } else if (otherParticipants.length === 1) {
      displayName = otherParticipants[0].name || 'User';
      displayAvatar = otherParticipants[0].avatar_url;
    }

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigateToChat(item.id)} // Navigate with roomId
      >
        {isGroupChat ? (
          <View style={styles.groupAvatarContainer}>
            {/* Render multiple/group avatar */}
            {avatarArray.map((avatarUrl, index) => (
               <Image
                 key={index}
                 source={avatarUrl ? { uri: avatarUrl } : require('../assets/images/default-avatar.png')}
                 style={[styles.groupAvatar, styles[`groupAvatar${index}`]]}
              />
            ))}
             {item.participants.length > 3 && (
                <View style={styles.groupAvatarMore}>
                    <Text style={styles.groupAvatarMoreText}>+{item.participants.length - 3}</Text>
                </View>
            )}
          </View>
        ) : (
          <Image
            source={displayAvatar ? { uri: displayAvatar } : require('../assets/images/default-avatar.png')}
            style={styles.avatar}
          />
        )}
        <View style={styles.chatInfo}>
          <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
          {renderLastMessagePreview(item)}
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // --- NEW: Initiate chat from search result --- 
  const handleInitiateChatFromSearch = async (selectedUser: Profile) => {
    if (!user || !selectedUser || isInitiatingChat) return;

    setIsInitiatingChat(selectedUser.id); // Show loading for this specific user
    try {
      console.log(`[ChatSelection] Initiating chat with user: ${selectedUser.id}`);
      const result = await chatService.getOrCreateChatRoom([user.id, selectedUser.id]);

      if (result.success && result.roomId) {
        console.log(`[ChatSelection] Got roomId: ${result.roomId}, navigating...`);
        navigateToChat(result.roomId);
      } else {
        console.error('[ChatSelection] Failed to get/create chat room:', result.error);
        Alert.alert('Error', result.error || 'Could not start chat. Please try again.');
      }
    } catch (error: any) {
      console.error('[ChatSelection] Error initiating chat:', error);
      Alert.alert('Error', error.message || 'Could not start chat. Please try again.');
    } finally {
      setIsInitiatingChat(null); // Clear loading state
    }
  };

  // Render search result item
  const renderSearchResultItem = ({ item }: { item: Profile }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleInitiateChatFromSearch(item)} // Call the new handler
      disabled={isInitiatingChat === item.id} // Disable button while loading this chat
    >
      {item.avatar_url ? (
        <Image
          source={{ uri: item.avatar_url }}
          style={styles.searchResultAvatar}
          defaultSource={require('../assets/images/default-avatar.png')}
        />
      ) : (
        <View style={styles.searchResultAvatarPlaceholder}>
          <User color="#AAAAAA" size={24} />
        </View>
      )}
      <Text style={styles.searchResultName}>{item.name}</Text>
      {isInitiatingChat === item.id ? (
        <ActivityIndicator size="small" color="#22C55E" />
      ) : (
        <MessageCircle color="#22C55E" size={20} />
      )}
    </TouchableOpacity>
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
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <ChevronLeft color="#FFFFFF" size={28} />
          </TouchableOpacity>
          
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
            <Text style={styles.sectionTitle}>Conversations</Text>
            {isLoadingChats ? (
              <ActivityIndicator size="large" color="#22C55E" style={{marginTop: 50}}/>
            ) : (
              <FlatList
                data={chatRooms} // Use fetched chat rooms
                renderItem={renderRecentChatItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.chatList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No conversations yet</Text>
                  </View>
                }
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
  backButton: {
    marginRight: 12,
    padding: 4,
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
    justifyContent: 'center',
    marginRight: 10, // Add margin to prevent overlap with badge
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
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
  },
  unreadBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 'auto', // Push badge to the right
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
  mediaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatarContainer: {
    width: 56,
    height: 56,
    position: 'relative',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  groupAvatar0: {
    top: 0,
    left: 0,
    zIndex: 3,
  },
  groupAvatar1: {
    bottom: 0,
    left: 15,
    zIndex: 2,
  },
  groupAvatar2: {
    top: 10,
    right: 0,
    zIndex: 1,
    width: 30, // Make 3rd slightly smaller maybe
    height: 30,
    borderRadius: 15,
  },
  groupAvatarMore: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6c757d',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 4,
  },
  groupAvatarMoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
}); 