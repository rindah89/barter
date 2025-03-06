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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, X, Filter, LucidePackage, Info, Search, RotateCcw, User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Item } from '../../lib/supabase';
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;
const PAGE_SIZE = 10;

export default function DiscoverScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [ownerProfiles, setOwnerProfiles] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
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
  const categories = ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Other'];

  // Fetch items and profiles
  useEffect(() => {
    fetchItems();
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

      let query = supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .neq('user_id', userId);

      if (categoryFilter) query = query.eq('category', categoryFilter);

      const { data: itemsData, error: itemsError } = await query.range(0, PAGE_SIZE - 1);

      if (itemsError) throw itemsError;

      setItems(itemsData as Item[]);
      setPage(1);
      setHasMore(itemsData.length === PAGE_SIZE);

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
      let query = supabase
        .from('items')
        .select('*')
        .eq('is_available', true)
        .neq('user_id', user?.id);

      if (categoryFilter) query = query.eq('category', categoryFilter);

      const { data: newItems, error } = await query.range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1);

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

  const swipeLeft = () => {
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
    setPage(1);
    setHasMore(true);
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
          <Text style={styles.emptyTitle}>No Items Available</Text>
          <Text style={styles.emptyText}>There are no items available for trading at the moment.</Text>
        </View>
      );
    }

    if (currentIndex >= items.length) {
      return (
        <View style={styles.emptyContainer}>
          <RotateCcw color="#22C55E" size={64} />
          <Text style={styles.emptyTitle}>No More Items</Text>
          <Text style={styles.emptyText}>You've viewed all available items. Refresh for more!</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
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
              <Text style={styles.categoryBadgeText}>{item.category || 'Uncategorized'}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description || 'No description'}</Text>
              <View style={styles.ownerContainer}>
                <ExpoImage
                  source={{ uri: owner.avatar_url ? getSupabaseFileUrl(owner.avatar_url) : 'https://via.placeholder.com/40' }}
                  style={styles.ownerAvatar}
                  cachePolicy="disk"
                />
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{owner.name || 'Unknown User'}</Text>
                  <Text style={styles.ownerStats} numberOfLines={1}>
                    {owner.location || 'No location'} • Rating: {owner.rating || 'N/A'} • {owner.completed_trades || 0}{' '}
                    trades
                  </Text>
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
              <Text style={styles.categoryBadgeText}>{item.category || 'Uncategorized'}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.description} numberOfLines={2}>{item.description || 'No description'}</Text>
              <View style={styles.ownerContainer}>
                <ExpoImage
                  source={{ uri: owner.avatar_url ? getSupabaseFileUrl(owner.avatar_url) : 'https://via.placeholder.com/40' }}
                  style={styles.ownerAvatar}
                  cachePolicy="disk"
                />
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{owner.name || 'Unknown User'}</Text>
                  <Text style={styles.ownerStats} numberOfLines={1}>
                    {owner.location || 'No location'} • Rating: {owner.rating || 'N/A'} • {owner.completed_trades || 0}{' '}
                    trades
                  </Text>
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
              <Text style={styles.headerSubtitle}>Swipe to find items for trade</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Search color="#FFFFFF" size={22} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <SafeAreaView style={styles.contentContainer} edges={['bottom', 'left', 'right']}>
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

        <Modal visible={showFilterModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.categoryOption}
                  onPress={() => {
                    setCategoryFilter(category);
                    setShowFilterModal(false);
                  }}
                >
                  <Text style={styles.categoryText}>{category}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.clearFilterButton}
                onPress={() => {
                  setCategoryFilter(null);
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.clearFilterText}>Clear Filter</Text>
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
  image: { width: '100%', height: '45%', resizeMode: 'cover' },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  cardContent: { 
    padding: 16, 
    flex: 1, 
    justifyContent: 'flex-start' 
  },
  name: { fontSize: 22, fontWeight: 'bold', color: '#333333', marginBottom: 6 },
  description: { 
    fontSize: 14, 
    color: '#666666', 
    marginBottom: 10, 
    lineHeight: 18,
    maxHeight: 54, // Limit to 3 lines
  },
  ownerContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 16, fontWeight: '600', color: '#333333' },
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
  categoryOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  categoryText: { fontSize: 16, color: '#333333' },
  clearFilterButton: { marginTop: 20, alignItems: 'center' },
  clearFilterText: { fontSize: 16, color: '#22C55E', fontWeight: 'bold' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#FF3B30', fontSize: 16, marginTop: 12, marginBottom: 20, textAlign: 'center' },
  errorButton: { backgroundColor: '#22C55E', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25 },
  errorButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  lottieContainer: { width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7, marginBottom: 10 },
  lottieAnimation: { width: '100%', height: '100%' },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#333333', marginTop: 10, marginBottom: 8 },
  emptyText: { fontSize: 16, color: '#666666', marginBottom: 24, textAlign: 'center' },
  refreshButton: { backgroundColor: '#22C55E', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25 },
  refreshButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
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
});