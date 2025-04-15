// @ts-nocheck
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image as RNImage,
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
import { Send, ChevronLeft, Paperclip, X, Mic, StopCircle, Play, Pause, Users } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { chatService, Message, ChatRoom } from '@/services/chatService';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video } from 'expo-av';
import MediaSourceModal from '@/components/MediaSourceModal';
import { uploadFile } from '@/services/imageservice';
import LoadingIndicator from '../components/LoadingIndicator';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import { presenceService } from '@/services/presenceService';
import { getDefaultAvatar } from '@/lib/useDefaultAvatar';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Log received parameters immediately
  console.log('[ChatScreen] Received params:', params);
  
  const { roomId } = useLocalSearchParams();
  
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageMap, setMessageMap] = useState<{[key: string]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatRoomDetails, setChatRoomDetails] = useState<ChatRoom | null>(null);
  const [participants, setParticipants] = useState<Profile[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const lottieRef = useRef<LottieView>(null);
  const subscriptionRef = useRef<any>(null);
  
  // Media handling state
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreviewVisible, setMediaPreviewVisible] = useState(false);
  const videoRef = useRef<Video>(null);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<{[key: string]: boolean}>({});
  const [playbackDuration, setPlaybackDuration] = useState<{[key: string]: number}>({});
  const [playbackPosition, setPlaybackPosition] = useState<{[key: string]: number}>({});

  // Refs for recording and playback
  const recordingRef = useRef(null);
  const soundPlayersRef = useRef({});
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for initial item image attachment
  const [initialAttachment, setInitialAttachment] = useState<any>(null);
  
  // Get partner ID from params
  const partnerId = params.userId as string || params.partnerId as string;
  const userName = params.userName as string || params.partnerName as string;
  const userAvatar = params.userAvatar as string;
  const initialMessage = params.initialMessage as string;
  const tradeId = params.tradeId as string;
  const passedItemImageUrl = params.offeredItemImageUrl as string;
  const requestedItemImageUrl = params.requestedItemImageUrl as string;
  const passedItemName = params.offeredItemName as string;
  const requestedItemName = params.requestedItemName as string;
  
  // Track if initial message has been sent
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const initialMessageSentRef = useRef(false);
  
  // Set initial message based on item details if no other initial message is set
  useEffect(() => {
    // Read directly from params inside the effect
    const currentItemName = params.itemName as string;
    const currentItemImageUrl = params.itemImageUrl as string;
    const currentInitialMessage = params.initialMessage as string;
    
    console.log('[ChatScreen Effect Check] Running. currentItemName:', currentItemName, 'currentInitialMessage:', currentInitialMessage, 'initialMessageSentRef:', initialMessageSentRef.current);
    
    // Use the correct parameters passed from item-details screen
    if (currentItemName && !currentInitialMessage && !initialMessageSentRef.current) {
      console.log('[ChatScreen Effect Logic] Condition met. Setting state.');
      const itemMessage = `Hi, I'm interested in your item: ${currentItemName}`;
      setMessageText(itemMessage); // Set the text
      console.log('Pre-populating chat with item message. Image URL:', currentItemImageUrl);
      
      // Set the initial attachment if URL exists
      if (currentItemImageUrl) {
        const fileName = currentItemImageUrl.split('/').pop() || `item_image_${Date.now()}.jpg`;
        setInitialAttachment({
          uri: currentItemImageUrl,
          type: 'image', 
          name: fileName,
        });
        console.log('Setting initial attachment:', { uri: currentItemImageUrl, type: 'image', name: fileName });
      } else {
        setInitialAttachment(null); // Ensure it's null if no image URL
      }
      
      initialMessageSentRef.current = true; // Mark that this initial setup has happened
    }
    // Change dependency to the params object itself
  }, [params]); // Depend on the params object

  // Initialize chat room
  useEffect(() => {
    // Only proceed if roomId is available
    if (roomId && user) {
      console.log('Initialize Chat Effect - Starting with Room ID:', roomId, 'User ID:', user.id); 
      
      // Set loading true only when we are actually starting initialization
      setLoading(true); 

      // Define the async function inside the effect
      const initializeChat = async (currentRoomId: string) => {
        try {
          // 1. Fetch chat room details (including participants)
          console.log('[initializeChat] Fetching details for room:', currentRoomId);
          const detailsResult = await chatService.getChatRoomDetails(currentRoomId);
          if (!detailsResult.success || !detailsResult.chatRoom) {
            throw new Error(detailsResult.error || 'Failed to load chat room details');
          }
          console.log('[initializeChat] Fetched details:', detailsResult.chatRoom.participants.length, 'participants');
          setChatRoomDetails(detailsResult.chatRoom);
          setParticipants(detailsResult.chatRoom.participants || []);

          // 2. Load initial messages
          console.log('[initializeChat] Loading messages...');
          await loadMessages(currentRoomId);
          console.log('[initializeChat] Messages loaded.');

          // 3. Set up real-time message subscription
          console.log('[initializeChat] Setting up subscription...');
          await setupSubscription(currentRoomId); // Make sure setupSubscription is awaited if it returns the channel
          console.log('[initializeChat] Subscription setup.');

          // 4. Mark messages as read (could be moved to focus event)
          console.log('[initializeChat] Marking messages as read...');
          await chatService.markMessagesAsRead(currentRoomId, user.id);
          console.log('[initializeChat] Messages marked as read.');
          
        } catch (error: any) {
          console.error('Error during chat initialization:', error); 
          Alert.alert('Error', `Failed to initialize chat: ${error.message}`, [{ text: 'Go Back', onPress: () => router.back() }]);
        } finally {
          // Set loading false after initialization attempt (success or failure)
          setLoading(false); 
        }
      };

      // Call the initialization function
      initializeChat(roomId as string);

    } else {
       // Log if the effect runs but roomId or user is missing
       console.log('Initialize Chat Effect - Skipped (Missing roomId or user)', { hasRoomId: !!roomId, hasUser: !!user });
       // Do not set loading to false here, wait for roomId/user to trigger a valid run
    }
    
    // Cleanup function (remains the same)
    return () => {
      if (subscriptionRef.current && typeof subscriptionRef.current.unsubscribe === 'function') {
        try {
          subscriptionRef.current.unsubscribe();
          console.log(`[ChatScreen Cleanup] Unsubscribed from room: ${roomId}`);
        } catch (e) {
          console.error('[ChatScreen Cleanup] Error unsubscribing:', e);
        }
        subscriptionRef.current = null;
      }
    };
  }, [roomId, user]); // Depend on roomId and user

  // Set up real-time subscription
  const setupSubscription = async (currentRoomId: string) => {
    try {
      if (subscriptionRef.current) {
        await subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      subscriptionRef.current = await chatService.subscribeToMessages(currentRoomId, (payload) => {
        console.log('Received real-time update:', payload.eventType, payload.new?.id);
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;
          if (newMessage && !messageMap[newMessage.id]) { // Check map for duplicates
            console.log('Adding new message via subscription:', newMessage.id);
            setMessageMap(prev => ({ ...prev, [newMessage.id]: true }));
            // Prepend new message for inverted list
            setMessages(prevMessages => [newMessage, ...prevMessages]); 
            // Mark as read immediately if received while screen is focused
            // TODO: Add focus check later
            if (newMessage.sender_id !== user?.id) {
              chatService.markMessagesAsRead(currentRoomId, user.id);
            }
          }
        }
        // TODO: Handle UPDATE/DELETE if needed (e.g., read status, deleted messages)
      });
    } catch (error) {
      console.error('Error setting up subscription:', error);
    }
  };

  // Load messages
  const loadMessages = async (currentRoomId: string) => {
    try {
      console.log('Loading messages for room ID:', currentRoomId);
      const result = await chatService.getChatMessages(currentRoomId);
      console.log('Messages result:', result);
      
      if (!result.success || !result.messages) {
        throw new Error(result.error || 'Failed to load messages');
      }
      
      console.log('Setting messages:', result.messages.length);
      
      // Deduplicate messages by ID before sorting
      const uniqueMessages = result.messages.filter((msg, index, self) => 
        index === self.findIndex((m) => m.id === msg.id)
      );
      
      setMessageMap(uniqueMessages.reduce((acc, msg) => ({...acc, [msg.id]: true }), {}));
      setMessages(uniqueMessages); // Already reversed by service now
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Regular function to handle sending messages (text or with media)
  const handleSendMessage = async () => {
    const currentRoomId = roomId as string;
    if (!currentRoomId) return;
    
    const attachmentToSend = initialAttachment || selectedMedia;
    const textContent = messageText.trim();

    // Need either text or an attachment to send
    if (!textContent && !attachmentToSend) return;
    if (sending || !currentRoomId || !user) return;
    
    setSending(true);
    const tempId = `temp-${Date.now()}`; // Unique ID for optimistic update
    let uploadedMediaUrl: string | undefined = undefined;
    let messageType: 'text' | 'image' | 'video' | 'file' | 'voice' = 'text';
    let mediaLocalUri: string | undefined = undefined; // For optimistic preview
    
    try {
      // 1. Handle Attachment (Upload if needed)
      if (attachmentToSend) {
        console.log('Attachment detected:', attachmentToSend);
        mediaLocalUri = attachmentToSend.uri;
        messageType = attachmentToSend.type === 'video' ? 'video' : 
                      attachmentToSend.type === 'image' ? 'image' : 
                      attachmentToSend.type === 'voice' ? 'voice' : 'file'; // Include voice

        // Check if it's the initial attachment (already a URL) or needs upload
        if (attachmentToSend === initialAttachment) {
          console.log('Attachment is the initial item image, using its URL directly.');
          uploadedMediaUrl = attachmentToSend.uri; // Already the final URL
        } else {
          // Needs upload (selectedMedia)
          console.log('Attachment needs upload, calling uploadChatMedia...');
          setMediaPreviewVisible(false);
          const uploadResult = await chatService.uploadChatMedia(attachmentToSend, currentRoomId);
          if (!uploadResult.success || !uploadResult.url) {
            throw new Error(uploadResult.error || 'Failed to upload media');
          }
          uploadedMediaUrl = uploadResult.url;
          console.log('Media uploaded successfully:', uploadedMediaUrl);
        }
      } else {
        // No attachment, ensure message type is text
        messageType = 'text';
      }

      // 2. Prepare Optimistic Message
      const messageContentToSend = textContent || ''; // Send empty string if no text

      const tempMessage: Message = {
        id: tempId,
        chat_room_id: currentRoomId,
        sender_id: user.id,
        content: messageContentToSend,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: messageType,
        media_uri: mediaLocalUri,
        sender: user, // Optimistic sender profile
      };

      // 3. Add Optimistic Message to State & Clear Inputs
      setMessageMap(prev => ({ ...prev, [tempId]: true }));
      setMessages(prev => [tempMessage, ...prev]);
      setMessageText(''); // Clear text input
      setInitialAttachment(null); // Clear initial attachment
      setSelectedMedia(null); // Clear manually selected media

      // 4. Send Message to Server
      console.log(`Sending message: type=${messageType}, content='${messageContentToSend || null}', media_url=${uploadedMediaUrl}`);
      const result = await chatService.sendMessage(
        currentRoomId,
        user.id,
        messageContentToSend || null, // Pass null if content is empty
        uploadedMediaUrl, // Use the final URL (either from upload or initialAttachment)
        messageType
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message after upload');
      }
      
      // Real message confirmation will be handled by the subscription
      console.log('Message send call successful for tempId:', tempId);
      
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      // Update the temp message to show error
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...msg, is_sending: false, is_error: true, media_uri: mediaLocalUri } : msg
        )
      );
      Alert.alert('Error', `Failed to send message: ${error.message || 'Please try again.'}`);
    } finally {
      setSending(false);
      // setUploadingMedia(false); // Reset media upload indicator if used
    }
  };

  // Format timestamp
  const formatMessageTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return format(new Date(timestamp), 'h:mm a');
  };

  // Format last seen time
  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return '';
    
    const lastSeenDate = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffMinutes < 24 * 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return format(lastSeenDate, 'MMM d, h:mm a');
    }
  };

  // Replace audio setup with empty function
  useEffect(() => {
    // Audio functionality has been removed
    console.log('Audio functionality has been disabled');
    
    return () => {
      // No cleanup needed
    };
  }, []);

  // Replace recording function with placeholder
  const startRecording = async () => {
    Alert.alert(
      'Feature Disabled',
      'Voice recording has been temporarily disabled.',
      [{ text: 'OK' }]
    );
  };

  // Replace stop recording function with placeholder
  const stopRecording = async () => {
    setIsRecording(false);
  };

  // Replace send voice message function with placeholder
  const sendVoiceMessage = async () => {
    Alert.alert(
      'Feature Disabled',
      'Voice messages have been temporarily disabled.',
      [{ text: 'OK' }]
    );
    setIsRecording(false);
    setRecordingUri(null);
  };

  // Replace voice message playback function with placeholder
  const togglePlayVoiceMessage = async (messageId: string, uri: string) => {
    Alert.alert(
      'Feature Disabled',
      'Voice message playback has been temporarily disabled.',
      [{ text: 'OK' }]
    );
  };

  // Render message item - updated to handle different media types
  const renderMessageItem = ({ item }: { item: Message }) => {
    if (!item || !item.id || !item.sender_id) return null;
    
    const isMyMessage = item.sender_id === user?.id;
    // Get sender profile from the message object (joined in service)
    const senderProfile = item.sender;
    
    return (
      <View
        key={`msg-${item.id}`}
        style={[
          styles.messageWrapper,
          isMyMessage ? styles.myMessageWrapper : styles.partnerMessageWrapper,
        ]}
      >
        {!isMyMessage && senderProfile && (
          <Image
            source={{ 
              uri: getSupabaseFileUrl(senderProfile.avatar_url) ?? getDefaultAvatar()
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
          {/* Display sender name for group chats on partner messages */}
          {!isMyMessage && senderProfile && participants.length > 2 && (
            <Text style={styles.senderName}>{senderProfile.name || 'User'}</Text>
          )}
          
          {/* Render different types of media */}
          {item.message_type === 'image' && item.media_uri && (
            <View style={styles.imageWrapper}>
              <TouchableOpacity
                onPress={() => {
                  // Handle image preview (could implement a full-screen preview)
                  Alert.alert('Image', 'Image preview functionality coming soon!');
                }}
              >
                {/* Use try-catch with error state to handle image loading errors */}
                <View style={styles.imageContent}>
                  <Image
                    source={{ uri: item.media_uri }}
                    style={styles.imageInner}
                    contentFit="cover"
                    transition={200}
                    onError={() => {
                      console.log('Error loading image:', item.media_uri);
                    }}
                    fallback={
                      <View style={styles.imageFallback}>
                        <Text style={styles.imageFallbackText}>Image unavailable</Text>
                      </View>
                    }
                  />
                </View>
              </TouchableOpacity>
            </View>
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
          
          {item.message_type === 'voice' && item.media_uri && (
            <View style={styles.voiceMessageContainer}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => togglePlayVoiceMessage(item.id, item.media_uri!)}
              >
                {isPlaying[item.id] ? (
                  <Pause size={20} color="#FFFFFF" />
                ) : (
                  <Play size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              
              <View style={styles.voiceWaveformContainer}>
                <View style={styles.voiceWaveform}>
                  {/* Generate simple waveform visualization */}
                  {Array.from({ length: 20 }).map((_, index) => (
                    <View 
                      key={index}
                      style={[
                        styles.waveformBar,
                        {
                          height: 4 + Math.random() * 12,
                          backgroundColor: isPlaying[item.id] && 
                            (index / 20) <= ((playbackPosition[item.id] || 0) / (playbackDuration[item.id] || 1))
                            ? '#22C55E' 
                            : isMyMessage ? '#DDDDDD' : '#BBBBBB'
                        }
                      ]}
                    />
                  ))}
                </View>
                
                <Text style={styles.voiceDuration}>
                  {item.duration ? `${item.duration}s` : '0:00'}
                </Text>
              </View>
            </View>
          )}
          
          {item.message_type === 'file' && item.media_uri && (
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
            <Image
              source={{ uri: item.gif_url }}
              style={styles.gifImage}
              contentFit="contain"
            />
          ) : item.message_type === 'text' && item.content ? (
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.partnerMessageText,
                item.message_type === 'emoji' && styles.emojiText,
              ]}
            >
              {item.content}
            </Text>
          ) : null}
          
          {/* Show text content for media messages if it exists */}
          {(item.message_type === 'image' || item.message_type === 'video' || item.message_type === 'voice') && 
           item.content && item.content.trim() !== '' && (
            <Text
              style={[
                styles.messageText,
                styles.mediaCaption,
                isMyMessage ? styles.myMessageText : styles.partnerMessageText,
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
      // Clear any initial attachment first
      setInitialAttachment(null); 
      
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
      // Clear any initial attachment first
      setInitialAttachment(null); 
      
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
      // Clear any initial attachment first
      setInitialAttachment(null); 
      
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
  
  // Helper to generate group chat title
  const getGroupChatTitle = () => {
    if (!chatRoomDetails) return 'Chat';
    const otherParticipants = participants.filter(p => p.id !== user?.id);
    if (otherParticipants.length === 0) return 'Chat';
    if (otherParticipants.length === 1) return otherParticipants[0].name || 'Chat';
    // For groups, list first 2-3 names
    return otherParticipants.slice(0, 2).map(p => p.name?.split(' ')[0] || 'User').join(', ') + 
           (otherParticipants.length > 2 ? ' & others' : '');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ExpoStatusBar style="light" translucent backgroundColor="transparent" />
      
      {/* Header - Updated for Groups */}
      <LinearGradient
        colors={['#22C55E', '#16A34A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            {chatRoomDetails ? (
              <>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {getGroupChatTitle()}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {participants.length} participants
                </Text>
              </>
            ) : (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </View>
          
          {/* Optional: Add group info button */}
          {participants.length > 2 && (
            <TouchableOpacity style={styles.groupInfoButton}>
              <Users size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
      
      {/* Messages */}
      <View style={styles.messagesContainer}>
        {loading ? (
          <LoadingIndicator 
            message="Loading messages..." 
            size="medium"
            containerStyle={styles.loadingContainer}
            textStyle={styles.loadingText}
          />
        ) : messages && messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={messages.filter(msg => 
              msg !== null && 
              msg !== undefined && 
              msg.id && 
              typeof msg === 'object'
            )}
            keyExtractor={(item) => {
              // Ensure each message has a truly unique key
              if (!item || !item.id) {
                return `fallback-${Date.now()}-${Math.random()}`;
              }
              
              if (item.id.startsWith('temp-')) {
                // For temporary messages, use the temp ID
                return `temp-${item.id}`;
              } else {
                // For real messages, use the ID with a prefix
                return `msg-${item.id}`;
              }
            }}
            renderItem={({ item }) => {
              try {
                return renderMessageItem({ item });
              } catch (error) {
                console.error('Error rendering message:', error, item);
                // Return a fallback UI for messages that fail to render
                return (
                  <View style={[styles.messageWrapper, styles.errorMessageWrapper]}>
                    <View style={[styles.messageContainer, styles.errorMessage]}>
                      <Text style={styles.errorMessageText}>
                        Message could not be displayed
                      </Text>
                    </View>
                  </View>
                );
              }
            }}
            contentContainerStyle={styles.messagesContainer}
            inverted={true}
            removeClippedSubviews={false}
            maxToRenderPerBatch={10}
            windowSize={10}
            ListEmptyComponent={() => (
              <View style={styles.noMessagesContainer}>
                <Text style={styles.noMessagesText}>No messages yet</Text>
              </View>
            )}
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
        style={styles.inputContainerWrapper}
      >
        {/* Initial Attachment Preview Area */} 
        {initialAttachment && (
          <View style={styles.initialAttachmentPreviewContainer}>
            <Image 
              source={{ uri: initialAttachment.uri }}
              style={styles.initialAttachmentThumbnail}
              contentFit="cover"
            />
            <Text style={styles.initialAttachmentText} numberOfLines={1}>
              Attached: {initialAttachment.name}
            </Text>
            <TouchableOpacity 
              style={styles.removeAttachmentButton}
              onPress={() => setInitialAttachment(null)}
            >
              <X size={16} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        
        {!isRecording ? (
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
            
            {messageText.trim() ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  sending && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.micButton}
                onPress={startRecording}
              >
                <Mic size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.recordingContainer}>
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { opacity: recordingDuration % 2 ? 0.5 : 1 }]} />
              <Text style={styles.recordingTimer}>
                Recording... {recordingDuration}s
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.stopRecordingButton}
              onPress={stopRecording}
            >
              <StopCircle size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
        
        {recordingUri && !isRecording && (
          <View style={styles.recordingPreviewContainer}>
            <View style={styles.recordingPreview}>
              <View style={styles.recordingPreviewInfo}>
                <Mic size={20} color="#22C55E" />
                <Text style={styles.recordingPreviewText}>
                  Voice message ({recordingDuration}s)
                </Text>
              </View>
              
              <View style={styles.recordingPreviewActions}>
                <TouchableOpacity
                  style={styles.previewPlayButton}
                  onPress={() => togglePlayVoiceMessage('preview', recordingUri)}
                >
                  {isPlaying['preview'] ? (
                    <Pause size={20} color="#FFFFFF" />
                  ) : (
                    <Play size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.cancelRecordingButton}
                  onPress={() => {
                    setRecordingUri(null);
                    setRecordingDuration(0);
                    if (isPlaying['preview']) {
                      togglePlayVoiceMessage('preview', recordingUri);
                    }
                  }}
                >
                  <X size={20} color="#666666" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.sendRecordingButton}
                  onPress={sendVoiceMessage}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
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
                contentFit="cover"
                transition={200}
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
              onPress={handleSendMessage}
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
    marginRight: 5, // Add margin to prevent overlap with info button
    alignItems: 'flex-start', // Align title/subtitle left
  },
  headerTitle: {
    fontSize: 17, // Adjust size if needed
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13, // Adjust size
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  inputContainerWrapper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  inputContainer: {
    // width: '100%', 
    // backgroundColor: '#FFFFFF',
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
    flexDirection: 'row', // Keep avatar and bubble together
    alignItems: 'flex-end', // Align avatar bottom with bubble
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    // marginBottom: 4, // Align with bottom of text bubble potentially
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
  mediaCaption: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 2,
  },
  imageWrapper: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  imageContent: {
    width: '100%',
    height: '100%',
  },
  imageInner: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imageFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  imageFallbackText: {
    fontSize: 16,
    color: '#666666',
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
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0F0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 8,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingTimer: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  stopRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  recordingPreviewContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  recordingPreview: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 12,
  },
  recordingPreviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingPreviewText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 8,
  },
  recordingPreviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelRecordingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendRecordingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    marginBottom: 4,
    maxWidth: '100%',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  voiceWaveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    marginRight: 8,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    marginHorizontal: 1,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#666666',
    minWidth: 30,
    textAlign: 'right',
  },
  errorMessageWrapper: {
    marginVertical: 4,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  errorMessage: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 4,
    backgroundColor: '#FFF0F0',
  },
  errorMessageText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  onlineStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  initialAttachmentPreviewContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0', // Light background for the preview area
  },
  initialAttachmentThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 10,
  },
  initialAttachmentText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
  },
  removeAttachmentButton: {
    padding: 6,
    marginLeft: 8,
  },
  groupInfoButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6c757d', // Or use a specific color
    marginBottom: 3,
    marginLeft: 2, // Align with text content padding
  },
}); 