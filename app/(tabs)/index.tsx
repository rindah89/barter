import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  StatusBar,
  Modal,
  ScrollView,
  TextInput,
  Keyboard,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, X, Filter, LucidePackage, Info, Search, RotateCcw, User, ArrowLeft, Grid, Layers, Star } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Tables } from '../../database.types';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import LottieView from 'lottie-react-native';
import { useAuth } from '../../lib/AuthContext';
import useProfile from '../../hooks/useProfile';
import { getDefaultAvatar } from '../../lib/useDefaultAvatar';
import ChatButton from '../components/ChatButton';
import { getSupabaseFileUrl } from '../../services/imageservice';
import LoadingIndicator from '../../components/LoadingIndicator';
import { useLoading } from '../../lib/LoadingContext';
import SuggestedTrades from '../../components/SuggestedTrades';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;
const PAGE_SIZE = 10;

// View mode enum
enum ViewMode {
  SWIPE = 'swipe',
  LIST = 'list'
}

// Media Carousel Component
const MediaCarousel = ({ mediaFiles, mainImage }: { mediaFiles: string[], mainImage: string | null }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const allMedia = mainImage ? [mainImage, ...mediaFiles] : mediaFiles;
  const mediaToShow = allMedia.slice(0, 5); // Show max 5 media files
  
  // Auto-rotation timer
  useEffect(() => {
    if (mediaToShow.length <= 1) return;
    
    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % mediaToShow.length;
      setActiveIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true
      });
    }, 3000);
    
    return () => clearInterval(timer);
  }, [activeIndex, mediaToShow.length]);
  
  if (mediaToShow.length === 0) {
    return (
      <ExpoImage 
        source={{ uri: 'https://via.placeholder.com/300' }} 
        style={styles.listItemImage} 
        cachePolicy="disk" 
      />
    );
  }
  
  if (mediaToShow.length === 1) {
    return (
      <ExpoImage 
        source={{ uri: getSupabaseFileUrl(mediaToShow[0]) }} 
        style={styles.listItemImage} 
        cachePolicy="disk" 
      />
    );
  }
  
  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const viewSize = event.nativeEvent.layoutMeasurement;
    const pageNum = Math.floor(contentOffset.x / viewSize.width);
    setActiveIndex(pageNum);
  };
  
  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.carousel}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {mediaToShow.map((media, index) => (
          <View key={index} style={[styles.carouselItem, { width: SCREEN_WIDTH }]}>
            <ExpoImage 
              source={{ uri: getSupabaseFileUrl(media) }} 
              style={styles.carouselImage} 
              cachePolicy="disk" 
            />
          </View>
        ))}
      </ScrollView>
      {mediaToShow.length > 1 && (
        <View style={styles.carouselIndicators}>
          {mediaToShow.map((_, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.carouselDot,
                index === activeIndex ? styles.carouselDotActive : null
              ]} 
              onPress={() => {
                setActiveIndex(index);
                scrollViewRef.current?.scrollTo({
                  x: index * SCREEN_WIDTH,
                  animated: true
                });
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// Define Item type using the database schema
type Item = Tables<'items'>;

export default function DiscoverScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [ownerProfiles, setOwnerProfiles] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST);
  const [likedItems, setLikedItems] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const position = useRef(new Animated.ValueXY()).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lottieRef = useRef<LottieView>(null);
  const { user } = useAuth();
  const { profile } = useProfile();
  const [lastGesture, setLastGesture] = useState({ dx: 0, dy: 0 });
  const { setIsLoading } = useLoading();

  // Predefined categories (fetch dynamically if possible)
  const categories = ['All', 'Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Toys', 'Art', 'Other'];

  // Fetch user's liked items
  const fetchLikedItems = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('liked_items')
        .select('item_id')
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error fetching liked items:', error);
        return;
      }
      
      const likedItemIds = data.map(item => item.item_id);
      setLikedItems(likedItemIds);
    } catch (err) {
      console.error('Error in fetchLikedItems:', err);
    }
  };

  // Fetch items and profiles
  useEffect(() => {
    fetchItems();
    fetchLikedItems();
  }, [categoryFilter]);

  useEffect(() => {
    if (currentIndex >= items.length - 5 && hasMore && !loading) {
      loadMoreItems();
    }
  }, [currentIndex]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        setError('User not authenticated');
        return;
      }

      // First, fetch the user's liked items
      const { data: likedItems, error: likedItemsError } = await supabase
        .from('liked_items')
        .select('item_id')
        .eq('user_id', userId);

      if (likedItemsError) {
        console.error('Error fetching liked items:', likedItemsError);
      }

      // Extract the item IDs that the user has liked
      const likedItemIds = likedItems?.map(item => item.item_id) || [];

      let query = supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .neq('user_id', userId);

      // Add filter to exclude liked items if there are any
      if (likedItemIds.length > 0) {
        query = query.not('id', 'in', `(${likedItemIds.join(',')})`);
      }

      // Apply category filter if selected
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data: itemsData, error: itemsError } = await query
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (itemsError) throw itemsError;

      setItems(itemsData as Item[]);
      setPage(1);
      setHasMore(itemsData.length === PAGE_SIZE);
      setCurrentIndex(0);

      const userIds = [...new Set(itemsData.map((item) => item.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
      setOwnerProfiles(profilesMap);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreItems = async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      
      // First, fetch the user's liked items
      const { data: likedItems, error: likedItemsError } = await supabase
        .from('liked_items')
        .select('item_id')
        .eq('user_id', user?.id);

      if (likedItemsError) {
        console.error('Error fetching liked items:', likedItemsError);
      }

      // Extract the item IDs that the user has liked
      const likedItemIds = likedItems?.map(item => item.item_id) || [];
      
      let query = supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .neq('user_id', user?.id);

      // Add filter to exclude liked items if there are any
      if (likedItemIds.length > 0) {
        query = query.not('id', 'in', `(${likedItemIds.join(',')})`);
      }

      // Apply category filter if selected
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data: newItems, error } = await query
        .order('created_at', { ascending: false })
        .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1);

      if (error) throw error;

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
        setPage(nextPage);
        setHasMore(newItems.length === PAGE_SIZE);

        const userIds = [...new Set(newItems.map((item) => item.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const profilesMap = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, { ...ownerProfiles });
        setOwnerProfiles(profilesMap);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Animations
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const cardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: [0.95, 1, 0.95],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 8, SCREEN_WIDTH / 4],
    outputRange: [0, 0.8, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, -SCREEN_WIDTH / 8, 0],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const likeScale = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: [0.5, 1],
    extrapolate: 'clamp',
  });

  const nopeScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  const nextCardOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: [1, 0.7, 1],
    extrapolate: 'clamp',
  });

  const nextCardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: [1, 0.85, 1],
    extrapolate: 'clamp',
  });

  const likeRotate = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 4],
    outputRange: ['0deg', '5deg'],
    extrapolate: 'clamp',
  });

  const nopeRotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 4, 0],
    outputRange: ['-5deg', '0deg'],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
        setLastGesture({ dx: gesture.dx, dy: gesture.dy });
        
        // Update swipe direction with more granular feedback
        if (gesture.dx > 50) {
          setSwipeDirection('right');
        } else if (gesture.dx < -50) {
          setSwipeDirection('left');
        } else {
          setSwipeDirection(null);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        setLastGesture({ dx: gesture.dx, dy: gesture.dy });
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const swipeRight = async () => {
    // Get the current item being swiped
    const currentItem = items[currentIndex];
    
    // Add item to liked items
    if (currentItem && user?.id) {
      try {
        // Check if the item is already liked to avoid duplicate entries
        const { data, error: checkError } = await supabase
          .from('liked_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('item_id', currentItem.id)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
          console.error('Error checking liked item:', checkError);
        }
        
        // Only add to liked items if not already liked
        if (!data) {
          const { error } = await supabase
            .from('liked_items')
            .upsert({
              user_id: user.id,
              item_id: currentItem.id,
              created_at: new Date().toISOString()
            });
            
          if (error) {
            console.error('Error adding item to liked items:', error);
          }
        }
      } catch (error) {
        console.error('Error in swipeRight:', error);
      }
    }
    
    // Continue with animation
    Animated.timing(position, { 
      toValue: { x: SCREEN_WIDTH + 100, y: lastGesture.dy }, 
      duration: 300, 
      useNativeDriver: false 
    }).start(() => {
      setCurrentIndex(currentIndex + 1);
      position.setValue({ x: 0, y: 0 });
      setSwipeDirection(null);
    });
  };

  const swipeLeft = async () => {
    // Get the current item being swiped
    const currentItem = items[currentIndex];
    
    // Remove item from liked items if it exists
    if (currentItem && user?.id) {
      try {
        // Check if the item is already liked
        const { data, error: checkError } = await supabase
          .from('liked_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('item_id', currentItem.id)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
          console.error('Error checking liked item:', checkError);
        }
        
        // If the item is liked, remove it
        if (data) {
          const { error: deleteError } = await supabase
            .from('liked_items')
            .delete()
            .eq('user_id', user.id)
            .eq('item_id', currentItem.id);
            
          if (deleteError) {
            console.error('Error removing item from liked items:', deleteError);
          }
        }
      } catch (error) {
        console.error('Error in swipeLeft:', error);
      }
    }
    
    // Continue with animation
    Animated.timing(position, { 
      toValue: { x: -SCREEN_WIDTH - 100, y: lastGesture.dy }, 
      duration: 300, 
      useNativeDriver: false 
    }).start(() => {
      setCurrentIndex(currentIndex + 1);
      position.setValue({ x: 0, y: 0 });
      setSwipeDirection(null);
    });
  };

  const resetPosition = () => {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start();
    setSwipeDirection(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setCurrentIndex(0);
    fetchItems();
  };

  // Function to handle navigation to item details
  const navigateToItemDetails = (itemId: string) => {
    setIsLoading(true);
    router.push(`/item-details?id=${itemId}`);
  };

  // Skeleton Card Component
  const SkeletonCard = ({ pulseOpacity }: { pulseOpacity: Animated.AnimatedInterpolation<number> }) => (
    <View style={styles.card}>
      <Animated.View style={[styles.image, { backgroundColor: '#EDEDED', opacity: pulseOpacity }]} />
      <View style={styles.categoryBadge}>
        <Animated.View style={{ width: 80, height: 20, backgroundColor: '#EDEDED', opacity: pulseOpacity }} />
      </View>
      <View style={styles.cardContent}>
        <Animated.View style={{ width: '80%', height: 28, backgroundColor: '#EDEDED', marginBottom: 10, opacity: pulseOpacity }} />
        <Animated.View style={{ width: '100%', height: 14, backgroundColor: '#EDEDED', marginBottom: 5, opacity: pulseOpacity }} />
        <Animated.View style={{ width: '100%', height: 14, backgroundColor: '#EDEDED', marginBottom: 15, opacity: pulseOpacity }} />
        <View style={styles.ownerContainer}>
          <Animated.View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDEDED', opacity: pulseOpacity }} />
          <View style={{ marginLeft: 10 }}>
            <Animated.View style={{ width: 100, height: 16, backgroundColor: '#EDEDED', opacity: pulseOpacity }} />
            <Animated.View style={{ width: 80, height: 14, backgroundColor: '#EDEDED', marginTop: 5, opacity: pulseOpacity }} />
          </View>
        </View>
      </View>
    </View>
  );

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  const renderCards = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.cardsContainer}>
          <SkeletonCard pulseOpacity={pulseOpacity} />
          <SkeletonCard pulseOpacity={pulseOpacity} />
          <SkeletonCard pulseOpacity={pulseOpacity} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Info color="#FF3B30" size={48} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorButton} onPress={fetchItems}>
            <Text style={styles.errorButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.lottieContainer}>
            <LottieView
              ref={lottieRef}
              source={require('../../assets/home.json')}
              autoPlay
              loop
              style={styles.lottieAnimation}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {categoryFilter 
              ? `No ${categoryFilter} Items Available` 
              : 'No Items Available'}
          </Text>
          <Text style={styles.emptyText}>
            {categoryFilter 
              ? `There are no ${categoryFilter.toLowerCase()} items available for trading at the moment.` 
              : 'There are no items available for trading at the moment.'}
          </Text>
          {categoryFilter && (
            <TouchableOpacity 
              style={styles.clearFilterButton} 
              onPress={() => {
                setCategoryFilter(null);
              }}
            >
              <Text style={styles.clearFilterText}>Clear Filter</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (currentIndex >= items.length) {
      return (
        <View style={styles.emptyContainer}>
          <RotateCcw color="#22C55E" size={64} />
          <Text style={styles.emptyTitle}>
            {categoryFilter 
              ? `No More ${categoryFilter} Items` 
              : 'No More Items'}
          </Text>
          <Text style={styles.emptyText}>
            {categoryFilter 
              ? `You've viewed all available ${categoryFilter.toLowerCase()} items.` 
              : "You've viewed all available items. Refresh for more!"}
          </Text>
          <View style={styles.emptyActionButtons}>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
            {categoryFilter && (
              <TouchableOpacity 
                style={styles.clearFilterButton} 
                onPress={() => {
                  setCategoryFilter(null);
                }}
              >
                <Text style={styles.clearFilterText}>Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return items.map((item, index) => {
      if (index < currentIndex) return null;

      const owner = ownerProfiles[item.user_id] || {};
      const imageUri = item.image_url
        ? getSupabaseFileUrl(item.image_url)
        : 'https://via.placeholder.com/300';

      if (index === currentIndex) {
        return (
          <Animated.View
            key={item.id}
            style={[
              styles.card,
              {
                transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }, { scale: cardScale }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Animated.View 
              style={[
                styles.likeContainer, 
                { 
                  opacity: likeOpacity, 
                  transform: [
                    { scale: likeScale },
                    { rotate: likeRotate }
                  ] 
                }
              ]}
            >
              <View style={styles.likeBackground}>
                <Heart color="#22C55E" size={80} fill="#22C55E" />
                <Text style={styles.likeText}>LIKE</Text>
              </View>
            </Animated.View>
            <Animated.View 
              style={[
                styles.nopeContainer, 
                { 
                  opacity: nopeOpacity, 
                  transform: [
                    { scale: nopeScale },
                    { rotate: nopeRotate }
                  ] 
                }
              ]}
            >
              <View style={styles.nopeBackground}>
                <X color="#FF3B30" size={80} />
                <Text style={styles.nopeText}>NOPE</Text>
              </View>
            </Animated.View>
            <ExpoImage source={{ uri: imageUri }} style={styles.image} cachePolicy="disk" />
            <View style={styles.categoryBadge}>
              <LucidePackage color="#FFFFFF" size={14} style={styles.categoryIcon} />
              <Text style={styles.categoryBadgeText}>{item.category || 'Uncategorized'}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description || 'No description'}</Text>
              <View style={styles.ownerContainer}>
                <ExpoImage
                  source={{ uri: owner.avatar_url ? getSupabaseFileUrl(owner.avatar_url) : getDefaultAvatar() }}
                  style={styles.ownerAvatar}
                  cachePolicy="disk"
                />
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{owner.name || 'Unknown User'}</Text>
                  <View style={styles.ownerRatingContainer}>
                    {renderStarRating(owner.rating, 14)}
                    <Text style={styles.ownerTradesText}>{owner.completed_trades || 0} trades</Text>
                  </View>
                  <Text style={styles.ownerLocation}>{owner.location || 'No location'}</Text>
                </View>
              </View>
              
              {owner.interest && owner.interest.length > 0 && (
                <View style={styles.interestsContainer}>
                  <Text style={styles.interestsLabel}>Interested in:</Text>
                  <View style={styles.interestsList}>
                    {owner.interest.slice(0, 3).map((interest: string, index: number) => (
                      <View key={index} style={styles.interestBadge}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                    {owner.interest.length > 3 && (
                      <View style={styles.interestBadge}>
                        <Text style={styles.interestText}>+{owner.interest.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.detailsButton} 
                onPress={() => navigateToItemDetails(item.id)}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      }

      if (index === currentIndex + 1) {
        return (
          <Animated.View
            key={item.id}
            style={[styles.card, { opacity: nextCardOpacity, transform: [{ scale: nextCardScale }], zIndex: -1 }]}
          >
            <ExpoImage source={{ uri: imageUri }} style={styles.image} cachePolicy="disk" />
            <View style={styles.categoryBadge}>
              <LucidePackage color="#FFFFFF" size={14} style={styles.categoryIcon} />
              <Text style={styles.categoryBadgeText}>{item.category || 'Uncategorized'}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description || 'No description'}</Text>
              <View style={styles.ownerContainer}>
                <ExpoImage
                  source={{ uri: owner.avatar_url ? getSupabaseFileUrl(owner.avatar_url) : getDefaultAvatar() }}
                  style={styles.ownerAvatar}
                  cachePolicy="disk"
                />
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{owner.name || 'Unknown User'}</Text>
                  <View style={styles.ownerRatingContainer}>
                    {renderStarRating(owner.rating, 14)}
                    <Text style={styles.ownerTradesText}>{owner.completed_trades || 0} trades</Text>
                  </View>
                  <Text style={styles.ownerLocation}>{owner.location || 'No location'}</Text>
                </View>
              </View>
              
              {owner.interest && owner.interest.length > 0 && (
                <View style={styles.interestsContainer}>
                  <Text style={styles.interestsLabel}>Interested in:</Text>
                  <View style={styles.interestsList}>
                    {owner.interest.slice(0, 3).map((interest: string, index: number) => (
                      <View key={index} style={styles.interestBadge}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                    {owner.interest.length > 3 && (
                      <View style={styles.interestBadge}>
                        <Text style={styles.interestText}>+{owner.interest.length - 3}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.detailsButton} 
                onPress={() => navigateToItemDetails(item.id)}
              >
                <Text style={styles.detailsButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      }
      return null;
    }).reverse();
  };

  // Search function
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (!userId) {
        setError('User not authenticated');
        return;
      }

      // Search in name and description fields
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .neq('user_id', userId)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setSearchResults(data as Item[]);

      // Fetch owner profiles for search results
      if (data.length > 0) {
        const userIds = [...new Set(data.map((item) => item.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const profilesMap = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, { ...ownerProfiles });
        setOwnerProfiles(profilesMap);
      }
    } catch (err) {
      console.error('Error searching items:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search to avoid too many requests
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Focus search input when modal opens
  useEffect(() => {
    if (showSearchModal && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [showSearchModal]);

  // Reset search when modal closes
  const handleCloseSearch = () => {
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  };

  // Render search result item
  const renderSearchResultItem = ({ item }: { item: Item }) => {
    const owner = ownerProfiles[item.user_id] || {};
    const imageUri = item.image_url
      ? getSupabaseFileUrl(item.image_url)
      : 'https://via.placeholder.com/300';

    return (
      <TouchableOpacity 
        style={styles.searchResultItem} 
        onPress={() => {
          handleCloseSearch();
          navigateToItemDetails(item.id);
        }}
      >
        <ExpoImage 
          source={{ uri: imageUri }} 
          style={styles.searchResultImage} 
          cachePolicy="disk" 
        />
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.searchResultDescription} numberOfLines={2}>
            {item.description || 'No description'}
          </Text>
          <View style={styles.searchResultOwner}>
            <Text style={styles.searchResultOwnerName} numberOfLines={1}>
              Owner: {owner.name || 'Unknown User'}
            </Text>
            {item.category && (
              <View style={styles.searchResultCategory}>
                <Text style={styles.searchResultCategoryText}>{item.category}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Handle refresh for grid view
  const handleGridRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchItems();
    setRefreshing(false);
  };

  // Handle end reached for grid view
  const handleEndReached = () => {
    if (!hasMore || loading || loadingMore) return;
    loadMoreItemsForGrid();
  };

  // Load more items for grid view
  const loadMoreItemsForGrid = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      
      // First, fetch the user's liked items
      const { data: likedItems, error: likedItemsError } = await supabase
        .from('liked_items')
        .select('item_id')
        .eq('user_id', user?.id);

      if (likedItemsError) {
        console.error('Error fetching liked items:', likedItemsError);
      }

      // Extract the item IDs that the user has liked
      const likedItemIds = likedItems?.map(item => item.item_id) || [];
      
      let query = supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .neq('user_id', user?.id);

      // Add filter to exclude liked items if there are any
      if (likedItemIds.length > 0) {
        query = query.not('id', 'in', `(${likedItemIds.join(',')})`);
      }

      // Apply category filter if selected
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      const { data: newItems, error } = await query
        .order('created_at', { ascending: false })
        .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1);

      if (error) throw error;

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
        setPage(nextPage);
        setHasMore(newItems.length === PAGE_SIZE);

        const userIds = [...new Set(newItems.map((item) => item.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const profilesMap = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, { ...ownerProfiles });
        setOwnerProfiles(profilesMap);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more items:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Toggle view mode
  const toggleViewMode = () => {
    setViewMode(prevMode => 
      prevMode === ViewMode.LIST ? ViewMode.SWIPE : ViewMode.LIST
    );
  };

  // Toggle like status
  const toggleLike = async (itemId: string) => {
    if (!user?.id) return;
    
    try {
      // Check if already liked
      const isLiked = likedItems.includes(itemId);
      
      if (isLiked) {
        // Unlike the item
        const { error } = await supabase
          .from('liked_items')
          .delete()
          .eq('user_id', user.id)
          .eq('item_id', itemId);
          
        if (error) {
          console.error('Error removing item from liked items:', error);
          return;
        }
        
        // Update local state
        setLikedItems(prev => prev.filter(id => id !== itemId));
      } else {
        // Like the item
        const { error } = await supabase
          .from('liked_items')
          .upsert({
            user_id: user.id,
            item_id: itemId,
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.error('Error adding item to liked items:', error);
          return;
        }
        
        // Update local state
        setLikedItems(prev => [...prev, itemId]);
      }
    } catch (error) {
      console.error('Error in toggleLike:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Render list item
  const renderListItem = ({ item }: { item: Item }) => {
    const owner = ownerProfiles[item.user_id] || {};
    const isLiked = likedItems.includes(item.id);
    
    // Get media files
    const mediaFiles = item.media_files || [];

    return (
      <View style={styles.listItem}>
        {/* User header */}
        <View style={styles.listItemHeader}>
          <ExpoImage
            source={{ uri: owner.avatar_url ? getSupabaseFileUrl(owner.avatar_url) : getDefaultAvatar() }}
            style={styles.listItemAvatar}
            cachePolicy="disk"
          />
          <View style={styles.listItemUserInfo}>
            <Text style={styles.listItemUsername}>{owner.name || 'Unknown User'}</Text>
            {owner.email && (
              <Text style={styles.listItemEmail}>{owner.email}</Text>
            )}
          </View>
          <View style={styles.listItemMeta}>
            <Text style={styles.listItemLocation}>{owner.location || 'No location'}</Text>
            <Text style={styles.listItemDot}>•</Text>
            <Text style={styles.listItemTimestamp}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        
        {/* Item media */}
        <View style={styles.listItemMediaContainer}>
          <MediaCarousel mediaFiles={mediaFiles} mainImage={item.image_url} />
          
          {/* Category badge overlay */}
          <View style={styles.listItemCategoryBadge}>
            <LucidePackage color="#FFFFFF" size={12} style={styles.listItemCategoryIcon} />
            <Text style={styles.listItemCategoryText}>{item.category || 'Uncategorized'}</Text>
          </View>
          
          {/* Transparent overlay for item details navigation */}
          <TouchableOpacity 
            style={styles.listItemMediaOverlay}
            activeOpacity={1}
            onPress={() => navigateToItemDetails(item.id)}
          />
        </View>
        
        {/* Item content */}
        <View style={styles.listItemContent}>
          <Text style={styles.listItemName}>{item.name}</Text>
          <Text style={styles.listItemDescription} numberOfLines={3}>
            {item.description || 'No description'}
          </Text>
          
          {/* Stats */}
          <View style={styles.listItemStats}>
            <View style={styles.listItemStat}>
              {renderStarRating(owner.rating)}
              <Text style={styles.listItemStatLabel}>Rating</Text>
            </View>
            <View style={styles.listItemStat}>
              <Text style={styles.listItemStatValue}>{owner.completed_trades || 0}</Text>
              <Text style={styles.listItemStatLabel}>Trades</Text>
            </View>
          </View>
          
          {/* Actions */}
          <View style={styles.listItemActions}>
            <TouchableOpacity 
              style={styles.listItemLikeButton}
              onPress={() => toggleLike(item.id)}
            >
              <Heart 
                color="#22C55E" 
                size={24} 
                fill={isLiked ? "#22C55E" : "transparent"} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.listItemDetailsButton}
              onPress={() => navigateToItemDetails(item.id)}
            >
              <Text style={styles.listItemDetailsText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render list view
  const renderListView = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="large" color="#22C55E" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Info color="#FF3B30" size={48} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorButton} onPress={fetchItems}>
            <Text style={styles.errorButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Note: The original emptyContainer logic is complex and renders full-screen replacements.
    // If items.length is 0, we might want to show SuggestedTrades above the empty message.
    // For simplicity now, SuggestedTrades will only show if there ARE items.
    // A more robust solution might involve a different structure if SuggestedTrades
    // should *always* show above the main list area, even if empty.

    return (
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderListItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleGridRefresh}
            colors={['#22C55E']}
            tintColor="#22C55E"
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Add SuggestedTrades as the header for the list
        ListHeaderComponent={<SuggestedTrades />}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMoreIndicator}>
              <ActivityIndicator size="small" color="#22C55E" />
              <Text style={styles.loadMoreText}>Loading more items...</Text>
            </View>
          ) : hasMore ? (
            <View style={styles.loadMoreIndicator}>
              <Text style={styles.loadMoreHint}>Scroll for more items</Text>
            </View>
          ) : (
            <View style={styles.loadMoreIndicator}>
              <Text style={styles.loadMoreEnd}>You've reached the end</Text>
            </View>
          )
        }
        // Render the empty component without the header if needed
        // Or adjust the emptyContainer style to accommodate the header possibly
        ListEmptyComponent={(
            items.length === 0 && !loading && !refreshing ? (
              <View style={styles.emptyContainer}>
                {/* Reuse the existing empty state logic from the main component body */}
                <View style={styles.lottieContainer}>
                  <LottieView
                    ref={lottieRef}
                    source={require('../../assets/home.json')}
                    autoPlay
                    loop
                    style={styles.lottieAnimation}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {categoryFilter 
                    ? `No ${categoryFilter} Items Available` 
                    : 'No Items Available'}
                </Text>
                <Text style={styles.emptyText}>
                  {categoryFilter 
                    ? `There are no ${categoryFilter.toLowerCase()} items available for trading at the moment.` 
                    : 'There are no items available for trading at the moment.'}
                </Text>
                {categoryFilter && (
                  <TouchableOpacity 
                    style={styles.clearFilterButton} 
                    onPress={() => {
                      setCategoryFilter(null);
                    }}
                  >
                    <Text style={styles.clearFilterText}>Clear Filter</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          )}
      />
    );
  };

  // Render star rating
  const renderStarRating = (rating: number | null, size: number = 16) => {
    const ratingValue = rating || 0;
    const maxRating = 5;
    const stars = [];
    
    for (let i = 1; i <= maxRating; i++) {
      stars.push(
        <Star 
          key={i} 
          size={size} 
          color="#22C55E" 
          fill={i <= ratingValue ? "#22C55E" : "transparent"} 
          style={{ marginRight: i < maxRating ? 2 : 0 }}
        />
      );
    }
    
    return (
      <View style={styles.starRating}>
        {stars}
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
          <View style={styles.headerLeftSection}>
            <TouchableOpacity style={styles.avatarButton} onPress={() => router.push('/(tabs)/profile')}>
              {profile?.avatar_url ? (
                <ExpoImage source={{ uri: profile.avatar_url }} style={styles.avatarImage} cachePolicy="disk" />
              ) : (
                <View style={styles.avatarCircle}>
                  <User color="#FFFFFF" size={22} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Hi, {profile?.name?.split(' ')[0] || 'there'}</Text>
              <Text style={styles.headerSubtitle}>
                {categoryFilter 
                  ? `Browsing ${categoryFilter} items` 
                  : viewMode === ViewMode.LIST 
                    ? 'Browse items for trade'
                    : 'Swipe to find items for trade'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={toggleViewMode}
            >
              {viewMode === ViewMode.LIST ? (
                <Layers color="#FFFFFF" size={22} />
              ) : (
                <Grid color="#FFFFFF" size={22} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowSearchModal(true)}
            >
              <Search color="#FFFFFF" size={22} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Category Selector */}
      <View style={styles.categorySelector}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categorySelectorContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                categoryFilter === category ? styles.categoryChipActive : null,
                categoryFilter === null && category === 'All' ? styles.categoryChipActive : null,
              ]}
              onPress={() => {
                setCategoryFilter(category === 'All' ? null : category);
                setCurrentIndex(0);
              }}
            >
              <Text 
                style={[
                  styles.categoryChipText,
                  categoryFilter === category ? styles.categoryChipTextActive : null,
                  categoryFilter === null && category === 'All' ? styles.categoryChipTextActive : null,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        onRequestClose={handleCloseSearch}
      >
        <SafeAreaView style={styles.searchModalContainer}>
          <View style={styles.searchHeader}>
            <TouchableOpacity 
              style={styles.searchBackButton} 
              onPress={handleCloseSearch}
            >
              <ArrowLeft color="#333333" size={24} />
            </TouchableOpacity>
            <View style={styles.searchInputContainer}>
              <Search color="#666666" size={20} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor="#999999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  style={styles.searchClearButton} 
                  onPress={() => setSearchQuery('')}
                >
                  <X color="#999999" size={16} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isSearching ? (
            <View style={styles.searchLoadingContainer}>
              <LoadingIndicator size="large" color="#22C55E" />
            </View>
          ) : searchQuery.length > 0 && searchResults.length === 0 ? (
            <View style={styles.searchEmptyContainer}>
              <Info color="#999999" size={48} />
              <Text style={styles.searchEmptyText}>No items found matching "{searchQuery}"</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResultItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                searchQuery.length > 0 ? null : (
                  <View style={styles.searchInitialContainer}>
                    <Search color="#CCCCCC" size={64} />
                    <Text style={styles.searchInitialText}>
                      Search for items by name or description
                    </Text>
                  </View>
                )
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      <SafeAreaView style={styles.contentContainer} edges={['bottom', 'left', 'right']}>
          {/* Conditional Rendering for List or Swipe View */}
          {viewMode === ViewMode.LIST ? (
            renderListView() // This now includes SuggestedTrades as a header
          ) : (
            <>
              {/* SuggestedTrades could optionally be added here too if desired for swipe view */}
              {/* <SuggestedTrades /> */} 
              <View style={styles.cardsContainer}>{renderCards()}</View>
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={[styles.actionButton, styles.nopeButton]} onPress={swipeLeft}>
                  <X color="#FF3B30" size={30} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.filterButton]} onPress={() => setShowFilterModal(true)}>
                  <Filter color="#666666" size={30} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={swipeRight}>
                  <Heart color="#22C55E" size={30} fill="#22C55E" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Filter Modal */}
          <Modal visible={showFilterModal} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Filter by Category</Text>
                <View style={styles.modalCategoriesGrid}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.modalCategoryOption,
                        categoryFilter === category ? styles.modalCategoryOptionActive : null,
                        categoryFilter === null && category === 'All' ? styles.modalCategoryOptionActive : null,
                      ]}
                      onPress={() => {
                        setCategoryFilter(category === 'All' ? null : category);
                        setCurrentIndex(0);
                        setShowFilterModal(false);
                      }}
                    >
                      <Text 
                        style={[
                          styles.modalCategoryText,
                          categoryFilter === category ? styles.modalCategoryTextActive : null,
                          categoryFilter === null && category === 'All' ? styles.modalCategoryTextActive : null,
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setShowFilterModal(false)}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    height: 60,
  },
  headerLeftSection: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitleContainer: { justifyContent: 'center', marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '400' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarButton: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  contentContainer: { flex: 1 },
  cardsContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 15, 
    marginBottom: 10,
    zIndex: 1 
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: '90%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  image: { 
    width: '100%', 
    height: '45%', 
    resizeMode: 'cover' 
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    marginRight: 4,
  },
  categoryBadgeText: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  cardContent: { 
    padding: 16, 
    flex: 1, 
    justifyContent: 'flex-start' 
  },
  name: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#333333', 
    marginBottom: 6 
  },
  description: { 
    fontSize: 14, 
    color: '#666666', 
    marginBottom: 10, 
    lineHeight: 18,
    maxHeight: 54, // Limit to 3 lines
  },
  ownerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 6,
    marginBottom: 10,
  },
  ownerAvatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginRight: 10 
  },
  ownerInfo: { 
    flex: 1 
  },
  ownerName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333333',
    marginBottom: 2,
  },
  ownerStats: { 
    fontSize: 11, 
    color: '#999999', 
    marginTop: 2 
  },
  detailsButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  detailsButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  likeContainer: {
    position: 'absolute',
    top: '25%',
    right: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transform: [{ rotate: '0deg' }],
  },
  nopeContainer: {
    position: 'absolute',
    top: '25%',
    right: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transform: [{ rotate: '0deg' }],
  },
  likeText: { 
    color: '#22C55E', 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  nopeText: { 
    color: '#FF3B30', 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actionsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-evenly', 
    marginBottom: 15, 
    paddingHorizontal: 30 
  },
  nopeButton: { borderWidth: 2, borderColor: '#FF3B30', backgroundColor: '#FFFFFF' },
  filterButton: { borderWidth: 2, borderColor: '#666666', backgroundColor: '#FFFFFF' },
  likeButton: { borderWidth: 2, borderColor: '#22C55E', backgroundColor: '#FFFFFF' },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#333333' },
  modalCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalCategoryOption: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  modalCategoryOptionActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  modalCategoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  modalCategoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#FF3B30', fontSize: 16, marginTop: 12, marginBottom: 20, textAlign: 'center' },
  errorButton: { backgroundColor: '#22C55E', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25 },
  errorButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  emptyActionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  refreshButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginHorizontal: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearFilterButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#22C55E',
    marginHorizontal: 8,
  },
  clearFilterText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lottieContainer: { width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7, marginBottom: 10 },
  lottieAnimation: { width: '100%', height: '100%' },
  interestsContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  interestBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  interestText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '500',
  },
  interestsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
  },
  likeBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#22C55E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  nopeBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  categorySelector: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categorySelectorContent: {
    paddingHorizontal: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  categoryChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchBackButton: {
    padding: 8,
    marginRight: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
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
  searchClearButton: {
    padding: 6,
  },
  searchLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  searchEmptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  searchInitialContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  searchInitialText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 16,
    maxWidth: '80%',
  },
  searchResultsList: {
    padding: 12,
  },
  searchResultItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  searchResultContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  searchResultDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 18,
  },
  searchResultOwner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchResultOwnerName: {
    fontSize: 12,
    color: '#999999',
    flex: 1,
  },
  searchResultCategory: {
    backgroundColor: '#22C55E20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  searchResultCategoryText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  listContainer: {
    padding: 12,
    paddingBottom: 20,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  listItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  listItemUserInfo: {
    flex: 1,
  },
  listItemUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  listItemEmail: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 2,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listItemLocation: {
    fontSize: 12,
    color: '#666666',
  },
  listItemDot: {
    fontSize: 12,
    color: '#999999',
    marginHorizontal: 4,
  },
  listItemTimestamp: {
    fontSize: 12,
    color: '#666666',
  },
  listItemMediaContainer: {
    position: 'relative',
    width: '100%',
  },
  listItemImage: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  carouselContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
    overflow: 'hidden',
  },
  carousel: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  carouselDotActive: {
    backgroundColor: '#FFFFFF',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  listItemCategoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  listItemCategoryIcon: {
    marginRight: 4,
  },
  listItemCategoryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  listItemContent: {
    padding: 12,
  },
  listItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 6,
  },
  listItemDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  listItemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  listItemLikeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemDetailsButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemDetailsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listItemStats: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  listItemStat: {
    marginRight: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  listItemStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 4,
  },
  listItemStatLabel: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadMoreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadMoreHint: {
    fontSize: 14,
    color: '#999999',
  },
  loadMoreEnd: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
  },
  listItemMediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  ownerRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  ownerTradesText: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  ownerLocation: {
    fontSize: 12,
    color: '#666666',
  },
});