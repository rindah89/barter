import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
// Assuming you have a way to get the Supabase client, e.g., a hook or context
import { useSupabaseClient } from '@/hooks/useSupabaseClient'; // Adjust the import path as needed
import { Database } from '@/database.types'; // Assuming types are generated here
import { Lightbulb } from 'lucide-react-native'; // Import an icon
import { useRouter } from 'expo-router'; // Import router

// Re-define or import the type for clarity
interface SuggestedTrade {
  user_a_id: string;
  user_a_name: string | null;
  user_a_avatar: string | null;
  item_a_id: string;
  item_a_name: string;
  item_a_image: string | null;
  user_b_id: string;
  user_b_name: string | null;
  user_b_avatar: string | null;
  item_b_id: string;
  item_b_name: string;
  item_b_image: string | null;
  user_c_id: string;
  user_c_name: string | null;
  user_c_avatar: string | null;
  item_c_id: string;
  item_c_name: string;
  item_c_image: string | null;
}

// Skeleton Component for loading state
const SuggestionSkeleton: React.FC = () => {
  return (
    <View style={styles.skeletonCard}>
      {/* Mimic Card Title */}
      <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
      {/* Mimic Items Container */}
      <View style={styles.skeletonItemsContainer}>
        {/* Mimic Item */}
        <View style={styles.skeletonItem}>
          <View style={[styles.skeletonBlock, styles.skeletonImage]} />
          <View style={[styles.skeletonBlock, styles.skeletonTextShort]} />
          <View style={[styles.skeletonBlock, styles.skeletonTextLong]} />
        </View>
        {/* Mimic Arrow (optional, or just space) */}
        {/* Mimic Item */}
        <View style={styles.skeletonItem}>
          <View style={[styles.skeletonBlock, styles.skeletonImage]} />
          <View style={[styles.skeletonBlock, styles.skeletonTextShort]} />
          <View style={[styles.skeletonBlock, styles.skeletonTextLong]} />
        </View>
        {/* Mimic Arrow (optional) */}
        {/* Mimic Item */}
        <View style={styles.skeletonItem}>
          <View style={[styles.skeletonBlock, styles.skeletonImage]} />
          <View style={[styles.skeletonBlock, styles.skeletonTextShort]} />
          <View style={[styles.skeletonBlock, styles.skeletonTextLong]} />
        </View>
      </View>
       {/* Mimic Button */}
      <View style={[styles.skeletonBlock, styles.skeletonButton]} />
    </View>
  );
};

const SuggestedTrades: React.FC = () => {
  const supabase = useSupabaseClient(); // Get Supabase client
  const router = useRouter(); // Get router instance
  const [suggestions, setSuggestions] = useState<SuggestedTrade[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!supabase) {
        setError('Supabase client not available');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Invoke the Supabase Edge Function
        const { data, error: functionError } = await supabase.functions.invoke('suggested-trades');

        if (functionError) {
          throw functionError;
        }

        if (data && Array.isArray(data)) {
           setSuggestions(data as SuggestedTrade[]);
        } else {
           console.warn('Received unexpected data format from suggested-trades function:', data);
           setSuggestions([]); // Set empty if format is wrong
        }

      } catch (err: any) {
        console.error('Error fetching suggested trades:', err);
        setError(err.message || 'Failed to fetch suggestions.');
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [supabase]); // Re-run if supabase client instance changes

  // --- Handle Navigation --- 
  const handleViewDetails = (suggestion: SuggestedTrade) => {
    // Navigate to a details screen, passing necessary IDs
    // Encode data if necessary, but simple IDs are usually fine
    router.push({
      pathname: '/suggested-trade-details', // Correct path relative to app directory
      params: { 
        item_a_id: suggestion.item_a_id,
        item_b_id: suggestion.item_b_id,
        item_c_id: suggestion.item_c_id,
        user_b_id: suggestion.user_b_id,
        user_c_id: suggestion.user_c_id,
        // Optionally pass other simple data if needed directly
        item_a_name: suggestion.item_a_name,
        item_a_image: suggestion.item_a_image,
        item_b_name: suggestion.item_b_name,
        item_b_image: suggestion.item_b_image,
        item_c_name: suggestion.item_c_name,
        item_c_image: suggestion.item_c_image,
        user_b_name: suggestion.user_b_name,
        user_b_avatar: suggestion.user_b_avatar,
        user_c_name: suggestion.user_c_name,
        user_c_avatar: suggestion.user_c_avatar,
      } 
    });
  };

  const renderSuggestion = ({ item }: { item: SuggestedTrade }) => (
    <View style={styles.suggestionCard}>
       <Text style={styles.cardTitle}>Potential 3-Way Trade!</Text>
      <View style={styles.itemsContainer}>
        {/* Item A (Your Item) */}
        <View style={styles.item}>
          <Image source={{ uri: item.item_a_image ?? undefined }} style={styles.itemImage} />
          <Text style={styles.itemOwner}>You Offer</Text>
          <Text numberOfLines={1} style={styles.itemName}>{item.item_a_name}</Text>
        </View>

        <Text style={styles.arrow}>→</Text>

        {/* Item B (User B's Item) */}
         <View style={styles.item}>
          <Image source={{ uri: item.item_b_image ?? undefined }} style={styles.itemImage} />
           <Text style={styles.itemOwner}>{item.user_b_name || 'User'}</Text>
          <Text numberOfLines={1} style={styles.itemName}>{item.item_b_name}</Text>
        </View>

        <Text style={styles.arrow}>→</Text>

        {/* Item C (User C's Item) */}
        <View style={styles.item}>
          <Image source={{ uri: item.item_c_image ?? undefined }} style={styles.itemImage} />
           <Text style={styles.itemOwner}>{item.user_c_name || 'User'}</Text>
          <Text numberOfLines={1} style={styles.itemName}>{item.item_c_name}</Text>
        </View>
      </View>
      {/* Updated Button */}
       <TouchableOpacity 
         style={styles.viewButton}
         onPress={() => handleViewDetails(item)} // Add onPress handler
       >
          <Text style={styles.viewButtonText}>View Details & Discuss</Text> // Update text
       </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Suggested Trades For You</Text>
        <View style={styles.skeletonContainer}> 
          <SuggestionSkeleton />
          {/* Optionally render a second skeleton for visual balance */}
          <SuggestionSkeleton />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

   if (suggestions.length === 0) {
    // Render improved empty state
    return (
       <View style={styles.emptyContainer}>
         <Lightbulb color="#FFFFFF" size={48} />
         <Text style={styles.emptyTitle}>No Suggestions Yet</Text>
         <Text style={styles.emptyText}>
            Like more items you're interested in! The more you like, the better we can suggest potential trades for you.
         </Text>
       </View>
    );
   }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suggested Trades For You</Text>
      <FlatList
        data={suggestions}
        renderItem={renderSuggestion}
        keyExtractor={(item, index) => `${item.item_a_id}-${item.item_b_id}-${item.item_c_id}-${index}`} // Composite key
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContentContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 15,
    marginBottom: 20, // Increased bottom margin
  },
   listContentContainer: {
    paddingHorizontal: 10,
    minHeight: 150, // Ensure the container has some height even when empty
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 15, // Align with typical content indentation
  },
  suggestionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginRight: 15, // Spacing between cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
     minWidth: 300, // Ensure card has some width
  },
  cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 10,
      textAlign: 'center',
  },
  itemsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 15,
  },
  item: {
    alignItems: 'center',
    maxWidth: 80, // Limit width for each item column
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 5,
    backgroundColor: '#eee', // Placeholder background
    marginBottom: 5,
  },
   itemOwner: {
      fontSize: 12,
      color: '#555',
      fontWeight: '500',
   },
  itemName: {
    fontSize: 12,
    textAlign: 'center',
  },
  arrow: {
    fontSize: 20,
    fontWeight: 'bold',
     marginHorizontal: 5,
  },
   viewButton: {
      backgroundColor: '#007bff', // Example button color
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 5,
      alignSelf: 'center', // Center the button
   },
   viewButtonText: {
      color: '#fff',
      fontWeight: 'bold',
   },
  errorText: {
    color: 'red',
    textAlign: 'center',
    padding: 20,
  },
  // Styles for the improved empty state
  emptyContainer: {
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
    marginHorizontal: 15,
    backgroundColor: '#22C55E', // Green background
    borderRadius: 8,
    marginBottom: 20, // Add margin directly to the empty container
    // Remove border as background provides contrast
    // borderWidth: 1,
    // borderColor: '#e5e7eb',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF', // White text
    marginTop: 15,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#FFFFFF', // White text
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.9, // Slightly transparent white for subtlety
  },
  // --- Skeleton Styles --- 
  skeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10, // Match list padding
  },
  skeletonCard: {
    backgroundColor: '#e5e7eb', // Lighter grey for skeleton base
    borderRadius: 8,
    padding: 15,
    marginRight: 15,
    minWidth: 300,
    height: 180, // Approximate height of a suggestion card
    overflow: 'hidden', // Hide overflow if blocks are slightly off
  },
  skeletonBlock: {
    backgroundColor: '#d1d5db', // Darker grey for blocks
    borderRadius: 4,
  },
  skeletonTitle: {
    height: 20,
    width: '60%',
    marginBottom: 15,
    alignSelf: 'center',
  },
  skeletonItemsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
  },
  skeletonItem: {
    alignItems: 'center',
    maxWidth: 80,
  },
  skeletonImage: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  skeletonTextShort: {
    height: 12,
    width: '70%',
    marginBottom: 5,
  },
  skeletonTextLong: {
    height: 12,
    width: '90%',
  },
  skeletonButton: {
    height: 34, // Match button height approx
    width: '40%',
    alignSelf: 'center',
    marginTop: 5, // Adjust spacing
  },
});

export default SuggestedTrades; 