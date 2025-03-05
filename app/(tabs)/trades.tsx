import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, MessageCircle, Info, Repeat } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Trade, Item, Profile } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { getDefaultAvatar } from '../../lib/useDefaultAvatar';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

// Define extended Trade type with additional properties used in the component
interface ExtendedTrade extends Trade {
  type?: 'sent' | 'received';
  date?: string;
  proposer?: Profile;
  receiver?: Profile;
  offered_item?: Item;
  requested_item?: Item;
}

// Define filter option type
interface FilterOption {
  id: string;
  label: string;
}

export default function TradesScreen() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<ExtendedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState<ExtendedTrade | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
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

  useEffect(() => {
    if (user) {
      fetchTrades();
    }
  }, [user, activeFilter]);

  const fetchTrades = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
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

      if (activeFilter !== 'all') {
        query = query.eq('status', activeFilter);
      }

      query = query.order('created_at', { ascending: false });
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      // Process the trades to add the type property
      const processedTrades = data?.map(trade => ({
        ...trade,
        type: trade.proposer_id === user.id ? 'sent' : 'received',
        date: trade.created_at
      })) as ExtendedTrade[];
      
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
      Alert.alert('Success', 'Trade accepted successfully!');
    } catch (err) {
      console.error('Error accepting trade:', err);
      Alert.alert('Error', 'Failed to accept trade');
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
      Alert.alert('Success', 'Trade rejected successfully!');
    } catch (err) {
      console.error('Error rejecting trade:', err);
      Alert.alert('Error', 'Failed to reject trade');
    } finally {
      setLoading(false);
    }
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
      setTradeDetails({
        trade: data as any,
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
    return true;
  });

  const renderTradeItem = ({ item }: { item: ExtendedTrade }) => (
    <View style={styles.tradeCard}>
      <View style={styles.tradeHeader}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: item.proposer_id === user?.id ? getDefaultAvatar('You') : getDefaultAvatar(item.receiver?.name) }}
            style={styles.avatar}
          />
          <Text style={styles.username}>
            {item.proposer_id === user?.id ? 'You → ' + (item.receiver?.name || 'Unknown') : (item.proposer?.name || 'Unknown') + ' → You'}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <Text
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === 'accepted' ? '#4CD964' :
                  item.status === 'rejected' ? '#FF3B30' :
                  '#FF9500',
              },
            ]}
          >
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
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
      <View style={styles.tradeFooter}>
        <Text style={styles.tradeDate}>{formatDate(item.created_at)}</Text>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => handleViewDetails(item)}
        >
          <Info color="#007AFF" size={16} />
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>
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
          <ActivityIndicator size="large" color="#22C55E" />
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
                <View style={styles.modalBody}>
                  <View style={styles.tradeParties}>
                    <View style={styles.tradeParty}>
                      <Image
                        source={{ uri: getDefaultAvatar(tradeDetails.proposer?.name) }}
                        style={styles.partyAvatar}
                      />
                      <Text style={styles.partyName}>{tradeDetails.proposer?.name}</Text>
                    </View>
                    <View style={styles.tradeDirectionContainer}>
                      <Text style={styles.tradeDirectionText}>⟷</Text>
                    </View>
                    <View style={styles.tradeParty}>
                      <Image
                        source={{ uri: getDefaultAvatar('You') }}
                        style={styles.partyAvatar}
                      />
                      <Text style={styles.partyName}>You</Text>
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
                              '#FF9500',
                          },
                        ]}
                      >
                        {tradeDetails.trade?.status ? 
                          tradeDetails.trade.status.charAt(0).toUpperCase() + tradeDetails.trade.status.slice(1) : 
                          'Pending'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Proposed on:</Text>
                      <Text style={styles.infoValue}>{formatDate(tradeDetails.trade?.created_at)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Trade ID:</Text>
                      <Text style={styles.infoValue}>{tradeDetails.trade?.id}</Text>
                    </View>
                  </View>
                  {tradeDetails.trade?.status === 'pending' && tradeDetails.trade?.type === 'received' && (
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
                  {tradeDetails.trade?.status === 'accepted' && (
                    <TouchableOpacity style={styles.modalMessageButton}>
                      <MessageCircle color="#FFFFFF" size={20} />
                      <Text style={styles.modalMessageText}>Message {tradeDetails.proposer?.name}</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  statusContainer: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  tradeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  tradeItem: {
    alignItems: 'center',
    width: '40%',
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 12,
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
    color: '#999999',
    textAlign: 'center',
  },
  tradeArrow: {
    alignItems: 'center',
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tradeDate: {
    fontSize: 14,
    color: '#999999',
  },
  detailsButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#22C55E',
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalBody: {
    paddingBottom: 20,
  },
  tradeParties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  tradeDirectionContainer: {
    width: '20%',
    alignItems: 'center',
  },
  tradeDirectionText: {
    fontSize: 24,
    color: '#999999',
  },
  tradeItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  },
  detailItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  detailItemLabel: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 4,
  },
  tradeInfo: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    marginTop: 20,
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
    backgroundColor: '#22C55E',
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
});