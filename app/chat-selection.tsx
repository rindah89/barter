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
import { chatService } from '../services/chatService';

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

  // Function to search for users
  const searchUsers = async (query) => {
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
  const handleSearchChange = (text) => {
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
  const navigateToChat = async (userId, userName, userAvatar) => {
    try {
      if (!user) {
        Alert.alert('Error', 'You need to be logged in to chat');
        return;
      }
      
      console.log('Navigating to chat with:', {
        currentUserId: user.id,
        partnerId: userId,
        partnerName: userName,
        partnerAvatar: userAvatar
      });
      
      // Create or get existing chat room
      const result = await chatService.createOrGetChatRoom(user.id, userId);
      
      if (!result.success || !result.chatRoom) {
        throw new Error(result.error || 'Failed to initialize chat room');
      }
      
      console.log('Chat room created/retrieved:', result.chatRoom.id);
      
      // Prepare navigation parameters
      const chatParams = {
        userId: userId,
        userName: userName || 'Unknown User',
        userAvatar: userAvatar || '',
      };
      
      console.log('Navigating to chat with params:', chatParams);
      
      // Navigate to chat screen
      router.push({
        pathname: '/chat' as any,
        params: chatParams,
      });
    } catch (error) {
      console.error('Error navigating to chat:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  // Function to render the last message preview
  const renderLastMessagePreview = (chatRoom) => {
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
  const renderRecentChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigateToChat(item.id, item.name, item.avatar)}
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.avatar}
        defaultSource={require('../assets/images/default-avatar.png')}
      />
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          {renderLastMessagePreview(item)}
        </View>
        <View style={styles.chatFooter}>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render search result item
  const renderSearchResultItem = ({ item }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => navigateToChat(item.id, item.name, item.avatar_url)}
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
      <MessageCircle color="#22C55E" size={20} />
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
            <Text style={styles.sectionTitle}>Recent Conversations</Text>
            <FlatList
              data={recentChats}
              renderItem={renderRecentChatItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.chatList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No recent conversations</Text>
                  <Text style={styles.emptySubtext}>
                    Search for users to start chatting
                  </Text>
                </View>
              }
            />
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
}); 