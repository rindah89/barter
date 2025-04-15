import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Image as ExpoImage } from 'expo-image';
import { ArrowLeft, ChevronLeft, ChevronRight, MessageCircle, Play, Repeat, LucidePackage, Star, Award, Plus } from 'lucide-react-native';
import { getSupabaseFileUrl } from '../services/imageservice';
import { useVideoPlayer, VideoView } from 'expo-video';
import { chatService } from '@/services/chatService';
import { useAuth } from '@/lib/AuthContext';
import LoadingIndicator from '../components/LoadingIndicator';
import { useLoading } from '../lib/LoadingContext';
import LottieView from 'lottie-react-native';
import { useToast } from '../lib/ToastContext';
import { Tables } from '../database.types';

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
  rating?: number;
  completed_trades?: number;
}

// Use the database schema type
type Item = Tables<'items'> & {
  profiles?: ItemProfile;
};

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
  
  // Trade proposal related states
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loadingUserItems, setLoadingUserItems] = useState(false);
  const [ownerItemCount, setOwnerItemCount] = useState(0);
  const [showNoItemsModal, setShowNoItemsModal] = useState(false);
  
  // Always call the hook, but conditionally use the URL
  const videoPlayer = useVideoPlayer(selectedVideoUrl || '', player => {
    if (selectedVideoUrl) {
      player.play();
    }
  });

  // Create a ref to track if the component is mounted
  const isMounted = useRef(true);

  const { setIsLoading } = useLoading();

  const [cashAmount, setCashAmount] = useState<string>('');
  const [includeCash, setIncludeCash] = useState<boolean>(false);

  const { showToast } = useToast();
  const [isNavigatingToChat, setIsNavigatingToChat] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('items')
          .select(`
            *,
            profiles:user_id (
              id,
              name,
              avatar_url,
              location,
              interest,
              rating,
              completed_trades
            )
          `)
          .eq('id', id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setItem(data);
          processMediaFiles(data);
          
          // Fetch owner's item count
          if (data.profiles?.id) {
            const { count } = await supabase
              .from('items')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', data.profiles.id)
              .eq('is_available', true);
            
            setOwnerItemCount(count || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching item:', error);
        Alert.alert('Error', 'Failed to load item details. Please try again.');
      } finally {
        setLoading(false);
        setIsLoading(false); // Turn off global loading state
      }
    };

    // Set up component
    fetchItem();
    
    // Clean up
    return () => {
      isMounted.current = false;
      setIsLoading(false); // Ensure loading state is reset when component unmounts
      
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
    if (!item?.profiles?.id || !user) {
      console.error('Missing user or owner profile ID for chat');
      showToast('Cannot start chat: User or owner info missing.', 'error');
      return;
    }
    if (isNavigatingToChat) return; // Prevent double taps

    setIsNavigatingToChat(true);
    try {
      console.log(`[ItemDetails] Initiating chat between ${user.id} and ${item.profiles.id}`);
      
      // Call the updated service function to get or create the 1-on-1 chat room
      const roomResult = await chatService.getOrCreateChatRoom([user.id, item.profiles.id]);

      if (!roomResult.success || !roomResult.roomId) {
          throw new Error(roomResult.error || 'Failed to initialize chat room.');
      }
      
      const roomId = roomResult.roomId;
      console.log(`[ItemDetails] Got roomId: ${roomId}, navigating...`);
      
      // Prepare navigation parameters - ONLY roomId is needed now
      const chatParams = { roomId: roomId }; 
      
      // Optionally pre-send the initial message about the item
      // (Consider if this should be done here or on the chat screen)
      if (item.name) {
          const initialMessage = `Hi, I'm interested in your item: ${item.name}`;
          const imgUrl = item.image_url ? getSupabaseFileUrl(item.image_url) : undefined;
          // Determine the message type based on whether an image URL exists
          const messageType: 'text' | 'image' = imgUrl ? 'image' : 'text';
          
          // Send silently in background, don't block navigation
          chatService.sendMessage(roomId, user.id, initialMessage, imgUrl, messageType).catch(err => {
              console.warn('[ItemDetails] Failed to send initial item message:', err);
          });
      }

      // Navigate to chat screen using roomId
      router.push({
        pathname: '/chat' as any,
        params: chatParams, // Pass { roomId: ... }
      });

    } catch (error: any) {
      console.error('Error navigating to chat:', error);
      showToast(error.message || 'Failed to open chat. Please try again.', 'error');
    } finally {
      setIsNavigatingToChat(false);
    }
  };

  // Function to fetch user's items for trade
  const fetchUserItems = async () => {
    if (!user) {
      console.log('No user found for fetching items');
      showToast('You need to be logged in to propose trades', 'error');
      return [];
    }
    
    try {
      console.log('Fetching items for user:', user.id);
      setLoadingUserItems(true);
      
      // First, let's check if the is_available column exists
      const { data: availableCheck, error: checkError } = await supabase
        .from('items')
        .select('is_available')
        .eq('user_id', user.id)
        .limit(1);
      
      console.log('Available check result:', availableCheck);
      
      let query = supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id);
      
      // Only add the is_available filter if the column exists and has values
      if (availableCheck && availableCheck.length > 0 && 'is_available' in availableCheck[0]) {
        query = query.eq('is_available', true);
        console.log('Adding is_available filter to query');
      } else {
        console.log('Skipping is_available filter (column may not exist or be empty)');
      }
      
      const { data, error } = await query;
        
      if (error) {
        console.error('Supabase error fetching items:', error);
        throw error;
      }
      
      console.log('Items fetched successfully:', data?.length || 0, 'items found');
      // Return the data directly
      return data || [];
    } catch (error) {
      console.error('Error fetching user items:', error);
      showToast('Failed to load your items. Please try again.', 'error');
      return [];
    } finally {
      setLoadingUserItems(false);
    }
  };
  
  // Helper function to format currency
  const formatCurrency = (amount: string | number): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0 FCFA';
    return `${numAmount.toLocaleString()} FCFA`;
  };
  
  // Function to handle trade proposal
  const handleProposeTrade = async () => {
    if (!user) {
      showToast('You need to be logged in to propose trades', 'error');
      return;
    }
    
    if (!item) {
      showToast('Item details not available', 'error');
      return;
    }
    
    // Check if the item belongs to the current user
    if (item.profiles?.id === user.id) {
      showToast('You cannot propose a trade for your own item', 'error');
      return;
    }
    
    console.log('Handling trade proposal for item:', item.id);
    // Fetch user's items before showing the modal
    const items = await fetchUserItems();
    
    // Filter out the current item if it somehow appears in the user's items
    const filteredItems = items.filter(userItem => userItem.id !== item.id);
    
    console.log('Items fetched for trade proposal:', filteredItems.length);
    // Update the state with the fetched items
    setUserItems(filteredItems);
    
    // If user has no items, show the custom modal instead of an alert
    if (filteredItems.length === 0) {
      console.log('No items available, showing modal');
      setShowNoItemsModal(true);
      return;
    }
    
    console.log('Items available, showing trade modal');
    // Show the trade modal
    setShowTradeModal(true);
  };
  
  // Function to submit the trade proposal
  const submitTradeProposal = async () => {
    if (!selectedItemId) {
      showToast('Please select an item to offer', 'error');
      return;
    }
    
    // Validate cash amount if included
    let cashValue = null;
    if (includeCash && cashAmount.trim() !== '') {
      const parsed = parseFloat(cashAmount);
      if (isNaN(parsed) || parsed <= 0) {
        showToast('Please enter a valid cash amount', 'error');
        return;
      }
      cashValue = parsed;
    }
    
    try {
      console.log('Submitting trade proposal with data:', {
        proposer_id: user?.id,
        receiver_id: item?.profiles?.id,
        offered_item_id: selectedItemId,
        requested_item_id: item?.id,
        status: 'pending',
        cash_amount: cashValue
      });
      
      const { data, error } = await supabase
        .from('trades')
        .insert({
          proposer_id: user?.id,
          receiver_id: item?.profiles?.id,
          offered_item_id: selectedItemId,
          requested_item_id: item?.id,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cash_amount: cashValue
        });
        
      if (error) throw error;
      
      showToast('Trade proposal sent successfully!', 'success');
      setShowTradeModal(false);
      setSelectedItemId(null);
      setCashAmount('');
      setIncludeCash(false);
    } catch (error) {
      console.error('Error proposing trade:', error);
      showToast('Failed to propose trade. Please try again.', 'error');
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
      
      {loading ? (
        <View style={styles.centeredLoadingContainer}>
          <LoadingIndicator 
            message="Loading item details..." 
            size="large"
          />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {item ? (
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
                      
                      <View style={styles.ownerActions}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={navigateToChat}
                          disabled={isNavigatingToChat}
                        >
                          {isNavigatingToChat ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <MessageCircle color="#FFFFFF" size={20} />
                          )}
                          <Text style={styles.actionButtonText}>Chat</Text>
                        </TouchableOpacity>
                        
                        {user?.id !== item.profiles.id && (
                          <TouchableOpacity 
                            style={[styles.actionButton, styles.tradeButton]}
                            onPress={handleProposeTrade}
                          >
                            <Repeat color="#FFFFFF" size={20} />
                            <Text style={styles.actionButtonText}>Propose Trade</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    {/* Owner Stats Section */}
                    <View style={styles.ownerStatsContainer}>
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{item.profiles?.rating ? item.profiles.rating.toFixed(1) : '0.0'}</Text>
                        <View style={styles.ratingStars}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star 
                              key={star}
                              size={16}
                              color={star <= Math.round(item.profiles?.rating || 0) ? '#FFD700' : '#DDDDDD'}
                              fill={star <= Math.round(item.profiles?.rating || 0) ? '#FFD700' : 'none'}
                            />
                          ))}
                        </View>
                        <Text style={styles.statLabel}>Rating</Text>
                      </View>
                      
                      <View style={styles.statCard}>
                        <Text style={styles.statValue}>{item.profiles?.completed_trades || '0'}</Text>
                        <Award size={20} color="#22C55E" style={styles.statIcon} />
                        <Text style={styles.statLabel}>Trades</Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.statCard}
                        onPress={() => router.push({
                          pathname: '/my-items',
                          params: { userId: item.profiles?.id }
                        })}
                      >
                        <Text style={styles.statValue}>{ownerItemCount}</Text>
                        <LucidePackage size={20} color="#22C55E" style={styles.statIcon} />
                        <Text style={styles.statLabel}>Items</Text>
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
      )}
      
      {/* No Items Modal */}
      <Modal
        visible={showNoItemsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNoItemsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.noItemsModalContainer}>
            <View style={styles.noItemsModalHeader}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowNoItemsModal(false)}
              >
                <ArrowLeft size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.noItemsModalTitle}>No Items Available</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.noItemsModalContent}>
              <LottieView
                source={require('../assets/noitems.json')}
                style={styles.noItemsLottie}
                autoPlay
                loop
              />
              <Text style={styles.noItemsModalText}>
                You need to add items to your inventory before proposing a trade.
              </Text>
              
              <View style={styles.noItemsModalButtons}>
                <TouchableOpacity 
                  style={styles.noItemsModalCancelButton}
                  onPress={() => setShowNoItemsModal(false)}
                >
                  <Text style={styles.noItemsModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.noItemsModalAddButton}
                  onPress={() => {
                    setShowNoItemsModal(false);
                    router.push('/my-items');
                  }}
                >
                  <Plus color="#FFFFFF" size={18} />
                  <Text style={styles.noItemsModalAddText}>Add Items</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Trade Proposal Modal */}
      <Modal
        visible={showTradeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTradeModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowTradeModal(false);
                    setSelectedItemId(null);
                    setCashAmount('');
                    setIncludeCash(false);
                  }}
                >
                  <ArrowLeft size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Propose a Trade</Text>
                <View style={{ width: 24 }} />
              </View>
              
              <Text style={styles.modalSubtitle}>Select an item to offer:</Text>
              
              {loadingUserItems ? (
                <View style={styles.modalLoadingContainer}>
                  <LoadingIndicator 
                    message="Loading your items..." 
                    size="small"
                  />
                </View>
              ) : userItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <LottieView
                    source={require('../assets/noitems.json')}
                    style={styles.emptyLottie}
                    autoPlay
                    loop
                  />
                  <Text style={styles.emptyTitle}>No Items to Trade</Text>
                  <Text style={styles.emptyText}>
                    You need to add items to your inventory before proposing a trade.
                  </Text>
                  <TouchableOpacity 
                    style={styles.addItemButton}
                    onPress={() => {
                      setShowTradeModal(false);
                      router.push('/my-items');
                    }}
                  >
                    <Plus color="#FFFFFF" size={20} />
                    <Text style={styles.addItemButtonText}>Add Your First Item</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <FlatList
                    data={userItems}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: userItem }) => (
                      <TouchableOpacity 
                        style={[
                          styles.itemOption,
                          selectedItemId === userItem.id && styles.selectedItemOption
                        ]}
                        onPress={() => setSelectedItemId(userItem.id)}
                      >
                        <ExpoImage
                          source={{ uri: userItem.image_url ? getSupabaseFileUrl(userItem.image_url) : 'https://via.placeholder.com/60' }}
                          style={styles.itemOptionImage}
                          contentFit="cover"
                        />
                        <View style={styles.itemOptionInfo}>
                          <Text style={styles.itemOptionName}>{userItem.name}</Text>
                          <Text style={styles.itemOptionCategory}>{userItem.category}</Text>
                        </View>
                        {selectedItemId === userItem.id && (
                          <View style={styles.selectedCheckmark}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.itemOptionsList}
                  />
                  
                  {/* Cash Option */}
                  <View style={styles.cashOptionContainer}>
                    <TouchableOpacity 
                      style={styles.cashToggleContainer}
                      onPress={() => setIncludeCash(!includeCash)}
                    >
                      <View style={[styles.cashToggle, includeCash && styles.cashToggleActive]}>
                        {includeCash && <Text style={styles.cashToggleCheck}>✓</Text>}
                      </View>
                      <Text style={styles.cashToggleText}>Add cash to your offer</Text>
                    </TouchableOpacity>
                    
                    <Text style={styles.cashHelperText}>
                      Adding cash  to your offer can increase the chances of your trade being accepted.
                    </Text>

                    {includeCash && (
                      <View style={styles.cashInputContainer}>
                        <Text style={styles.cashInputLabel}>Cash amount:</Text>
                        <View style={styles.cashInputWrapper}>
                          <Image
                            source={require('../assets/cash.png')}
                            style={styles.cashIcon}
                          />
                          <TextInput
                            style={styles.cashInput}
                            value={cashAmount}
                            onChangeText={setCashAmount}
                            placeholder="0"
                            keyboardType="numeric"
                            maxLength={10}
                          />
                          <Text style={styles.cashCurrencySymbol}>FCFA</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}
              
              <View style={styles.modalFooter}>
                {selectedItemId && (
                  <View style={styles.offerSummary}>
                    <Text style={styles.offerSummaryText}>
                      Offering: Selected item
                    </Text>
                    
                    {includeCash && cashAmount.trim() !== '' && (
                      <View style={styles.offerSummaryCashRow}>
                        <Text style={styles.offerSummaryPlusText}>+</Text>
                       
                        <Text style={styles.offerSummaryCashText}>
                          {formatCurrency(cashAmount)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <TouchableOpacity 
                  style={[
                    styles.submitButton,
                    (!selectedItemId || loadingUserItems) && styles.disabledButton
                  ]}
                  onPress={submitTradeProposal}
                  disabled={!selectedItemId || loadingUserItems}
                >
                  <Text style={styles.submitButtonText}>Propose Trade</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginTop: 24,
    marginBottom: 16,
  },
  ownerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  ownerCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginHorizontal: 16,
    marginBottom: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  ownerActions: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 10,
  },
  actionButton: {
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: 'center',
    minWidth: 140,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  tradeButton: {
    backgroundColor: '#5856D6',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  itemOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#f0f0f0',
    borderRadius: 8,
  },
  selectedItemOption: {
    borderColor: '#22C55E',
  },
  itemOptionImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  itemOptionInfo: {
    flex: 1,
  },
  itemOptionName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemOptionCategory: {
    fontSize: 14,
    color: '#666',
  },
  selectedCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  checkmarkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  itemOptionsList: {
    padding: 16,
  },
  modalFooter: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  offerSummary: {
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  offerSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
    marginBottom: 4,
  },
  offerSummaryCashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  offerSummaryPlusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22C55E',
    marginRight: 4,
  },
  offerSummaryCashIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
  offerSummaryCashText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
  },
  submitButton: {
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  emptyLottie: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  addItemButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  ownerStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#222',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 0,
    height: 24,
    justifyContent: 'center',
  },
  starIcon: {
    fontSize: 16,
    color: '#DDDDDD',
    marginRight: 2,
  },
  filledStar: {
    color: '#FFD700',
  },
  statIcon: {
    marginBottom: 0,
    marginTop: 0,
    height: 24,
    justifyContent: 'center',
  },
  centeredLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  modalLoadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noItemsModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  noItemsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  noItemsModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  noItemsModalContent: {
    padding: 24,
    alignItems: 'center',
  },
  noItemsLottie: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  noItemsModalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  noItemsModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  noItemsModalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    marginRight: 8,
    flex: 1,
    alignItems: 'center',
  },
  noItemsModalCancelText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 15,
  },
  noItemsModalAddButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8,
  },
  noItemsModalAddText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 6,
  },
  cashOptionContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  cashToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cashToggle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22C55E',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashToggleActive: {
    backgroundColor: '#22C55E',
  },
  cashToggleCheck: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  cashToggleText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    color: '#333',
  },
  cashHelperText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  cashInputContainer: {
    marginTop: 16,
  },
  cashInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
  },
  cashInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cashIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  cashCurrencySymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
    minWidth: 45,
  },
  cashInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 8,
  },
}); 