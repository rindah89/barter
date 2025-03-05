// @ts-nocheck
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, ChevronLeft, Paperclip, X } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { chatService, Message } from '@/services/chatService';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from 'react-native-fast-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video } from 'expo-av';
import MediaSourceModal from '@/components/MediaSourceModal';
import { uploadFile } from '@/services/imageservice';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const lottieRef = useRef<LottieView>(null);
  const subscriptionRef = useRef<any>(null);
  
  // Media handling state
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreviewVisible, setMediaPreviewVisible] = useState(false);
  const videoRef = useRef<Video>(null);
  
  // Get partner ID from params
  const partnerId = params.userId as string;
  const userName = params.userName as string;
  const userAvatar = params.userAvatar as string;
  
  // Add a check for required parameters
  useEffect(() => {
    if (!partnerId) {
      console.error('Missing required parameter: userId');
      Alert.alert(
        'Error',
        'Missing user information. Please try again.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
    }
  }, [partnerId, router]);

  // Initialize chat room
  useEffect(() => {
    console.log('Initialize Chat Effect - User:', user?.id, 'Partner ID:', partnerId);
    
    if (!user || !partnerId) {
      console.log('Missing user or partnerId, not initializing chat');
      setLoading(false);
      return;
    }

    // Set a basic partner profile from params while we load the real one
    if (userName) {
      setPartnerProfile({
        id: partnerId,
        username: userName,
        avatar_url: userAvatar,
      });
    }

    // Set a timeout to ensure loading state doesn't get stuck
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000); // 5 seconds timeout

    const initializeChat = async () => {
      try {
        // Create or get existing chat room
        const result = await chatService.createOrGetChatRoom(user.id, partnerId);
        
        if (result.success && result.chatRoom) {
          setChatRoomId(result.chatRoom.id);
          
          // Find partner profile from participants
          const partner = result.chatRoom.participants.find(p => p.id !== user.id);
          if (partner) {
            setPartnerProfile(partner);
          }
          
          // Load messages
          await loadMessages(result.chatRoom.id);
          
          // Set up real-time subscription
          setupSubscription(result.chatRoom.id);
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    initializeChat();
    
    return () => {
      clearTimeout(timeoutId);
      // Clean up subscription on unmount
      if (subscriptionRef.current) {
        subscriptionRef.current.then(sub => sub.unsubscribe());
      }
    };
  }, [user, partnerId, userName, userAvatar]);

  // Set up real-time subscription
  const setupSubscription = async (roomId) => {
    try {
      // Clean up any existing subscription
      if (subscriptionRef.current) {
        const sub = await subscriptionRef.current;
        sub.unsubscribe();
      }
      
      // Create new subscription
      subscriptionRef.current = chatService.subscribeToMessages(roomId, (payload) => {
        console.log('Received real-time update:', payload);
        
        // When a new message is received
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;
          
          // Check if this message is already in our state (to avoid duplicates)
          const messageExists = messages.some(msg => msg.id === newMessage.id);
          if (messageExists) {
            console.log('Message already exists in state, skipping');
            return;
          }
          
          // Add the new message to the beginning of the array for inverted FlatList
          setMessages(prevMessages => [
            newMessage,
            ...prevMessages
          ]);
          
          // No need to scroll with inverted FlatList
        }
      });
    } catch (error) {
      console.error('Error setting up subscription:', error);
    }
  };

  // Play Lottie animation when component mounts
  useEffect(() => {
    if (lottieRef.current && !loading && messages.length === 0) {
      lottieRef.current.play();
    }
  }, [loading, messages.length]);

  // Load messages
  const loadMessages = async (roomId: string) => {
    try {
      console.log('Loading messages for room ID:', roomId);
      const result = await chatService.getChatMessages(roomId);
      console.log('Messages result:', result);
      
      if (!result.success || !result.messages) {
        throw new Error(result.error || 'Failed to load messages');
      }
      
      console.log('Setting messages:', result.messages.length);
      // Sort messages in reverse chronological order for inverted FlatList
      const sortedMessages = [...result.messages].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setMessages(sortedMessages);
      
      // No need to scroll with inverted FlatList
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Update the handleSendMessage function to handle only text messages
  const handleSendMessage = async () => {
    if (!messageText.trim() || sending || !chatRoomId) return;
    
    setSending(true);
    
    try {
      const tempId = `temp-${Date.now()}`;
      
      // Add optimistic message at the beginning for inverted FlatList
      const tempMessage: Message = {
        id: tempId,
        room_id: chatRoomId,
        sender_id: user?.id || '',
        content: messageText,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: 'text',
      };
      
      setMessages((prev) => [tempMessage, ...prev]);
      setMessageText('');
      
      // No need to scroll with inverted FlatList
      
      // Send message to server
      const result = await chatService.sendMessage(
        chatRoomId,
        messageText,
        'text'
      );
      
      if (!result.success) {
        // Update the temp message to show error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
          )
        );
        console.error('Failed to send message:', result.error);
        return;
      }
      
      // Replace temp message with actual message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...result.message, is_sending: false } : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update the temp message to show error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id.startsWith('temp-') && msg.is_sending
            ? { ...msg, is_sending: false, is_error: true }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatMessageTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return format(new Date(timestamp), 'h:mm a');
  };

  // Render message item - updated to handle different media types
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;
    
    return (
      <View
        style={[
          styles.messageWrapper,
          isMyMessage ? styles.myMessageWrapper : styles.partnerMessageWrapper,
        ]}
      >
        {!isMyMessage && partnerProfile && (
          <Image
            source={{ 
              uri: partnerProfile.avatar_url || 'https://via.placeholder.com/40' 
            }}
            style={styles.avatar}
          />
        )}
        
        <View
          style={[
            styles.messageContainer,
            isMyMessage ? styles.myMessage : styles.partnerMessage,
            item.is_sending && { opacity: 0.7 },
            item.is_error && { borderWidth: 1, borderColor: '#FF3B30' },
          ]}
        >
          {/* Render different types of media */}
          {item.message_type === 'image' && item.media_uri && (
            <TouchableOpacity
              onPress={() => {
                // Handle image preview (could implement a full-screen preview)
                Alert.alert('Image', 'Image preview functionality coming soon!');
              }}
            >
              <FastImage
                source={{ uri: item.media_uri }}
                style={styles.imageContent}
                resizeMode={FastImage.resizeMode.cover}
              />
            </TouchableOpacity>
          )}
          
          {item.message_type === 'video' && item.media_uri && (
            <View style={styles.videoContainer}>
              <Video
                source={{ uri: item.media_uri }}
                style={styles.videoContent}
                useNativeControls
                resizeMode="contain"
                isLooping={false}
              />
            </View>
          )}
          
          {item.message_type === 'file' && (
            <TouchableOpacity
              style={styles.fileContainer}
              onPress={() => {
                // Handle file download/preview
                if (item.media_uri) {
                  Alert.alert('File', 'File download functionality coming soon!');
                }
              }}
            >
              <View style={styles.fileIconContainer}>
                <Text style={styles.fileIcon}>📄</Text>
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.content || 'File'}
                </Text>
                <Text style={styles.fileSize}>Tap to download</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {item.message_type === 'gif' && item.gif_url ? (
            <FastImage
              source={{ uri: item.gif_url }}
              style={styles.gifImage}
              resizeMode={FastImage.resizeMode.contain}
            />
          ) : item.message_type === 'text' && (
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.partnerMessageText,
                item.message_type === 'emoji' && styles.emojiText,
              ]}
            >
              {item.content}
            </Text>
          )}
          
          <View style={styles.messageFooter}>
            {item.is_sending && (
              <Text style={styles.statusText}>Sending...</Text>
            )}
            {item.is_error && (
              <Text style={styles.errorText}>Failed to send</Text>
            )}
            <Text
              style={[
                styles.timestamp,
                isMyMessage ? styles.myTimestamp : styles.partnerTimestamp,
              ]}
            >
              {formatMessageTime(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Handle media selection from camera
  const handleCameraSelect = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera access is required to take photos');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setSelectedMedia({
          uri: selectedAsset.uri,
          type: selectedAsset.type || (selectedAsset.uri.endsWith('.mp4') ? 'video' : 'image'),
          name: selectedAsset.fileName || `${Date.now()}.${selectedAsset.uri.split('.').pop()}`,
        });
        setMediaPreviewVisible(true);
      }
    } catch (error) {
      console.error('Error selecting from camera:', error);
      Alert.alert('Error', 'Failed to capture media. Please try again.');
    }
  };
  
  // Handle media selection from gallery
  const handleGallerySelect = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Media library access is required to select photos');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setSelectedMedia({
          uri: selectedAsset.uri,
          type: selectedAsset.type || (selectedAsset.uri.endsWith('.mp4') ? 'video' : 'image'),
          name: selectedAsset.fileName || `${Date.now()}.${selectedAsset.uri.split('.').pop()}`,
        });
        setMediaPreviewVisible(true);
      }
    } catch (error) {
      console.error('Error selecting from gallery:', error);
      Alert.alert('Error', 'Failed to select media. Please try again.');
    }
  };
  
  // Handle document selection
  const handleDocumentSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setSelectedMedia({
          uri: selectedAsset.uri,
          type: 'file',
          name: selectedAsset.name || `file-${Date.now()}`,
          size: selectedAsset.size,
          mimeType: selectedAsset.mimeType,
        });
        setMediaPreviewVisible(true);
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };
  
  // Handle sending media message
  const handleSendMedia = async () => {
    if (!selectedMedia || !chatRoomId || !user) {
      return;
    }
    
    setUploadingMedia(true);
    
    try {
      const tempId = `temp-${Date.now()}`;
      let messageType = 'text';
      
      // Determine message type based on media type
      if (selectedMedia.type === 'image') {
        messageType = 'image';
      } else if (selectedMedia.type === 'video') {
        messageType = 'video';
      } else {
        messageType = 'file';
      }
      
      // Add optimistic message
      const tempMessage: Message = {
        id: tempId,
        room_id: chatRoomId,
        sender_id: user?.id || '',
        content: selectedMedia.name,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: messageType,
        media_uri: selectedMedia.uri,
      };
      
      setMessages((prev) => [tempMessage, ...prev]);
      
      // Upload media to storage
      let folderName = 'chatFiles';
      if (messageType === 'image') folderName = 'chatImages';
      if (messageType === 'video') folderName = 'chatVideos';
      
      const uploadResult = await chatService.uploadChatMedia(selectedMedia, chatRoomId);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('Failed to upload media');
      }
      
      // Send message with media URL
      const result = await chatService.sendMessage(
        chatRoomId,
        user.id,
        selectedMedia.name,
        uploadResult.url,
        messageType
      );
      
      if (!result.success) {
        // Update the temp message to show error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
          )
        );
        console.error('Failed to send media message:', result.error);
        return;
      }
      
      // Replace temp message with actual message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...result.message, is_sending: false } : msg
        )
      );
      
      // Clear selected media
      setSelectedMedia(null);
      setMediaPreviewVisible(false);
    } catch (error) {
      console.error('Error sending media message:', error);
      
      // Update the temp message to show error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id.startsWith('temp-') && msg.is_sending
            ? { ...msg, is_sending: false, is_error: true }
            : msg
        )
      );
      
      Alert.alert('Error', 'Failed to send media. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ExpoStatusBar style="light" translucent backgroundColor="transparent" />
      
      {/* Header with gradient that extends to status bar */}
      <LinearGradient
        colors={['#22C55E', '#16A34A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.headerGradient,
          { paddingTop: insets.top }
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            {partnerProfile ? (
              <>
                <Text style={styles.headerTitle}>
                  {partnerProfile.full_name || partnerProfile.username || userName || 'User'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {chatRoomId ? 'Online' : 'Connecting...'}
                </Text>
              </>
            ) : (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.headerTitle}>Loading...</Text>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
      
      {/* Messages */}
      <View style={styles.messagesContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesContainer}
            inverted={true}
          />
        ) : (
          <View style={styles.noMessagesContainer}>
            <LottieView
              ref={lottieRef}
              source={require('../assets/no-message.json')}
              style={styles.lottieAnimation}
              autoPlay
              loop
            />
            <Text style={styles.noMessagesText}>No messages yet. Start the conversation!</Text>
          </View>
        )}
      </View>
      
      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.bottom + 10}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowMediaModal(true)}
          >
            <Paperclip size={22} color="#666666" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.inputNative}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Media Source Modal */}
      <MediaSourceModal
        visible={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onCameraSelect={handleCameraSelect}
        onGallerySelect={handleGallerySelect}
        onDocumentSelect={handleDocumentSelect}
      />

      {/* Media Preview Modal */}
      <Modal
        visible={mediaPreviewVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setMediaPreviewVisible(false);
          setSelectedMedia(null);
        }}
      >
        <View style={styles.mediaPreviewContainer}>
          <View style={styles.mediaPreviewHeader}>
            <Text style={styles.mediaPreviewTitle}>
              {selectedMedia?.type === 'image' ? 'Image Preview' : 
               selectedMedia?.type === 'video' ? 'Video Preview' : 'File Preview'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setMediaPreviewVisible(false);
                setSelectedMedia(null);
              }}
            >
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.mediaPreviewContent}>
            {selectedMedia?.type === 'image' && (
              <Image
                source={{ uri: selectedMedia.uri }}
                style={styles.mediaPreviewImage}
                resizeMode="contain"
              />
            )}
            
            {selectedMedia?.type === 'video' && (
              <Video
                ref={videoRef}
                source={{ uri: selectedMedia.uri }}
                style={styles.mediaPreviewVideo}
                useNativeControls
                resizeMode="contain"
                isLooping={false}
              />
            )}
            
            {selectedMedia?.type === 'file' && (
              <View style={styles.filePreviewContainer}>
                <Text style={styles.filePreviewIcon}>📄</Text>
                <Text style={styles.filePreviewName} numberOfLines={2}>
                  {selectedMedia.name}
                </Text>
                {selectedMedia.size && (
                  <Text style={styles.filePreviewSize}>
                    {(selectedMedia.size / 1024).toFixed(2)} KB
                  </Text>
                )}
              </View>
            )}
          </View>
          
          <View style={styles.mediaPreviewActions}>
            <TouchableOpacity
              style={styles.mediaPreviewCancelButton}
              onPress={() => {
                setMediaPreviewVisible(false);
                setSelectedMedia(null);
              }}
              disabled={uploadingMedia}
            >
              <Text style={styles.mediaPreviewCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.mediaPreviewSendButton,
                uploadingMedia && styles.mediaPreviewSendButtonDisabled,
              ]}
              onPress={handleSendMedia}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.mediaPreviewSendText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerGradient: {
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    height: 70,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputNative: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },
  messageWrapper: {
    marginVertical: 4,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  partnerMessageWrapper: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageContainer: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 4,
  },
  myMessage: {
    backgroundColor: '#DCF8C6',
    borderBottomRightRadius: 4,
    marginLeft: 40,
  },
  partnerMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333333',
  },
  myMessageText: {
    color: '#333333',
  },
  partnerMessageText: {
    color: '#333333',
  },
  emojiText: {
    fontSize: 24,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
  },
  myTimestamp: {
    color: '#7B8794',
  },
  partnerTimestamp: {
    color: '#7B8794',
  },
  statusText: {
    fontSize: 12,
    color: '#999999',
    marginRight: 8,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginRight: 8,
    fontStyle: 'italic',
  },
  // Media content styles
  imageContent: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  videoContainer: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  videoContent: {
    width: '100%',
    height: '100%',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  fileSize: {
    fontSize: 12,
    color: '#999999',
  },
  gifImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  noMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lottieAnimation: {
    width: 200,
    height: 200,
  },
  noMessagesText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  mediaPreviewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    maxWidth: '80%',
    width: '100%',
    alignItems: 'center',
  },
  mediaPreviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewContent: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 16,
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  mediaPreviewVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  filePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  filePreviewIcon: {
    fontSize: 24,
    color: '#333333',
    marginRight: 8,
  },
  filePreviewName: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  filePreviewSize: {
    fontSize: 12,
    color: '#999999',
  },
  mediaPreviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaPreviewCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewCancelText: {
    fontSize: 16,
    color: '#333333',
  },
  mediaPreviewSendButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreviewSendButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },
  mediaPreviewSendText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
}); 