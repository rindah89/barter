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
import { Send, ChevronLeft, Paperclip, X, Mic, StopCircle, Play, Pause } from 'lucide-react-native';
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
import { Video, Audio } from 'expo-av';
import MediaSourceModal from '@/components/MediaSourceModal';
import { uploadFile } from '@/services/imageservice';
import LoadingIndicator from '../components/LoadingIndicator';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

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
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<{[key: string]: boolean}>({});
  const [playbackDuration, setPlaybackDuration] = useState<{[key: string]: number}>({});
  const [playbackPosition, setPlaybackPosition] = useState<{[key: string]: number}>({});

  // Refs for recording and playback
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundPlayersRef = useRef<{[key: string]: Audio.Sound}>({});
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get partner ID from params
  const partnerId = params.userId as string || params.partnerId as string;
  const userName = params.userName as string || params.partnerName as string;
  const userAvatar = params.userAvatar as string;
  const initialMessage = params.initialMessage as string;
  const tradeId = params.tradeId as string;
  
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
      const timer = setTimeout(() => {
        // Include the trade ID in the message content instead of as a separate field
        const messageWithTradeId = initialMessage + ` (Trade ID: ${tradeId})`;
        
        // Use the regular handleSendMessage function
        setMessageText(messageWithTradeId);
        handleSendMessage();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [initialMessage, chatRoomId, tradeId]);

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

  // Special function to handle sending messages with trade ID
  const handleSendMessageWithTradeId = async (tradeId: string) => {
    if (!messageText.trim() || sending || !chatRoomId) return;
    
    setSending(true);
    
    try {
      const tempId = `temp-${Date.now()}`;
      // Include the trade ID in the message content instead of as a separate field
      const messageContent = messageText + ` (Trade ID: ${tradeId})`;
      
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
        message_type: 'text'
      };
      
      setMessages((prev) => [tempMessage, ...prev]);
      setMessageText('');
      
      // Use the regular sendMessage function with the working approach
      console.log(`Sending message with trade ID in content: ${tradeId}`);
      const result = await chatService.sendMessage(
        chatRoomId,
        user?.id || '',
        messageContent,
        undefined,
        'text'
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
      
      // Update the temp message to show error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
        )
      );
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
        message_type: 'text'
      };
      
      setMessages((prev) => [tempMessage, ...prev]);
      setMessageText('');
      
      // Send message to server using the working approach
      console.log('Sending regular message');
      const result = await chatService.sendMessage(
        chatRoomId,
        user?.id || '',
        messageContent,
        undefined,
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
      console.error('Error sending message:', error);
      
      // Update the temp message to show error
      setMessages((prev) =>
        prev.map((msg) =>
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

  // Initialize audio
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    setupAudio();
    
    // Clean up audio resources
    return () => {
      // Stop and unload recording if exists
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
      }
      
      // Stop and unload all sound players
      Object.values(soundPlayersRef.current).forEach(player => {
        player.unloadAsync().catch(console.error);
      });
      
      // Clear intervals
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Start recording function
  const startRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant microphone access to record voice messages.');
        return;
      }

      // Create recording object
      const newRecording = new Audio.Recording();
      recordingRef.current = newRecording;

      // Start recording
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop recording function
  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      // Stop the recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setRecordingUri(uri);

      // Clear interval and reset states
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  // Send voice message function
  const sendVoiceMessage = async () => {
    if (!recordingUri || !chatRoomId || !user?.id) return;

    try {
      setUploadingMedia(true);

      // Add optimistic message
      const tempId = `temp-${Date.now()}`;
      // Make content optional - can be null for voice messages without text
      const messageContent = null;
      
      const tempMessage: Message = {
        id: tempId,
        chat_room_id: chatRoomId,
        room_id: chatRoomId,
        sender_id: user.id,
        content: messageContent,
        created_at: new Date().toISOString(),
        is_sending: true,
        is_error: false,
        message_type: 'voice',
        media_uri: recordingUri,
        duration: recordingDuration
      };
      
      setMessages((prev) => [tempMessage, ...prev]);

      // Upload voice message
      console.log('Uploading voice message:', recordingUri);
      const uploadResult = await chatService.uploadVoiceMessage(recordingUri);
      
      if (!uploadResult.success || !uploadResult.url) {
        console.error('Failed to upload voice message:', uploadResult.error);
        throw new Error('Failed to upload voice message');
      }
      
      console.log('Voice message uploaded successfully:', uploadResult.url);

      // Send message with the working approach
      const result = await chatService.sendMessage(
        chatRoomId,
        user.id,
        messageContent,
        uploadResult.url,
        'voice',
        recordingDuration
      );
      
      if (!result.success) {
        console.error('Failed to send voice message:', result.error);
        // Update the temp message to show error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, is_sending: false, is_error: true } : msg
          )
        );
        throw new Error(result.error || 'Failed to send voice message');
      }
      
      console.log('Voice message sent successfully:', result.message);
      
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

      // Clear recording states
      setRecordingUri(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Play/pause voice message function
  const togglePlayVoiceMessage = async (messageId: string, uri: string) => {
    try {
      // If already playing, stop it
      if (soundPlayersRef.current[messageId]) {
        const player = soundPlayersRef.current[messageId];
        const status = await player.getStatusAsync();
        
        if (status.isLoaded) {
          if (status.isPlaying) {
            await player.pauseAsync();
            setIsPlaying(prev => ({ ...prev, [messageId]: false }));
          } else {
            await player.playAsync();
            setIsPlaying(prev => ({ ...prev, [messageId]: true }));
          }
        }
        return;
      }

      // Create new sound player
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri });
      soundPlayersRef.current[messageId] = sound;

      // Get duration
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setPlaybackDuration(prev => ({ ...prev, [messageId]: status.durationMillis || 0 }));
      }

      // Play and update state
      await sound.playAsync();
      setIsPlaying(prev => ({ ...prev, [messageId]: true }));

      // Add playback finished listener
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(prev => ({ ...prev, [messageId]: status.positionMillis }));
          
          if (status.didJustFinish) {
            setIsPlaying(prev => ({ ...prev, [messageId]: false }));
            setPlaybackPosition(prev => ({ ...prev, [messageId]: 0 }));
          }
        }
      });
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Error', 'Failed to play voice message. Please try again.');
    }
  };

  // Render message item - updated to handle different media types
  const renderMessageItem = ({ item }: { item: Message }) => {
    // Add null check for item
    if (!item) {
      return null;
    }
    
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
            <FastImage
              source={{ uri: item.gif_url }}
              style={styles.gifImage}
              resizeMode={FastImage.resizeMode.contain}
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
           item.content && (
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
      
      // Use null or empty content for media messages
      const mediaContent = selectedMedia.name || null;
      
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
        media_uri: selectedMedia.uri
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
        mediaContent,
        uploadResult.url,
        messageType as 'text' | 'image' | 'video' | 'voice' | 'gif' | 'emoji'
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
          <LoadingIndicator 
            message="Loading messages..." 
            size="medium"
            containerStyle={styles.loadingContainer}
            textStyle={styles.loadingText}
          />
        ) : messages && messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={messages.filter(msg => msg !== null && msg !== undefined)}
            keyExtractor={(item) => item?.id || `msg-${Date.now()}-${Math.random()}`}
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
  mediaCaption: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 2,
  },
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
}); 