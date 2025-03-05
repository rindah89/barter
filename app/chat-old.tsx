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
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Send, ChevronLeft, Mic, Image as ImageIcon, X, Video as VideoIcon, Play, Pause } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { chatService, Message } from '@/services/chatService';
import { useAuth } from '@/lib/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useAudioPlayer, useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { format } from 'date-fns';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  // Add console logs for debugging
  console.log('Chat Screen Params:', params);
  console.log('Current User:', user);
  
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioPlayers, setAudioPlayers] = useState<Record<string, ReturnType<typeof useAudioPlayer>>>({});
  const [videoPlayers, setVideoPlayers] = useState<Record<string, ReturnType<typeof useVideoPlayer>>>({});
  
  // Initialize audio recorder
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Get partner ID from params
  const partnerId = params.userId as string;
  const userName = params.userName as string;
  const userAvatar = params.userAvatar as string;
  
  // Add more console logs
  console.log('Partner ID:', partnerId);
  console.log('User Name:', userName);
  console.log('User Avatar:', userAvatar);

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

  // Initialize chat room - simplified version
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
          const messagesResult = await chatService.getChatMessages(result.chatRoom.id);
          if (messagesResult.success && messagesResult.messages) {
            setMessages(messagesResult.messages);
          }
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
    };
  }, [user, partnerId, userName, userAvatar]);

  // Request microphone permissions
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission to access microphone was denied');
      }
    })();
  }, []);

  // Subscribe to real-time message updates
  useEffect(() => {
    if (!chatRoomId) return;
    
    const subscription = chatService.subscribeToMessages(chatRoomId, (payload) => {
      // When a new message is received
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new;
        
        // Fetch the complete message with sender info
        chatService.getChatRoomDetails(chatRoomId).then(result => {
          if (result.success && result.chatRoom) {
            const sender = result.chatRoom.participants.find(p => p.id === newMessage.sender_id);
            if (sender) {
              setMessages(prevMessages => [
                ...prevMessages,
                { ...newMessage, sender } as Message
              ]);
              
              // Scroll to bottom
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }
        });
      }
    });
    
    // Cleanup subscription on unmount
    return () => {
      subscription.then(sub => sub.unsubscribe());
    };
  }, [chatRoomId]);

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
      setMessages(result.messages);
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        console.log('Scrolling to bottom');
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Simplified send message function
  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatRoomId || !user) return;
    
    try {
      setSending(true);
      const result = await chatService.sendMessage(
        chatRoomId,
        user.id,
        messageText.trim()
      );
      
      if (result.success) {
        setMessageText('');
      } else {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Send image message
  const handleSendImage = async () => {
    if (!chatRoomId || !user) return;
    
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to grant permission to access your photos.');
        return;
      }
      
      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      
      if (result.canceled) return;
      
      setSending(true);
      
      // Upload image
      const uploadResult = await chatService.uploadChatMedia(
        { uri: result.assets[0].uri, type: 'image' },
        chatRoomId
      );
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Failed to upload image');
      }
      
      // Send message with image
      await chatService.sendMessage(
        chatRoomId,
        user.id,
        null,
        uploadResult.url,
        'image'
      );
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Send video message
  const handleSendVideo = async () => {
    if (!chatRoomId || !user) return;
    
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to grant permission to access your media.');
        return;
      }
      
      // Pick video
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // Limit to 60 seconds
      });
      
      if (result.canceled) return;
      
      setSending(true);
      
      // Upload video
      const uploadResult = await chatService.uploadChatMedia(
        { uri: result.assets[0].uri, type: 'video' },
        chatRoomId
      );
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Failed to upload video');
      }
      
      // Get video duration if available
      let duration = 0;
      if (result.assets[0].duration) {
        duration = Math.round(result.assets[0].duration);
      }
      
      // Send message with video
      await chatService.sendMessage(
        chatRoomId,
        user.id,
        null,
        uploadResult.url,
        'video',
        duration
      );
    } catch (error) {
      console.error('Error sending video:', error);
      Alert.alert('Error', 'Failed to send video. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Start recording
      setIsRecording(true);
      await audioRecorder.record();
      
      // Start duration timer
      setRecordingDuration(0);
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!chatRoomId || !user) return;
    
    try {
      // Stop duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      
      setIsRecording(false);
      
      // Stop recording
      await audioRecorder.stop();
      
      const uri = audioRecorder.uri;
      if (!uri) {
        throw new Error('Recording URI is null');
      }
      
      setSending(true);
      
      // Upload voice message
      const uploadResult = await chatService.uploadVoiceMessage(uri);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'Failed to upload voice message');
      }
      
      // Send message with voice recording
      await chatService.sendMessage(
        chatRoomId,
        user.id,
        null,
        uploadResult.url,
        'voice',
        recordingDuration
      );
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
    } finally {
      setRecordingDuration(0);
      setSending(false);
    }
  };

  const cancelRecording = async () => {
    try {
      // Stop duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      
      setIsRecording(false);
      
      // Stop and discard recording
      await audioRecorder.stop();
    } catch (error) {
      console.error('Error canceling recording:', error);
    } finally {
      setRecordingDuration(0);
    }
  };

  // Audio playback functions
  const getAudioPlayer = (messageId: string, audioUri: string) => {
    if (!audioPlayers[messageId]) {
      const player = useAudioPlayer(audioUri);
      setAudioPlayers(prev => ({
        ...prev,
        [messageId]: player
      }));
      return player;
    }
    return audioPlayers[messageId];
  };

  const playAudio = async (audioUri: string, messageId: string) => {
    try {
      const player = getAudioPlayer(messageId, audioUri);
      
      // If already playing this audio, pause it
      if (playingAudio === messageId && player.playing) {
        player.pause();
        return;
      }
      
      // If playing a different audio, pause it first
      if (playingAudio && playingAudio !== messageId && audioPlayers[playingAudio]) {
        audioPlayers[playingAudio].pause();
      }
      
      // Set the current audio
      setPlayingAudio(messageId);
      
      // Play the sound
      player.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio. Please try again.');
    }
  };

  // Format timestamp
  const formatMessageTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return format(new Date(timestamp), 'h:mm a');
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Initialize video player for a message
  const getVideoPlayer = (messageId: string, videoUri: string) => {
    if (!videoPlayers[messageId]) {
      const player = useVideoPlayer(videoUri, (player) => {
        // Initialize player settings
        player.loop = false;
      });
      
      setVideoPlayers(prev => ({
        ...prev,
        [messageId]: player
      }));
      return player;
    }
    return videoPlayers[messageId];
  };

  // Simplified message rendering
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender.id === user?.id;
    
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.partnerMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.partnerMessageText,
          ]}
        >
          {item.content}
        </Text>
        <Text
          style={[
            styles.timestamp,
            isMyMessage ? styles.myTimestamp : styles.partnerTimestamp,
          ]}
        >
          {formatMessageTime(item.created_at)}
        </Text>
      </View>
    );
  };

  // Simplified render function
  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          {partnerProfile ? (
            <>
              <Image
                source={
                  partnerProfile.avatar_url
                    ? { uri: partnerProfile.avatar_url }
                    : require('../assets/images/default-avatar.png')
                }
                style={styles.avatar}
              />
              <Text style={styles.headerName}>
                {partnerProfile.full_name || partnerProfile.username || userName || 'User'}
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="small" color="#333" />
              <Text style={styles.headerName}>Loading...</Text>
            </>
          )}
        </View>
      </View>
      
      {/* Debug Info - Remove in production */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Partner ID: {partnerId || 'None'}</Text>
          <Text style={styles.debugText}>Chat Room ID: {chatRoomId || 'None'}</Text>
          <Text style={styles.debugText}>Messages: {messages.length}</Text>
          <Text style={styles.debugText}>Loading: {loading ? 'Yes' : 'No'}</Text>
        </View>
      )}
      
      {/* Messages */}
      <View style={styles.messagesWrapper}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        ) : (
          <View style={styles.noMessagesContainer}>
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
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
        />
        
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={sending || !messageText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
  },
  debugContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  debugText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 24,
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
  noMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMessagesText: {
    fontSize: 16,
    color: '#666666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0066CC',
  },
  partnerMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  partnerMessageText: {
    color: '#333333',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  partnerTimestamp: {
    color: '#999999',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  videoContainer: {
    width: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoPlayer: {
    width: '100%',
    height: 200,
  },
  videoDuration: {
    fontSize: 12,
    color: '#333333',
    marginTop: 4,
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
  },
  voiceMessageContent: {
    marginLeft: 8,
  },
  voiceMessageText: {
    fontSize: 16,
    color: '#333333',
  },
  voiceMessageDuration: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  deletedMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#999999',
  },
}); 