import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, MessageCircle, Info, Repeat, Edit2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Trade, Item, Profile } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { getDefaultAvatar } from '../../lib/useDefaultAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useRouter } from 'expo-router';
import LoadingIndicator from '../../components/LoadingIndicator';
import useProfile from '../../hooks/useProfile';
import { useToast } from '../../lib/ToastContext';

// Define extended Trade type with additional properties used in the component
interface ExtendedTrade extends Trade {
  type?: 'sent' | 'received';
  date?: string;
  proposer?: Profile;
  receiver?: Profile;
  offered_item?: Item;
  requested_item?: Item;
  cash_amount?: number | null;
  isProposer?: boolean;
}

// Define filter option type
interface FilterOption {
  id: string;
  label: string;
}

export default function TradesScreen() {
  // Safely use the auth hook with a try-catch block
  let user;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    console.error('Error using useAuth:', error);
    // Return an error UI if useAuth fails
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Authentication error. Please restart the app.</Text>
        <Text style={styles.errorSubtext}>Error: useAuth must be used within an AuthProvider</Text>
      </View>
    );
  }

  const { profile } = useProfile();
  const [trades, setTrades] = useState<ExtendedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState<ExtendedTrade | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [proposeModalVisible, setProposeModalVisible] = useState(false);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [proposingTrade, setProposingTrade] = useState<ExtendedTrade | null>(null);
  const [tradeDetails, setTradeDetails] = useState<{
    trade: ExtendedTrade | null;
    offeredItem: Item | null;
    requestedItem: Item | null;
    proposer: Profile | null;
    receiver: Profile | null;
  }>({
    trade: null,
    offeredItem: null,
    requestedItem: null,
    proposer: null,
    receiver: null,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user, activeFilter]);

  // Function to navigate to chat with trade details
  const navigateToChat = (trade: ExtendedTrade) => {
    const partnerId = trade.proposer_id === user?.id ? trade.receiver_id : trade.proposer_id;
    const partnerName = trade.proposer_id === user?.id ? trade.receiver?.name : trade.proposer?.name;
    
    // Create a formal message with trade details
    let tradeDetailsMessage = "Regarding our trade proposal: ";
    
    // Determine which item is being offered by the message sender
    const isUserProposer = trade.proposer_id === user?.id;
    const userOfferedItem = isUserProposer ? trade.offered_item : trade.requested_item;
    const userRequestedItem = isUserProposer ? trade.requested_item : trade.offered_item;
    
    if (userOfferedItem?.name && userRequestedItem?.name) {
      // Add the item the user is offering
      tradeDetailsMessage += `I am offering ${userOfferedItem.name}`;
      
      // Add cash amount if it exists and the user is the one offering cash
      if (trade.cash_amount && trade.cash_amount > 0 && isUserProposer) {
        tradeDetailsMessage += ` with an additional ${trade.cash_amount.toLocaleString()} FCFA`;
      }
      
      // Add the item the user is requesting
      tradeDetailsMessage += ` in exchange for your ${userRequestedItem.name}`;
      
      // Add cash amount if it exists and the user is the one receiving cash
      if (trade.cash_amount && trade.cash_amount > 0 && !isUserProposer) {
        tradeDetailsMessage += ` with an additional ${trade.cash_amount.toLocaleString()} FCFA from you`;
      }
    }
    
    // Add a polite closing
    tradeDetailsMessage += ". I would like to discuss this trade with you.";
    
    // Navigate to chat screen with partner ID, initial message, and trade ID only
    router.push({
      pathname: '/chat',
      params: {
        partnerId,
        partnerName,
        initialMessage: tradeDetailsMessage,
        tradeId: trade.id
      }
    });
  };

  const fetchTrades = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      
      // Handle liked items filter separately
      if (activeFilter === 'liked') {
        // Fetch liked items
        const { data: likedItemsData, error: likedItemsError } = await supabase
          .from('liked_items')
          .select(`
            *,
            item:item_id(*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (likedItemsError) throw likedItemsError;
        
        // Fetch user's own items for potential trades
        const { data: userItems, error: userItemsError } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_available', true);
          
        if (userItemsError) throw userItemsError;
        
        // Create an array of seller IDs to fetch their profiles
        const sellerIds = likedItemsData?.map(likedItem => likedItem.item.user_id) || [];
        
        // Fetch seller profiles
        const { data: sellerProfiles, error: sellerProfilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', sellerIds);
          
        if (sellerProfilesError) throw sellerProfilesError;
        
        // Create a map of seller profiles for easy lookup
        const sellerProfileMap = sellerProfiles?.reduce((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {} as Record<string, Profile>) || {};
        
        // Create potential trade proposals from liked items
        const potentialTrades = likedItemsData?.map(likedItem => {
          const item = likedItem.item;
          // Use the first available user item, or null if none available
          const userItem = userItems && userItems.length > 0 ? userItems[0] : null;
          // Get the seller profile
          const sellerProfile = sellerProfileMap[item.user_id] || { id: item.user_id, name: 'Item Owner' };
          
          return {
            id: `potential-${likedItem.id}`,
            proposer_id: user.id,
            receiver_id: item.user_id,
            offered_item_id: userItem ? userItem.id : '',
            requested_item_id: item.id,
            status: 'potential',
            created_at: likedItem.created_at,
            updated_at: likedItem.created_at,
            type: 'potential',
            date: likedItem.created_at,
            proposer: { id: user.id, name: 'You' },
            receiver: sellerProfile,
            offered_item: userItem,
            requested_item: item
          } as ExtendedTrade;
        }) || [];
        
        setTrades(potentialTrades);
        setLoading(false);
        return;
      }
      
      // Regular trade fetching for other filters
      let query = supabase
        .from('trades')
        .select(`
          *,
          proposer:proposer_id(*),
          receiver:receiver_id(*),
          offered_item:offered_item_id(*),
          requested_item:requested_item_id(*)
        `)
        .or(`proposer_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (activeFilter === 'sent') {
        query = query.eq('proposer_id', user.id);
      } else if (activeFilter === 'received') {
        query = query.eq('receiver_id', user.id);
      } else if (activeFilter !== 'all') {
        query = query.eq('status', activeFilter);
      }

      query = query.order('created_at', { ascending: false });
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      // Process the trades to add the type property
      const processedTrades = data?.map(trade => {
        const isProposer = trade.proposer_id === user.id;
        return {
          ...trade,
          type: isProposer ? 'sent' : 'received',
          date: trade.created_at,
          isProposer: isProposer
        };
      }) as ExtendedTrade[];
      
      setTrades(processedTrades);
    } catch (err) {
      console.error('Error fetching trades:', err);
      setError('Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTrade = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('trades')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setTrades(trades.map((trade) =>
        trade.id === id ? { ...trade, status: 'accepted' } : trade
      ));
      if (detailsVisible) {
        setTradeDetails({
          ...tradeDetails,
          trade: { ...tradeDetails.trade, status: 'accepted' } as ExtendedTrade,
        });
      }
      showToast('Trade accepted successfully!', 'success', 3000);
    } catch (err) {
      console.error('Error accepting trade:', err);
      showToast('Failed to accept trade', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTrade = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('trades')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setTrades(trades.map((trade) =>
        trade.id === id ? { ...trade, status: 'rejected' } : trade
      ));
      if (detailsVisible) {
        setTradeDetails({
          ...tradeDetails,
          trade: { ...tradeDetails.trade, status: 'rejected' } as ExtendedTrade,
        });
      }
      showToast('Trade rejected successfully!', 'success', 3000);
    } catch (err) {
      console.error('Error rejecting trade:', err);
      showToast('Failed to reject trade', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTrade = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('trades')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setTrades(trades.map((trade) =>
        trade.id === id ? { ...trade, status: 'canceled' } : trade
      ));
      if (detailsVisible) {
        setTradeDetails({
          ...tradeDetails,
          trade: { ...tradeDetails.trade, status: 'canceled' } as ExtendedTrade,
        });
      }
      showToast('Trade canceled successfully!', 'success', 3000);
      setDetailsVisible(false);
    } catch (err) {
      console.error('Error canceling trade:', err);
      showToast('Failed to cancel trade', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleAmendTrade = (trade: ExtendedTrade) => {
    // Close details modal
    setDetailsVisible(false);
    
    // Set up the propose modal with the existing trade data
    setProposingTrade(trade);
    setCashAmount(trade.cash_amount ? trade.cash_amount.toString() : '0');
    setProposeModalVisible(true);
  };

  const handleViewDetails = async (trade: ExtendedTrade) => {
    setSelectedTrade(trade);
    setDetailsVisible(true);
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          proposer:proposer_id(*),
          receiver:receiver_id(*),
          offered_item:offered_item_id(*),
          requested_item:requested_item_id(*)
        `)
        .eq('id', trade.id)
        .single();
      if (error) throw error;
      
      // Add the type property and isProposer flag to the trade object
      const isProposer = data.proposer_id === user?.id;
      const tradeWithType = {
        ...data,
        type: isProposer ? 'sent' : 'received',
        isProposer: isProposer
      };
      
      setTradeDetails({
        trade: tradeWithType as any,
        proposer: data.proposer as Profile,
        receiver: data.receiver as Profile,
        offeredItem: data.offered_item as Item,
        requestedItem: data.requested_item as Item,
      });
    } catch (err) {
      console.error('Error fetching trade details:', err);
      Alert.alert('Error', 'Failed to load trade details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredTrades = trades.filter((trade) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return trade.status === 'pending';
    if (activeFilter === 'completed') return trade.status === 'accepted';
    if (activeFilter === 'sent') return trade.type === 'sent';
    if (activeFilter === 'received') return trade.type === 'received';
    if (activeFilter === 'liked') return trade.type === 'potential';
    return true;
  });

  const handleProposeTrade = async (trade: ExtendedTrade) => {
    // Check if user has items to offer
    if (!trade.offered_item) {
      Alert.alert(
        'No Items Available',
        'You need to add items to your inventory before proposing a trade.',
        [
          { text: 'Add Items', onPress: () => router.push('/my-items') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    // Show the propose modal
    setProposingTrade(trade);
    setCashAmount('');
    setProposeModalVisible(true);
  };

  const submitTradeProposal = async () => {
    if (!proposingTrade) return;
    
    try {
      setLoading(true);
      
      // Parse cash amount
      const parsedCashAmount = cashAmount ? parseFloat(cashAmount) : null;
      
      // Create a real trade from the potential trade
      const { error } = await supabase
        .from('trades')
        .insert({
          proposer_id: user?.id,
          receiver_id: proposingTrade.receiver_id,
          offered_item_id: proposingTrade.offered_item_id,
          requested_item_id: proposingTrade.requested_item_id,
          cash_amount: parsedCashAmount,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      // Use toast instead of Alert
      showToast('Trade proposal sent!', 'success', 3000);
      
      // Close the modal
      setProposeModalVisible(false);
      // Refresh trades list
      fetchTrades();
    } catch (err) {
      console.error('Error proposing trade:', err);
      // Use toast instead of Alert
      showToast('Failed to propose trade', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const renderTradeItem = ({ item }: { item: ExtendedTrade }) => (
    <View style={styles.tradeCard}>
      <View style={styles.tradeHeader}>
        <View style={styles.userInfo}>
          {item.type === 'potential' ? (
            <>
              <TouchableOpacity onPress={() => navigateToChat(item)}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ 
                      uri: item.receiver?.avatar_url || getDefaultAvatar(item.receiver?.name)
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.chatIconOverlay}>
                    <MessageCircle color="#FFFFFF" size={14} />
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={styles.username}>
                {item.receiver?.name || 'Item Owner'}
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => navigateToChat(item)}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ 
                      uri: item.proposer_id === user?.id 
                        ? (profile?.avatar_url || getDefaultAvatar('You')) 
                        : (item.proposer?.avatar_url || getDefaultAvatar(item.proposer?.name))
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.chatIconOverlay}>
                    <MessageCircle color="#FFFFFF" size={14} />
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={styles.username}>
                {item.proposer_id === user?.id 
                  ? 'You → ' + (item.receiver?.name || 'Unknown') 
                  : (item.proposer?.name || 'Unknown') + ' → You'}
              </Text>
            </>
          )}
        </View>
        <View style={styles.statusContainer}>
          {item.type === 'potential' ? (
            <Text style={[styles.statusBadge, { backgroundColor: '#22C55E' }]}>
              Liked
            </Text>
          ) : (
            <Text
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === 'accepted' ? '#4CD964' :
                    item.status === 'rejected' ? '#FF3B30' :
                    item.status === 'canceled' ? '#FF6347' :
                    '#FF9500',
                },
              ]}
            >
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          )}
        </View>
      </View>
      {item.type === 'potential' ? (
        <View style={styles.likedItemContent}>
          <View style={styles.likedItem}>
            <View style={styles.likedItemImageContainer}>
              <Image
                source={{ uri: item.requested_item?.image_url || 'https://via.placeholder.com/200?text=No+Image' }}
                style={styles.likedItemImage}
              />
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>
                  {item.requested_item?.category || 'Other'}
                </Text>
              </View>
            </View>
            <Text style={styles.itemName}>{item.requested_item?.name || 'Unknown Item'}</Text>
            <Text style={styles.tradeDirection}>
              Liked item from {item.receiver?.name || 'Item Owner'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.tradeContent}>
          <View style={styles.tradeItem}>
            <Image
              source={{ uri: item.offered_item?.image_url || 'https://via.placeholder.com/200?text=No+Image' }}
              style={styles.itemImage}
            />
            <Text style={styles.itemName}>{item.offered_item?.name || 'Unknown Item'}</Text>
            <Text style={styles.tradeDirection}>
              {item.proposer_id === user?.id ? 'You Offered' : 'Offered to You'}
            </Text>
            {item.cash_amount && item.cash_amount > 0 && (
              <View style={styles.cashBadge}>
                <Text style={styles.cashText}>+{item.cash_amount.toLocaleString()} FCFA</Text>
              </View>
            )}
          </View>
          <View style={styles.tradeArrow}>
            <Repeat color="#999999" size={24} />
          </View>
          <View style={styles.tradeItem}>
            <Image
              source={{ uri: item.requested_item?.image_url || 'https://via.placeholder.com/200?text=No+Image' }}
              style={styles.itemImage}
            />
            <Text style={styles.itemName}>{item.requested_item?.name || 'Unknown Item'}</Text>
            <Text style={styles.tradeDirection}>
              {item.proposer_id === user?.id ? 'You Requested' : 'In Exchange For'}
            </Text>
          </View>
        </View>
      )}
      <View style={styles.tradeFooter}>
        <Text style={styles.tradeDate}>{formatDate(item.created_at)}</Text>
        {item.type === 'potential' ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.proposeButton]}
            onPress={() => handleProposeTrade(item)}
          >
            <Repeat color="#FFFFFF" size={16} />
            <Text style={styles.actionButtonText}>Propose Trade</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => handleViewDetails(item)}
          >
            <Info color="#FFFFFF" size={16} />
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

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
          <Text style={styles.headerTitle}>Trade Proposals</Text>
        </View>
      </LinearGradient>
      <SafeAreaView style={styles.contentContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.filterContainer}>
          <ScrollableFilter
            options={[
              { id: 'all', label: 'All' },
              { id: 'liked', label: 'Liked Items' },
              { id: 'pending', label: 'Pending' },
              { id: 'completed', label: 'Completed' },
              { id: 'sent', label: 'Sent' },
              { id: 'received', label: 'Received' },
            ]}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        </View>
        {loading ? (
          <LoadingIndicator size="medium" />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Info color="#FF3B30" size={48} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTrades}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredTrades.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LottieView
              source={require('../../assets/no-trades.json')} // Ensure this file exists in your assets
              autoPlay
              loop
              style={styles.lottieAnimation}
            />
            <Text style={styles.emptyTitle}>No Trade Proposals</Text>
            <Text style={styles.emptyText}>
              Start browsing items and propose trades to see them here
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTrades}
            renderItem={renderTradeItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={fetchTrades}
                colors={['#22C55E']}
              />
            }
          />
        )}
        <Modal
          animationType="slide"
          transparent={true}
          visible={proposeModalVisible}
          onRequestClose={() => setProposeModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Propose Trade</Text>
                <TouchableOpacity onPress={() => setProposeModalVisible(false)}>
                  <X color="#333333" size={24} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                {proposingTrade && (
                  <>
                    <View style={styles.tradeItems}>
                      <View style={styles.detailItemContainer}>
                        <Image
                          source={proposingTrade.offered_item?.image_url ? 
                            { uri: proposingTrade.offered_item.image_url } : 
                            { uri: 'https://via.placeholder.com/200?text=No+Image' }}
                          style={styles.detailItemImage}
                        />
                        <Text style={styles.detailItemName}>{proposingTrade.offered_item?.name}</Text>
                        <Text style={styles.detailItemLabel}>You offer</Text>
                      </View>
                      <View style={styles.detailItemContainer}>
                        <Image
                          source={proposingTrade.requested_item?.image_url ? 
                            { uri: proposingTrade.requested_item.image_url } : 
                            { uri: 'https://via.placeholder.com/200?text=No+Image' }}
                          style={styles.detailItemImage}
                        />
                        <Text style={styles.detailItemName}>{proposingTrade.requested_item?.name}</Text>
                        <Text style={styles.detailItemLabel}>You request</Text>
                      </View>
                    </View>
                    
                    <View style={styles.cashInputContainer}>
                      <Text style={styles.cashInputLabel}>Add Cash (optional):</Text>
                      <View style={styles.cashInputWrapper}>
                        <TextInput
                          style={styles.cashInput}
                          value={cashAmount}
                          onChangeText={setCashAmount}
                          placeholder="0"
                          keyboardType="numeric"
                          placeholderTextColor="#999999"
                        />
                        <Text style={styles.cashSuffix}>FCFA</Text>
                      </View>
                      <Text style={styles.cashInputHint}>
                        Adding cash can increase the chances of your trade being accepted
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={submitTradeProposal}
                    >
                      <Text style={styles.submitButtonText}>Send Proposal</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          animationType="slide"
          transparent={true}
          visible={detailsVisible}
          onRequestClose={() => setDetailsVisible(false)}
        >
          {selectedTrade && (
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Trade Details</Text>
                  <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                    <X color="#333333" size={24} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
                  <View style={styles.modalBody}>
                    <View style={styles.tradeParties}>
                      <View style={styles.tradeParty}>
                        <TouchableOpacity 
                          onPress={() => {
                            setDetailsVisible(false);
                            if (tradeDetails.trade && tradeDetails.proposer?.id !== user?.id) {
                              navigateToChat(tradeDetails.trade);
                            }
                          }}
                          disabled={tradeDetails.proposer?.id === user?.id}
                        >
                          <View style={styles.avatarContainer}>
                            <Image
                              source={{ 
                                uri: tradeDetails.proposer?.avatar_url || getDefaultAvatar(tradeDetails.proposer?.name) 
                              }}
                              style={[
                                styles.partyAvatar,
                                tradeDetails.proposer?.id === user?.id ? styles.disabledAvatar : {}
                              ]}
                            />
                            {tradeDetails.proposer?.id !== user?.id && (
                              <View style={styles.chatIconOverlay}>
                                <MessageCircle color="#FFFFFF" size={16} />
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        <Text style={styles.partyName}>
                          {tradeDetails.proposer?.id === user?.id ? 'You' : tradeDetails.proposer?.name}
                        </Text>
                        <Text style={styles.partyRole}>Proposer</Text>
                      </View>
                      <View style={styles.tradeDirectionContainer}>
                        <Text style={styles.tradeDirectionText}>⟷</Text>
                      </View>
                      <View style={styles.tradeParty}>
                        <TouchableOpacity 
                          onPress={() => {
                            setDetailsVisible(false);
                            if (tradeDetails.trade && tradeDetails.receiver?.id !== user?.id) {
                              navigateToChat(tradeDetails.trade);
                            }
                          }}
                          disabled={tradeDetails.receiver?.id === user?.id}
                        >
                          <View style={styles.avatarContainer}>
                            <Image
                              source={{ 
                                uri: tradeDetails.receiver?.id === user?.id 
                                  ? (profile?.avatar_url || getDefaultAvatar('You'))
                                  : (tradeDetails.receiver?.avatar_url || getDefaultAvatar(tradeDetails.receiver?.name))
                              }}
                              style={[
                                styles.partyAvatar,
                                tradeDetails.receiver?.id === user?.id ? styles.disabledAvatar : {}
                              ]}
                            />
                            {tradeDetails.receiver?.id !== user?.id && (
                              <View style={styles.chatIconOverlay}>
                                <MessageCircle color="#FFFFFF" size={16} />
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        <Text style={styles.partyName}>
                          {tradeDetails.receiver?.id === user?.id ? 'You' : tradeDetails.receiver?.name}
                        </Text>
                        <Text style={styles.partyRole}>Receiver</Text>
                      </View>
                    </View>
                    <View style={styles.tradeItems}>
                      <View style={styles.detailItemContainer}>
                        <Image
                          source={tradeDetails.offeredItem?.image_url ? 
                            { uri: tradeDetails.offeredItem.image_url } : 
                            { uri: 'https://via.placeholder.com/200?text=No+Image' }}
                          style={styles.detailItemImage}
                        />
                        <Text style={styles.detailItemName}>{tradeDetails.offeredItem?.name}</Text>
                        <Text style={styles.detailItemLabel}>
                          {tradeDetails.trade?.type === 'received' ? 'Offered to you' : 'You offered'}
                        </Text>
                        {tradeDetails.trade?.cash_amount && tradeDetails.trade.cash_amount > 0 && (
                          <View style={styles.detailCashBadge}>
                            <Text style={styles.detailCashText}>+{tradeDetails.trade.cash_amount.toLocaleString()} FCFA</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.detailItemContainer}>
                        <Image
                          source={tradeDetails.requestedItem?.image_url ? 
                            { uri: tradeDetails.requestedItem.image_url } : 
                            { uri: 'https://via.placeholder.com/200?text=No+Image' }}
                          style={styles.detailItemImage}
                        />
                        <Text style={styles.detailItemName}>{tradeDetails.requestedItem?.name}</Text>
                        <Text style={styles.detailItemLabel}>
                          {tradeDetails.trade?.type === 'received' ? 'You give' : 'You requested'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.tradeInfo}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Status:</Text>
                        <Text
                          style={[
                            styles.infoValue,
                            {
                              color:
                                tradeDetails.trade?.status === 'accepted' ? '#4CD964' :
                                tradeDetails.trade?.status === 'rejected' ? '#FF3B30' :
                                tradeDetails.trade?.status === 'canceled' ? '#FF6347' :
                                '#FF9500',
                            },
                          ]}
                        >
                          {tradeDetails.trade?.status ? 
                            tradeDetails.trade.status.charAt(0).toUpperCase() + tradeDetails.trade.status.slice(1) : 
                            'Pending'}
                        </Text>
                      </View>
                      {tradeDetails.trade?.cash_amount && tradeDetails.trade.cash_amount > 0 && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Cash Amount:</Text>
                          <Text style={[styles.infoValue, { color: '#22C55E' }]}>
                            {tradeDetails.trade.cash_amount.toLocaleString()} FCFA
                          </Text>
                        </View>
                      )}
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Proposed on:</Text>
                        <Text style={styles.infoValue}>{formatDate(tradeDetails.trade?.created_at)}</Text>
                      </View>
                    </View>
                    {tradeDetails.trade?.status === 'pending' && !tradeDetails.trade?.isProposer && (
                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={[styles.modalActionButton, styles.modalRejectButton]}
                          onPress={() => {
                            if (tradeDetails.trade?.id) {
                              handleRejectTrade(tradeDetails.trade.id);
                            }
                          }}
                        >
                          <X color="#FF3B30" size={20} />
                          <Text style={styles.modalRejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalActionButton, styles.modalAcceptButton]}
                          onPress={() => {
                            if (tradeDetails.trade?.id) {
                              handleAcceptTrade(tradeDetails.trade.id);
                            }
                          }}
                        >
                          <Check color="#FFFFFF" size={20} />
                          <Text style={styles.modalAcceptButtonText}>Accept</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {tradeDetails.trade?.status === 'pending' && tradeDetails.trade?.isProposer && (
                      <View style={styles.modalActions}>
                        <TouchableOpacity
                          style={[styles.modalActionButton, styles.modalRejectButton]}
                          onPress={() => {
                            if (tradeDetails.trade?.id) {
                              handleCancelTrade(tradeDetails.trade.id);
                            }
                          }}
                        >
                          <X color="#FF3B30" size={20} />
                          <Text style={styles.modalRejectButtonText}>Cancel Trade</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalActionButton, styles.modalAmendButton]}
                          onPress={() => {
                            if (tradeDetails.trade) {
                              handleAmendTrade(tradeDetails.trade as ExtendedTrade);
                            }
                          }}
                        >
                          <Edit2 color="#FFFFFF" size={20} />
                          <Text style={styles.modalAmendButtonText}>Amend Trade</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {tradeDetails.trade?.status === 'accepted' && (
                      <TouchableOpacity 
                        style={styles.modalMessageButton}
                        onPress={() => {
                          setDetailsVisible(false);
                          // Determine the chat partner based on who the user is in the trade
                          const isUserProposer = tradeDetails.trade?.proposer_id === user?.id;
                          const partnerId = isUserProposer ? tradeDetails.trade?.receiver_id : tradeDetails.trade?.proposer_id;
                          const partnerName = isUserProposer ? tradeDetails.receiver?.name : tradeDetails.proposer?.name;
                          
                          if (tradeDetails.trade) {
                            // Create a formal message with trade details
                            let tradeDetailsMessage = "Regarding our accepted trade: ";
                            
                            const userOfferedItem = isUserProposer ? tradeDetails.offeredItem : tradeDetails.requestedItem;
                            const userRequestedItem = isUserProposer ? tradeDetails.requestedItem : tradeDetails.offeredItem;
                            
                            if (userOfferedItem?.name && userRequestedItem?.name) {
                              tradeDetailsMessage += `I traded my ${userOfferedItem.name}`;
                              
                              // Add cash amount if it exists and the user is the one offering cash
                              if (tradeDetails.trade.cash_amount && tradeDetails.trade.cash_amount > 0 && isUserProposer) {
                                tradeDetailsMessage += ` with an additional ${tradeDetails.trade.cash_amount.toLocaleString()} FCFA`;
                              }
                              
                              tradeDetailsMessage += ` for your ${userRequestedItem.name}`;
                              
                              // Add cash amount if it exists and the user is the one receiving cash
                              if (tradeDetails.trade.cash_amount && tradeDetails.trade.cash_amount > 0 && !isUserProposer) {
                                tradeDetailsMessage += ` with an additional ${tradeDetails.trade.cash_amount.toLocaleString()} FCFA from you`;
                              }
                            }
                            
                            tradeDetailsMessage += ". Let's coordinate the exchange.";
                            
                            // Navigate to chat screen with partner ID, initial message, and trade ID only
                            router.push({
                              pathname: '/chat',
                              params: {
                                partnerId,
                                partnerName,
                                initialMessage: tradeDetailsMessage,
                                tradeId: tradeDetails.trade.id
                              }
                            });
                          }
                        }}
                      >
                        <MessageCircle color="#FFFFFF" size={20} />
                        <Text style={styles.modalMessageText}>
                          Message {tradeDetails.trade?.proposer_id === user?.id ? tradeDetails.receiver?.name : tradeDetails.proposer?.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function ScrollableFilter({ 
  options, 
  activeFilter, 
  onFilterChange 
}: { 
  options: FilterOption[]; 
  activeFilter: string; 
  onFilterChange: (filter: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterScroll}
    >
      {options.map((option: FilterOption) => (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.filterOption,
            activeFilter === option.id && styles.activeFilterOption,
          ]}
          onPress={() => onFilterChange(option.id)}
        >
          <Text
            style={[
              styles.filterText,
              activeFilter === option.id && styles.activeFilterText,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#F2F2F7',
  },
  activeFilterOption: {
    backgroundColor: '#22C55E',
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    padding: 20,
  },
  tradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  statusContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tradeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  tradeItem: {
    alignItems: 'center',
    width: '40%',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  tradeDirection: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  tradeArrow: {
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  tradeDate: {
    fontSize: 14,
    color: '#666666',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lottieAnimation: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalBody: {
    paddingBottom: 10,
  },
  modalScrollView: {
    flexGrow: 0,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  tradeParties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  tradeParty: {
    alignItems: 'center',
    width: '40%',
  },
  partyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  partyRole: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  tradeDirectionContainer: {
    width: '20%',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
  },
  tradeDirectionText: {
    fontSize: 24,
    color: '#666666',
  },
  tradeItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  detailItemContainer: {
    alignItems: 'center',
    width: '48%',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
  },
  detailItemImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  detailItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  detailItemLabel: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
  },
  tradeInfo: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalRejectButton: {
    backgroundColor: '#F9F9F9',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  modalRejectButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalAcceptButton: {
    backgroundColor: '#22C55E',
    marginLeft: 10,
  },
  modalAcceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalMessageButton: {
    backgroundColor: '#FF9500',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
  },
  modalMessageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailCashBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  detailCashText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  proposeButton: {
    backgroundColor: '#FF9500',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  cashBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  cashText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cashInputContainer: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  cashInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  cashInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    height: 50,
  },
  cashSuffix: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 4,
    fontWeight: '500',
  },
  cashInput: {
    flex: 1,
    fontSize: 18,
    color: '#333333',
    height: 50,
    textAlign: 'right',
    paddingRight: 8,
  },
  cashInputHint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAmendButton: {
    backgroundColor: '#22C55E',
    marginLeft: 10,
  },
  modalAmendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledAvatar: {
    opacity: 0.7,
  },
  avatarContainer: {
    position: 'relative',
  },
  chatIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  likedItemContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedItem: {
    alignItems: 'center',
    width: '80%',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#22C55E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  likedItemImage: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  likedItemImageContainer: {
    position: 'relative',
  },
  categoryPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
});