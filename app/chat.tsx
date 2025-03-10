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
import { Send, ChevronLeft, Paperclip, X, Mic, StopCircle, Play, Pause } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { chatService, Message } from '@/services/chatService';
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

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageMap, setMessageMap] = useState<{[key: string]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [partnerOnline, setPartnerOnline] = useState<boolean>(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lottieRef = useRef<LottieView>(null);
  const subscriptionRef = useRef<any>(null);
  const presenceSubscriptionRef = useRef<any>(null);
  
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
  
  // Get partner ID from params
  const partnerId = params.userId as string || params.partnerId as string;
  const userName = params.userName as string || params.partnerName as string;
  const userAvatar = params.userAvatar as string;
  const initialMessage = params.initialMessage as string;
  const tradeId = params.tradeId as string;
  const offeredItemImageUrl = params.offeredItemImageUrl as string;
  const requestedItemImageUrl = params.requestedItemImageUrl as string;
  const offeredItemName = params.offeredItemName as string;
  const requestedItemName = params.requestedItemName as string;
  
  // Track if initial message has been sent
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const initialMessageSentRef = useRef(false);
  
  // Add a check for required parameters
  useEffect(() => {
    if (!partnerId) {
      console.error('Missing required parameter: userId or partnerId');
      Alert.alert(
        'Error',
        'Missing user information. Please try again.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
    }
  }, [partnerId, router]);

  // Set initial message if provided
  useEffect(() => {
    // Use ref to ensure the effect only runs once
    if (initialMessage && chatRoomId && !initialMessageSentRef.current && tradeId) {
      // Mark as sent immediately to prevent duplicate sends
      initialMessageSentRef.current = true;
      setInitialMessageSent(true);
      
      // Set the message text first
      setMessageText(initialMessage);
      
      // Then send it automatically after a short delay
      const timer = setTimeout(async () => {
        // Send the initial message without appending the trade ID to the visible text
        // The trade ID will be included in metadata or as a separate field
        setMessageText(initialMessage);
        await handleSendMessageWithTradeId(tradeId);
        
        // Then send the item images if available
        if (offeredItemImageUrl) {
          await sendTradeItemImage(offeredItemImageUrl, `My offered item: ${offeredItemName || 'Item'}`);
        }
        
        if (requestedItemImageUrl) {
          await sendTradeItemImage(requestedItemImageUrl, `Your item: ${requestedItemName || 'Item'}`);
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [initialMessage, chatRoomId, tradeId, offeredItemImageUrl, requestedItemImageUrl]);

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
          
          // Update current user's presence
          await presenceService.updatePresence(user.id);
          
          // Check partner's online status
          const presenceResult = await presenceService.isUserOnline(partnerId);
          if (presenceResult.success) {
            setPartnerOnline(presenceResult.isOnline);
          }
          
          // Subscribe to partner's presence changes
          setupPresenceSubscription(partnerId);
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    initializeChat();
    
    // Set up a periodic presence update for the current user
    const presenceInterval = setInterval(() => {
      if (user?.id) {
        presenceService.updatePresence(user.id).catch(err => {
          console.error('Error updating presence:', err);
        });
      }
    }, 30000); // Update every 30 seconds
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(presenceInterval);
      
      // Mark user as offline when leaving
      if (user?.id) {
        presenceService.markOffline(user.id).catch(err => {
          console.error('Error marking user offline:', err);
        });
      }
      
      // Clean up subscriptions on unmount - Fix the cleanup
      if (subscriptionRef.current) {
        // Check if it's a Promise or direct subscription
        if (typeof subscriptionRef.current.then === 'function') {
          // Handle Promise without await since we're in a non-async function
          subscriptionRef.current.then(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
              sub.unsubscribe();
            }
          }).catch(err => {
            console.error('Error unsubscribing from messages:', err);
          });
        } else if (subscriptionRef.current.unsubscribe) {
          subscriptionRef.current.unsubscribe();
        }
      }
      
      if (presenceSubscriptionRef.current) {
        // Fix: Don't use .then() as it's not a Promise
        if (presenceSubscriptionRef.current.unsubscribe) {
          presenceSubscriptionRef.current.unsubscribe();
        }
      }
    };
  }, [user, partnerId, userName, userAvatar]);

  // Set up real-time subscription
  const setupSubscription = async (roomId) => {
    try {
      // Clean up any existing subscription
      if (subscriptionRef.current) {
        // Check if it's a Promise or direct subscription
        if (typeof subscriptionRef.current.then === 'function') {
          const sub = await subscriptionRef.current;
          sub.unsubscribe();
        } else if (subscriptionRef.current.unsubscribe) {
          subscriptionRef.current.unsubscribe();
        }
      }
      
      // Create new subscription
      subscriptionRef.current = chatService.subscribeToMessages(roomId, (payload) => {
        console.log('Received real-time update:', payload);
        
        // When a new message is received
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;
          
          // Log the message ID to help with debugging
          console.log('Received message with ID:', newMessage.id);
          
          setMessages(prevMessages => {
            // First check if this exact message ID already exists in our state
            const exactDuplicate = prevMessages.some(msg => msg.id === newMessage.id);
            if (exactDuplicate) {
              console.log('Exact duplicate message found, skipping:', newMessage.id);
              return prevMessages;
            }
            
            // Check if we have a temporary message that needs to be replaced
            const tempMessageIndex = prevMessages.findIndex(msg => 
              msg.is_sending && msg.content === newMessage.content && 
              msg.sender_id === newMessage.sender_id &&
              Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 10000
            );

            if (tempMessageIndex !== -1) {
              // Replace the temporary message with the real one
              console.log('Replacing temp message with real message:', newMessage.id);
              const updatedMessages = [...prevMessages];
              updatedMessages[tempMessageIndex] = { ...newMessage, is_sending: false };
              return updatedMessages;
            }

            // If no temporary message found and not in messageMap, add as new
            if (!messageMap[newMessage.id]) {
              console.log('Adding new message to state:', newMessage.id);
              setMessageMap(prev => ({ ...prev, [newMessage.id]: true }));
              return [newMessage, ...prevMessages];
            }

            return prevMessages;
          });
        }
      });
    } catch (error) {
      console.error('Error setting up subscription:', error);
    }
  };

  // Set up presence subscription
  const setupPresenceSubscription = async (partnerId) => {
    try {
      // Clean up any existing subscription
      if (presenceSubscriptionRef.current) {
        // Fix: Don't use .then() as it's not a Promise
        presenceSubscriptionRef.current.unsubscribe();
      }
      
      // Create new subscription
      presenceSubscriptionRef.current = presenceService.subscribeToUserPresence(partnerId, (payload) => {
        console.log('Received presence update:', payload);
        
        if (payload.eventType === 'UPDATE') {
          const presenceData = payload.new;
          
          // Check if user is online (is_online flag and last_seen within 2 minutes)
          const isOnline = presenceData.is_online && 
            new Date(presenceData.last_seen).getTime() > Date.now() - 2 * 60 * 1000;
          
          setPartnerOnline(isOnline);
          setPartnerLastSeen(presenceData.last_seen);
        }
      });
    } catch (error) {
      console.error('Error setting up presence subscription:', error);
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
      
      // Deduplicate messages by ID before sorting
      const uniqueMessages = result.messages.reduce((acc, message) => {
        // Only add if we don't already have this message ID
        if (!acc.some(m => m.id === message.id)) {
          acc.push(message);
        } else {
          console.log('Duplicate message found during load:', message.id);
        }
        return acc;
      }, []);
      
      console.log('Unique messages count:', uniqueMessages.length);
      
      // Sort messages in reverse chronological order for inverted FlatList
      const sortedMessages = [...uniqueMessages].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Create a map of message IDs
      const newMessageMap = sortedMessages.reduce((acc, msg) => {
        acc[msg.id] = true;
        return acc;
      }, {} as {[key: string]: boolean});
      
      setMessageMap(newMessageMap);
      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Special function to handle sending messages with trade ID
  const handleSendMessageWithTradeId = async (tradeId: string) => {
    if (!messageText.trim() || sending || !chatRoomId) return;
    
    setSending(true);
    
    try {
      const tempId = `temp-${Date.now()}`;
      // Use the message text as is, without appending the trade ID
      const messageContent = messageText;
      
      // Create metadata to store the trade ID
      const metadata = {
        tradeId: tradeId,
        isTradeMessage: true
      };
      
      // Add optimistic message at the beginning for inverted FlatList
      const tempMessage: Message = {
        id: tempId,
        room_id: chatRoomId,
        chat_room_id: chatRoomId,
        sender_id: user?.id || '',
        content: messageContent,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: 'text',
        metadata: metadata
      };
      
      setMessages((prev) => [tempMessage, ...prev]);
      setMessageText('');
      
      // Use the regular sendMessage function with metadata for the trade ID
      console.log(`Sending message with trade ID in metadata: ${tradeId}`);
      const result = await chatService.sendMessage(
        chatRoomId,
        user?.id || '',
        messageContent,
        undefined,
        'text',
        undefined,
        undefined,
        metadata
      );
      
      if (!result.success) {
        // Update the temp message to show error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
          )
        );
        console.error('Failed to send message with trade ID:', result.error);
        Alert.alert('Error', 'Failed to send message. Please try again.');
        return;
      }
      
      if (result.message) {
        // Replace temp message with actual message
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...result.message, is_sending: false } : msg
          )
        );
      } else {
        // If no message returned, just mark as sent
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, is_sending: false } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message with trade ID:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Regular function to handle sending messages without trade ID
  const handleSendMessage = async () => {
    if (!messageText.trim() || sending || !chatRoomId) return;
    
    setSending(true);
    
    try {
      const tempId = `temp-${Date.now()}`;
      const messageContent = messageText;
      const currentTime = new Date().toISOString();
      
      // Add optimistic message
      const tempMessage: Message = {
        id: tempId,
        room_id: chatRoomId,
        chat_room_id: chatRoomId,
        sender_id: user?.id || '',
        content: messageContent,
        created_at: currentTime,
        is_sending: true,
        is_error: false,
        message_type: 'text',
        sender: user
      };
      
      // Add to messageMap to prevent duplication
      setMessageMap(prev => ({ ...prev, [tempId]: true }));
      setMessages(prev => [tempMessage, ...prev]);
      setMessageText('');
      
      // Send message to server
      const result = await chatService.sendMessage(
        chatRoomId,
        user?.id || '',
        messageContent,
        undefined,
        'text'
      );
      
      if (!result.success) {
        // Update the temp message to show error
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
          )
        );
        console.error('Failed to send message:', result.error);
        return;
      }
      
      // The real message will be handled by the subscription
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update the temp message to show error
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
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
    // Add null check for item and required properties
    if (!item || !item.id || !item.sender_id) {
      console.log('Invalid message item:', item);
      return null;
    }
    
    const isMyMessage = item.sender_id === user?.id;
    
    return (
      <View
        key={`msg-${item.id}`}
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
    
    // Prevent multiple submissions
    if (uploadingMedia) {
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
      
      // Use messageText as caption if provided, otherwise use a descriptive text based on media type
      let mediaContent = messageText.trim();
      if (!mediaContent) {
        if (messageType === 'image') {
          mediaContent = '📷 Image';
        } else if (messageType === 'video') {
          mediaContent = '🎥 Video';
        } else {
          mediaContent = '📎 File';
        }
      }
      
      // Create a safe sender object with only necessary properties
      const safeSender = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url
      };
      
      // Validate the media URI before proceeding
      if (!selectedMedia.uri || typeof selectedMedia.uri !== 'string') {
        throw new Error('Invalid media URI');
      }
      
      // Add optimistic message
      const tempMessage: Message = {
        id: tempId,
        room_id: chatRoomId,
        chat_room_id: chatRoomId,
        sender_id: user?.id || '',
        content: mediaContent,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: messageType,
        media_uri: selectedMedia.uri,
        sender: safeSender
      };
      
      // Add to messageMap to prevent duplication
      setMessageMap(prev => ({ ...prev, [tempId]: true }));
      
      // Update messages state safely
      setMessages(prevMessages => {
        return [tempMessage, ...prevMessages];
      });
      
      // Clear the input field
      setMessageText('');
      
      // Close the media preview first to avoid UI issues
      setMediaPreviewVisible(false);
      
      // Upload media to storage
      let folderName = 'chatFiles';
      if (messageType === 'image') folderName = 'chatImages';
      if (messageType === 'video') folderName = 'chatVideos';
      
      console.log('Uploading media:', selectedMedia.uri);
      const uploadResult = await chatService.uploadChatMedia(selectedMedia, chatRoomId);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('Failed to upload media');
      }
      
      console.log('Media uploaded successfully:', uploadResult.url);
      
      // Send message with media URL
      const result = await chatService.sendMessage(
        chatRoomId,
        user.id,
        mediaContent, // Use the caption if provided, otherwise null
        uploadResult.url,
        messageType as 'text' | 'image' | 'video' | 'voice' | 'gif' | 'emoji'
      );
      
      // The real message will be handled by the subscription
      
      // Clear selected media after successful upload
      setSelectedMedia(null);
    } catch (error) {
      console.error('Error sending media:', error);
      
      // Update the temp message to show error
      if (tempId) {
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.id === tempId) {
              return { ...msg, is_sending: false, is_error: true };
            }
            return msg;
          });
        });
      }
      
      Alert.alert('Error', 'Failed to send media. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Function to send trade item images
  const sendTradeItemImage = async (imageUrl: string, caption: string) => {
    if (!imageUrl || !chatRoomId || !user) return;
    
    try {
      const tempId = `temp-${Date.now()}`;
      
      // Create a safe sender object with only necessary properties
      const safeSender = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url
      };
      
      // Add optimistic message
      const tempMessage: Message = {
        id: tempId,
        room_id: chatRoomId,
        chat_room_id: chatRoomId,
        sender_id: user?.id || '',
        content: caption,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: 'image',
        media_uri: imageUrl,
        sender: safeSender
      };
      
      // Add to messageMap to prevent duplication
      setMessageMap(prev => ({ ...prev, [tempId]: true }));
      
      // Update messages state safely
      setMessages(prevMessages => {
        return [tempMessage, ...prevMessages];
      });
      
      // Send message with the image URL
      const result = await chatService.sendMessage(
        chatRoomId,
        user.id,
        caption,
        imageUrl,
        'image'
      );
      
      if (!result.success) {
        // Update the temp message to show error
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
          )
        );
        console.error('Failed to send trade item image:', result.error);
      }
    } catch (error) {
      console.error('Error sending trade item image:', error);
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
                <View style={styles.onlineStatusContainer}>
                  {partnerOnline ? (
                    <>
                      <View style={styles.onlineIndicator} />
                      <Text style={styles.headerSubtitle}>Online</Text>
                    </>
                  ) : (
                    <Text style={styles.headerSubtitle}>
                      {partnerLastSeen ? `Last seen ${formatLastSeen(partnerLastSeen)}` : 'Offline'}
                    </Text>
                  )}
                </View>
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
        style={styles.inputContainer}
      >
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
                onPress={() => {
                  // Always use the regular handleSendMessage for user-typed messages
                  // The initial message with tradeId is handled by the useEffect
                  handleSendMessage();
                }}
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
}); 