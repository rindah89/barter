import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Image as ExpoImage } from 'expo-image';
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Play } from 'lucide-react-native';
import { getSupabaseFileUrl } from '../services/imageservice';
import { useVideoPlayer, VideoView } from 'expo-video';
import { chatService } from '@/services/chatService';
import { useAuth } from '@/lib/AuthContext';

// Get screen dimensions for responsive design
const { width } = Dimensions.get('window');

// Define MediaFile interface for our app's use
interface MediaFile {
  url: string;
  type: 'image' | 'video';
}

// Define Item interface to fix TypeScript errors
interface ItemProfile {
  id: string;
  name?: string;
  avatar_url?: string;
  location?: string;
  interest?: string[];
}

interface Item {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url?: string;
  media_type?: string;
  media_files?: string | any[];
  profiles?: ItemProfile;
}

export default function ItemDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const thumbnailsRef = useRef<FlatList>(null);
  
  // Always call the hook, but conditionally use the URL
  const videoPlayer = useVideoPlayer(selectedVideoUrl || '', player => {
    if (selectedVideoUrl) {
      player.play();
    }
  });

  // Create a ref to track if the component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*, profiles:user_id(*)')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        setItem(data);
        console.log('Item fetched:', data);
        console.log('Image URL:', data?.image_url);
        console.log('Owner interests:', data?.profiles?.interest);
        
        // Process media files
        processMediaFiles(data);
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
    
    // Cleanup function to safely handle the video player when component unmounts
    return () => {
      try {
        // Check if the video player exists and is in a playing state before pausing
        if (videoPlayer && videoPlayer.playing) {
          videoPlayer.pause();
        }
      } catch (error) {
        console.log('Error during cleanup:', error);
      }
    };
  }, [id]);
  
  useEffect(() => {
    // Set isMounted to true when the component mounts
    isMounted.current = true;
    
    // Set isMounted to false when the component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  useEffect(() => {
    // Update the video source when selectedVideoUrl changes
    if (selectedVideoUrl && videoPlayer && isMounted.current) {
      try {
        videoPlayer.replace(selectedVideoUrl);
      } catch (error) {
        console.log('Error updating video source:', error);
      }
    }
  }, [selectedVideoUrl]);
  
  const processMediaFiles = (data: Item | null) => {
    if (!data) return;
    
    let processedMediaFiles: MediaFile[] = [];
    
    // Always add the main image_url as the first media file if it exists
    if (data.image_url) {
      processedMediaFiles.push({
        url: getSupabaseFileUrl(data.image_url),
        type: data.media_type === 'video' ? 'video' : 'image'
      });
    }
    
    // Process additional media files if they exist
    if (data.media_files) {
      let mediaFilesArray = [];
      
      if (typeof data.media_files === 'string') {
        try {
          mediaFilesArray = JSON.parse(data.media_files);
        } catch (e) {
          console.error('Error parsing media_files:', e);
        }
      } else if (Array.isArray(data.media_files)) {
        mediaFilesArray = data.media_files;
      }
      
      // Convert string URLs to MediaFile objects and add to the array
      // Skip the first one if it's the same as the main image_url
      if (Array.isArray(mediaFilesArray)) {
        mediaFilesArray.forEach((media, index) => {
          const mediaUrl = typeof media === 'string' ? media : media.url;
          const mediaType = typeof media === 'string' 
            ? (mediaUrl.match(/\.(mp4|mov|avi|3gp|mkv)$/i) ? 'video' : 'image')
            : media.type || 'image';
            
          // Skip if this is the same as the main image_url and it's the first item
          if (index === 0 && data.image_url && mediaUrl === data.image_url) {
            return;
          }
          
          processedMediaFiles.push({
            url: getSupabaseFileUrl(mediaUrl),
            type: mediaType as 'image' | 'video'
          });
        });
      }
    }
    
    setMediaFiles(processedMediaFiles);
    
    // If there's a video in the first position, set it as the selected video
    if (processedMediaFiles.length > 0 && processedMediaFiles[0].type === 'video') {
      setSelectedVideoUrl(processedMediaFiles[0].url);
    }
  };
  
  const handleMediaChange = (index: number) => {
    setActiveMediaIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
    
    try {
      // If the selected media is a video, update the video player
      if (mediaFiles[index]?.type === 'video') {
        setSelectedVideoUrl(mediaFiles[index].url);
      } else {
        // If the current video is playing, pause it before switching to an image
        if (videoPlayer && videoPlayer.playing) {
          videoPlayer.pause();
        }
        setSelectedVideoUrl(null);
      }
    } catch (error) {
      console.log('Error changing media:', error);
    }
  };
  
  const renderMediaItem = ({ item: media, index }: { item: MediaFile, index: number }) => {
    if (media.type === 'video') {
      return (
        <View style={styles.mediaContainer}>
          {selectedVideoUrl && index === activeMediaIndex && videoPlayer && (
            <VideoView
              player={videoPlayer}
              style={styles.videoPlayer}
              contentFit="contain"
              allowsFullscreen
              allowsPictureInPicture
              nativeControls={true}
            />
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.mediaContainer}>
          <ExpoImage
            source={{ uri: media.url }}
            style={styles.itemImage}
            contentFit="cover"
            cachePolicy="disk"
            transition={300}
          />
        </View>
      );
    }
  };
  
  const renderThumbnail = ({ item: media, index }: { item: MediaFile, index: number }) => {
    return (
      <TouchableOpacity 
        style={[
          styles.thumbnailContainer, 
          index === activeMediaIndex && styles.thumbnailContainerActive
        ]} 
        onPress={() => handleMediaChange(index)}
      >
        <ExpoImage
          source={{ uri: media.url }}
          style={styles.thumbnail}
          contentFit="cover"
          cachePolicy="disk"
        />
        {media.type === 'video' && (
          <View style={styles.videoIndicator}>
            <Play size={12} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  const renderMediaIndicator = () => {
    if (mediaFiles.length <= 1) return null;
    
    return (
      <View style={styles.mediaIndicatorContainer}>
        {mediaFiles.map((_, index) => (
          <TouchableOpacity 
            key={index} 
            style={[
              styles.mediaIndicator, 
              index === activeMediaIndex && styles.mediaIndicatorActive
            ]}
            onPress={() => handleMediaChange(index)}
          />
        ))}
      </View>
    );
  };
  
  const renderMediaControls = () => {
    if (mediaFiles.length <= 1) return null;
    
    return (
      <View style={styles.mediaControlsContainer}>
        <TouchableOpacity 
          style={[styles.mediaControlButton, activeMediaIndex === 0 && styles.mediaControlButtonDisabled]}
          onPress={() => activeMediaIndex > 0 && handleMediaChange(activeMediaIndex - 1)}
          disabled={activeMediaIndex === 0}
        >
          <ChevronLeft size={24} color={activeMediaIndex === 0 ? "#ccc" : "#333"} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.mediaControlButton, activeMediaIndex === mediaFiles.length - 1 && styles.mediaControlButtonDisabled]}
          onPress={() => activeMediaIndex < mediaFiles.length - 1 && handleMediaChange(activeMediaIndex + 1)}
          disabled={activeMediaIndex === mediaFiles.length - 1}
        >
          <ChevronRight size={24} color={activeMediaIndex === mediaFiles.length - 1 ? "#ccc" : "#333"} />
        </TouchableOpacity>
      </View>
    );
  };

  // Add a function to navigate to chat with the owner
  const navigateToChat = async () => {
    if (!item?.profiles?.id) {
      console.error('No profile ID available for chat');
      Alert.alert('Error', 'Cannot start chat: No profile information available');
      return;
    }
    
    try {
      // Check if user is logged in
      if (!user) {
        Alert.alert('Error', 'You need to be logged in to chat');
        return;
      }
      
      console.log('Navigating to chat with:', {
        currentUserId: user.id,
        itemOwnerId: item.profiles.id,
        ownerName: item.profiles.name,
        ownerAvatar: item.profiles.avatar_url
      });
      
      // Create or get existing chat room
      const result = await chatService.createOrGetChatRoom(user.id, item.profiles.id);
      
      if (!result.success || !result.chatRoom) {
        throw new Error(result.error || 'Failed to initialize chat room');
      }
      
      console.log('Chat room created/retrieved:', result.chatRoom.id);
      
      // Prepare navigation parameters
      const chatParams = {
        userId: item.profiles.id,
        userName: item.profiles.name || 'Unknown User',
        userAvatar: item.profiles.avatar_url || '',
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Details</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading item details...</Text>
          </View>
        ) : item ? (
          <View style={styles.itemContainer}>
            {mediaFiles.length > 0 ? (
              <View>
                <View style={styles.mediaGalleryContainer}>
                  <FlatList
                    ref={flatListRef}
                    data={mediaFiles}
                    renderItem={renderMediaItem}
                    keyExtractor={(_, index) => `media-${index}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
                      if (newIndex !== activeMediaIndex) {
                        handleMediaChange(newIndex);
                      }
                    }}
                    style={styles.mediaGallery}
                  />
                  {renderMediaIndicator()}
                  {renderMediaControls()}
                </View>
                
                {mediaFiles.length > 1 && (
                  <View style={styles.thumbnailsWrapper}>
                    <FlatList
                      ref={thumbnailsRef}
                      data={mediaFiles}
                      renderItem={renderThumbnail}
                      keyExtractor={(_, index) => `thumbnail-${index}`}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.thumbnailsContainer}
                      contentContainerStyle={styles.thumbnailsContent}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.itemImage, styles.placeholderImage]}>
                <Text style={styles.placeholderText}>{item.name?.charAt(0) || '?'}</Text>
              </View>
            )}
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.name}</Text>
              <View style={styles.categoryContainer}>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </View>
              <Text style={styles.itemDescription}>{item.description}</Text>
              
              {item.profiles && (
                <View style={styles.ownerContainer}>
                  <Text style={styles.ownerTitle}>Owner</Text>
                  <View style={styles.ownerCard}>
                    <View style={styles.ownerInfo}>
                      <ExpoImage
                        source={{ uri: item.profiles.avatar_url ? getSupabaseFileUrl(item.profiles.avatar_url) : 'https://via.placeholder.com/40' }}
                        style={styles.ownerAvatar}
                        contentFit="cover"
                        cachePolicy="disk"
                      />
                      <View style={styles.ownerTextContainer}>
                        <Text style={styles.ownerName}>{item.profiles.name || 'Unknown User'}</Text>
                        <Text style={styles.ownerLocation}>{item.profiles.location || 'No location'}</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.chatButton}
                      onPress={navigateToChat}
                    >
                      <MessageCircle color="#FFFFFF" size={20} />
                      <Text style={styles.chatButtonText}>Chat</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {item.profiles.interest && item.profiles.interest.length > 0 && (
                    <View style={styles.interestsContainer}>
                      <Text style={styles.interestsTitle}>Interests</Text>
                      <View style={styles.interestsList}>
                        {item.profiles.interest.map((interest: string, index: number) => (
                          <View key={index} style={styles.interestBadge}>
                            <Text style={styles.interestText}>{interest}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Item not found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  itemContainer: {
    padding: 16,
  },
  mediaGalleryContainer: {
    position: 'relative',
    height: 300,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mediaGallery: {
    width: width - 32, // Account for container padding
  },
  mediaContainer: {
    width: width - 32, // Account for container padding
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbnailsWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  thumbnailsContainer: {
    maxWidth: '100%',
  },
  thumbnailsContent: {
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 0,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailContainerActive: {
    borderColor: '#22C55E',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  mediaIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  mediaIndicatorActive: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mediaControlsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mediaControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaControlButtonDisabled: {
    opacity: 0.5,
  },
  itemImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: 16,
  },
  videoPlayer: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  itemDetails: {
    padding: 8,
  },
  itemName: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#222',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  itemCategory: {
    fontSize: 16,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  itemDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    color: '#444',
  },
  ownerContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    padding: 0,
  },
  ownerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#222',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  ownerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ownerTextContainer: {
    flex: 1,
  },
  ownerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  ownerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  ownerLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chatButton: {
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff3b30',
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  interestsContainer: {
    marginTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  interestsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#222',
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  interestText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
}); 