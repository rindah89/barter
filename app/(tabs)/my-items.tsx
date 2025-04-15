import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, ActivityIndicator, Alert, Dimensions, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Edit, Trash2, X, Camera, Tag, Info, Search, Image as ImageIcon } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Item } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../lib/AuthContext';
import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadFile, getSupabaseFileUrl, getThumbnailUrl } from '@/services/imageservice';
import { Tables } from '@/database.types';
import { useToast } from '../../lib/ToastContext';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import MediaSourceModal from '../../components/MediaSourceModal';
import LoadingIndicator from '../../components/LoadingIndicator';

// Categories for items
const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home', 'Sports', 
  'Accessories', 'Art', 'Musical Instruments', 'Other'
];

// Get screen dimensions for responsive design
const { width } = Dimensions.get('window');

// Define MediaFile interface for our app's use
interface MediaFile {
  url: string;
  type: 'image' | 'video';
  tempId?: string;
  uploadStatus?: 'uploading' | 'uploaded' | 'failed';
}

// Use the database types for our item
type ItemType = Tables<'items'> & {
  media_files?: string[] | MediaFile[] | string;
  media_type?: string;
};

export default function MyItemsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemType | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    image_url: '',
    media_files: [] as MediaFile[],
    category: 'Other',
    media_type: 'image'
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lottieRef = React.useRef<LottieView>(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const videoPlayer = useVideoPlayer(selectedVideoUrl || '', player => {
    if (selectedVideoUrl && videoModalVisible) {
      player.play();
    }
  });
  const { showToast } = useToast();
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoVisible, setPreviewVideoVisible] = useState(false);
  const previewVideoPlayer = useVideoPlayer({});

  useEffect(() => {
    fetchItems();
    
    // Return cleanup function
    return () => {
      // Clean up video players when component unmounts
      if (videoPlayer) {
        videoPlayer.pause();
      }
      if (previewVideoPlayer) {
        previewVideoPlayer.pause();
      }
    };
  }, [user]);

  useEffect(() => {
    // Play the animation when the component mounts or when items are empty
    if (items.length === 0 && !loading && !error && lottieRef.current) {
      lottieRef.current.play();
    }
  }, [items, loading, error]);

  const fetchItems = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setItems(data as ItemType[]);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to load your items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setNewItem({
      name: '',
      description: '',
      image_url: '',
      media_files: [],
      category: 'Other',
      media_type: 'image'
    });
    setModalVisible(true);
  };

  const handleEditItem = (item: ItemType) => {
    // Parse media_files if it's a string or convert from string[] to MediaFile[]
    let mediaFiles: MediaFile[] = [];
    
    if (item.media_files) {
      if (typeof item.media_files === 'string') {
        try {
          // If it's a JSON string, parse it
          const parsed = JSON.parse(item.media_files);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
              // If it's an array of strings (URLs), convert to MediaFile objects
              mediaFiles = parsed.map(url => ({
                url,
                // Determine type based on file extension
                type: url.match(/\.(mp4|mov|avi|3gp|mkv)$/i) ? 'video' : 'image'
              }));
            } else if (parsed.length > 0 && typeof parsed[0] === 'object') {
              // If it's already an array of MediaFile objects
              mediaFiles = parsed as MediaFile[];
            }
          }
        } catch (e) {
          console.error('Error parsing media_files:', e);
        }
      } else if (Array.isArray(item.media_files)) {
        // If it's already an array
        if (item.media_files.length > 0) {
          if (typeof item.media_files[0] === 'string') {
            // If it's an array of strings (URLs), convert to MediaFile objects
            mediaFiles = item.media_files.map(url => ({
              url: url as string,
              // Determine type based on file extension
              type: (url as string).match(/\.(mp4|mov|avi|3gp|mkv)$/i) ? 'video' : 'image'
            }));
          } else if (typeof item.media_files[0] === 'object') {
            // If it's already an array of MediaFile objects
            mediaFiles = item.media_files as unknown as MediaFile[];
          }
        }
      }
    }

    setEditingItem(item);
    setNewItem({
      name: item.name || '',
      description: item.description || '',
      image_url: item.image_url || '',
      media_files: mediaFiles,
      category: item.category || 'Other',
      media_type: item.media_type || 'image'
    });
    setModalVisible(true);
  };

  const handleDeleteItem = async (id: string) => {
    setItemToDelete(id);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      setLoading(true);
      showToast("Deleting item...", "info");
      
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemToDelete);
      
      if (error) {
        throw error;
      }
      
      setItems(items.filter(item => item.id !== itemToDelete));
      showToast('Item deleted successfully', 'success', 3000);
    } catch (err) {
      console.error('Error deleting item:', err);
      showToast('Failed to delete item', 'error', 3000);
    } finally {
      setLoading(false);
      setDeleteDialogVisible(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogVisible(false);
    setItemToDelete(null);
  };

  const takePicture = async () => {
    try {
      // Check if we already have 4 media files
      if (newItem.media_files.length >= 4) {
        showToast("You can only add up to 4 photos or videos per item.", "warning");
        return;
      }

      console.log("Requesting camera permissions...");
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!cameraPermission.granted) {
        console.log("Camera permission denied:", cameraPermission);
        showToast("Camera permission is required to take photos.", "warning");
        return;
      }
      
      console.log("Camera permission granted, launching camera...");
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false, // Don't include EXIF data to reduce file size
      });

      console.log("Camera result:", JSON.stringify(result));
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          console.log("Captured photo:", asset.uri);
          
          // Show a toast to indicate the upload is starting
          showToast("Uploading photo...", "info");
          
          await uploadMedia(asset.uri, 'image');
        } else {
          console.log("No photo captured");
          showToast("No photo was captured", "error");
        }
      } else {
        console.log("Photo capture was canceled by user");
      }
    } catch (err: any) {
      console.error('Error taking photo:', err);
      showToast(`Failed to capture photo: ${err.message || 'Unknown error'}`, "error");
    }
  };

  const pickMedia = () => {
    // Check if we already have 4 media files
    if (newItem.media_files.length >= 4) {
      showToast("You can only add up to 4 photos or videos per item.", "warning");
      return;
    }
    
    // Show our custom media source modal
    setMediaModalVisible(true);
  };

  const pickFromGallery = async () => {
    try {
      // Request media library permissions first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showToast("Media library permission is required to select photos or videos.", "warning");
        return;
      }
      
      // Check how many more items can be added
      const currentMediaCount = newItem.media_files.length;
      const remainingSlots = 4 - currentMediaCount;
      if (remainingSlots <= 0) {
        showToast("You already have the maximum of 4 media items.", "warning");
        return;
      }

      console.log(`Launching image picker, allowing up to ${remainingSlots} selections...`);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots, 
      });

      console.log("Image picker result:", JSON.stringify(result));
      
      if (!result.canceled) {
        if (result.assets && result.assets.length > 0) {
          console.log(`Selected ${result.assets.length} assets.`);
          
          // Create temporary objects for optimistic UI update
          const temporaryMediaFiles: MediaFile[] = result.assets.map((asset, index) => {
            const tempId = `temp_${Date.now()}_${index}`;
            const fileExt = asset.uri.split('.').pop()?.toLowerCase();
            const isVideo = ['mp4', 'mov', 'avi', '3gp', 'mkv'].includes(fileExt || '');
            return {
              url: asset.uri, // Use local URI initially
              type: isVideo ? 'video' : 'image',
              tempId: tempId,
              uploadStatus: 'uploading',
            };
          });
          
          // Optimistically update the state
          setNewItem(currentItem => ({
            ...currentItem,
            media_files: [...currentItem.media_files, ...temporaryMediaFiles],
            // Optionally set main image optimistically if it's the first one
            image_url: currentItem.image_url || temporaryMediaFiles[0].url, 
            media_type: currentItem.media_type || temporaryMediaFiles[0].type
          }));
          
          // Upload each selected asset in the background
          temporaryMediaFiles.forEach(async (tempFile) => {
            if (!tempFile.tempId) return; // Should not happen
            
            const uploadedResult = await uploadMedia(tempFile.url, tempFile.type, tempFile.tempId);
            
            // Update the specific item in the state based on tempId
            setNewItem(currentItem => {
              const updatedMediaFiles = currentItem.media_files.map(media => {
                if (media.tempId === tempFile.tempId) {
                  if (uploadedResult && uploadedResult.uploadStatus === 'uploaded') {
                    // Upload success: update URL and status
                    return { ...media, url: uploadedResult.url, uploadStatus: 'uploaded' };
                  } else {
                    // Upload failed: update status
                    return { ...media, uploadStatus: 'failed' };
                  }
                }
                return media;
              });
              
              // Also update the main image_url if the first image just finished uploading
              let newMainImage = currentItem.image_url;
              let newMediaType = currentItem.media_type;
              if (currentItem.media_files.length > 0 && currentItem.media_files[0].tempId === tempFile.tempId) {
                 if (uploadedResult && uploadedResult.uploadStatus === 'uploaded') {
                    newMainImage = uploadedResult.url;
                    newMediaType = uploadedResult.type;
                 }
              }

              return {
                ...currentItem,
                media_files: updatedMediaFiles,
                image_url: newMainImage,
                media_type: newMediaType
              };
            });
          });
          
        } else {
          console.log("No assets found in the result");
          showToast("No media was selected", "error");
        }
      } else {
        console.log("Media selection was canceled by user");
      }
    } catch (err: any) {
      console.error('Error picking media:', err);
      showToast(`Failed to select media: ${err.message || 'Unknown error'}`, "error");
    }
  };

  const uploadMedia = async (uri: string, type: string, tempId?: string): Promise<MediaFile | null> => {
    if (!user) {
      showToast("You must be logged in to upload media", "error");
      return null;
    }
    
    try {
      setImageUploading(true);
      console.log(`Starting upload for media: ${uri}, type: ${type}`);
      
      // Validate the URI
      if (!uri || typeof uri !== 'string') {
        throw new Error('Invalid media URI');
      }
      
      // Determine if it's a video based on file extension
      const fileExt = uri.split('.').pop()?.toLowerCase();
      const isVideo = type === 'video' || 
        ['mp4', 'mov', 'avi', '3gp', 'mkv'].includes(fileExt || '');
      
      console.log(`Media type determined as: ${isVideo ? 'video' : 'image'}, extension: ${fileExt}`);
      
      // Show progress toast
      showToast(`Uploading ${isVideo ? 'video' : 'photo'}...`, "info");
      
      // Use the uploadFile service function
      const result = await uploadFile('items', uri, !isVideo);
      
      if (!result.success) {
        throw new Error(result.msg || 'Failed to upload media');
      }
      
      console.log("Upload successful, getting public URL");
      
      // Get the public URL using the getSupabaseFileUrl helper
      const publicUrl = getSupabaseFileUrl(result.data || '');
      
      if (!publicUrl) {
        throw new Error("Failed to get public URL for uploaded media");
      }
      
      console.log(`Public URL obtained: ${publicUrl}`);
      
      // Return the uploaded media file details
      return {
        url: publicUrl,
        type: isVideo ? 'video' : 'image',
        tempId: tempId,
        uploadStatus: 'uploaded'
      };
    } catch (err: any) {
      console.error('Error uploading media:', err);
      showToast(`Failed to upload media: ${err.message || 'Unknown error'}`, "error");
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    const updatedMediaFiles = [...newItem.media_files];
    updatedMediaFiles.splice(index, 1);
    
    // Update the main image_url if we're removing the first item or all items
    const newMainImage = updatedMediaFiles.length > 0 ? updatedMediaFiles[0].url : '';
    const newMediaType = updatedMediaFiles.length > 0 ? updatedMediaFiles[0].type : 'image';
    
    setNewItem({
      ...newItem,
      image_url: newMainImage,
      media_type: newMediaType,
      media_files: updatedMediaFiles
    });
  };

  const handleSaveItem = async () => {
    if (!user) return;
    
    if (!newItem.name.trim() || !newItem.category) {
      showToast('Please fill in all required fields', 'warning', 3000);
      return;
    }
    
    if (newItem.media_files.length === 0) {
      showToast('Please add at least one photo or video of your item', 'warning', 3000);
      return;
    }
    
    setLoading(true);
    
    try {
      // Extract URLs from media files to match the database schema
      const mediaUrls = newItem.media_files.map(media => media.url);
      
      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from('items')
          .update({
            name: newItem.name,
            description: newItem.description,
            category: newItem.category,
            image_url: newItem.image_url,
            media_files: mediaUrls
          })
          .eq('id', editingItem.id);
        
        if (error) {
          throw error;
        }
        
        // Update local state
        setItems(items.map(item => 
          item.id === editingItem.id 
            ? { 
                ...item, 
                name: newItem.name, 
                description: newItem.description, 
                category: newItem.category, 
                image_url: newItem.image_url, 
                media_files: mediaUrls 
              } 
            : item
        ));
        
        showToast('Item updated successfully', 'success', 3000);
      } else {
        // Create new item
        try {
          // First insert the item
          const { error: insertError } = await supabase
            .from('items')
            .insert([{
              user_id: user.id,
              name: newItem.name,
              description: newItem.description,
              category: newItem.category,
              image_url: newItem.image_url,
              media_files: mediaUrls,
              is_available: true
            }]);
          
          if (insertError) {
            throw insertError;
          }
          
          // Then fetch the newly created item
          const { data: newItemData, error: fetchError } = await supabase
            .from('items')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (fetchError) {
            throw fetchError;
          }
          
          // Add new item to the local state
          if (newItemData && newItemData.length > 0) {
            setItems([newItemData[0] as ItemType, ...items]);
            showToast('Item created successfully', 'success', 3000);
          }
        } catch (insertErr) {
          console.error('Error inserting item:', insertErr);
          throw insertErr;
        }
      }
      
      setModalVisible(false);
    } catch (err) {
      console.error('Error saving item:', err);
      showToast('Failed to save item', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaPress = (item: ItemType) => {
    if (item.media_type === 'video' && item.image_url) {
      // Get the full URL for the video
      const videoUrl = getSupabaseFileUrl(item.image_url);
      setSelectedVideoUrl(videoUrl);
      setVideoModalVisible(true);
      // Initialize the video player with the selected URL
      videoPlayer.replace(videoUrl);
    } else if (item.image_url) {
      // For images, show the full-size image, not the thumbnail
      // You could implement an image viewer modal here
      // For now, just alert with the full image URL
      Alert.alert(
        "View Full Image",
        "Opening full-size image...",
        [{ text: "OK" }]
      );
      
      // Here you would typically open a modal with the full-size image
      // For example:
      // setSelectedImageUrl(item.image_url);
      // setImageViewerVisible(true);
    }
  };

  const renderItem = ({ item }: { item: ItemType }) => {
    // Parse media_files if it's a string or convert from string[] to MediaFile[]
    let mediaFiles: MediaFile[] = [];
    
    if (item.media_files) {
      if (typeof item.media_files === 'string') {
        try {
          // If it's a JSON string, parse it
          const parsed = JSON.parse(item.media_files);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
              // If it's an array of strings (URLs), convert to MediaFile objects
              mediaFiles = parsed.map(url => ({
                url,
                // Determine type based on file extension
                type: url.match(/\.(mp4|mov|avi|3gp|mkv)$/i) ? 'video' : 'image'
              }));
            } else if (parsed.length > 0 && typeof parsed[0] === 'object') {
              // If it's already an array of MediaFile objects
              mediaFiles = parsed as MediaFile[];
            }
          }
        } catch (e) {
          console.error('Error parsing media_files:', e);
        }
      } else if (Array.isArray(item.media_files)) {
        // If it's already an array
        if (item.media_files.length > 0) {
          if (typeof item.media_files[0] === 'string') {
            // If it's an array of strings (URLs), convert to MediaFile objects
            mediaFiles = item.media_files.map(url => ({
              url: url as string,
              // Determine type based on file extension
              type: (url as string).match(/\.(mp4|mov|avi|3gp|mkv)$/i) ? 'video' : 'image'
            }));
          } else if (typeof item.media_files[0] === 'object') {
            // If it's already an array of MediaFile objects
            mediaFiles = item.media_files as unknown as MediaFile[];
          }
        }
      }
    }

    return (
      <View style={styles.itemCard}>
        <View style={styles.mediaContainer}>
          <TouchableOpacity 
            activeOpacity={item.media_type === 'video' ? 0.7 : 1}
            onPress={() => handleMediaPress(item)}
          >
            <Image 
              source={{ 
                uri: item.media_type === 'video' 
                  ? (item.image_url || 'https://via.placeholder.com/300?text=Image')
                  : (getSupabaseFileUrl(item.image_url || '') || 'https://via.placeholder.com/300?text=Image')
              }} 
              style={styles.itemImage}
              resizeMode="cover"
              onError={() => {
                console.log('Error loading image for item:', item.id);
              }}
              contentFit="cover"
              transition={200}
            />
            {item.media_type === 'video' && (
              <View style={styles.videoIndicatorSmall}>
                <View style={styles.playButtonSmall}>
                  <Text style={styles.playButtonIconSmall}>▶</Text>
                </View>
              </View>
            )}
            {mediaFiles.length > 1 && (
              <View style={styles.multipleMediaIndicator}>
                <Text style={styles.multipleMediaText}>+{mediaFiles.length - 1}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.itemOverlay}>
          <View style={styles.categoryBadge}>
            <Tag size={12} color="#FFFFFF" />
            <Text style={styles.categoryBadgeText}>{item.category}</Text>
          </View>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description || 'No description provided'}
          </Text>
          <View style={styles.itemActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.editButton]} 
              onPress={() => handleEditItem(item)}
            >
              <Edit color="#FFFFFF" size={16} />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]} 
              onPress={() => handleDeleteItem(item.id)}
            >
              <Trash2 color="#FFFFFF" size={16} />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#22C55E', '#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>My Items</Text>
            <Text style={styles.headerSubtitle}>
              {items.length} {items.length === 1 ? 'item' : 'items'} available for trade
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.searchButton}>
              <Search color="#FFFFFF" size={22} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
              <Plus color="#FFFFFF" size={22} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <SafeAreaView style={styles.contentContainer} edges={['bottom', 'left', 'right']}>
        {loading && !refreshing ? (
          <LoadingIndicator 
            message="Loading your items..." 
            containerStyle={styles.loadingContainer}
            textStyle={styles.loadingText}
          />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Info color="#FF3B30" size={48} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={fetchItems}>
              <Text style={styles.errorButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.lottieContainer}>
              <LottieView
                ref={lottieRef}
                source={require('../../assets/noitems.json')}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
            </View>
            <Text style={styles.emptyTitle}>No Items Yet</Text>
            <Text style={styles.emptyText}>
              Add items you'd like to trade with others
            </Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={handleAddItem}>
              <Plus color="#FFFFFF" size={20} />
              <Text style={styles.emptyAddButtonText}>Add Your First Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            numColumns={2}
            refreshing={refreshing}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.columnWrapper}
          />
        )}

        {/* Add/Edit Item Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <BlurView intensity={80} style={StyleSheet.absoluteFill} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </Text>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={() => setModalVisible(false)}
                >
                  <X color="#FFFFFF" size={20} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Item Name</Text>
                  <TextInput
                    style={styles.input}
                    value={newItem.name}
                    onChangeText={(text) => setNewItem({...newItem, name: text})}
                    placeholder="Enter item name"
                    placeholderTextColor="#A0A0A0"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Category</Text>
                  <TouchableOpacity 
                    style={styles.categorySelector}
                    onPress={() => setCategoryModalVisible(true)}
                  >
                    <Text style={styles.categoryText}>{newItem.category}</Text>
                    <Tag size={16} color="#22C55E" />
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={newItem.description}
                    onChangeText={(text) => setNewItem({...newItem, description: text})}
                    placeholder="Describe your item (condition, size, etc.)"
                    placeholderTextColor="#A0A0A0"
                    multiline={true}
                    numberOfLines={4}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Item Photos or Videos (Max 4)</Text>
                  <View style={styles.mediaFilesContainer}>
                    {newItem.media_files.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                        {newItem.media_files.map((media, index) => (
                          <View key={index} style={styles.mediaPreviewContainer}>
                            <TouchableOpacity
                              onPress={() => {
                                if (media.type === 'video') {
                                  // For videos, show the video player
                                  const videoUrl = media.url || '';
                                  setPreviewVideoUrl(videoUrl);
                                  setPreviewVideoVisible(true);
                                  // Initialize the video player with the selected URL
                                  previewVideoPlayer.replace(videoUrl);
                                }
                              }}
                            >
                              <Image 
                                source={{ 
                                  uri: media.url || 'https://via.placeholder.com/100?text=Preview'
                                }} 
                                style={styles.mediaPreviewImage} 
                                resizeMode="cover"
                                onError={() => {
                                  console.log('Error loading media preview');
                                }}
                                contentFit="cover"
                                transition={200}
                              />
                              {media.type === 'video' && (
                                <View style={styles.videoIndicatorSmall}>
                                  <View style={styles.playButtonSmall}>
                                    <Text style={styles.playButtonIconSmall}>▶</Text>
                                  </View>
                                </View>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.removeMediaButton}
                              onPress={() => removeMedia(index)}
                            >
                              <X color="#FFFFFF" size={16} />
                            </TouchableOpacity>
                          </View>
                        ))}
                        {newItem.media_files.length < 4 && (
                          <TouchableOpacity 
                            style={styles.addMediaButton} 
                            onPress={pickMedia}
                            disabled={imageUploading}
                          >
                            {imageUploading ? (
                              <ActivityIndicator size="small" color="#22C55E" />
                            ) : (
                              <>
                                <View style={styles.mediaButtonIcons}>
                                  <Camera color="#FFFFFF" size={18} />
                                  <View style={styles.iconDivider} />
                                  <ImageIcon color="#FFFFFF" size={18} />
                                </View>
                                <Text style={styles.addFirstMediaText}>Add Media</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    ) : (
                      <View style={styles.noMediaContainer}>
                        <Text style={styles.noMediaText}>No media selected</Text>
                        <TouchableOpacity 
                          style={styles.addFirstMediaButton} 
                          onPress={pickMedia}
                          disabled={imageUploading}
                        >
                          {imageUploading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <View style={styles.mediaButtonIcons}>
                                <Camera color="#FFFFFF" size={18} />
                                <View style={styles.iconDivider} />
                                <ImageIcon color="#FFFFFF" size={18} />
                              </View>
                              <Text style={styles.addFirstMediaText}>Add Media</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <Text style={styles.imageHelp}>
                    Clear photos or videos increase your chances of successful trades (max 4)
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleSaveItem}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingItem ? 'Update Item' : 'Add Item'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Category Selection Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={categoryModalVisible}
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <BlurView intensity={80} style={StyleSheet.absoluteFill} />
            <View style={[styles.modalContent, styles.categoryModalContent]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setCategoryModalVisible(false)}
                >
                  <X color="#FFFFFF" size={20} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={CATEGORIES}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[
                      styles.categoryItem,
                      newItem.category === item && styles.selectedCategoryItem
                    ]}
                    onPress={() => {
                      setNewItem({...newItem, category: item});
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.categoryItemText,
                      newItem.category === item && styles.selectedCategoryText
                    ]}>
                      {item}
                    </Text>
                    {newItem.category === item && (
                      <View style={styles.selectedIndicator} />
                    )}
                  </TouchableOpacity>
                )}
                keyExtractor={item => item}
              />
            </View>
          </View>
        </Modal>

        {/* Video Player Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={videoModalVisible}
          onRequestClose={() => {
            setVideoModalVisible(false);
            setSelectedVideoUrl(null);
          }}
        >
          <View style={styles.videoModalContainer}>
            <TouchableOpacity 
              style={styles.videoCloseButton} 
              onPress={() => {
                setVideoModalVisible(false);
                setSelectedVideoUrl(null);
              }}
            >
              <X color="#FFFFFF" size={24} />
            </TouchableOpacity>
            
            {selectedVideoUrl && videoPlayer && (
              <VideoView
                style={styles.videoPlayer}
                player={videoPlayer}
                allowsFullscreen
                allowsPictureInPicture
                contentFit="contain"
                nativeControls={true}
              />
            )}
          </View>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          visible={deleteDialogVisible}
          title="Delete Item"
          message="Are you sure you want to delete this item? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmType="danger"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
        
        {/* Media Source Modal */}
        <MediaSourceModal
          visible={mediaModalVisible}
          onClose={() => setMediaModalVisible(false)}
          onCameraSelect={takePicture}
          onGallerySelect={pickFromGallery}
        />

        {/* Video Preview Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={previewVideoVisible}
          onRequestClose={() => {
            setPreviewVideoVisible(false);
            setPreviewVideoUrl(null);
          }}
        >
          <View style={styles.videoModalContainer}>
            <TouchableOpacity 
              style={styles.videoCloseButton} 
              onPress={() => {
                setPreviewVideoVisible(false);
                setPreviewVideoUrl(null);
              }}
            >
              <X color="#FFFFFF" size={24} />
            </TouchableOpacity>
            
            {previewVideoUrl && previewVideoPlayer && (
              <VideoView
                style={styles.videoPlayer}
                player={previewVideoPlayer}
                allowsFullscreen
                allowsPictureInPicture
                contentFit="contain"
                nativeControls={true}
              />
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerGradient: {
    paddingBottom: 20,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    height: 50,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  list: {
    padding: 16,
    paddingTop: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  itemCard: {
    width: (width - 36) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  itemOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  itemContent: {
    padding: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    height: 40,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  editButton: {
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    marginLeft: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lottieContainer: {
    width: width * 0.7,
    height: width * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 10,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyAddButton: {
    flexDirection: 'row',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  categoryModalContent: {
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  categoryText: {
    fontSize: 16,
    color: '#333333',
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  },
  noImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 12,
    color: '#A0A0A0',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  imageHelp: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    elevation: 4,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  selectedCategoryItem: {
    backgroundColor: '#F0FFF4',
  },
  categoryItemText: {
    fontSize: 16,
    color: '#333333',
  },
  selectedCategoryText: {
    color: '#22C55E',
    fontWeight: 'bold',
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  videoIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    marginLeft: 4,
  },
  videoIndicatorSmall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  playButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIconSmall: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 3,
  },
  mediaContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
  },
  videoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: '100%',
    height: 300,
    backgroundColor: 'transparent',
  },
  videoCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaFilesContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F9F9F9',
  },
  mediaScroll: {
    padding: 12,
  },
  mediaPreviewContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMediaButton: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 12,
    padding: 12,
    height: 100,
    width: 100,
    marginRight: 10,
  },
  addFirstMediaButton: {
    flexDirection: 'row',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addFirstMediaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  multipleMediaIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  multipleMediaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mediaButtonIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 8,
  },
  addMediaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  noMediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noMediaText: {
    marginTop: 12,
    marginBottom: 16,
    color: '#A0A0A0',
    fontSize: 14,
  },
});